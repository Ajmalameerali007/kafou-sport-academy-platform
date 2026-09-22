create function private.attendance_photo_receipt_limit() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (select count(*) from private.attendance_photo_receipts where session_id=new.session_id)>=10 then raise exception 'This session has reached its limit of 10 photographs. Resolve remaining students manually.' using errcode='P0409';end if;
 return new;
end $$;
revoke all on function private.attendance_photo_receipt_limit() from public,anon,authenticated;
create trigger attendance_photo_limit before insert on private.attendance_photo_receipts for each row execute function private.attendance_photo_receipt_limit();
alter function private.attendance_photo_receipt_limit() owner to postgres;
-- Reuse the existing transactional event/outbox, leaving external delivery inactive.
create function private.attendance_family_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;b uuid;begin
 if old.finalized_at is null and new.finalized_at is not null then
 select branch_id into b from public.academy_classes where id=new.class_id;
 for r in select sr.id,k.family_id,k.id child_id from public.session_roster sr left join public.enrollments e on e.id=sr.enrollment_id left join public.trial_bookings tb on tb.id=sr.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id join public.children k on k.id=coalesce(e.child_id,q.child_id) where sr.session_id=new.id and not sr.cancelled loop
 perform private.emit_product_event('attendance.finalized',r.id,r.family_id,b,'Attendance updated','Your child’s finalized attendance is available in Schedule history.','/parent?view=Schedule&child='||r.child_id::text);
 end loop;
 end if;return new;
end $$;
revoke all on function private.attendance_family_notice() from public,anon,authenticated;
create trigger attendance_family_notice after update on public.class_sessions for each row execute function private.attendance_family_notice();
alter function private.attendance_family_notice() owner to postgres;

create table private.attendance_review_requests(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.class_sessions,roster_id uuid not null references public.session_roster,actor_id uuid not null references public.profiles,key uuid not null,reason text not null check(length(trim(reason)) between 5 and 500),created_at timestamptz not null default now(),resolved_by uuid references public.profiles,resolved_at timestamptz,unique(actor_id,key));
create index attendance_review_session on private.attendance_review_requests(session_id);
create index attendance_review_roster on private.attendance_review_requests(roster_id);
create index attendance_review_resolver on private.attendance_review_requests(resolved_by);
revoke all on private.attendance_review_requests from public,anon,authenticated;
alter table private.attendance_review_requests owner to postgres;
create function public.attendance_reviews(p_session uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_access(private.attendance_access(p_session));
 return jsonb_build_object('can_resolve',exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=p_session and private.product_can('attendance.correct',c.branch_id)),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'roster_id',roster_id,'reason',reason,'resolved_at',resolved_at,'created_at',created_at) order by created_at desc) from private.attendance_review_requests where session_id=p_session),'[]'::jsonb));
