-- Shared drafts are private. Finalization continues to use the existing roster,
-- transactional entitlement/makeup triggers and delivery-independent accounting.
create table private.attendance_drafts(
 session_id uuid primary key references public.class_sessions,
 revision bigint not null default 0, marks jsonb not null default '{}',
 updated_by uuid references public.profiles, updated_at timestamptz not null default now()
);
create table private.attendance_draft_requests(
 actor_id uuid not null references public.profiles, key uuid not null,
 session_id uuid not null references public.class_sessions, fingerprint text not null,
 response jsonb not null, created_at timestamptz not null default now(),primary key(actor_id,key)
);
create index attendance_draft_request_session on private.attendance_draft_requests(session_id);
create index attendance_draft_actor on private.attendance_drafts(updated_by);
revoke all on private.attendance_drafts,private.attendance_draft_requests from public,anon,authenticated;

create function private.attendance_access(p_session uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and exists(
 select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=p_session and
 (private.operations_staff(c.branch_id) or
 (private.development_coach_session(s.id) and (not p_write or private.coach_attendance_access(s.id)))))
$$;
revoke all on function private.attendance_access(uuid,boolean) from public,anon,authenticated;

create function public.attendance_register(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.attendance_access(p_session));
 select jsonb_build_object('id',s.id,'name',c.name,'branch',b.name,'branch_id',b.id,
 'sport',c.sport,'level',l.name,'venue',v.name,'coach',p.name,'starts_at',s.starts_at,'ends_at',s.ends_at,
 'status',s.status,'finalized_at',s.finalized_at,'can_mark',private.attendance_access(s.id,true),
 'can_photo',private.attendance_access(s.id,true) and private.product_can('attendance.photo',c.branch_id),
 'revision',coalesce(d.revision,0),'marks',coalesce(d.marks,'{}'::jsonb),
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
revoke all on function public.attendance_register(uuid) from public,anon;
grant execute on function public.attendance_register(uuid) to authenticated;

create function public.attendance_draft_command(p_session uuid,p_action text,p_revision bigint,p_roster_token text,p_marks jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.class_sessions; d private.attendance_drafts; prior private.attendance_draft_requests;
 fingerprint text; snapshot jsonb; entries jsonb; result jsonb;begin
 perform private.require_access(private.attendance_access(p_session,true));
 if p_action not in ('save','finish') or p_action is null or p_key is null or p_revision is null or p_roster_token is null or jsonb_typeof(p_marks) is distinct from 'object' or octet_length(p_marks::text)>16000 then raise exception 'Invalid attendance draft' using errcode='22023';end if;
 -- Serialize with the existing booking/finalization commands, always same lock order.
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into s from public.class_sessions where id=p_session for update;
 fingerprint:=md5(jsonb_build_array(p_session,p_action,p_revision,p_roster_token,p_marks)::text);
 select * into prior from private.attendance_draft_requests where actor_id=auth.uid() and key=p_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'Retry does not match original attendance action' using errcode='P0409';end if;
  return prior.response;
 end if;
 if s.finalized_at is not null or s.status<>'scheduled' then raise exception 'Attendance is locked. Use an authorized correction with a reason.' using errcode='P0409';end if;
 insert into private.attendance_drafts(session_id) values(p_session) on conflict do nothing;
 select * into d from private.attendance_drafts where session_id=p_session for update;
 snapshot:=public.attendance_register(p_session);
 if d.revision<>p_revision or snapshot->>'roster_token'<>p_roster_token then
  raise exception 'The register changed. Review the latest draft before saving.' using errcode='P0409';end if;
 if p_action='save' then
  if exists(select 1 from jsonb_each_text(p_marks) i where i.value not in ('present','late','absent','excused','') or i.value is null
   or not exists(select 1 from public.session_roster r where r.session_id=p_session and not r.cancelled and r.id::text=i.key)) then raise exception 'Invalid roster entry or attendance state' using errcode='22023';end if;
  update private.attendance_drafts set marks=p_marks,revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where session_id=p_session;
 else
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'attendance',d.marks->>r.id::text)),'[]'::jsonb) into entries from public.session_roster r where r.session_id=p_session and not r.cancelled;
  if exists(select 1 from jsonb_array_elements(entries) i where coalesce(i->>'attendance','') not in ('present','late','absent','excused')) then raise exception 'Resolve every unmarked student before finishing attendance.' using errcode='22023';end if;
  if private.coach_attendance_access(p_session) then
   perform private.coach_attendance_command('coach_attendance.finalize',jsonb_build_object('session_id',p_session,'entries',entries));
  else
   perform public.operations_command('attendance.finalize',jsonb_build_object('session_id',p_session,'entries',entries));
  end if;
  update private.attendance_drafts set revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid() where session_id=p_session;
 end if;
 result:=jsonb_build_object('id',p_session,'revision',d.revision+1,'finished',p_action='finish','committed_at',clock_timestamp());
 insert into private.attendance_draft_requests(actor_id,key,session_id,fingerprint,response) values(auth.uid(),p_key,p_session,fingerprint,result);
 return result;
end $$;
revoke all on function public.attendance_draft_command(uuid,text,bigint,text,jsonb,uuid) from public,anon;
grant execute on function public.attendance_draft_command(uuid,text,bigint,text,jsonb,uuid) to authenticated;

-- Match existing command owners when an administrator applies the reviewed SQL.
alter table private.attendance_drafts owner to postgres;
alter table private.attendance_draft_requests owner to postgres;
alter function private.attendance_access(uuid,boolean) owner to postgres;
alter function public.attendance_register(uuid) owner to postgres;
alter function public.attendance_draft_command(uuid,text,bigint,text,jsonb,uuid) owner to postgres;
