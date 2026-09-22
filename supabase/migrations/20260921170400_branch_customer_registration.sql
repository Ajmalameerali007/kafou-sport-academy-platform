create or replace function public.management_finance(p_from date,p_to date,p_branch uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.active() and private.mfa_ready() and private.has_role(array['super_admin','admin','branch']::public.academy_role[]) and not private.has_role(array['coach','sales']::public.academy_role[]));
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

alter function private.commercial_command(text,jsonb) rename to commercial_command_before_customer;
create function private.commercial_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid;f uuid;c uuid;lvl uuid;sp public.sport_id;begin
 if p_action<>'commercial.customer.create' then return private.commercial_command_before_customer(p_action,p_data);end if;
 b:=(p_data->>'branch_id')::uuid;sp:=(p_data->>'sport')::public.sport_id;lvl:=nullif(p_data->>'level_id','')::uuid;
 perform private.require_access(private.active() and private.mfa_ready() and private.operations_staff(b));
 if not exists(select 1 from public.branches where id=b and active) or not exists(select 1 from public.branch_sports where branch_id=b and sport=sp) then raise exception 'Active branch activity required' using errcode='P0409';end if;
 if exists(select 1 from public.families f join public.family_branches fb on fb.family_id=f.id where fb.branch_id=b and f.mobile=trim(p_data->>'mobile')) then raise exception 'A customer with this mobile already exists in this branch' using errcode='P0409';end if;
 if lvl is not null and not exists(select 1 from public.sport_levels where id=lvl and sport=sp and active) then raise exception 'Invalid activity level' using errcode='P0409';end if;
 if length(trim(p_data->>'name')) not between 2 and 100 or coalesce(p_data->>'mobile','') !~ '^\+?[0-9 ()-]{9,25}$' or (p_data->>'age')::int not between 1 and 17 then raise exception 'Customer details are invalid' using errcode='22023';end if;
 insert into public.families(name,mobile,email) values(trim(p_data->>'name'),trim(p_data->>'mobile'),coalesce(p_data->>'email','')) returning id into f;
 insert into public.family_branches values(f,b);
 insert into public.children(family_id,name,reported_age,age_captured_on,dob) values(f,trim(p_data->>'child_name'),(p_data->>'age')::int,current_date,nullif(p_data->>'dob','')::date) returning id into c;
 insert into public.child_sports(child_id,sport,level_id,status) values(c,sp,lvl,'interest');
 return jsonb_build_object('id',f,'child_id',c);
end $$;
revoke all on function private.commercial_command(text,jsonb),private.commercial_command_before_customer(text,jsonb) from public,anon,authenticated;
