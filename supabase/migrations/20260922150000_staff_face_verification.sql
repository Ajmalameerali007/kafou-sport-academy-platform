-- Staff photo verification is a local synthetic rehearsal capability.
-- Raw photographs and embeddings stay in the loopback worker; Postgres keeps
-- consent, approval, hashes and verification receipts only.
create table private.staff_photo_consents(
  staff_id uuid primary key references public.profiles(id) on delete restrict,
  version int not null default 1,
  granted boolean not null,
  consented_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);
create table private.staff_photo_references(
  id uuid primary key,
  staff_id uuid not null references public.profiles(id) on delete restrict,
  consent_version int not null,
  sha256 text not null,
  model text not null,
  proposed_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index staff_photo_reference_staff on private.staff_photo_references(staff_id);
create index staff_photo_reference_approver on private.staff_photo_references(approved_by);
create table private.staff_photo_receipts(
  staff_id uuid not null references public.profiles(id) on delete restrict,
  sha256 text not null,
  request_key uuid not null,
  fingerprint text not null,
  actor_id uuid not null references public.profiles(id),
  matched boolean not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(staff_id,request_key),
  unique(staff_id,sha256)
);
revoke all on private.staff_photo_consents,private.staff_photo_references,private.staff_photo_receipts from public,anon,authenticated,service_role;

create function private.staff_photo_access(p_staff uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and exists(
   select 1 from public.profiles p
   join public.role_assignments ra on ra.user_id=p.id
   where p.id=p_staff and p.active and ra.role in ('coach','branch','admin','super_admin')
 ) and (
   p_staff=auth.uid() or private.head_office() or exists(
     select 1 from public.branch_permissions target
     where target.user_id=p_staff and private.operations_staff(target.branch_id)
   )
 )
$$;

create function public.staff_photo_info(p_staff uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; can_approve boolean;
begin
 perform private.require_access(private.staff_photo_access(p_staff));
 select private.head_office() or exists(
   select 1 from public.branch_permissions target
   where target.user_id=p_staff and private.operations_staff(target.branch_id)
 ) into can_approve;
 select jsonb_build_object(
   'staff',p.id,'name',p.name,'synthetic',p.synthetic,
   'consent',coalesce(c.granted,false),'version',coalesce(c.version,0),
   'can_approve',coalesce(can_approve,false),
   'references',coalesce((select jsonb_agg(jsonb_build_object(
     'id',r.id,'approved',r.approved_at is not null,'created_at',r.created_at
   ) order by r.created_at desc) from private.staff_photo_references r
   where r.staff_id=p.id and r.withdrawn_at is null and r.created_at>now()-interval '30 days' and c.granted and r.consent_version=c.version),'[]'::jsonb)
 ) into result
 from public.profiles p left join private.staff_photo_consents c on c.staff_id=p.id
 where p.id=p_staff;
 return result;
end $$;

create function public.staff_photo_consent(p_staff uuid,p_granted boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old_ids jsonb;
begin
 perform private.require_access(private.staff_photo_access(p_staff) and p_staff=auth.uid());
 perform private.require_access(exists(select 1 from public.profiles where id=p_staff and synthetic));
 if p_granted is null then raise exception 'Choose whether to consent' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select coalesce(jsonb_agg(id),'[]'::jsonb) into old_ids from private.staff_photo_references where staff_id=p_staff and withdrawn_at is null;
 insert into private.staff_photo_consents(staff_id,granted,consented_by)
 values(p_staff,p_granted,auth.uid())
 on conflict(staff_id) do update set granted=excluded.granted,version=staff_photo_consents.version+1,consented_by=auth.uid(),updated_at=now();
 update private.staff_photo_references set withdrawn_at=now() where staff_id=p_staff and withdrawn_at is null;
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value)
 values(auth.uid(),'staff_photo_consent','profiles',p_staff::text,jsonb_build_object('granted',p_granted));
 return jsonb_build_object('delete_references',old_ids);
end $$;

create function public.staff_reference_candidate(p_payload text,p_signature text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb; version int; staff uuid;
begin
 v:=private.attendance_photo_proof(p_payload,p_signature);
 staff:=(v->>'staff')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 perform private.require_access(v->>'kind'='staff_reference' and private.staff_photo_access(staff) and staff=auth.uid());
 perform private.require_access(exists(select 1 from public.profiles where id=staff and synthetic));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select c.version into version from private.staff_photo_consents c where c.staff_id=staff and c.granted;
 if version is null or version<>(v->>'version')::int then raise exception 'Consent changed. Review consent before enrolling a reference.' using errcode='P0409'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 update private.staff_photo_references set withdrawn_at=now() where staff_id=staff and withdrawn_at is null;
 insert into private.staff_photo_references(id,staff_id,consent_version,sha256,model,proposed_by)
 values((v->>'reference')::uuid,staff,version,v->>'sha256',v->>'model',auth.uid());
 insert into public.audit_events(actor_id,action,entity,entity_id)
 values(auth.uid(),'staff_photo_proposed','profiles',staff::text);
 return public.staff_photo_info(staff);
end $$;

create function public.staff_reference_approve(p_staff uuid,p_reference uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_access(private.staff_photo_access(p_staff) and exists(
   select 1 from public.profiles p where p.id=p_staff and p.synthetic
 ) and (private.head_office() or exists(
   select 1 from public.branch_permissions target where target.user_id=p_staff and private.operations_staff(target.branch_id)
 )));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 update private.staff_photo_references r set approved_by=auth.uid(),approved_at=now()
 where r.id=p_reference and r.staff_id=p_staff and r.withdrawn_at is null and exists(
   select 1 from private.staff_photo_consents c where c.staff_id=r.staff_id and c.granted and c.version=r.consent_version
 );
 if not found then raise exception 'Reference or consent changed' using errcode='P0409'; end if;
 insert into public.audit_events(actor_id,action,entity,entity_id)
 values(auth.uid(),'staff_photo_approved','profiles',p_staff::text);
 return public.staff_photo_info(p_staff);
end $$;

create function public.staff_photo_accept(p_payload text,p_signature text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb; staff uuid; ref uuid; result jsonb; prior private.staff_photo_receipts; fp text; shift_result jsonb;
begin
 v:=private.attendance_photo_proof(p_payload,p_signature);
 staff:=(v->>'staff')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 perform private.require_access(v->>'kind'='staff_session' and private.staff_photo_access(staff) and staff=auth.uid());
 perform private.require_access(exists(
   select 1 from private.staff_photo_references r join private.staff_photo_consents c on c.staff_id=r.staff_id
   where r.staff_id=staff and r.id=(v->>'reference')::uuid and r.created_at>now()-interval '30 days' and r.withdrawn_at is null and r.approved_at is not null and c.granted and c.version=r.consent_version
 ));
 perform private.require_access(exists(select 1 from public.profiles where id=staff and synthetic));
 if v->>'action' is null or v->>'action' not in ('shift.in','shift.out') or v->>'key' is null then raise exception 'Invalid clock action' using errcode='22023';end if;
 fp:=md5(jsonb_build_array(v->'action',v->'data',v->'reference',v->'sha256')::text);
 select * into prior from private.staff_photo_receipts where staff_id=staff and request_key=(v->>'key')::uuid;
 if found then
   if prior.fingerprint<>fp then raise exception 'Photo request changed' using errcode='P0409';end if;
   return prior.response;
 end if;
 if exists(select 1 from private.staff_photo_receipts where staff_id=staff and sha256=v->>'sha256') then raise exception 'Use a new photo for each clock action.' using errcode='P0409';end if;
 if (v->>'matched')::boolean then shift_result:=public.daily_command(v->>'action',v->'data',(v->>'key')::uuid);end if;
 ref:=(v->>'reference')::uuid;
 result:=jsonb_build_object('staff',staff,'matched',coalesce((v->>'matched')::boolean,false),'reference',ref,'processing_ms',v->'processing_ms','shift',shift_result);
 insert into private.staff_photo_receipts(staff_id,sha256,request_key,fingerprint,actor_id,matched,response)
 values(staff,v->>'sha256',(v->>'key')::uuid,fp,auth.uid(),coalesce((v->>'matched')::boolean,false),result);
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(auth.uid(),'staff_face_verification','profiles',staff::text,jsonb_build_object('matched',v->'matched','action',v->'action'));
 return result;
end $$;

revoke all on function private.staff_photo_access(uuid),public.staff_photo_info(uuid),public.staff_photo_consent(uuid,boolean),public.staff_reference_candidate(text,text),public.staff_reference_approve(uuid,uuid),public.staff_photo_accept(text,text) from public,anon,authenticated;
grant execute on function public.staff_photo_info(uuid),public.staff_photo_consent(uuid,boolean),public.staff_reference_candidate(text,text),public.staff_reference_approve(uuid,uuid),public.staff_photo_accept(text,text) to authenticated;
do $$ declare n text; begin foreach n in array array['staff_photo_consents','staff_photo_references','staff_photo_receipts'] loop execute format('alter table private.%I owner to postgres',n); end loop; end $$;
alter function private.staff_photo_access(uuid) owner to postgres;
alter function public.staff_photo_info(uuid) owner to postgres;
alter function public.staff_photo_consent(uuid,boolean) owner to postgres;
alter function public.staff_reference_candidate(text,text) owner to postgres;
alter function public.staff_reference_approve(uuid,uuid) owner to postgres;
alter function public.staff_photo_accept(text,text) owner to postgres;

-- Retention covers both child and staff references in the same private store.
alter function public.attendance_reference_retention() rename to attendance_child_reference_retention;
revoke all on function public.attendance_child_reference_retention() from public,anon,authenticated,service_role;
create function public.attendance_reference_retention() returns jsonb language plpgsql security definer set search_path='' as $$
declare children jsonb; staff jsonb;begin
 children:=public.attendance_child_reference_retention();
 update private.staff_photo_references r set withdrawn_at=now() where r.withdrawn_at is null and (r.created_at<now()-interval '30 days' or not exists(select 1 from private.staff_photo_consents c join public.profiles p on p.id=c.staff_id where c.staff_id=r.staff_id and c.granted and c.version=r.consent_version and p.active and p.synthetic));
 select coalesce(jsonb_agg(id),'[]'::jsonb) into staff from private.staff_photo_references where withdrawn_at is null;
 return children||staff;
end $$;
revoke all on function public.attendance_reference_retention() from public,anon,authenticated;
grant execute on function public.attendance_reference_retention() to service_role;
alter function public.attendance_reference_retention() owner to postgres;
create function public.staff_photo_worker_authorize(p_actor uuid,p_aal text,p_reference uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare claims text; allowed boolean;begin
 if p_actor is null or p_aal is null or p_aal not in ('aal1','aal2') then return false;end if;
 claims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aal',p_aal)::text,true);
 allowed:=private.staff_photo_access(p_actor) and exists(select 1 from private.staff_photo_references r join private.staff_photo_consents c on c.staff_id=r.staff_id join public.profiles p on p.id=r.staff_id where r.id=p_reference and r.staff_id=p_actor and p.synthetic and c.granted and c.version=r.consent_version and r.approved_at is not null and r.withdrawn_at is null and r.created_at>now()-interval '30 days');
 perform set_config('request.jwt.claims',coalesce(claims,''),true);
 return allowed;
end $$;
revoke all on function public.staff_photo_worker_authorize(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.staff_photo_worker_authorize(uuid,text,uuid) to service_role;
alter function public.staff_photo_worker_authorize(uuid,text,uuid) owner to postgres;
