-- Additive daily operations. No reseeding, provider activation or historical rewrites.
create table private.staff_shifts (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.profiles,
 branch_id uuid references public.branches, clocked_in_at timestamptz not null default clock_timestamp(),
 clocked_out_at timestamptz, revision bigint not null default 0,
 check(clocked_out_at is null or clocked_out_at>=clocked_in_at)
);
create unique index one_open_staff_shift on private.staff_shifts(employee_id) where clocked_out_at is null;
create table private.student_arrivals (
 id uuid primary key default gen_random_uuid(), roster_id uuid not null unique references public.session_roster,
 recorded_at timestamptz not null default clock_timestamp(), actor_id uuid not null references public.profiles,
 source text not null check(source in ('check_in','finalization','correction'))
);
create table private.delivery_starts (
 id uuid primary key default gen_random_uuid(), session_id uuid not null unique references public.class_sessions,
 coach_id uuid not null references public.profiles, actor_id uuid not null references public.profiles,
 shift_id uuid references private.staff_shifts, reason text, started_at timestamptz not null default clock_timestamp()
);
create table private.staff_salary_agreements (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.profiles,
 effective_from date not null, effective_to date not null, amount_minor bigint not null check(amount_minor>0 and amount_minor<=1000000000),
 allocations jsonb not null, created_by uuid not null references public.profiles, created_at timestamptz not null default now(),
 check(effective_to>effective_from)
);
create table private.cost_obligations (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('expense','salary')),
 branch_id uuid references public.branches, employee_id uuid references public.profiles,
 agreement_id uuid references private.staff_salary_agreements, period_start date, cost_date date not null,
 title text not null check(length(trim(title)) between 2 and 150), category text not null check(length(trim(category)) between 2 and 80),
 evidence text not null default '' check(length(evidence)<=1000), amount_minor bigint not null check(amount_minor>0 and amount_minor<=1000000000),
 adjustment_minor bigint not null default 0, adjustment_reason text,
 allocations jsonb not null, status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','part_paid','paid')),
 revision bigint not null default 0, created_by uuid not null references public.profiles, reviewed_by uuid references public.profiles,
 review_reason text, created_at timestamptz not null default now(),
 unique(employee_id,period_start), check(amount_minor+adjustment_minor>0),
 check((kind='salary' and employee_id is not null and agreement_id is not null and period_start is not null) or (kind='expense' and employee_id is null and agreement_id is null and period_start is null))
);
create table private.cost_payouts (
 id uuid primary key default gen_random_uuid(), obligation_id uuid not null references private.cost_obligations,
 amount_minor bigint not null check(amount_minor<>0), method text not null check(method in ('cash','bank','card')),
 reference text not null unique check(length(trim(reference)) between 3 and 100), paid_on date not null,
 recorded_by uuid not null references public.profiles, allocations jsonb not null, reversal_of uuid unique references private.cost_payouts, created_at timestamptz not null default now()
);
create table private.daily_requests (
 actor_id uuid not null references public.profiles, key uuid not null, fingerprint text not null, access_hash text not null,
 response jsonb not null, primary key(actor_id,key)
);
create table private.daily_history (
 id uuid primary key default gen_random_uuid(), entity text not null, record_id uuid not null, actor_id uuid references public.profiles,
 action text not null, before_value jsonb, after_value jsonb, reason text, created_at timestamptz not null default now()
);
create function private.daily_audit() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into private.daily_history(entity,record_id,actor_id,action,before_value,after_value,reason)
 values(tg_table_name,new.id,auth.uid(),tg_op,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new),nullif(current_setting('kafou.action_reason',true),''));
 insert into public.audit_events(actor_id,action,entity,entity_id) values(auth.uid(),tg_op,tg_table_name,new.id::text);
 return new;end $$;
