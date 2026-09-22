-- Additive local operational structure. Existing purchased contracts and ledgers remain intact.
create table public.package_catalogue (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 100),
 name_ar text not null default '', sport public.sport_id not null, created_by uuid not null references public.profiles,
 created_at timestamptz not null default now()
);
alter table public.commercial_packages add column catalogue_id uuid references public.package_catalogue,
 add column duration_months integer not null default 1 check(duration_months between 1 and 12),
 add column min_age integer not null default 1 check(min_age between 1 and 17),
 add column max_age integer not null default 17 check(max_age between min_age and 17),
 add column superseded_by uuid references public.commercial_packages;
-- Supersession is append-only, held separately so the existing contract guard stays strict.
alter table public.commercial_packages drop column superseded_by;
create table public.package_offer_versions (
 catalogue_id uuid not null references public.package_catalogue, branch_id uuid not null references public.branches,
 package_id uuid not null unique references public.commercial_packages, revision integer not null,
 created_at timestamptz not null default now(), primary key(catalogue_id,branch_id,revision)
);
create table public.coach_assignments (
 id uuid primary key default gen_random_uuid(), coach_id uuid not null references public.profiles,
 branch_id uuid not null references public.branches, sport public.sport_id not null,
 level_id uuid references public.sport_levels, venue_id uuid references public.venues,
 active boolean not null default true, created_at timestamptz not null default now(),
 unique nulls not distinct(coach_id,branch_id,sport,level_id,venue_id)
);
alter table public.commercial_compensation_rates add column basis text not null default 'session' check(basis in ('session','hour','month')),
 add column sport public.sport_id,
 add column cancellation_rule text not null default 'unpaid' check(cancellation_rule='unpaid'),
 add column substitute_rule text not null default 'actual_coach' check(substitute_rule in ('actual_coach','exclude'));
alter table public.commercial_compensation_accruals alter column session_id drop not null,
 add column period_start date, add column units numeric not null default 1 check(units>0),
 add constraint compensation_work_source check ((session_id is not null and period_start is null) or (session_id is null and period_start is not null)),
 add unique(rate_id,period_start);

alter table public.package_catalogue enable row level security;
alter table public.package_offer_versions enable row level security;
alter table public.coach_assignments enable row level security;
grant select on public.package_catalogue,public.package_offer_versions,public.coach_assignments to authenticated;
grant all on public.package_catalogue,public.package_offer_versions,public.coach_assignments to service_role;
create policy catalogue_read on public.package_catalogue for select to authenticated using(private.head_office() or exists(select 1 from public.commercial_packages p where p.catalogue_id=package_catalogue.id));
create policy offer_version_read on public.package_offer_versions for select to authenticated using(exists(select 1 from public.commercial_packages p where p.id=package_id));
create policy coach_assignment_read on public.coach_assignments for select to authenticated using(private.active() and (private.branch_access(branch_id) or coach_id=auth.uid()));
create trigger catalogue_audit after insert or update on public.package_catalogue for each row execute function private.commercial_audit();
create trigger coach_assignment_audit after insert or update on public.coach_assignments for each row execute function private.commercial_audit();
create trigger offer_version_immutable before update or delete on public.package_offer_versions for each row execute function private.commercial_immutable();

