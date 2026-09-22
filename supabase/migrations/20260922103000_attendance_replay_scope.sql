-- Preserve past photo receipts; a changed reference scope creates a new review result.
alter table private.attendance_photo_receipts add column scope_hash text not null default '';
alter table private.attendance_photo_receipts drop constraint attendance_photo_receipts_pkey;
alter table private.attendance_photo_receipts add primary key(session_id,sha256,scope_hash);
create or replace function private.attendance_photo_receipt_limit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from private.attendance_photo_receipts where session_id=new.session_id and sha256=new.sha256) and (select count(distinct sha256) from private.attendance_photo_receipts where session_id=new.session_id)>=10 then raise exception 'This session has reached its limit of 10 photographs. Resolve remaining students manually.' using errcode='P0409';end if;
 return new;
end $$;
create or replace function public.attendance_draft_command(p_session uuid,p_action text,p_revision bigint,p_roster_token text,p_marks jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.attendance_drafts; x record;result jsonb;fresh_write boolean;begin
 perform private.require_access(private.attendance_access(p_session,true));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into d from private.attendance_drafts where session_id=p_session;
 fresh_write:=not exists(select 1 from private.attendance_draft_requests where actor_id=auth.uid() and key=p_key);
 if p_action='finish' and fresh_write and exists(select 1 from jsonb_each_text(d.photo_sources) src where exists(select 1 from public.session_roster rr where rr.session_id=p_session and not rr.cancelled and rr.id::text=src.key) and not exists(select 1 from private.attendance_photo_references r join private.attendance_photo_consents c on c.child_id=r.child_id where r.id::text=src.value and r.withdrawn_at is null and r.created_at>now()-interval '30 days' and r.approved_at is not null and c.granted and c.version=r.consent_version)) then raise exception 'Photo consent or reference changed. Review automatic marks manually before finishing.' using errcode='P0409';end if;
 result:=public.attendance_draft_before_photos(p_session,p_action,p_revision,p_roster_token,p_marks,p_key);
 if p_action='save' and fresh_write then
  for x in select key,value from jsonb_each_text(d.photo_sources) loop
   if p_marks->>x.key is distinct from d.marks->>x.key then update private.attendance_drafts set photo_sources=photo_sources-x.key where session_id=p_session;end if;
  end loop;
 end if;
 return result;
end $$;

create or replace function public.attendance_photo_accept(p_payload text,p_signature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;sid uuid;scope jsonb;snapshot jsonb;marks jsonb;prior jsonb;result jsonb;i jsonb;matched int:=0;reuse boolean;begin
 v:=private.attendance_photo_proof(p_payload,p_signature);sid:=(v->>'session')::uuid;
 perform private.require_access(v->>'kind'='session');
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 scope:=public.attendance_photo_scope(sid);
 if scope is distinct from v->'scope' then raise exception 'Consent, reference or roster changed. Process the photo again.' using errcode='P0409';end if;
 select response into prior from private.attendance_photo_receipts where session_id=sid and sha256=v->>'sha256' and scope_hash=md5(scope::text);
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
 insert into private.attendance_photo_receipts(session_id,sha256,actor_id,response,scope_hash) values(sid,v->>'sha256',auth.uid(),result,md5(scope::text));
 return result;
end $$;
