-- Current operational instructions only; no medical history is projected to coaching staff.
create table public.development_safety_instructions(
 id uuid primary key default gen_random_uuid(),child_id uuid not null unique references public.children,
 instructions text not null default '' check(length(instructions)<=1000),
 updated_by uuid not null references public.profiles,updated_at timestamptz not null default now()
);
create index development_safety_actor on public.development_safety_instructions(updated_by);
alter table public.development_safety_instructions enable row level security;
revoke all on public.development_safety_instructions from anon,authenticated;
grant select on public.development_safety_instructions to authenticated;grant all on public.development_safety_instructions to service_role;
create function private.development_safety_staff(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and exists(select 1 from public.children k where k.id=cid and (
 (private.head_office() and private.product_can('development.safety',null)) or exists(select 1 from public.family_branches fb where fb.family_id=k.family_id and private.operations_staff(fb.branch_id) and private.product_can('development.safety',fb.branch_id))))
$$;
create function private.development_safety_coach(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_sessions s where s.ends_at>=now()-interval '1 day' and s.starts_at<=now()+interval '45 days' and private.development_coach_session(s.id) and private.development_session_child(s.id,cid))
$$;
revoke all on function private.development_safety_staff(uuid),private.development_safety_coach(uuid) from public,anon;
grant execute on function private.development_safety_staff(uuid),private.development_safety_coach(uuid) to authenticated,service_role;
create policy development_safety_read on public.development_safety_instructions for select to authenticated using(private.development_parent(child_id) or private.development_safety_staff(child_id));
create trigger development_safety_audit after insert or update or delete on public.development_safety_instructions for each row execute function private.product_audit();
-- Explicit projection also allows authorized families to add instructions before a current record exists.
create function private.development_safety_child_rows() returns table(id uuid,name text,instructions text,updated_at timestamptz,can_edit boolean) language sql stable security definer set search_path='' as $$
select k.id,k.name,coalesce(i.instructions,'') instructions,i.updated_at,
 (private.development_parent(k.id) or private.development_safety_staff(k.id)) can_edit
 from public.children k left join public.development_safety_instructions i on i.child_id=k.id
 where private.development_parent(k.id) or private.development_safety_staff(k.id) or private.development_safety_coach(k.id)
$$;
revoke all on function private.development_safety_child_rows() from public,anon;grant execute on function private.development_safety_child_rows() to authenticated,service_role;
create view public.development_safety_children with(security_invoker=true,security_barrier=true) as select * from private.development_safety_child_rows();
revoke all on public.development_safety_children from public,anon;grant select on public.development_safety_children to authenticated,service_role;
-- The target travels with the evidence through the existing independent review and publication lifecycle.
alter table public.development_assessments add column next_target text not null default '' check(length(next_target)<=1000);
alter function private.development_command(text,jsonb) rename to development_history_command;
create function private.development_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid;rid uuid;result jsonb;note text;begin
 if p_action not in ('development.safety.save','development.assessment.save') then return private.development_history_command(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready());
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if p_action='development.safety.save' then
 cid:=(p_data->>'child_id')::uuid;
 perform private.require_access(private.development_parent(cid) or private.development_safety_staff(cid));
 if jsonb_typeof(p_data->'instructions') is distinct from 'string' or length(p_data->>'instructions')>1000 then raise exception 'Current instructions must be at most 1000 characters' using errcode='22023';end if;
 note:=trim(p_data->>'instructions');
 insert into public.development_safety_instructions(child_id,instructions,updated_by) values(cid,note,auth.uid()) on conflict(child_id) do update set instructions=excluded.instructions,updated_by=auth.uid(),updated_at=now() returning id into rid;
 return jsonb_build_object('id',rid);
 end if;
 if (p_data ? 'next_target' and jsonb_typeof(p_data->'next_target') is distinct from 'string') or length(coalesce(p_data->>'next_target',''))>1000 then raise exception 'Next target must be at most 1000 characters' using errcode='22023';end if;
 result:=private.development_history_command(p_action,p_data-'next_target');
 update public.development_assessments set next_target=trim(coalesce(p_data->>'next_target','')) where id=(result->>'id')::uuid;
 return result;
end $$;
revoke all on function private.development_command(text,jsonb),private.development_history_command(text,jsonb) from public,anon,authenticated;