create function private.calculate_coach_earning(sid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.class_sessions; c public.academy_classes; r public.commercial_compensation_rates; result uuid; n numeric; begin
 select * into s from public.class_sessions where id=sid for update;
 select * into c from public.academy_classes where id=s.class_id;
 if s.delivered_at is null or s.delivered_by is null or s.status='cancelled' or s.ends_at>now() then return null;end if;
 select * into r from public.commercial_compensation_rates where coach_id=s.delivered_by and branch_id=c.branch_id
 and effective_from <= (s.starts_at at time zone 'Asia/Dubai')::date and effective_to > (s.starts_at at time zone 'Asia/Dubai')::date
 and (sport is null or sport=c.sport) order by sport nulls last limit 1;
 if r.id is null or r.basis='month' or (r.substitute_rule='exclude' and s.delivered_by<>c.coach_id) then return null;end if;
 n:=case when r.basis='hour' then extract(epoch from(s.ends_at-s.starts_at))/3600 else 1 end;
 insert into public.commercial_compensation_accruals(session_id,coach_id,branch_id,rate_id,amount_minor,units)
 values(s.id,s.delivered_by,c.branch_id,r.id,round(r.amount_minor*n)::integer,n) on conflict(session_id) do nothing returning id into result;
 if result is null then select id into result from public.commercial_compensation_accruals where session_id=s.id;end if;
 return result;
end $$;
create function private.accrue_completed_work() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.delivered_at is not null and old.delivered_at is null then perform private.calculate_coach_earning(new.id);end if;return new;
end $$;
create trigger accrue_completed_work after update of delivered_at on public.class_sessions for each row execute function private.accrue_completed_work();
-- Branch operations completing a session must attribute delivery to the actual assigned/substitute coach, not the receptionist.
create function private.resolve_delivered_coach() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.delivered_at is null and new.delivered_at is not null then
  select coalesce((select cs.coach_id from public.coach_substitutions cs where cs.session_id=new.id and cs.revoked_at is null order by cs.created_at desc limit 1),c.coach_id)
  into new.delivered_by from public.academy_classes c where c.id=new.class_id;
 end if;return new;
end $$;
create trigger resolve_delivered_coach before update of delivered_at on public.class_sessions for each row execute function private.resolve_delivered_coach();

alter function private.commercial_command(text,jsonb) rename to commercial_command_before_management;
create function private.commercial_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare id uuid; b uuid; cid uuid; pid uuid; oldpkg public.commercial_packages; pkg public.commercial_packages; m public.commercial_memberships;
 a public.commercial_compensation_accruals; r public.commercial_compensation_rates; entry jsonb; result jsonb; n int; price int; d date; ending date; child public.children; f uuid; inv uuid;
begin
 if p_action in ('commercial.package.create','commercial.package.status','commercial.compensation.rate') then
  perform private.require_access(private.head_office());
 end if;
 if p_action='commercial.package.status' and coalesce((p_data->>'active')::boolean,false) and exists(
  select 1 from public.package_offer_versions v where v.package_id=(p_data->>'id')::uuid and exists(select 1 from public.package_offer_versions v2 where v2.catalogue_id=v.catalogue_id and v2.branch_id=v.branch_id and v2.revision>v.revision)) then
  raise exception 'A newer offer exists; historical contracts cannot be resold' using errcode='P0409';
 end if;
 if p_action='commercial.catalogue.save' then
  perform private.require_access(private.head_office() and private.active() and private.mfa_ready());
  cid:=nullif(p_data->>'id','')::uuid;
  if cid is null then insert into public.package_catalogue(name,name_ar,sport,created_by) values(trim(p_data->>'name'),coalesce(p_data->>'name_ar',''),(p_data->>'sport')::public.sport_id,auth.uid()) returning package_catalogue.id into cid;
  else perform 1 from public.package_catalogue where package_catalogue.id=cid for update;if not found then raise exception 'Catalogue not found' using errcode='P0409';end if;
   if (select sport::text from public.package_catalogue where package_catalogue.id=cid)<>p_data->>'sport' then raise exception 'Create a different catalogue for another activity' using errcode='P0409';end if;
   update public.package_catalogue set name=trim(p_data->>'name'),name_ar=coalesce(p_data->>'name_ar','') where package_catalogue.id=cid;
  end if;
  for entry in select value from jsonb_array_elements(p_data->'offers') loop
   b:=(entry->>'branch_id')::uuid;
   perform private.require_access(private.product_can('finance.packages',b));
   if not exists(select 1 from public.branches br join public.branch_sports bs on bs.branch_id=br.id where br.id=b and br.active and bs.sport=(p_data->>'sport')::public.sport_id) then raise exception 'Branch activity is not configured' using errcode='P0409';end if;
   if nullif(p_data->>'level_id','') is not null and not exists(select 1 from public.sport_levels where sport_levels.id=(p_data->>'level_id')::uuid and sport=(p_data->>'sport')::public.sport_id and active) then raise exception 'Invalid activity level' using errcode='P0409';end if;
   select coalesce(max(revision),0)+1 into n from public.package_offer_versions where catalogue_id=cid and branch_id=b;
   update public.commercial_packages set active=false where catalogue_id=cid and branch_id=b and active;
   price:=coalesce((entry->>'price_minor')::integer,(p_data->>'price_minor')::integer);
   insert into public.commercial_packages(catalogue_id,branch_id,sport,level_id,name,name_ar,price_minor,session_allowance,terms,terms_ar,created_by,active,duration_months,min_age,max_age)
   values(cid,b,(p_data->>'sport')::public.sport_id,nullif(p_data->>'level_id','')::uuid,trim(p_data->>'name'),coalesce(p_data->>'name_ar',''),price,(p_data->>'session_allowance')::integer,p_data->>'terms',coalesce(p_data->>'terms_ar',''),auth.uid(),(entry->>'enabled')::boolean,(p_data->>'duration_months')::integer,(p_data->>'min_age')::integer,(p_data->>'max_age')::integer) returning commercial_packages.id into pid;
   insert into public.package_offer_versions values(cid,b,pid,n,now());
  end loop;
  return jsonb_build_object('id',cid);
 elsif p_action='commercial.coach.save' then
  perform private.require_access(private.super_admin() and private.active() and private.mfa_ready());id:=(p_data->>'id')::uuid;
  perform private.require_access(id<>auth.uid() and exists(select 1 from public.role_assignments where user_id=id and role='coach'));
  update public.profiles set name=trim(p_data->>'name'),mobile=coalesce(p_data->>'mobile',''),active=(p_data->>'active')::boolean where profiles.id=id;
  return jsonb_build_object('id',id);
 elsif p_action='commercial.coach.assign' then
  perform private.require_access(private.super_admin() and private.active() and private.mfa_ready());id:=(p_data->>'coach_id')::uuid;b:=(p_data->>'branch_id')::uuid;
  perform private.require_access(exists(select 1 from public.role_assignments where user_id=id and role='coach') and exists(select 1 from public.profiles where profiles.id=id and active));
  if not exists(select 1 from public.branch_sports where branch_id=b and sport=(p_data->>'sport')::public.sport_id) or not exists(select 1 from public.branches where branches.id=b and active) then raise exception 'Configure branch activity first' using errcode='P0409';end if;
  if nullif(p_data->>'venue_id','') is not null and not exists(select 1 from public.venues where venues.id=(p_data->>'venue_id')::uuid and branch_id=b) then raise exception 'Venue belongs to another branch' using errcode='P0409';end if;
  if nullif(p_data->>'level_id','') is not null and not exists(select 1 from public.sport_levels where sport_levels.id=(p_data->>'level_id')::uuid and sport=(p_data->>'sport')::public.sport_id) then raise exception 'Level belongs to another activity' using errcode='P0409';end if;
  insert into public.branch_permissions values(id,b) on conflict do nothing;
  insert into public.coach_assignments(coach_id,branch_id,sport,level_id,venue_id,active) values(id,b,(p_data->>'sport')::public.sport_id,nullif(p_data->>'level_id','')::uuid,nullif(p_data->>'venue_id','')::uuid,true)
  on conflict(coach_id,branch_id,sport,level_id,venue_id) do update set active=true returning coach_assignments.id into cid;
  return jsonb_build_object('id',cid);
 elsif p_action='commercial.venue.update' then
  perform private.require_access(private.head_office() and private.active() and private.mfa_ready());
  update public.venues set name=p_data->>'name',address=p_data->>'address',operating_information=p_data->>'operating_information' where venues.id=(p_data->>'id')::uuid returning venues.id into id;
  if id is null then raise exception 'Venue not found' using errcode='P0409';end if;return jsonb_build_object('id',id);
 elsif p_action='commercial.agreement.create' then
  perform private.require_access(private.head_office() and private.active() and private.mfa_ready());b:=(p_data->>'branch_id')::uuid;id:=(p_data->>'coach_id')::uuid;
  perform private.require_access(private.product_can('finance.compensation',b) and exists(select 1 from public.branch_permissions where user_id=id and branch_id=b) and exists(select 1 from public.role_assignments where user_id=id and role='coach') and exists(select 1 from public.profiles where profiles.id=id and active));
  perform pg_advisory_xact_lock(hashtextextended(id::text||b::text,0));
  if exists(select 1 from public.commercial_compensation_rates where coach_id=id and branch_id=b and (sport is null or nullif(p_data->>'sport','') is null or sport::text=p_data->>'sport') and daterange(effective_from,effective_to,'[)') && daterange((p_data->>'effective_from')::date,(p_data->>'effective_to')::date,'[)')) then raise exception 'Agreement dates overlap; use a later effective period' using errcode='P0409';end if;
  insert into public.commercial_compensation_rates(coach_id,branch_id,amount_minor,effective_from,effective_to,created_by,basis,sport,cancellation_rule,substitute_rule) values(id,b,(p_data->>'amount_minor')::integer,(p_data->>'effective_from')::date,(p_data->>'effective_to')::date,auth.uid(),p_data->>'basis',nullif(p_data->>'sport','')::public.sport_id,p_data->>'cancellation_rule',p_data->>'substitute_rule') returning commercial_compensation_rates.id into cid;
  return jsonb_build_object('id',cid);
 elsif p_action='commercial.compensation.accrue' then
  select c.branch_id into b from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=(p_data->>'session_id')::uuid;
  perform private.require_access(private.product_can('finance.compensation',b));id:=private.calculate_coach_earning((p_data->>'session_id')::uuid);
  if id is null then raise exception 'Completed delivery and eligible session/hour agreement required' using errcode='P0409';end if;return jsonb_build_object('id',id);
 elsif p_action='commercial.compensation.month' then
  select * into r from public.commercial_compensation_rates where commercial_compensation_rates.id=(p_data->>'id')::uuid;
  perform private.require_access(private.product_can('finance.compensation',r.branch_id));d:=(p_data->>'period_start')::date;ending:=(d+interval '1 month')::date;
  if r.basis<>'month' or d<>date_trunc('month',d)::date or d<r.effective_from or ending>r.effective_to or ending>(now() at time zone 'Asia/Dubai')::date then raise exception 'A full completed calendar month within the agreement is required' using errcode='P0409';end if;
  insert into public.commercial_compensation_accruals(coach_id,branch_id,rate_id,amount_minor,period_start) values(r.coach_id,r.branch_id,r.id,r.amount_minor,d) on conflict(rate_id,period_start) do nothing returning commercial_compensation_accruals.id into id;
  if id is null then select commercial_compensation_accruals.id into id from public.commercial_compensation_accruals where rate_id=r.id and period_start=d;end if;return jsonb_build_object('id',id);
 elsif p_action in ('commercial.compensation.review','commercial.compensation.settle') then
  select * into a from public.commercial_compensation_accruals where commercial_compensation_accruals.id=(p_data->>'id')::uuid for update;
  if a.period_start is not null then
   perform private.require_access(private.product_can('finance.compensation',a.branch_id) and not private.has_role(array['coach','sales']::public.academy_role[]));
   if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Reason required' using errcode='22023';end if;
   if p_action='commercial.compensation.review' then
    if a.status<>'pending' or p_data->>'decision' not in ('approved','rejected') then raise exception 'Pending earnings required' using errcode='P0409';end if;
    update public.commercial_compensation_accruals set status=p_data->>'decision',review_reason=p_data->>'reason',reviewed_by=auth.uid(),reviewed_at=now() where commercial_compensation_accruals.id=a.id;id:=a.id;
   else
    perform private.require_access(private.product_can('finance.compensation_payment',a.branch_id));
    if a.status<>'approved' or coalesce((select sum(amount_minor) from public.commercial_compensation_settlements where accrual_id=a.id),0)<>0 then raise exception 'Approved unpaid earnings required' using errcode='P0409';end if;
    insert into public.commercial_compensation_settlements(accrual_id,branch_id,amount_minor,reference,reason,recorded_by) values(a.id,a.branch_id,a.amount_minor,p_data->>'reference',p_data->>'reason',auth.uid()) returning commercial_compensation_settlements.id into id;
   end if;return jsonb_build_object('id',id);
  end if;
 elsif p_action in ('commercial.membership.start','commercial.membership.renew') then
  if p_action='commercial.membership.renew' then select * into m from public.commercial_memberships where commercial_memberships.id=(p_data->>'id')::uuid;pid:=m.package_id;cid:=m.child_id;d:=m.expires_on;
  else pid:=(p_data->>'package_id')::uuid;cid:=(p_data->>'child_id')::uuid;d:=(p_data->>'starts_on')::date;end if;
  select * into pkg from public.commercial_packages where commercial_packages.id=pid;
  if pkg.catalogue_id is not null then
   select * into child from public.children where children.id=cid;f:=child.family_id;
   perform private.require_access(private.commercial_can('finance.memberships',f,pkg.branch_id) or private.family_owner(f));
   perform pg_advisory_xact_lock(hashtextextended(cid::text,0));
   if p_action='commercial.membership.renew' and exists(select 1 from public.commercial_memberships where renewed_from=m.id) then select commercial_memberships.id into id from public.commercial_memberships where renewed_from=m.id;return jsonb_build_object('id',id,'unchanged',true);end if;
   n:=case when child.dob is not null then extract(year from age(d,child.dob))::int else child.reported_age end;
   if not pkg.active or coalesce((p_data->>'accepted')::boolean,false) is not true or n is null or n not between pkg.min_age and pkg.max_age then raise exception 'Active age-eligible offer and explicit acceptance required' using errcode='P0409';end if;
   if not exists(select 1 from public.branches br join public.branch_sports bs on bs.branch_id=br.id where br.id=pkg.branch_id and br.active and not br.provisional and bs.sport=pkg.sport) or not exists(select 1 from public.child_sports where child_id=cid and sport=pkg.sport and (pkg.level_id is null or level_id=pkg.level_id)) then raise exception 'Branch, activity or level is unavailable' using errcode='P0409';end if;
   if d<(now() at time zone 'Asia/Dubai')::date or d>(now() at time zone 'Asia/Dubai')::date+366 then raise exception 'Start date outside permitted range' using errcode='P0409';end if;
   ending:=(d+make_interval(months=>pkg.duration_months))::date;
   if exists(select 1 from public.commercial_memberships where child_id=cid and branch_id=pkg.branch_id and sport=pkg.sport and daterange(starts_on,expires_on,'[)')&&daterange(d,ending,'[)')) then raise exception 'Membership dates overlap' using errcode='P0409';end if;
   insert into public.commercial_memberships(package_id,child_id,family_id,branch_id,sport,starts_on,expires_on,accepted_by,renewed_from) values(pkg.id,cid,f,pkg.branch_id,pkg.sport,d,ending,auth.uid(),m.id) returning commercial_memberships.id into id;
   insert into public.commercial_invoices(membership_id,family_id,branch_id,issued_by) values(id,f,pkg.branch_id,auth.uid()) returning commercial_invoices.id into inv;
   insert into public.commercial_invoice_lines(invoice_id,description,quantity,unit_minor) values(inv,pkg.name||' / '||d||' – '||ending,1,pkg.price_minor);
   perform private.commercial_sync_membership(inv);
   perform private.emit_product_event('membership.created',id,f,pkg.branch_id,'Membership created','Your membership and invoice are available. Activation requires payment or approved credit.','/parent?view=Memberships');
   return jsonb_build_object('id',id,'invoice_id',inv);
  end if;
 end if;
 return private.commercial_command_before_management(p_action,p_data);
end $$;
revoke all on function private.commercial_command(text,jsonb),private.commercial_command_before_management(text,jsonb),private.calculate_coach_earning(uuid),private.accrue_completed_work(),private.resolve_delivered_coach() from public,anon,authenticated;

-- A branch selection is applied before pagination, under the caller's existing RLS.
create function public.branch_records(p_table text,p_branch uuid,p_offset integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
declare predicate text; result jsonb; cols text[]; begin
 if not private.active() or not private.branch_access(p_branch) then raise exception 'Branch access denied' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 or p_table !~ '^[a-z][a-z_]+$' or not exists(select 1 from pg_catalog.pg_tables where schemaname='public' and tablename=p_table) then raise exception 'Invalid record request' using errcode='22023';end if;
 select array_agg(column_name::text) into cols from information_schema.columns where table_schema='public' and table_name=p_table;
 if 'branch_id'=any(cols) then predicate:='t.branch_id=$1';
 elsif p_table='branches' then predicate:='t.id=$1';
 elsif p_table='families' then predicate:='exists(select 1 from public.family_branches fb where fb.family_id=t.id and fb.branch_id=$1)';
 elsif p_table='profiles' then predicate:='exists(select 1 from public.branch_permissions bp where bp.user_id=t.id and bp.branch_id=$1)';
 elsif p_table in ('role_assignments','coach_availability') then predicate:=case when p_table='role_assignments' then 'exists(select 1 from public.branch_permissions bp where bp.user_id=t.user_id and bp.branch_id=$1)' else 'exists(select 1 from public.branch_permissions bp where bp.user_id=t.coach_id and bp.branch_id=$1)' end;
 elsif 'family_id'=any(cols) then predicate:='exists(select 1 from public.family_branches fb where fb.family_id=t.family_id and fb.branch_id=$1)';
 elsif 'invoice_id'=any(cols) then predicate:='exists(select 1 from public.commercial_invoices i where i.id=t.invoice_id and i.branch_id=$1)';
 elsif 'payment_id'=any(cols) then predicate:='exists(select 1 from public.commercial_payments p where p.id=t.payment_id and p.branch_id=$1)';
 elsif 'membership_id'=any(cols) then predicate:='exists(select 1 from public.commercial_memberships m where m.id=t.membership_id and m.branch_id=$1)';
 elsif 'class_id'=any(cols) then predicate:='exists(select 1 from public.academy_classes c where c.id=t.class_id and c.branch_id=$1)';
 elsif 'session_id'=any(cols) then predicate:='exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=t.session_id and c.branch_id=$1)';
 elsif 'lead_id'=any(cols) then predicate:='exists(select 1 from public.leads l where l.id=t.lead_id and l.branch_id=$1)';
 elsif 'child_id'=any(cols) then predicate:='exists(select 1 from public.children c join public.family_branches fb on fb.family_id=c.family_id where c.id=t.child_id and fb.branch_id=$1)';
 elsif p_table in ('sport_levels','age_groups','development_criteria','package_catalogue') then predicate:='true';
 else return '[]'::jsonb;end if;
 execute format('select coalesce(jsonb_agg(x),''[]''::jsonb) from (select t.* from public.%I t where %s order by to_jsonb(t)::text offset $2 limit 200)x',p_table,predicate) into result using p_branch,p_offset;
 return result;
end $$;
revoke all on function public.branch_records(text,uuid,integer) from public,anon;
grant execute on function public.branch_records(text,uuid,integer) to authenticated;

create function public.management_finance(p_from date,p_to date,p_branch uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.active() and private.mfa_ready() and not private.has_role(array['parent','coach','sales']::public.academy_role[]));
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose up to one year' using errcode='22023';end if;
 if p_branch is not null then perform private.require_access(private.branch_access(p_branch));end if;
 with permitted as (select b.id,b.name from public.branches b where (p_branch is null or b.id=p_branch) and private.branch_access(b.id) and private.product_can('finance.view',b.id)),
 summaries as (select b.*,public.business_report(p_from,p_to,b.id,null)->'finance' finance from permitted b),
 balances as (select a.branch_id,
 coalesce(sum(a.amount_minor) filter(where a.status='approved' and (a.created_at at time zone 'Asia/Dubai')::date between p_from and p_to),0) earned,
 coalesce(sum(a.amount_minor-coalesce((select sum(s.amount_minor) from public.commercial_compensation_settlements s where s.accrual_id=a.id),0)) filter(where a.status='approved'),0) outstanding
 from public.commercial_compensation_accruals a join permitted b on b.id=a.branch_id where private.product_can('finance.compensation',a.branch_id) group by a.branch_id),
 payouts as (select s.branch_id,sum(s.amount_minor) paid from public.commercial_compensation_settlements s join permitted b on b.id=s.branch_id where private.product_can('finance.compensation',s.branch_id) and (s.created_at at time zone 'Asia/Dubai')::date between p_from and p_to group by s.branch_id)
 select jsonb_build_object('asOf',statement_timestamp(),'from',p_from,'to',p_to,'branches',coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'finance',b.finance,'coachVisible',private.product_can('finance.compensation',b.id),'earnedMinor',coalesce(c.earned,0),'coachOutstandingMinor',coalesce(c.outstanding,0),'paidMinor',coalesce(p.paid,0)) order by b.name),'[]'::jsonb)) into result from summaries b left join balances c on c.branch_id=b.id left join payouts p on p.branch_id=b.id;
 return result;
end $$;
revoke all on function public.management_finance(date,date,uuid) from public,anon;
grant execute on function public.management_finance(date,date,uuid) to authenticated;
