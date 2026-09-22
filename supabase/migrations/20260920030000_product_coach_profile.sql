-- Coach profile: qualifications, bio and a weekly availability grid.
-- Self-service for the coach; head office may correct or review any record.
alter table public.profiles
  add column bio text not null default '' check(length(bio)<=2000),
  add column qualifications text[] not null default '{}'
    check(cardinality(qualifications)<=20
      and length(array_to_string(qualifications,'|'))<=2000);

create table public.coach_availability(
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles,
  branch_id uuid references public.branches,
  weekday int not null check(weekday between 0 and 6),
  start_time time not null,
  end_time time not null check(end_time>start_time),
  created_at timestamptz not null default now(),
  unique nulls not distinct(coach_id,branch_id,weekday,start_time)
);
create index coach_availability_coach on public.coach_availability(coach_id);
create index coach_availability_branch on public.coach_availability(branch_id);
alter table public.coach_availability enable row level security;
revoke all on public.coach_availability from public,anon,authenticated;
grant select on public.coach_availability to authenticated;
grant all on public.coach_availability to service_role;
create policy coach_availability_read on public.coach_availability for select to authenticated
  using(coach_id=auth.uid() or private.head_office()
    or (private.has_role(array['branch']::public.academy_role[])
      and (branch_id is null or exists(select 1 from public.branch_permissions bp
        where bp.user_id=auth.uid() and bp.branch_id=coach_availability.branch_id))));
create trigger coach_availability_audit after insert or update or delete on public.coach_availability
  for each row execute function private.product_audit();

-- Admin/branch coach directory now surfaces bio, qualifications and availability
-- alongside the existing branch assignment projection.
create or replace function public.coach_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]') from (
  select p.id,p.name,p.bio,p.qualifications,jsonb_agg(distinct bp.branch_id) branch_ids,
   coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'branch_id',a.branch_id,
    'weekday',a.weekday,'start_time',a.start_time,'end_time',a.end_time) order by a.weekday,a.start_time)
    from public.coach_availability a where a.coach_id=p.id),'[]'::jsonb) availability
  from public.profiles p
  join public.role_assignments r on r.user_id=p.id
  join public.branch_permissions bp on bp.user_id=p.id
  where private.head_office() and p.active and r.role='coach'
  group by p.id,p.name,p.bio,p.qualifications) x
$$;

create function private.coach_profile_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; b uuid; wd int; st time; et time; r uuid; quals text[]; begin
 target:=coalesce(nullif(p_data->>'coach_id','')::uuid,auth.uid());
 perform private.require_access(target=auth.uid() or private.head_office());
 perform private.require_access(exists(select 1 from public.role_assignments where user_id=target and role='coach'));
 case p_action
 when 'coach.profile.update' then
  if jsonb_typeof(p_data->'qualifications') is distinct from 'array' then
   raise exception 'Qualifications must be a list' using errcode='22023';end if;
  select array_agg(trim(value)) into quals from jsonb_array_elements_text(p_data->'qualifications') value where trim(value)<>'';
  update public.profiles set bio=coalesce(trim(p_data->>'bio'),''),qualifications=coalesce(quals,'{}')
   where id=target returning id into r;
  if not found then raise exception 'Coach profile not found' using errcode='P0002';end if;
 when 'coach.availability.save' then
  b:=nullif(p_data->>'branch_id','')::uuid;
  if jsonb_typeof(p_data->'weekday') is distinct from 'number' then raise exception 'Invalid availability window' using errcode='22023';end if;
  wd:=(p_data->>'weekday')::int;
  st:=(p_data->>'start_time')::time; et:=(p_data->>'end_time')::time;
  if wd<0 or wd>6 or st is null or et is null or et<=st then raise exception 'Invalid availability window' using errcode='22023';end if;
  if b is not null and not exists(select 1 from public.branches where id=b and active) then
   raise exception 'Branch is not available' using errcode='P0409';end if;
  if b is not null and not exists(select 1 from public.branch_permissions where user_id=target and branch_id=b) then
   raise exception 'Coach is not assigned to that branch' using errcode='42501';end if;
  insert into public.coach_availability(coach_id,branch_id,weekday,start_time,end_time)
   values(target,b,wd,st,et)
   on conflict(coach_id,branch_id,weekday,start_time) do update set end_time=excluded.end_time
   returning id into r;
 when 'coach.availability.remove' then
  delete from public.coach_availability where id=(p_data->>'id')::uuid and coach_id=target returning id into r;
  if r is null then raise exception 'Availability window not found' using errcode='P0002';end if;
 else raise exception 'Unknown coach command' using errcode='22023';
 end case;
 return jsonb_build_object('id',r);
