-- Private consent/reference metadata. No photograph, crop or embedding is stored
-- in public records. Engine signing is provisioned locally, never in this file.
create table private.attendance_engine_key(id boolean primary key default true check(id),secret text not null);
create table private.attendance_photo_consents(child_id uuid primary key references public.children,version int not null default 1,granted boolean not null,guardian_id uuid not null references public.profiles,updated_at timestamptz not null default now());
create table private.attendance_photo_references(id uuid primary key,child_id uuid not null references public.children,consent_version int not null,sha256 text not null,model text not null,guardian_id uuid not null references public.profiles,approved_by uuid references public.profiles,approved_at timestamptz,created_at timestamptz not null default now(),withdrawn_at timestamptz);
create index attendance_photo_reference_child on private.attendance_photo_references(child_id);
create index attendance_photo_reference_guardian on private.attendance_photo_references(guardian_id);
create index attendance_photo_reference_approver on private.attendance_photo_references(approved_by);
create index attendance_photo_consent_guardian on private.attendance_photo_consents(guardian_id);
create table private.attendance_photo_receipts(session_id uuid not null references public.class_sessions,sha256 text not null,actor_id uuid not null references public.profiles,response jsonb not null,created_at timestamptz not null default now(),primary key(session_id,sha256));
create index attendance_photo_receipt_actor on private.attendance_photo_receipts(actor_id);
revoke all on private.attendance_engine_key,private.attendance_photo_consents,private.attendance_photo_references,private.attendance_photo_receipts from public,anon,authenticated,service_role;

create function private.attendance_photo_child_access(p_child uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and exists(select 1 from public.children c where c.id=p_child and
 (private.family_owner(c.family_id) or exists(select 1 from public.family_branches b where b.family_id=c.family_id and private.operations_staff(b.branch_id))))
$$;
create function public.attendance_reference_info(p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.attendance_photo_child_access(p_child));
 select jsonb_build_object('child',c.id,'name',c.name,'synthetic',c.synthetic,'guardian',private.family_owner(c.family_id),'consent',coalesce(x.granted,false),'version',coalesce(x.version,0),'references',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'approved',r.approved_at is not null,'created_at',r.created_at)) from private.attendance_photo_references r where r.child_id=c.id and r.withdrawn_at is null and x.granted and r.consent_version=x.version),'[]'::jsonb)) into result from public.children c left join private.attendance_photo_consents x on x.child_id=c.id where c.id=p_child;
 return result;