create function private.daily_staff() returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and private.has_role(array['super_admin','admin','branch','coach','sales']::public.academy_role[])
$$;
create function private.daily_location(b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.daily_staff() and (private.head_office() or exists(select 1 from public.branch_permissions where user_id=auth.uid() and branch_id=b))
$$;
-- A global explicit grant can support Accounts users without granting the admin role.
create function private.daily_can(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select private.daily_staff() and (private.super_admin() or exists(select 1 from public.product_permissions where user_id=auth.uid() and permission=p_permission and branch_id is null))
$$;
create function private.daily_allocations(p_value jsonb,p_amount bigint) returns void language plpgsql security definer set search_path='' as $$begin
 if jsonb_typeof(p_value) is distinct from 'array' or jsonb_array_length(p_value) not between 1 and 100 then raise exception 'Specify cost allocations' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_value) x where (x->>'amount_minor')::bigint<=0 or (nullif(x->>'branch_id','') is not null and not exists(select 1 from public.branches where id=(x->>'branch_id')::uuid)))
 or (select sum((x->>'amount_minor')::bigint) from jsonb_array_elements(p_value) x) is distinct from p_amount
 or (select count(*) from jsonb_array_elements(p_value))<>(select count(distinct coalesce(nullif(x->>'branch_id',''),'central')) from jsonb_array_elements(p_value) x)
 then raise exception 'Allocations must match the amount with one entry per cost centre' using errcode='22023';end if;
end $$;
create function private.daily_cost_visible(c private.cost_obligations) returns boolean language sql stable security definer set search_path='' as $$
 select private.daily_staff() and case when c.kind='salary' then c.employee_id=auth.uid() or private.daily_can('accounts.payroll')
 else private.daily_can('accounts.expenses') or (c.branch_id is not null and private.operations_staff(c.branch_id)) end