end $$;
create function public.attendance_request_review(p_session uuid,p_roster uuid,p_reason text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;old private.attendance_review_requests;begin
 perform private.require_access(private.attendance_access(p_session));
 if not exists(select 1 from public.class_sessions s join public.session_roster r on r.session_id=s.id where s.id=p_session and s.finalized_at is not null and r.id=p_roster and not r.cancelled) or p_key is null or p_reason is null or length(trim(p_reason)) not between 5 and 500 then raise exception 'Select a finalized student and enter a correction reason.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into old from private.attendance_review_requests where actor_id=auth.uid() and key=p_key;
 if found then if old.session_id<>p_session or old.roster_id<>p_roster or old.reason<>p_reason then raise exception 'Review request changed' using errcode='P0409';end if;return old.id;end if;
 insert into private.attendance_review_requests(session_id,roster_id,actor_id,key,reason) values(p_session,p_roster,auth.uid(),p_key,p_reason) returning id into rid;
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(auth.uid(),'attendance_correction_requested','session_roster',p_roster::text,jsonb_build_object('request_id',rid,'reason',p_reason));
 return rid;
end $$;
create function public.attendance_resolve_review(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform private.require_access(exists(select 1 from private.attendance_review_requests r join public.class_sessions s on s.id=r.session_id join public.academy_classes c on c.id=s.class_id where r.id=p_id and private.product_can('attendance.correct',c.branch_id)));
 update private.attendance_review_requests set resolved_at=coalesce(resolved_at,now()),resolved_by=coalesce(resolved_by,auth.uid()) where id=p_id;
 return p_id;
end $$;
revoke all on function public.attendance_reviews(uuid),public.attendance_request_review(uuid,uuid,text,uuid),public.attendance_resolve_review(uuid) from public,anon;
grant execute on function public.attendance_reviews(uuid),public.attendance_request_review(uuid,uuid,text,uuid),public.attendance_resolve_review(uuid) to authenticated;
alter function public.attendance_reviews(uuid) owner to postgres;
alter function public.attendance_request_review(uuid,uuid,text,uuid) owner to postgres;
alter function public.attendance_resolve_review(uuid) owner to postgres;

create or replace function public.attendance_photo_scope(p_session uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.attendance_access(p_session,true) and exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=p_session and private.product_can('attendance.photo',c.branch_id)));
 select coalesce(jsonb_agg(jsonb_build_object('roster',r.id,'child',k.id,'reference',ref.id,'version',pc.version,'status',case when not coalesce(pc.granted,false) then 'consent_unavailable' when ref.id is null then 'missing_reference' else 'ready' end) order by r.id),'[]'::jsonb) into result
 from public.session_roster r left join public.enrollments e on e.id=r.enrollment_id left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id left join public.children k on k.id=coalesce(e.child_id,q.child_id)
 left join private.attendance_photo_consents pc on pc.child_id=k.id
 left join private.attendance_photo_references ref on ref.child_id=k.id and ref.withdrawn_at is null and ref.created_at>now()-interval '30 days' and ref.approved_at is not null and ref.consent_version=pc.version and pc.granted and k.synthetic
 where r.session_id=p_session and not r.cancelled;
 return result;
end $$;

create or replace function public.attendance_reference_info(p_child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.attendance_photo_child_access(p_child));
 select jsonb_build_object('child',c.id,'name',c.name,'synthetic',c.synthetic,'guardian',private.family_owner(c.family_id),'consent',coalesce(x.granted,false),'version',coalesce(x.version,0),'references',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'approved',r.approved_at is not null,'created_at',r.created_at)) from private.attendance_photo_references r where r.child_id=c.id and r.withdrawn_at is null and r.created_at>now()-interval '30 days' and x.granted and r.consent_version=x.version),'[]'::jsonb)) into result from public.children c left join private.attendance_photo_consents x on x.child_id=c.id where c.id=p_child;
 return result;
end $$;