end $$;
revoke all on function private.coach_profile_command(text,jsonb) from public,anon,authenticated;

-- Route the new "coach.*" prefix through the shared product boundary.
create or replace function public.product_command(p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.product_requests; result jsonb; fingerprint text; access_fingerprint text; begin
 perform private.require_access(private.active() and private.mfa_ready());
 if p_key is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>24000 then raise exception 'Invalid command' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if p_action='academy.session.move' then raise exception 'Use schedule.move with entitlement reconciliation' using errcode='P0409';end if;
 if split_part(p_action,'.',1)='coach_attendance' then perform private.require_access(private.coach_attendance_access((p_data->>'session_id')::uuid));end if;
 if p_action='communication.preview' then return private.communication_command(p_action,p_data);end if;
 if p_action='schedule.preview' then return private.operations_extension_command(p_action,p_data);end if;
 access_fingerprint:=private.product_access_revision();
 fingerprint:=md5(p_action||p_data::text);
 select * into old from private.product_requests where actor_id=auth.uid() and key=p_key;
 if found then if old.access_hash is distinct from access_fingerprint then raise exception 'Access changed; submit a newly authorized request' using errcode='42501';end if; if old.payload_hash<>fingerprint then raise exception 'Idempotency mismatch' using errcode='P0409'; end if;return old.response;end if;
 case split_part(p_action,'.',1)
 when 'commercial' then result:=private.commercial_command(p_action,p_data);
 when 'coach_attendance' then result:=private.coach_attendance_command(p_action,p_data);
 when 'coach' then result:=private.coach_profile_command(p_action,p_data);
 when 'academy' then result:=private.academy_command(p_action,p_data);
 when 'development' then result:=private.development_command(p_action,p_data);
 when 'community' then result:=private.community_command(p_action,p_data);
 when 'files' then result:=private.files_command(p_action,p_data);
 when 'communication' then result:=private.communication_command(p_action,p_data);
 when 'schedule' then result:=private.operations_extension_command(p_action,p_data);
 when 'engagement' then result:=private.engagement_command(p_action,p_data);
 when 'events' then result:=private.events_command(p_action,p_data);
 when 'permission' then
 perform private.require_access(private.super_admin());
 if p_action='permission.grant' then
 insert into public.product_permissions(user_id,permission,branch_id,granted_by) values((p_data->>'user_id')::uuid,p_data->>'permission',nullif(p_data->>'branch_id','')::uuid,auth.uid()) on conflict do nothing;
 elsif p_action='permission.revoke' then delete from public.product_permissions where id=(p_data->>'id')::uuid;
 else raise exception 'Unknown command' using errcode='22023';end if;
 result:=jsonb_build_object('saved',true);
 else raise exception 'Unknown command' using errcode='22023';end case;
 insert into private.product_requests(actor_id,key,payload_hash,access_hash,response) values(auth.uid(),p_key,fingerprint,private.product_access_revision(),result);
 return result;
end $$;
revoke all on function public.product_command(text,jsonb,uuid) from public,anon;
grant execute on function public.product_command(text,jsonb,uuid) to authenticated;