$$;
create function public.daily_command(p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.daily_requests; sh private.staff_shifts; c private.cost_obligations; ag private.staff_salary_agreements;
 s public.class_sessions; cl public.academy_classes; r public.session_roster; ds private.delivery_starts; payment private.cost_payouts;
 b uuid:=nullif(p_data->>'branch_id','')::uuid; rid uuid:=nullif(p_data->>'id','')::uuid; employee uuid;
 result jsonb; fp text; paid bigint; amt bigint; v_allocations jsonb; dt date; why text:=trim(coalesce(p_data->>'reason',''));
begin
 perform private.require_access(private.daily_staff());
 if p_key is null or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>24000 then raise exception 'Invalid daily command' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 perform set_config('kafou.action_reason',why,true);
 fp:=md5(p_action||p_data::text);
 -- Cached outcomes are also invalidated when the actor's grants or assignments change.
 select * into old from private.daily_requests where actor_id=auth.uid() and key=p_key;
 if found then
  if old.access_hash is distinct from private.product_access_revision() then raise exception 'Access changed; reload this workspace' using errcode='42501';end if;
  if old.fingerprint<>fp then raise exception 'Retry does not match original action' using errcode='P0409';end if;
  return old.response;
 end if;
 if p_action='shift.in' then
  perform private.require_access((b is null and (private.head_office() or private.daily_can('accounts.payroll') or private.daily_can('accounts.expenses') or private.daily_can('accounts.timekeeping'))) or (b is not null and private.daily_location(b)));
  select * into sh from private.staff_shifts where employee_id=auth.uid() and clocked_out_at is null;
  if found then
   if sh.branch_id is distinct from b then raise exception 'Clock out of your current location first' using errcode='P0409';end if;rid:=sh.id;
  else insert into private.staff_shifts(employee_id,branch_id) values(auth.uid(),b) returning id into rid;end if;
 elsif p_action='shift.out' then
  select * into sh from private.staff_shifts where id=rid for update;
  perform private.require_access(sh.employee_id=auth.uid());
  if sh.clocked_out_at is null then update private.staff_shifts set clocked_out_at=clock_timestamp(),revision=revision+1 where id=rid;end if;
 elsif p_action='shift.correct' then
  perform private.require_access(private.daily_can('accounts.timekeeping'));
  select * into sh from private.staff_shifts where id=rid for update;
  if sh.id is null or sh.revision is distinct from (p_data->>'revision')::bigint then raise exception 'Record changed; reload before saving' using errcode='P0409';end if;
  if length(why)<5 or (p_data->>'clocked_out_at')::timestamptz is null or (p_data->>'clocked_out_at')::timestamptz>now() or (p_data->>'clocked_in_at')::timestamptz is null then raise exception 'Provide valid times and a correction reason' using errcode='22023';end if;
  update private.staff_shifts set clocked_in_at=(p_data->>'clocked_in_at')::timestamptz,clocked_out_at=(p_data->>'clocked_out_at')::timestamptz,revision=revision+1 where id=rid;
 elsif p_action='session.start' then
  select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;
  select * into cl from public.academy_classes where id=s.class_id;
  perform private.require_access(private.attendance_access(s.id));
  if s.status<>'scheduled' or s.delivered_at is not null then raise exception 'This session cannot be started' using errcode='P0409';end if;
  select * into ds from private.delivery_starts where session_id=s.id;
  if found then rid:=ds.id;else
   select coalesce((select coach_id from public.coach_substitutions where session_id=s.id and revoked_at is null order by created_at desc limit 1),cl.coach_id) into employee;
   select * into sh from private.staff_shifts where employee_id=employee and branch_id=cl.branch_id and clocked_out_at is null;
   if employee=auth.uid() then
    if sh.id is null then raise exception 'Clock in at this branch before starting the session' using errcode='P0409';end if;
   else
    perform private.require_access(private.operations_staff(cl.branch_id));
    if length(why)<5 then raise exception 'Record a reason for starting on behalf of the coach' using errcode='22023';end if;
   end if;
   insert into private.delivery_starts(session_id,coach_id,actor_id,shift_id,reason) values(s.id,employee,auth.uid(),sh.id,nullif(why,'')) returning id into rid;
  end if;
 elsif p_action='student.arrive' then
  select * into r from public.session_roster where id=rid;
  perform private.require_access(private.attendance_access(r.session_id,true));
  if r.cancelled or exists(select 1 from public.class_sessions where id=r.session_id and (status<>'scheduled' or finalized_at is not null)) then raise exception 'Attendance is locked' using errcode='P0409';end if;
  if (public.attendance_register(r.session_id)->>'revision')::bigint is distinct from (p_data->>'revision')::bigint then raise exception 'Record changed; reload before saving' using errcode='P0409';end if;
  if coalesce((select marks->>r.id::text from private.attendance_drafts where session_id=r.session_id),'') not in ('','present') then raise exception 'Review the existing attendance decision first' using errcode='P0409';end if;
  insert into private.student_arrivals(roster_id,actor_id,source) values(r.id,auth.uid(),'check_in') on conflict(roster_id) do nothing;
  insert into private.attendance_drafts(session_id,marks,revision,updated_by) values(r.session_id,jsonb_build_object(r.id::text,'present'),1,auth.uid())
   on conflict(session_id) do update set marks=attendance_drafts.marks||excluded.marks,revision=attendance_drafts.revision+1,updated_at=clock_timestamp(),updated_by=auth.uid();
 elsif p_action='expense.save' then
  perform private.require_access(private.daily_can('accounts.expenses') or (b is not null and private.operations_staff(b)));
  amt:=(p_data->>'amount_minor')::bigint;
  v_allocations:=jsonb_build_array(jsonb_build_object('branch_id',b,'amount_minor',amt));
  if rid is null then
   insert into private.cost_obligations(kind,branch_id,cost_date,title,category,evidence,amount_minor,allocations,created_by)
    values('expense',b,(p_data->>'cost_date')::date,trim(p_data->>'title'),trim(p_data->>'category'),coalesce(p_data->>'evidence',''),amt,v_allocations,auth.uid()) returning id into rid;
  else
   select * into c from private.cost_obligations where id=rid for update;
   perform private.require_access(c.kind='expense' and c.branch_id is not distinct from b and private.daily_cost_visible(c));
   if c.status not in ('draft','rejected') or c.revision is distinct from (p_data->>'revision')::bigint then raise exception 'Record changed; reload before saving' using errcode='P0409';end if;
   update private.cost_obligations set cost_date=(p_data->>'cost_date')::date,title=trim(p_data->>'title'),category=trim(p_data->>'category'),evidence=coalesce(p_data->>'evidence',''),amount_minor=amt,allocations=v_allocations,status='draft',revision=revision+1 where id=rid;
  end if;
 elsif p_action='salary.agreement' then
  perform private.require_access(private.daily_can('accounts.payroll'));
  employee:=(p_data->>'employee_id')::uuid;
  if not exists(select 1 from public.profiles p join public.role_assignments ra on ra.user_id=p.id where p.id=employee and p.active and ra.role in ('admin','super_admin','branch','sales')) or exists(select 1 from public.role_assignments where user_id=employee and role='coach') then raise exception 'Use coach compensation for coaches; choose an active employee' using errcode='22023';end if;
  amt:=(p_data->>'amount_minor')::bigint;v_allocations:=p_data->'allocations';perform private.daily_allocations(v_allocations,amt);
  if exists(select 1 from private.staff_salary_agreements where employee_id=employee and daterange(effective_from,effective_to,'[)') && daterange((p_data->>'effective_from')::date,(p_data->>'effective_to')::date,'[)')) then raise exception 'Salary agreement dates overlap' using errcode='P0409';end if;
  insert into private.staff_salary_agreements(employee_id,effective_from,effective_to,amount_minor,allocations,created_by) values(employee,(p_data->>'effective_from')::date,(p_data->>'effective_to')::date,amt,v_allocations,auth.uid()) returning id into rid;
 elsif p_action='salary.end' then
  perform private.require_access(private.daily_can('accounts.payroll'));
  select * into ag from private.staff_salary_agreements where id=rid for update;
  dt:=(p_data->>'effective_to')::date;
  if ag.id is null or dt is null or dt<=ag.effective_from or dt>=ag.effective_to or length(why)<5 or exists(select 1 from private.cost_obligations where agreement_id=ag.id and period_start+interval '1 month'>dt) then raise exception 'End date must preserve every drafted pay period' using errcode='P0409';end if;
  update private.staff_salary_agreements set effective_to=dt where id=rid;
 elsif p_action='salary.draft' then
  perform private.require_access(private.daily_can('accounts.payroll'));
  select * into ag from private.staff_salary_agreements where id=(p_data->>'agreement_id')::uuid;
  dt:=(p_data->>'period_start')::date;
  if ag.id is null or dt<>date_trunc('month',dt)::date or ag.effective_from>dt or ag.effective_to<dt+interval '1 month' then raise exception 'Choose an agreement covering the full month; partial months require review' using errcode='22023';end if;
  select id into rid from private.cost_obligations where employee_id=ag.employee_id and period_start=dt;
  if rid is null then
   insert into private.cost_obligations(kind,employee_id,agreement_id,period_start,cost_date,title,category,amount_minor,allocations,created_by)
    values('salary',ag.employee_id,ag.id,dt,dt,'Monthly salary','Salary',ag.amount_minor,ag.allocations,auth.uid()) returning id into rid;
  end if;
 elsif p_action in ('cost.submit','cost.review','cost.adjust','cost.pay','cost.reverse') then
  select * into c from private.cost_obligations where id=rid for update;
  perform private.require_access(c.id is not null and private.daily_cost_visible(c));
  if p_action<>'cost.submit' or c.kind='salary' then perform private.require_access(private.daily_can(case when c.kind='salary' then 'accounts.payroll' else 'accounts.expenses' end));end if;
  if c.revision is distinct from (p_data->>'revision')::bigint then raise exception 'Record changed; reload before saving' using errcode='P0409';end if;
  if p_action='cost.submit' then
   if c.status<>'draft' then raise exception 'Only drafts can be submitted' using errcode='P0409';end if;
   update private.cost_obligations set status='submitted',revision=revision+1 where id=rid;
  elsif p_action='cost.review' then
   if c.status<>'submitted' or p_data->>'decision' not in ('approved','rejected') or length(why)<5 then raise exception 'Review a submitted record with a reason' using errcode='P0409';end if;
   update private.cost_obligations set status=p_data->>'decision',reviewed_by=auth.uid(),review_reason=why,revision=revision+1 where id=rid;
  elsif p_action='cost.adjust' then
   if c.kind<>'salary' or c.status not in ('draft','rejected') or length(why)<5 then raise exception 'Adjust a salary draft with a reason' using errcode='P0409';end if;
   amt:=(p_data->>'adjustment_minor')::bigint;perform private.daily_allocations(p_data->'allocations',c.amount_minor+amt);
   update private.cost_obligations set adjustment_minor=amt,adjustment_reason=why,allocations=p_data->'allocations',status='draft',revision=revision+1 where id=rid;
  elsif p_action='cost.reverse' then
   select * into payment from private.cost_payouts where id=(p_data->>'payout_id')::uuid and obligation_id=rid;
   if payment.id is null or payment.amount_minor<=0 or length(why)<5 or exists(select 1 from private.cost_payouts where reversal_of=payment.id) then raise exception 'Choose an unreversed payout and record a reason' using errcode='P0409';end if;
   select jsonb_agg(jsonb_build_object('branch_id',a->'branch_id','amount_minor',-(a->>'amount_minor')::bigint)) into v_allocations from jsonb_array_elements(payment.allocations) a;
   insert into private.cost_payouts(obligation_id,amount_minor,method,reference,paid_on,recorded_by,allocations,reversal_of)
    values(rid,-payment.amount_minor,payment.method,trim(p_data->>'reference'),(now() at time zone 'Asia/Dubai')::date,auth.uid(),v_allocations,payment.id);
   select coalesce(sum(amount_minor),0) into paid from private.cost_payouts where obligation_id=rid;
   update private.cost_obligations set status=case when paid=0 then 'approved' else 'part_paid' end,revision=revision+1 where id=rid;
  else
   select coalesce(sum(amount_minor),0) into paid from private.cost_payouts where obligation_id=rid;
   amt:=(p_data->>'amount_minor')::bigint;
   if c.status not in ('approved','part_paid') or amt is null or amt<=0 or amt>c.amount_minor+c.adjustment_minor-paid then raise exception 'Payment exceeds the approved outstanding amount' using errcode='P0409';end if;
   if (p_data->>'paid_on')::date>(now() at time zone 'Asia/Dubai')::date then raise exception 'Record only a payment already made' using errcode='22023';end if;
   v_allocations:=case when c.kind='expense' then jsonb_build_array(jsonb_build_object('branch_id',c.branch_id,'amount_minor',amt)) else p_data->'allocations' end;
   perform private.daily_allocations(v_allocations,amt);
   if exists(select 1 from jsonb_array_elements(v_allocations) x where (x->>'amount_minor')::bigint >
    coalesce((select (a->>'amount_minor')::bigint from jsonb_array_elements(c.allocations) a where a->>'branch_id' is not distinct from x->>'branch_id'),0)
    -coalesce((select sum((a->>'amount_minor')::bigint) from private.cost_payouts pp cross join lateral jsonb_array_elements(pp.allocations) a where pp.obligation_id=rid and a->>'branch_id' is not distinct from x->>'branch_id'),0))
   then raise exception 'Payout allocation exceeds the cost centre balance' using errcode='P0409';end if;
   insert into private.cost_payouts(obligation_id,amount_minor,method,reference,paid_on,recorded_by,allocations) values(rid,amt,p_data->>'method',trim(p_data->>'reference'),(p_data->>'paid_on')::date,auth.uid(),v_allocations);
   update private.cost_obligations set status=case when paid+amt=amount_minor+adjustment_minor then 'paid' else 'part_paid' end,revision=revision+1 where id=rid;
  end if;
 else raise exception 'Unknown daily action' using errcode='22023';end if;
 result:=jsonb_build_object('id',rid,'committed_at',clock_timestamp());
 insert into private.daily_requests values(auth.uid(),p_key,fp,private.product_access_revision(),result);
 return result;
end $$;

create function public.daily_read(p_view text,p_branch uuid default null,p_from date default (now() at time zone 'Asia/Dubai')::date,p_to date default (now() at time zone 'Asia/Dubai')::date,p_offset integer default 0,p_query text default '',p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; meta jsonb; rows jsonb; total bigint; summary jsonb;
begin
 perform private.require_access(private.daily_staff());
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_offset<0 or p_offset>100000 or length(p_query)>100 then raise exception 'Choose a valid date range' using errcode='22023';end if;
 if p_branch is not null then perform private.require_access(private.daily_location(p_branch) or private.daily_can('accounts.expenses') or private.daily_can('accounts.payroll') or private.daily_can('accounts.timekeeping'));end if;
 meta:=jsonb_build_object('can_expenses',private.daily_can('accounts.expenses'),'can_payroll',private.daily_can('accounts.payroll'),'can_timekeeping',private.daily_can('accounts.timekeeping'),
 'can_clock_central',private.head_office() or private.daily_can('accounts.payroll') or private.daily_can('accounts.expenses') or private.daily_can('accounts.timekeeping'),
 'can_submit_expense',private.daily_can('accounts.expenses') or (p_branch is not null and private.operations_staff(p_branch)),
 'branches',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') from public.branches where private.daily_location(id) or private.daily_can('accounts.expenses') or private.daily_can('accounts.payroll') or private.daily_can('accounts.timekeeping')),
 'open_shift',(select to_jsonb(x) from private.staff_shifts x where employee_id=auth.uid() and clocked_out_at is null));
 if p_view='session' then
  perform private.require_access(private.attendance_access(p_id));
  return meta||jsonb_build_object('delivery',(select to_jsonb(d) from private.delivery_starts d where session_id=p_id),'delivered_at',(select delivered_at from public.class_sessions where id=p_id),'arrivals',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from private.student_arrivals a join public.session_roster r on r.id=a.roster_id where r.session_id=p_id));
 elsif p_view in ('expenses','salary') then
  with visible as (
   select c.*,p.name employee_name,coalesce((select sum(amount_minor) from private.cost_payouts where obligation_id=c.id),0) paid_minor,coalesce((select sum((a->>'amount_minor')::bigint) from private.cost_payouts pp cross join lateral jsonb_array_elements(pp.allocations) a where pp.obligation_id=c.id and a->>'branch_id'=p_branch::text),0) branch_paid_minor
   from private.cost_obligations c left join public.profiles p on p.id=c.employee_id
   where private.daily_cost_visible(c) and c.kind=case p_view when 'salary' then 'salary' else 'expense' end
    and c.cost_date between p_from and p_to and (p_id is null or c.id=p_id)
    and (p_branch is null or (c.kind='expense' and c.branch_id=p_branch) or (c.kind='salary' and exists(select 1 from jsonb_array_elements(c.allocations) a where a->>'branch_id'=p_branch::text)))
    and (p_query='' or c.title ilike '%'||p_query||'%' or p.name ilike '%'||p_query||'%')
  ), scoped as (
   select v.*,case when p_branch is null then amount_minor+adjustment_minor else coalesce((select (a->>'amount_minor')::bigint from jsonb_array_elements(v.allocations) a where a->>'branch_id'=p_branch::text),0) end scoped_amount from visible v
  )
  select (select count(*) from scoped),
   (select coalesce(jsonb_agg(to_jsonb(page)),'[]') from (select * from scoped order by cost_date desc,id limit 50 offset p_offset) page),
   (select jsonb_build_object('approved_cost_minor',coalesce(sum(scoped_amount) filter(where status in ('approved','part_paid','paid')),0),
    'paid_minor',coalesce(sum(case when p_branch is null then paid_minor else branch_paid_minor end) filter(where status in ('approved','part_paid','paid')),0),
    'outstanding_minor',coalesce(sum(case when p_branch is null then scoped_amount-paid_minor else scoped_amount-branch_paid_minor end) filter(where status in ('approved','part_paid','paid')),0)) from scoped)
   into total,rows,summary;
  result:=jsonb_build_object('rows',rows,'total',total,'summary',summary);
  if p_id is not null and total>0 then result:=result||jsonb_build_object('payouts',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at),'[]') from private.cost_payouts x where obligation_id=p_id),'history',(select coalesce(jsonb_agg(to_jsonb(h) order by created_at),'[]') from private.daily_history h where entity='cost_obligations' and record_id=p_id));end if;
 elsif p_view='shifts' then
  with scoped as (select s.*,p.name employee_name,b.name branch_name from private.staff_shifts s join public.profiles p on p.id=s.employee_id left join public.branches b on b.id=s.branch_id
    where (s.employee_id=auth.uid() or private.daily_can('accounts.timekeeping')) and (p_branch is null or s.branch_id=p_branch)
    and (s.clocked_in_at at time zone 'Asia/Dubai')::date between p_from and p_to and (p_query='' or p.name ilike '%'||p_query||'%'))
  select jsonb_build_object('total',(select count(*) from scoped),'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from scoped order by clocked_in_at desc,id limit 50 offset p_offset) x)) into result;
 elsif p_view='agreements' then
  with scoped as (select a.*,p.name employee_name from private.staff_salary_agreements a join public.profiles p on p.id=a.employee_id where (a.employee_id=auth.uid() or private.daily_can('accounts.payroll')) and (p_query='' or p.name ilike '%'||p_query||'%'))
  select jsonb_build_object('total',(select count(*) from scoped),'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from scoped order by effective_from desc,id limit 50 offset p_offset) x)) into result;
 elsif p_view='employees' then
  perform private.require_access(private.daily_can('accounts.payroll'));
  with scoped as (select p.id,p.name from public.profiles p where p.active and exists(select 1 from public.role_assignments where user_id=p.id and role in ('admin','super_admin','branch','sales')) and not exists(select 1 from public.role_assignments where user_id=p.id and role='coach') and (p_query='' or p.name ilike '%'||p_query||'%'))
  select jsonb_build_object('total',(select count(*) from scoped),'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from scoped order by name,id limit 50 offset p_offset) x)) into result;
 elsif p_view='today' then
  with scoped as (
   select s.id,c.name,c.branch_id,b.name branch_name,c.sport,v.name venue_name,s.starts_at,s.ends_at,s.status,s.finalized_at,s.delivered_at,
   (select count(*) from public.session_roster r where r.session_id=s.id and not r.cancelled) expected,
   (select count(*) from private.student_arrivals a join public.session_roster r on r.id=a.roster_id where r.session_id=s.id and not r.cancelled) arrived
   from public.class_sessions s join public.academy_classes c on c.id=s.class_id join public.branches b on b.id=c.branch_id join public.venues v on v.id=c.venue_id
   where private.attendance_access(s.id) and (p_branch is null or c.branch_id=p_branch) and (s.starts_at at time zone 'Asia/Dubai')::date between p_from and p_to and (p_query='' or c.name ilike '%'||p_query||'%')
  
  ) select jsonb_build_object('total',(select count(*) from scoped),'tasks',jsonb_build_object(
   'expected',(select coalesce(sum(expected),0) from scoped where status<>'cancelled'),
   'arrived',(select coalesce(sum(arrived),0) from scoped where status<>'cancelled'),
   'unresolved',(select count(*) from scoped where finalized_at is null and status='scheduled' and starts_at<=now()),
   'trials',(select count(*) from public.session_roster r join scoped s on s.id=r.session_id where r.kind='trial' and not r.cancelled),
   'followups',(select count(*) from public.leads l where private.operations_staff(l.branch_id) and (p_branch is null or l.branch_id=p_branch) and l.follow_up_at<=now() and l.stage::text not in ('converted','lost','won')),
   'staffing',(select count(*) from scoped s join public.class_sessions ss on ss.id=s.id join public.academy_classes c on c.id=ss.class_id join public.profiles p on p.id=c.coach_id where not p.active and s.status='scheduled')),
   'rows',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from scoped order by starts_at,id limit 50 offset p_offset) x)) into result;
 else raise exception 'Unknown daily view' using errcode='22023';end if;
 return meta||coalesce(result,'{}');
end $$;

-- Every path into canonical Present/Late creates an attested arrival, including
-- finalization/corrections. Recorded time is not inferred physical arrival time.
create function private.record_attested_arrival() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.attendance in ('present','late') and old.attendance is distinct from new.attendance then
  insert into private.student_arrivals(roster_id,actor_id,source) values(new.id,auth.uid(),case when old.attendance is null then 'finalization' else 'correction' end) on conflict(roster_id) do nothing;
 end if;return new;end $$;
create trigger record_attested_arrival after update of attendance on public.session_roster for each row execute function private.record_attested_arrival();
alter function private.academy_command(text,jsonb) rename to academy_command_before_daily;
create function private.academy_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.class_sessions; d private.delivery_starts; expected uuid;
begin
 if p_action='academy.session.complete' then
  select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;
  perform private.require_access(private.attendance_access(s.id));
  if s.delivered_at is null then
   select * into d from private.delivery_starts where session_id=s.id;
   select coalesce((select coach_id from public.coach_substitutions where session_id=s.id and revoked_at is null order by created_at desc limit 1),c.coach_id) into expected from public.academy_classes c where c.id=s.class_id;
   if d.id is null then raise exception 'Start the session before recording completed delivery' using errcode='P0409';end if;
   if d.coach_id<>expected then raise exception 'Coach assignment changed; request a reviewed session correction' using errcode='P0409';end if;
  end if;
 end if;
 return private.academy_command_before_daily(p_action,p_data);
end $$;

-- Private storage is not queryable by browser roles. Every RPC reauthorizes.
do $$declare n text;begin
 foreach n in array array['staff_shifts','student_arrivals','delivery_starts','staff_salary_agreements','cost_obligations','cost_payouts'] loop
  execute format('create trigger daily_audit after insert or update on private.%I for each row execute function private.daily_audit()',n);
  execute format('alter table private.%I owner to postgres',n);
  execute format('revoke all on private.%I from public,anon,authenticated',n);
 end loop;
end $$;
revoke all on private.daily_requests,private.daily_history from public,anon,authenticated;
revoke all on function private.daily_audit(),private.daily_staff(),private.daily_can(text),private.daily_allocations(jsonb,bigint),private.daily_cost_visible(private.cost_obligations),private.record_attested_arrival(),private.academy_command(text,jsonb),private.academy_command_before_daily(text,jsonb) from public,anon,authenticated;
revoke all on function public.daily_command(text,jsonb,uuid),public.daily_read(text,uuid,date,date,integer,text,uuid) from public,anon;
grant execute on function public.daily_command(text,jsonb,uuid),public.daily_read(text,uuid,date,date,integer,text,uuid) to authenticated;
do $$declare x record;begin
 for x in select oid::regprocedure f from pg_proc where pronamespace in ('private'::regnamespace,'public'::regnamespace) and proname in ('daily_location','daily_audit','daily_staff','daily_can','daily_allocations','daily_cost_visible','record_attested_arrival','academy_command','daily_command','daily_read') loop execute format('alter function %s owner to postgres',x.f);end loop;
end $$;
alter table private.daily_requests owner to postgres;
alter table private.daily_history owner to postgres;

revoke all on function private.daily_location(uuid) from public,anon,authenticated;