create or replace function public.attendance_draft_command(p_session uuid,p_action text,p_revision bigint,p_roster_token text,p_marks jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.attendance_drafts; x record;result jsonb;fresh_write boolean;begin
 perform private.require_access(private.attendance_access(p_session,true));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into d from private.attendance_drafts where session_id=p_session;
 fresh_write:=not exists(select 1 from private.attendance_draft_requests where actor_id=auth.uid() and key=p_key);
 if p_action='finish' and exists(select 1 from jsonb_each_text(d.photo_sources) src where exists(select 1 from public.session_roster rr where rr.session_id=p_session and not rr.cancelled and rr.id::text=src.key) and not exists(select 1 from private.attendance_photo_references r join private.attendance_photo_consents c on c.child_id=r.child_id where r.id::text=src.value and r.withdrawn_at is null and r.created_at>now()-interval '30 days' and r.approved_at is not null and c.granted and c.version=r.consent_version)) then raise exception 'Photo consent or reference changed. Review automatic marks manually before finishing.' using errcode='P0409';end if;
 result:=public.attendance_draft_before_photos(p_session,p_action,p_revision,p_roster_token,p_marks,p_key);
 if p_action='save' and fresh_write then
  for x in select key,value from jsonb_each_text(d.photo_sources) loop
   if p_marks->>x.key is distinct from d.marks->>x.key then update private.attendance_drafts set photo_sources=photo_sources-x.key where session_id=p_session;end if;
  end loop;
 end if;
 return result;
end $$;

create or replace function private.attendance_photo_child_access(p_child uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and exists(select 1 from public.children c where c.id=p_child and
 (private.family_owner(c.family_id) or exists(select 1 from public.family_branches b where b.family_id=c.family_id and private.operations_staff(b.branch_id) and private.product_can('attendance.photo',b.branch_id))))
$$;

create or replace function public.attendance_register(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.attendance_access(p_session));
 select jsonb_build_object('id',s.id,'name',c.name,'branch',b.name,'branch_id',b.id,
 'sport',c.sport,'level',l.name,'venue',v.name,'coach',p.name,'starts_at',s.starts_at,'ends_at',s.ends_at,
 'status',s.status,'finalized_at',s.finalized_at,'can_mark',private.attendance_access(s.id,true),
 'can_photo',private.attendance_access(s.id,true) and private.product_can('attendance.photo',c.branch_id),
 'revision',coalesce(d.revision,0),'marks',coalesce((select jsonb_object_agg(x.key,x.value) from jsonb_each(d.marks) x where exists(select 1 from public.session_roster rr where rr.session_id=s.id and not rr.cancelled and rr.id::text=x.key)),'{}'::jsonb),
 'photo_review_required',coalesce((select jsonb_agg(x.key) from jsonb_each_text(d.photo_sources) x where exists(select 1 from public.session_roster rr where rr.session_id=s.id and not rr.cancelled and rr.id::text=x.key) and not exists(select 1 from private.attendance_photo_references ref join private.attendance_photo_consents con on con.child_id=ref.child_id where ref.id::text=x.value and ref.withdrawn_at is null and ref.created_at>now()-interval '30 days' and ref.approved_at is not null and con.granted and con.version=ref.consent_version)),'[]'::jsonb),
 'updated_at',d.updated_at,'roster_token',md5(coalesce((select string_agg(r.id::text,',' order by r.id) from public.session_roster r where r.session_id=s.id and not r.cancelled),'')),
 'roster',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'child_id',k.id,
 'name',coalesce(k.name,q.child_name,'Trial participant'),'kind',r.kind,'attendance',r.attendance) order by r.id)
 from public.session_roster r left join public.enrollments e on e.id=r.enrollment_id
 left join public.trial_bookings tb on tb.id=r.trial_booking_id
 left join public.trial_enquiries q on q.id=tb.enquiry_id
 left join public.children k on k.id=coalesce(e.child_id,q.child_id)
 where r.session_id=s.id and not r.cancelled),'[]'::jsonb)) into result
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id
 join public.branches b on b.id=c.branch_id join public.venues v on v.id=c.venue_id
 join public.sport_levels l on l.id=c.level_id join public.profiles p on p.id=c.coach_id
 left join private.attendance_drafts d on d.session_id=s.id where s.id=p_session;
 return result;
end $$;
create function public.attendance_manual_review(p_session uuid,p_revision bigint,p_token text,p_roster uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;result jsonb;fingerprint text;prior private.attendance_draft_requests;begin
 perform private.require_access(private.attendance_access(p_session,true));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 fingerprint:=md5(jsonb_build_array('manual_review',p_session,p_revision,p_token,p_roster)::text);
 select * into prior from private.attendance_draft_requests where actor_id=auth.uid() and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'Review request changed' using errcode='P0409';end if;return prior.response;end if;
 v:=public.attendance_register(p_session);
 if p_key is null or p_revision is null or p_token is null or v->>'revision' is distinct from p_revision::text or v->>'roster_token' is distinct from p_token or v->>'finalized_at' is not null or not exists(select 1 from public.session_roster where id=p_roster and session_id=p_session and not cancelled) then raise exception 'The register changed. Review the latest draft before saving.' using errcode='P0409';end if;
 update private.attendance_drafts set photo_sources=photo_sources-p_roster::text,revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where session_id=p_session;
 if not found then raise exception 'No automatic draft mark to review' using errcode='P0409';end if;
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(auth.uid(),'attendance_manual_review','session_roster',p_roster::text,jsonb_build_object('attendance',v->'marks'->p_roster::text));
 result:=jsonb_build_object('id',p_session,'revision',p_revision+1);
 insert into private.attendance_draft_requests(actor_id,key,session_id,fingerprint,response) values(auth.uid(),p_key,p_session,fingerprint,result);
 return result;
end $$;
revoke all on function public.attendance_manual_review(uuid,bigint,text,uuid,uuid) from public,anon;
grant execute on function public.attendance_manual_review(uuid,bigint,text,uuid,uuid) to authenticated;
alter function public.attendance_manual_review(uuid,bigint,text,uuid,uuid) owner to postgres;
