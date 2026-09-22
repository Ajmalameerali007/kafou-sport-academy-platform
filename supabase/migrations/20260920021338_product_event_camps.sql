-- Synthetic dated camp occurrences. The parent event retains its first occurrence dates for compatibility.
alter table public.academy_events add column event_kind text not null default 'one_off' check(event_kind in('one_off','camp'));
alter table public.academy_events drop constraint academy_events_policy_version_check;
alter table public.academy_events add constraint event_policy_version_check check((event_kind='one_off' and policy_version='synthetic-one-off-v1') or (event_kind='camp' and policy_version='synthetic-camp-v1'));
create table public.event_occurrences(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.academy_events,position int not null check(position between 1 and 30),
 venue_id uuid not null references public.venues,coach_id uuid references public.profiles,
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at and ends_at<=starts_at+interval '12 hours'),
 status text not null default 'scheduled' check(status in('scheduled','cancelled')),cancellation_reason text,
 finalized_at timestamptz,finalized_by uuid references public.profiles,created_at timestamptz not null default now(),
 unique(event_id,position),unique(event_id,starts_at),
 check((starts_at at time zone 'Asia/Dubai')::date=(ends_at at time zone 'Asia/Dubai')::date),check((finalized_at is null)=(finalized_by is null))
);
-- Preserve the old one-off timetable, including cancellations, without inventing attendance.
insert into public.event_occurrences(event_id,position,venue_id,starts_at,ends_at,status,cancellation_reason)
select id,1,venue_id,starts_at,ends_at,case when status='cancelled' then 'cancelled' else 'scheduled' end,cancellation_reason from public.academy_events;
create table public.event_attendance(
 id uuid primary key default gen_random_uuid(),occurrence_id uuid not null references public.event_occurrences,registration_id uuid not null references public.event_registrations,
 attendance text check(attendance in('present','absent','late','excused')),recorded_by uuid references public.profiles,updated_at timestamptz not null default now(),unique(occurrence_id,registration_id)
);
insert into public.event_attendance(occurrence_id,registration_id) select o.id,r.id from public.event_occurrences o join public.event_registrations r on r.event_id=o.event_id;
create table public.event_attendance_corrections(
 id uuid primary key default gen_random_uuid(),attendance_id uuid not null references public.event_attendance,
 previous_attendance text not null,attendance text not null check(attendance in('present','absent','late','excused')),
 reason text not null check(length(trim(reason)) between 5 and 500),corrected_by uuid not null references public.profiles,created_at timestamptz not null default now()
);
alter table public.event_consents add column occurrence_snapshot jsonb not null default '[]'::jsonb check(jsonb_typeof(occurrence_snapshot)='array');
create function private.event_occurrence_coach(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and private.has_role(array['coach']::public.academy_role[]) and not private.has_role(array['sales']::public.academy_role[]) and exists(
 select 1 from public.event_occurrences o join public.academy_events e on e.id=o.event_id join public.branches b on b.id=e.branch_id
 where o.id=oid and o.coach_id=auth.uid() and o.status='scheduled' and e.status='open' and b.active and not b.provisional and o.ends_at>=now()-interval '90 days'
 and exists(select 1 from public.branch_permissions p where p.user_id=auth.uid() and p.branch_id=e.branch_id))
$$;
create function private.event_occurrence_staff(oid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.event_occurrences o join public.academy_events e on e.id=o.event_id where o.id=oid and private.event_staff(e.branch_id))$$;
create function private.event_attendance_write(oid uuid) returns boolean language sql stable security definer set search_path='' as $$select private.event_occurrence_staff(oid) or (private.event_occurrence_coach(oid) and exists(select 1 from public.event_occurrences o join public.academy_events e on e.id=o.event_id where o.id=oid and private.product_can('attendance.finalize',e.branch_id)))$$;
create function private.event_attendance_access(aid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.event_attendance a join public.event_occurrences o on o.id=a.occurrence_id join public.event_registrations r on r.id=a.registration_id where a.id=aid and private.event_record_access(r.family_id,r.event_id) and (private.event_occurrence_staff(o.id) or o.finalized_at is not null))$$;
revoke all on function private.event_occurrence_coach(uuid),private.event_occurrence_staff(uuid),private.event_attendance_write(uuid),private.event_attendance_access(uuid) from public,anon;
grant execute on function private.event_occurrence_coach(uuid),private.event_occurrence_staff(uuid),private.event_attendance_write(uuid),private.event_attendance_access(uuid) to authenticated,service_role;
create function private.event_has_coach(eid uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.event_occurrences o where o.event_id=eid and private.event_occurrence_coach(o.id))$$;
revoke all on function private.event_has_coach(uuid) from public,anon;grant execute on function private.event_has_coach(uuid) to authenticated,service_role;
-- Assignment cancellation and time expiry must also revoke actor-scoped cached command receipts.
alter function private.product_access_revision() rename to product_access_revision_before_camps;
create function private.product_access_revision() returns text language sql stable security definer set search_path='' as $$select md5(private.product_access_revision_before_camps()||coalesce((select jsonb_agg(o.id order by o.id)::text from public.event_occurrences o where private.event_occurrence_coach(o.id)),'[]'))$$;
revoke all on function private.product_access_revision(),private.product_access_revision_before_camps() from public,anon,authenticated;

drop policy academy_event_read on public.academy_events;
create policy academy_event_read on public.academy_events for select to authenticated using(private.active() and private.mfa_ready() and (private.event_staff(branch_id) or private.event_has_coach(id) or (private.has_role(array['parent']::public.academy_role[]) and exists(select 1 from public.branches b where b.id=branch_id and b.active and not b.provisional))));
create function private.event_coaches() returns table(id uuid,coach_id uuid,name text,branch_id uuid) language sql stable security definer set search_path='' as $$select md5(p.id::text||':'||bp.branch_id::text)::uuid,p.id,p.name,bp.branch_id from public.profiles p join public.role_assignments r on r.user_id=p.id and r.role='coach' join public.branch_permissions bp on bp.user_id=p.id where p.active and private.event_staff(bp.branch_id) and not exists(select 1 from public.role_assignments sales where sales.user_id=p.id and sales.role='sales')$$;
revoke all on function private.event_coaches() from public,anon;grant execute on function private.event_coaches() to authenticated,service_role;
create view public.event_coach_directory with(security_invoker=true,security_barrier=true) as select * from private.event_coaches();
revoke all on public.event_coach_directory from public,anon;grant select on public.event_coach_directory to authenticated,service_role;
do $$declare tab text;begin foreach tab in array array['event_occurrences','event_attendance','event_attendance_corrections'] loop
 execute format('alter table public.%I enable row level security',tab);execute format('revoke all on public.%I from public,anon,authenticated',tab);execute format('grant select on public.%I to authenticated',tab);execute format('grant all on public.%I to service_role',tab);execute format('create trigger camp_audit after insert or update or delete on public.%I for each row execute function private.product_audit()',tab);
end loop;end$$;
-- Parent catalogue access contains timetable only, not any other family's registration.
create policy event_occurrence_read on public.event_occurrences for select to authenticated using(private.event_occurrence_staff(id) or private.event_occurrence_coach(id) or (private.active() and private.mfa_ready() and private.has_role(array['parent']::public.academy_role[]) and exists(select 1 from public.academy_events e join public.branches b on b.id=e.branch_id where e.id=event_id and b.active and not b.provisional)));
create policy event_attendance_read on public.event_attendance for select to authenticated using(private.event_attendance_access(id));
create policy event_correction_read on public.event_attendance_corrections for select to authenticated using(private.event_attendance_access(attendance_id));
create trigger event_correction_immutable before update or delete on public.event_attendance_corrections for each row execute function private.immutable_record();
create function private.event_attendance_rows() returns table(id uuid,occurrence_id uuid,event_id uuid,registration_id uuid,child_id uuid,child_name text,attendance text,registration_status text,finalized_at timestamptz,can_record boolean,can_correct boolean)
language sql stable security definer set search_path='' as $$
 select a.id,o.id,e.id,r.id,k.id,k.name,a.attendance,r.status,o.finalized_at,private.event_attendance_write(o.id) and e.status='open' and o.status='scheduled' and r.status='registered',private.event_occurrence_staff(o.id)
 from public.event_attendance a join public.event_occurrences o on o.id=a.occurrence_id join public.academy_events e on e.id=o.event_id join public.event_registrations r on r.id=a.registration_id join public.children k on k.id=r.child_id
 where private.event_attendance_access(a.id) or (private.event_occurrence_coach(o.id) and r.status='registered')
$$;
revoke all on function private.event_attendance_rows() from public,anon;grant execute on function private.event_attendance_rows() to authenticated,service_role;
create view public.event_attendance_register with(security_invoker=true,security_barrier=true) as select * from private.event_attendance_rows();
revoke all on public.event_attendance_register from public,anon;grant select on public.event_attendance_register to authenticated,service_role;

create function private.event_occurrence_lock() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Event timetable history cannot be deleted' using errcode='42501';end if;
 if row(new.event_id,new.position,new.venue_id,new.coach_id,new.starts_at,new.ends_at) is distinct from row(old.event_id,old.position,old.venue_id,old.coach_id,old.starts_at,old.ends_at) or (old.finalized_at is not null and row(new.finalized_at,new.finalized_by) is distinct from row(old.finalized_at,old.finalized_by)) or (old.status='cancelled' and new.status<>old.status) then raise exception 'Published occurrence timetable is immutable; cancel instead' using errcode='42501';end if;return new;
end$$;
create trigger event_occurrence_immutable before update or delete on public.event_occurrences for each row execute function private.event_occurrence_lock();
create function private.event_occurrence_seed() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' and new.event_kind='one_off' then insert into public.event_occurrences(event_id,position,venue_id,starts_at,ends_at) values(new.id,1,new.venue_id,new.starts_at,new.ends_at);
 elsif tg_op='UPDATE' and new.status='cancelled' and old.status<>'cancelled' then update public.event_occurrences set status='cancelled',cancellation_reason=new.cancellation_reason where event_id=new.id and finalized_at is null and status<>'cancelled';end if;return null;
end$$;
create trigger event_occurrence_seed after insert or update of status on public.academy_events for each row execute function private.event_occurrence_seed();
create function private.event_registration_attendance() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.event_attendance(occurrence_id,registration_id) select id,new.id from public.event_occurrences where event_id=new.event_id and status='scheduled';return null;
end$$;
create trigger event_registration_attendance after insert on public.event_registrations for each row execute function private.event_registration_attendance();
create function private.event_consent_schedule() returns trigger language plpgsql security definer set search_path='' as $$begin
 select coalesce(jsonb_agg(jsonb_build_object('occurrence_id',o.id,'starts_at',o.starts_at,'ends_at',o.ends_at,'venue_id',o.venue_id,'coach_id',o.coach_id) order by o.position),'[]'::jsonb) into new.occurrence_snapshot from public.event_occurrences o join public.event_registrations r on r.event_id=o.event_id where r.id=new.registration_id and o.status='scheduled';return new;
end$$;
create trigger event_consent_schedule before insert on public.event_consents for each row execute function private.event_consent_schedule();

-- Camp resources are exclusive. Legacy one-off events retain old class-sharing semantics,
-- but neither a new one-off event nor a later class can overlap a reserved camp resource.
create function private.camp_resource_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare ev public.academy_events;begin
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into ev from public.academy_events where id=new.event_id;
 if new.status='cancelled' then return new;end if;
 if ev.event_kind='camp' then
  if new.coach_id is null or not exists(select 1 from public.profiles p join public.role_assignments ra on ra.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id where p.id=new.coach_id and p.active and ra.role='coach' and bp.branch_id=ev.branch_id and not exists(select 1 from public.role_assignments sales where sales.user_id=p.id and sales.role='sales')) or not exists(select 1 from public.venues v where v.id=new.venue_id and v.branch_id=ev.branch_id) then raise exception 'Camp coach and venue must be active in the event branch' using errcode='P0409';end if;
  if exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.status<>'cancelled' and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)') and (c.venue_id=new.venue_id or c.coach_id=new.coach_id or exists(select 1 from public.coach_substitutions sub where sub.session_id=s.id and sub.coach_id=new.coach_id and sub.revoked_at is null and tstzrange(sub.starts_at,sub.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')))) then raise exception 'Camp venue or coach overlaps a class session' using errcode='P0409';end if;
 end if;
 if exists(select 1 from public.event_occurrences o join public.academy_events e on e.id=o.event_id where o.id<>new.id and o.status='scheduled' and e.status='open' and (ev.event_kind='camp' or e.event_kind='camp') and (o.event_id=new.event_id or o.venue_id=new.venue_id or (new.coach_id is not null and o.coach_id=new.coach_id)) and tstzrange(o.starts_at,o.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Camp venue, coach or occurrence schedule overlaps' using errcode='P0409';end if;
 return new;
end$$;
create trigger camp_resource_guard before insert or update of status on public.event_occurrences for each row execute function private.camp_resource_guard();
create function private.camp_class_resource_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare cls public.academy_classes;s public.class_sessions;begin
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if tg_table_name='class_sessions' then
  if new.status='cancelled' then return new;end if;select * into cls from public.academy_classes where id=new.class_id;
  if exists(select 1 from public.event_occurrences o join public.academy_events e on e.id=o.event_id where e.event_kind='camp' and e.status='open' and o.status='scheduled' and (o.venue_id=cls.venue_id or o.coach_id=cls.coach_id or exists(select 1 from public.coach_substitutions sub where sub.session_id=new.id and sub.coach_id=o.coach_id and sub.revoked_at is null and tstzrange(sub.starts_at,sub.ends_at,'[)')&&tstzrange(o.starts_at,o.ends_at,'[)'))) and tstzrange(o.starts_at,o.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Class venue or coach overlaps a camp occurrence' using errcode='P0409';end if;
 elsif tg_table_name='academy_classes' then
  if exists(select 1 from public.class_sessions cs join public.event_occurrences o on tstzrange(o.starts_at,o.ends_at,'[)')&&tstzrange(cs.starts_at,cs.ends_at,'[)') join public.academy_events e on e.id=o.event_id where cs.class_id=new.id and cs.status<>'cancelled' and e.event_kind='camp' and e.status='open' and o.status='scheduled' and (o.venue_id=new.venue_id or o.coach_id=new.coach_id)) then raise exception 'Class assignment overlaps a camp occurrence' using errcode='P0409';end if;
 else
  if new.revoked_at is not null then return new;end if;select * into s from public.class_sessions where id=new.session_id;
  if s.status<>'cancelled' and exists(select 1 from public.event_occurrences o join public.academy_events e on e.id=o.event_id where e.event_kind='camp' and e.status='open' and o.status='scheduled' and o.coach_id=new.coach_id and tstzrange(o.starts_at,o.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)') and tstzrange(o.starts_at,o.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Substitute coach overlaps a camp occurrence' using errcode='P0409';end if;
 end if;return new;
end$$;
create trigger camp_session_resources before insert or update of starts_at,ends_at,status,class_id on public.class_sessions for each row execute function private.camp_class_resource_guard();
create trigger camp_class_resources before update of coach_id,venue_id on public.academy_classes for each row execute function private.camp_class_resource_guard();
create trigger camp_substitute_resources before insert or update on public.coach_substitutions for each row execute function private.camp_class_resource_guard();

-- Booking availability and commands must agree about every camp date.
create or replace function private.child_conflict(k uuid,st timestamptz,en timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.session_roster r join public.class_sessions s on s.id=r.session_id left join public.trial_bookings b on b.id=r.trial_booking_id left join public.trial_enquiries q on q.id=b.enquiry_id left join public.enrollments n on n.id=r.enrollment_id where not r.cancelled and s.status<>'cancelled' and coalesce(q.child_id,n.child_id)=k and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(st,en,'[)'))
 or exists(select 1 from public.event_registrations r join public.academy_events e on e.id=r.event_id join public.event_occurrences o on o.event_id=e.id where r.child_id=k and r.status='registered' and e.status='open' and o.status='scheduled' and tstzrange(o.starts_at,o.ends_at,'[)')&&tstzrange(st,en,'[)'))
$$;
create or replace function private.event_schedule_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare kid uuid;s public.class_sessions;begin
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if tg_table_name='session_roster' then
  if new.cancelled then return new;end if;select * into s from public.class_sessions where id=new.session_id;
  select coalesce((select child_id from public.enrollments where id=new.enrollment_id),(select q.child_id from public.trial_bookings b join public.trial_enquiries q on q.id=b.enquiry_id where b.id=new.trial_booking_id)) into kid;
  if s.status<>'cancelled' and exists(select 1 from public.event_registrations r join public.academy_events e on e.id=r.event_id join public.event_occurrences o on o.event_id=e.id where r.child_id=kid and r.status='registered' and e.status='open' and o.status='scheduled' and tstzrange(o.starts_at,o.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')) then raise exception 'Child already has an overlapping event' using errcode='P0409';end if;
 elsif tg_table_name='class_sessions' and new.status<>'cancelled' then
  if exists(select 1 from public.session_roster r left join public.enrollments n on n.id=r.enrollment_id left join public.trial_bookings b on b.id=r.trial_booking_id left join public.trial_enquiries q on q.id=b.enquiry_id join public.event_registrations er on er.child_id=coalesce(n.child_id,q.child_id) join public.academy_events e on e.id=er.event_id join public.event_occurrences o on o.event_id=e.id where r.session_id=new.id and not r.cancelled and er.status='registered' and e.status='open' and o.status='scheduled' and tstzrange(o.starts_at,o.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Session would overlap a registered child event' using errcode='P0409';end if;
 end if;return new;
end$$;

alter function private.events_command(text,jsonb) rename to events_single_command;
-- Keep existing transactional registration logic while making its notification copy apply to both formats.
do $$declare definition text;begin
 select pg_get_functiondef('private.events_single_command(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'Your selected children are registered for the one-off event.','Your selected children are registered for all scheduled event dates.');
 definition:=replace(definition,'Your one-off event registration was cancelled.','Your event registration was cancelled.');
 execute definition;
end$$;
create function private.events_command(a text,d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.academy_events;o public.event_occurrences;r public.event_registrations;k public.children;age public.age_groups;att public.event_attendance;
 item jsonb;slot jsonb;rid uuid;bid uuid;fid uuid;result jsonb;earliest timestamptz;latest timestamptz;st timestamptz;en timestamptz;n int;counted int;begin
 perform private.require_access(private.active() and private.mfa_ready());perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if a='events.camp.create' then
  bid:=(d->>'branch_id')::uuid;perform private.require_access(private.event_staff(bid));
  if d->'policy_acknowledged' is distinct from 'true'::jsonb or jsonb_typeof(d->'occurrences') is distinct from 'array' or jsonb_array_length(d->'occurrences') not between 2 and 30 then raise exception 'Acknowledge the synthetic camp policy and provide two to thirty occurrences' using errcode='22023';end if;
  if not exists(select 1 from public.branches b join public.branch_sports bs on bs.branch_id=b.id where b.id=bid and b.active and not b.provisional and bs.sport=(d->>'sport')::public.sport_id) or not exists(select 1 from public.sport_levels l where l.id=(d->>'level_id')::uuid and l.active and l.sport=(d->>'sport')::public.sport_id) or not exists(select 1 from public.document_versions doc where doc.id=(d->>'document_id')::uuid and doc.purpose='waiver' and doc.synthetic) or not exists(select 1 from public.age_groups g where g.id=(d->>'age_group_id')::uuid) then raise exception 'Event configuration unavailable' using errcode='P0409';end if;
  select min((v->>'starts_at')::timestamptz),max((v->>'ends_at')::timestamptz) into earliest,latest from jsonb_array_elements(d->'occurrences') v;
  if earliest<=now() or latest>earliest+interval '90 days' then raise exception 'Camp dates must be future dates within ninety days' using errcode='22023';end if;
  select v into slot from jsonb_array_elements(d->'occurrences') v order by (v->>'starts_at')::timestamptz limit 1;
  insert into public.academy_events(branch_id,venue_id,sport,level_id,age_group_id,document_id,title,starts_at,ends_at,capacity,event_kind,policy_version,created_by) values(bid,(slot->>'venue_id')::uuid,(d->>'sport')::public.sport_id,(d->>'level_id')::uuid,(d->>'age_group_id')::uuid,(d->>'document_id')::uuid,trim(d->>'title'),(slot->>'starts_at')::timestamptz,(slot->>'ends_at')::timestamptz,(d->>'capacity')::int,'camp','synthetic-camp-v1',auth.uid()) returning * into e;
  n:=0;for slot in select v from jsonb_array_elements(d->'occurrences') v order by (v->>'starts_at')::timestamptz loop n:=n+1;
   insert into public.event_occurrences(event_id,position,venue_id,coach_id,starts_at,ends_at) values(e.id,n,(slot->>'venue_id')::uuid,(slot->>'coach_id')::uuid,(slot->>'starts_at')::timestamptz,(slot->>'ends_at')::timestamptz);
  end loop;return jsonb_build_object('event_id',e.id,'occurrences',n);
 elsif a='events.register' then
  select * into e from public.academy_events where id=(d->>'event_id')::uuid for update;fid:=(d->>'family_id')::uuid;perform private.require_access(private.family_owner(fid));
  if e.id is null or jsonb_typeof(d->'children') is distinct from 'array' or jsonb_array_length(d->'children') not between 1 and 8 then raise exception 'Choose one to eight children' using errcode='22023';end if;
  if (select count(distinct v->>'child_id') from jsonb_array_elements(d->'children') v)<>jsonb_array_length(d->'children') then raise exception 'Choose each child once' using errcode='22023';end if;
  if e.event_kind='camp' and exists(select 1 from public.event_occurrences oc where oc.event_id=e.id and oc.status='scheduled' and (not exists(select 1 from public.profiles p join public.role_assignments ra on ra.user_id=p.id and ra.role='coach' join public.branch_permissions bp on bp.user_id=p.id where p.id=oc.coach_id and p.active and bp.branch_id=e.branch_id and not exists(select 1 from public.role_assignments sales where sales.user_id=p.id and sales.role='sales')) or not exists(select 1 from public.venues v where v.id=oc.venue_id and v.branch_id=e.branch_id))) then raise exception 'Camp coach and venue must be active in the event branch' using errcode='P0409';end if;
  select * into age from public.age_groups where id=e.age_group_id;
  for item in select value from jsonb_array_elements(d->'children') loop
   select * into k from public.children where id=(item->>'child_id')::uuid;perform private.require_access(k.id is not null and k.family_id=fid);
   if item->'accepted' is distinct from 'true'::jsonb or (item->>'document_id')::uuid is distinct from e.document_id then raise exception 'Accept the current waiver for every child' using errcode='22023';end if;
   for o in select * from public.event_occurrences where event_id=e.id and status='scheduled' loop
    if not coalesce(private.age_fits(k.dob,k.reported_age,k.age_captured_on,(o.starts_at at time zone 'Asia/Dubai')::date,age.min_age,age.max_age),false) then raise exception 'Child must meet the age requirement on every camp date' using errcode='P0409';end if;
    if private.child_conflict(k.id,o.starts_at,o.ends_at) or exists(select 1 from public.event_registrations er join public.academy_events ev on ev.id=er.event_id join public.event_occurrences oc on oc.event_id=ev.id where er.child_id=k.id and er.status='registered' and ev.status='open' and oc.status='scheduled' and tstzrange(oc.starts_at,oc.ends_at,'[)')&&tstzrange(o.starts_at,o.ends_at,'[)')) then raise exception 'Child already has an overlapping class or event occurrence' using errcode='P0409';end if;
   end loop;
  end loop;
  return private.events_single_command(a,d);
 elsif a in('events.attendance.save','events.attendance.finalize','events.occurrence.cancel') then
  select * into o from public.event_occurrences where id=(d->>'occurrence_id')::uuid for update;select * into e from public.academy_events where id=o.event_id;
  if o.id is null then raise exception 'Event occurrence unavailable' using errcode='P0404';end if;
  if a='events.occurrence.cancel' then
   perform private.require_access(private.event_staff(e.branch_id));
   if o.status<>'scheduled' or o.finalized_at is not null or o.starts_at<=now() then raise exception 'Only an unstarted occurrence may be cancelled individually' using errcode='P0409';end if;
   if length(trim(coalesce(d->>'reason',''))) not between 5 and 500 then raise exception 'Cancellation reason required' using errcode='22023';end if;
   update public.event_occurrences set status='cancelled',cancellation_reason=trim(d->>'reason') where id=o.id;
   for fid in select distinct family_id from public.event_registrations where event_id=e.id and status='registered' loop perform private.emit_product_event('event_occurrence.cancelled',o.id,fid,e.branch_id,'Event date cancelled','One date in your event timetable has been cancelled. Other dates are unchanged.','/parent?view=Events');end loop;
   if not exists(select 1 from public.event_occurrences where event_id=e.id and status='scheduled') then perform private.events_single_command('events.cancel',jsonb_build_object('event_id',e.id,'reason',d->>'reason'));end if;
   return jsonb_build_object('occurrence_id',o.id);
  end if;
  perform private.require_access(private.event_attendance_write(o.id));
  if e.status<>'open' or o.status<>'scheduled' or o.starts_at>now() or o.finalized_at is not null then raise exception 'Attendance requires a started unfinalized occurrence' using errcode='P0409';end if;
  if a='events.attendance.save' then
   if jsonb_typeof(d->'entries') is distinct from 'array' or jsonb_array_length(d->'entries') not between 1 and 100 or (select count(distinct v->>'registration_id') from jsonb_array_elements(d->'entries') v)<>jsonb_array_length(d->'entries') then raise exception 'Distinct registered attendance rows required' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(d->'entries') loop
    select * into r from public.event_registrations where id=(item->>'registration_id')::uuid;
    if r.id is null or r.event_id<>e.id or r.status<>'registered' or coalesce(item->>'attendance','') not in('present','absent','late','excused') then raise exception 'Attendance row does not belong to this active occurrence' using errcode='22023';end if;
    perform private.require_access(private.event_occurrence_coach(o.id) or private.event_record_access(r.family_id,e.id));
    update public.event_attendance set attendance=item->>'attendance',recorded_by=auth.uid(),updated_at=now() where occurrence_id=o.id and registration_id=r.id;
   end loop;
  else
   if o.ends_at>now() then raise exception 'Finalize attendance after the occurrence ends' using errcode='P0409';end if;
   select count(*) into counted from public.event_registrations where event_id=e.id and status='registered';
   if counted=0 or exists(select 1 from public.event_registrations reg left join public.event_attendance mark on mark.registration_id=reg.id and mark.occurrence_id=o.id where reg.event_id=e.id and reg.status='registered' and mark.attendance is null) then raise exception 'Mark every active child before finalizing attendance' using errcode='P0409';end if;
   if not private.event_occurrence_coach(o.id) and exists(select 1 from public.event_registrations reg where reg.event_id=e.id and reg.status='registered' and not private.event_record_access(reg.family_id,e.id)) then raise exception 'Access denied' using errcode='42501';end if;
   update public.event_occurrences set finalized_at=now(),finalized_by=auth.uid() where id=o.id;
   for fid in select distinct family_id from public.event_registrations where event_id=e.id and status='registered' loop perform private.emit_product_event('event_attendance.finalized',o.id,fid,e.branch_id,'Event attendance ready','The attendance register for one event date is ready.','/parent?view=Events');end loop;
  end if;return jsonb_build_object('occurrence_id',o.id);
 elsif a='events.attendance.correct' then
  select * into att from public.event_attendance where id=(d->>'id')::uuid for update;select * into o from public.event_occurrences where id=att.occurrence_id;select * into r from public.event_registrations where id=att.registration_id;
  perform private.require_access(private.event_occurrence_staff(o.id) and private.event_record_access(r.family_id,r.event_id));
  if o.finalized_at is null or att.attendance is null or coalesce(d->>'attendance','') not in('present','absent','late','excused') or length(trim(coalesce(d->>'reason',''))) not between 5 and 500 then raise exception 'Finalized attendance and correction reason required' using errcode='22023';end if;
  if att.attendance=d->>'attendance' then raise exception 'Attendance is unchanged' using errcode='P0409';end if;
  insert into public.event_attendance_corrections(attendance_id,previous_attendance,attendance,reason,corrected_by) values(att.id,att.attendance,d->>'attendance',trim(d->>'reason'),auth.uid()) returning id into rid;
  update public.event_attendance set attendance=d->>'attendance',recorded_by=auth.uid(),updated_at=now() where id=att.id;return jsonb_build_object('id',rid);
 end if;
 return private.events_single_command(a,d);
end$$;
revoke all on function private.events_command(text,jsonb),private.events_single_command(text,jsonb),private.event_occurrence_lock(),private.event_occurrence_seed(),private.event_registration_attendance(),private.event_consent_schedule(),private.camp_resource_guard(),private.camp_class_resource_guard() from public,anon,authenticated;
-- Full leading FK indexes, including nullable actor references, retain the advisor invariant.
do $$declare r record;cols text;begin for r in select c.conname,c.conrelid,c.conkey,t.relname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and n.nspname='public' and t.relname in('event_occurrences','event_attendance','event_attendance_corrections') loop
 if not exists(select 1 from pg_index i where i.indrelid=r.conrelid and i.indisvalid and i.indisready and i.indpred is null and i.indnkeyatts>=cardinality(r.conkey) and (select array_agg(k.attnum::smallint order by k.ord) from unnest(i.indkey) with ordinality k(attnum,ord) where k.ord<=cardinality(r.conkey))=r.conkey) then select string_agg(quote_ident(a.attname),',' order by k.ord) into cols from unnest(r.conkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=r.conrelid and a.attnum=k.attnum;execute format('create index %I on public.%I(%s)','fk_'||left(r.relname,28)||'_'||substr(md5(r.conname),1,16),r.relname,cols);end if;end loop;end$$;