end $$;
create function public.attendance_photo_consent(p_child uuid,p_granted boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_ids jsonb;begin
 perform private.require_access(private.active() and private.mfa_ready() and exists(select 1 from public.children c where c.id=p_child and c.synthetic and private.family_owner(c.family_id)));
 if p_granted is null then raise exception 'Choose whether to consent' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select coalesce(jsonb_agg(id),'[]'::jsonb) into old_ids from private.attendance_photo_references where child_id=p_child and withdrawn_at is null;
 insert into private.attendance_photo_consents(child_id,granted,guardian_id) values(p_child,p_granted,auth.uid()) on conflict(child_id) do update set granted=excluded.granted,version=attendance_photo_consents.version+1,guardian_id=auth.uid(),updated_at=now();
 update private.attendance_photo_references set withdrawn_at=now() where child_id=p_child and withdrawn_at is null;
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(auth.uid(),'attendance_photo_consent','children',p_child::text,jsonb_build_object('granted',p_granted));
 return jsonb_build_object('delete_references',old_ids);
end $$;
create function private.attendance_photo_proof(p_payload text,p_signature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare k text;v jsonb;begin
 select secret into k from private.attendance_engine_key where id;
 if k is null or encode(extensions.hmac(p_payload,k,'sha256'),'hex') is distinct from p_signature then raise exception 'Photo processing proof unavailable' using errcode='42501';end if;
 v:=p_payload::jsonb;
 if v->>'actor' is distinct from auth.uid()::text or abs(extract(epoch from clock_timestamp())-(v->>'time')::numeric)>120 then raise exception 'Photo processing authorization expired' using errcode='42501';end if;
 return v;
end $$;
create function public.attendance_reference_candidate(p_payload text,p_signature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;version int;begin
 v:=private.attendance_photo_proof(p_payload,p_signature);
 perform private.require_access(v->>'kind'='reference' and exists(select 1 from public.children c where c.id=(v->>'child')::uuid and c.synthetic and private.family_owner(c.family_id)));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select x.version into version from private.attendance_photo_consents x where x.child_id=(v->>'child')::uuid and x.granted;
 if version is null or version<>(v->>'version')::int then raise exception 'Consent changed. Review consent before enrolling a reference.' using errcode='P0409';end if;
 update private.attendance_photo_references set withdrawn_at=now() where child_id=(v->>'child')::uuid and withdrawn_at is null;
 insert into private.attendance_photo_references(id,child_id,consent_version,sha256,model,guardian_id) values((v->>'reference')::uuid,(v->>'child')::uuid,version,v->>'sha256',v->>'model',auth.uid());
 insert into public.audit_events(actor_id,action,entity,entity_id) values(auth.uid(),'attendance_reference_proposed','children',v->>'child');
 return public.attendance_reference_info((v->>'child')::uuid);
end $$;
create function public.attendance_reference_approve(p_child uuid,p_reference uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_access(private.active() and private.mfa_ready() and exists(select 1 from public.children c join public.family_branches b on b.family_id=c.family_id where c.id=p_child and c.synthetic and private.operations_staff(b.branch_id) and private.product_can('attendance.photo',b.branch_id)));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 update private.attendance_photo_references r set approved_by=auth.uid(),approved_at=now() where r.id=p_reference and r.child_id=p_child and r.withdrawn_at is null and exists(select 1 from private.attendance_photo_consents c where c.child_id=r.child_id and c.granted and c.version=r.consent_version);
 if not found then raise exception 'Reference or consent changed' using errcode='P0409';end if;
 insert into public.audit_events(actor_id,action,entity,entity_id) values(auth.uid(),'attendance_reference_confirmed','children',p_child::text);
 return public.attendance_reference_info(p_child);
end $$;
create function public.attendance_photo_scope(p_session uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.attendance_access(p_session,true) and exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=p_session and private.product_can('attendance.photo',c.branch_id)));
 select coalesce(jsonb_agg(jsonb_build_object('roster',r.id,'child',k.id,'reference',ref.id,'version',pc.version,'status',case when not coalesce(pc.granted,false) then 'consent_unavailable' when ref.id is null then 'missing_reference' else 'ready' end) order by r.id),'[]'::jsonb) into result
 from public.session_roster r left join public.enrollments e on e.id=r.enrollment_id left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id left join public.children k on k.id=coalesce(e.child_id,q.child_id)
 left join private.attendance_photo_consents pc on pc.child_id=k.id
 left join private.attendance_photo_references ref on ref.child_id=k.id and ref.withdrawn_at is null and ref.approved_at is not null and ref.consent_version=pc.version and pc.granted and k.synthetic
 where r.session_id=p_session and not r.cancelled;
 return result;
end $$;
create function public.attendance_photo_accept(p_payload text,p_signature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;sid uuid;scope jsonb;snapshot jsonb;marks jsonb;prior jsonb;result jsonb;i jsonb;matched int:=0;reuse boolean;begin
 v:=private.attendance_photo_proof(p_payload,p_signature);sid:=(v->>'session')::uuid;
 perform private.require_access(v->>'kind'='session');
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 scope:=public.attendance_photo_scope(sid);
 if scope is distinct from v->'scope' then raise exception 'Consent, reference or roster changed. Process the photo again.' using errcode='P0409';end if;
 select response into prior from private.attendance_photo_receipts where session_id=sid and sha256=v->>'sha256';
 if found then return prior||jsonb_build_object('duplicate',true);end if;
 snapshot:=public.attendance_register(sid);marks:=snapshot->'marks';
 if snapshot->>'revision' is distinct from v->>'revision' or snapshot->>'roster_token' is distinct from v->>'roster_token' then raise exception 'The draft changed while processing. Review and retry.' using errcode='P0409';end if;
 for i in select value from jsonb_array_elements(v->'matched') loop
  if not exists(select 1 from jsonb_array_elements(scope) x where x->>'roster'=i#>>'{}' and x->>'status'='ready') then raise exception 'Invalid photo match' using errcode='22023';end if;
  if coalesce(marks->>(i#>>'{}'),'')='' then marks:=jsonb_set(marks,array[i#>>'{}'],'"present"');matched:=matched+1;end if;
 end loop;
 perform public.attendance_draft_command(sid,'save',(snapshot->>'revision')::bigint,snapshot->>'roster_token',marks,gen_random_uuid());

 for i in select value from jsonb_array_elements(v->'matched') loop
  if coalesce(snapshot->'marks'->>(i#>>'{}'),'')='' then
   update private.attendance_drafts set photo_sources=jsonb_set(photo_sources,array[i#>>'{}'],(select x->'reference' from jsonb_array_elements(scope) x where x->>'roster'=i#>>'{}')) where session_id=sid;
  end if;
 end loop;
 select exists(select 1 from private.attendance_photo_receipts where sha256=v->>'sha256' and session_id<>sid) into reuse;
 result:=jsonb_build_object('matched',matched,'exceptions',v->'exceptions','cross_session_reuse',reuse,'processing_ms',v->'processing_ms','duplicate',false);
 insert into private.attendance_photo_receipts(session_id,sha256,actor_id,response) values(sid,v->>'sha256',auth.uid(),result);
 return result;
end $$;
revoke all on function private.attendance_photo_child_access(uuid),private.attendance_photo_proof(text,text) from public,anon,authenticated;
revoke all on function public.attendance_reference_info(uuid),public.attendance_photo_consent(uuid,boolean),public.attendance_reference_candidate(text,text),public.attendance_reference_approve(uuid,uuid),public.attendance_photo_scope(uuid),public.attendance_photo_accept(text,text) from public,anon;
grant execute on function public.attendance_reference_info(uuid),public.attendance_photo_consent(uuid,boolean),public.attendance_reference_candidate(text,text),public.attendance_reference_approve(uuid,uuid),public.attendance_photo_scope(uuid),public.attendance_photo_accept(text,text) to authenticated;
do $$declare n text;begin
 foreach n in array array['attendance_engine_key','attendance_photo_consents','attendance_photo_references','attendance_photo_receipts'] loop execute format('alter table private.%I owner to postgres',n);end loop;
end $$;
alter function private.attendance_photo_child_access(uuid) owner to postgres;
alter function private.attendance_photo_proof(text,text) owner to postgres;
alter function public.attendance_reference_info(uuid) owner to postgres;
alter function public.attendance_photo_consent(uuid,boolean) owner to postgres;
alter function public.attendance_reference_candidate(text,text) owner to postgres;
alter function public.attendance_reference_approve(uuid,uuid) owner to postgres;
alter function public.attendance_photo_scope(uuid) owner to postgres;
alter function public.attendance_photo_accept(text,text) owner to postgres;
-- A consent withdrawal after matching also blocks finalization of automatic marks.
alter table private.attendance_drafts add column photo_sources jsonb not null default '{}';
alter function public.attendance_draft_command(uuid,text,bigint,text,jsonb,uuid) rename to attendance_draft_before_photos;
revoke all on function public.attendance_draft_before_photos(uuid,text,bigint,text,jsonb,uuid) from public,anon,authenticated;
create function public.attendance_draft_command(p_session uuid,p_action text,p_revision bigint,p_roster_token text,p_marks jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.attendance_drafts; x record;result jsonb;begin
 perform private.require_access(private.attendance_access(p_session,true));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into d from private.attendance_drafts where session_id=p_session;
 if p_action='finish' and exists(select 1 from jsonb_each_text(d.photo_sources) src where not exists(select 1 from private.attendance_photo_references r join private.attendance_photo_consents c on c.child_id=r.child_id where r.id::text=src.value and r.withdrawn_at is null and r.approved_at is not null and c.granted and c.version=r.consent_version)) then raise exception 'Photo consent or reference changed. Review automatic marks manually before finishing.' using errcode='P0409';end if;
 result:=public.attendance_draft_before_photos(p_session,p_action,p_revision,p_roster_token,p_marks,p_key);
 if p_action='save' then
  for x in select key,value from jsonb_each_text(d.photo_sources) loop
   if p_marks->>x.key is distinct from d.marks->>x.key then update private.attendance_drafts set photo_sources=photo_sources-x.key where session_id=p_session;end if;
  end loop;
 end if;
 return result;
end $$;
revoke all on function public.attendance_draft_command(uuid,text,bigint,text,jsonb,uuid) from public,anon;
grant execute on function public.attendance_draft_command(uuid,text,bigint,text,jsonb,uuid) to authenticated;
alter function public.attendance_draft_command(uuid,text,bigint,text,jsonb,uuid) owner to postgres;
-- Local worker retention boundary: reference metadata is retained for audit, but
-- templates and pictures expire after 30 days. No group photographs are retained.
create function public.attendance_reference_retention() returns jsonb language plpgsql security definer set search_path='' as $$
declare ids jsonb;begin
 update private.attendance_photo_references r set withdrawn_at=now() where r.withdrawn_at is null and (r.created_at<now()-interval '30 days' or not exists(select 1 from private.attendance_photo_consents c where c.child_id=r.child_id and c.granted and c.version=r.consent_version));
 select coalesce(jsonb_agg(id),'[]'::jsonb) into ids from private.attendance_photo_references where withdrawn_at is null;
 return ids;
end $$;
revoke all on function public.attendance_reference_retention() from public,anon,authenticated;
grant execute on function public.attendance_reference_retention() to service_role;
alter function public.attendance_reference_retention() owner to postgres;
