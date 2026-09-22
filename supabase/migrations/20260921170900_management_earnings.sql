-- Each ledger row has a complete settlement balance, independent of detail pagination.
create function public.management_earnings(p_coach uuid default null,p_branch uuid default null,p_offset integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 if not private.active() or not private.mfa_ready() then raise exception 'Access denied' using errcode='42501';end if;
 if p_branch is not null and not private.branch_access(p_branch) then raise exception 'Branch access denied' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 then raise exception 'Invalid offset' using errcode='22023';end if;
 with eligible as (select a.*,coalesce((select sum(s.amount_minor) from public.commercial_compensation_settlements s where s.accrual_id=a.id),0) paid_minor,
 (select p.name from public.profiles p where p.id=a.coach_id) coach_name,
 (select b.name from public.branches b where b.id=a.branch_id) branch_name,
 (select s.starts_at from public.class_sessions s where s.id=a.session_id) work_at
 from public.commercial_compensation_accruals a where (p_coach is null or a.coach_id=p_coach) and (p_branch is null or a.branch_id=p_branch)),
 page as (select * from eligible order by created_at desc,id offset p_offset limit 50)
 select jsonb_build_object('total',(select count(*) from eligible),'rows',coalesce((select jsonb_agg(p) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.management_earnings(uuid,uuid,integer) from public,anon;
grant execute on function public.management_earnings(uuid,uuid,integer) to authenticated;
-- Serialize duplicate registrations in one branch; re-use is a staff decision, never a silent merge.
create or replace function private.commercial_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid;f uuid;c uuid;lvl uuid;sp public.sport_id;begin
 if p_action<>'commercial.customer.create' then return private.commercial_command_before_customer(p_action,p_data);end if;
 b:=(p_data->>'branch_id')::uuid;sp:=(p_data->>'sport')::public.sport_id;lvl:=nullif(p_data->>'level_id','')::uuid;
 perform private.require_access(private.active() and private.mfa_ready() and private.operations_staff(b));
 if not exists(select 1 from public.branches where id=b and active) or not exists(select 1 from public.branch_sports where branch_id=b and sport=sp) then raise exception 'Active branch activity required' using errcode='P0409';end if;
 perform pg_advisory_xact_lock(hashtextextended(b::text||trim(p_data->>'mobile'),0));
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
