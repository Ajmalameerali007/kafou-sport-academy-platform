-- Synthetic one-off events. No normal class/enrollment, billing or provider delivery.
create table public.academy_events(
 id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,venue_id uuid not null references public.venues,
 sport public.sport_id not null,level_id uuid not null references public.sport_levels,age_group_id uuid not null references public.age_groups,
 document_id uuid not null references public.document_versions,title text not null check(length(trim(title)) between 2 and 120),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at and ends_at<=starts_at+interval '12 hours'),
 capacity int not null check(capacity between 1 and 100),status text not null default 'open' check(status in ('open','cancelled')),
 synthetic boolean not null default true check(synthetic),policy_version text not null default 'synthetic-one-off-v1' check(policy_version='synthetic-one-off-v1'),
 created_by uuid not null references public.profiles,created_at timestamptz not null default now(),cancellation_reason text,
 check((starts_at at time zone 'Asia/Dubai')::date=(ends_at at time zone 'Asia/Dubai')::date));
create table public.event_registration_batches(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.academy_events,family_id uuid not null references public.families,guardian_id uuid not null references public.profiles,status text not null default 'registered' check(status in ('registered','cancelled')),created_at timestamptz not null default now(),cancelled_at timestamptz);
create table public.event_registrations(id uuid primary key default gen_random_uuid(),batch_id uuid not null references public.event_registration_batches,event_id uuid not null references public.academy_events,family_id uuid not null references public.families,child_id uuid not null references public.children,status text not null default 'registered' check(status in ('registered','cancelled')),created_at timestamptz not null default now());
create unique index event_child_registered on public.event_registrations(event_id,child_id) where status='registered';
create table public.event_consents(id uuid primary key default gen_random_uuid(),registration_id uuid not null unique references public.event_registrations,child_id uuid not null references public.children,family_id uuid not null references public.families,document_id uuid not null references public.document_versions,document_version text not null,document_body text not null,guardian_id uuid not null references public.profiles,accepted_at timestamptz not null default now());
create function private.event_consent_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Event consent evidence is append-only' using errcode='42501';end$$;
create trigger event_consent_immutable before update or delete on public.event_consents for each row execute function private.event_consent_immutable();
create function private.event_staff(b uuid) returns boolean language sql stable security definer set search_path='' as $$select private.active() and private.operations_staff(b) and private.product_can('events.manage',b)$$;
create function private.event_record_access(f uuid,e uuid) returns boolean language sql stable security definer set search_path='' as $$select private.family_owner(f) or exists(select 1 from public.academy_events x where x.id=e and private.event_staff(x.branch_id) and (private.head_office() or exists(select 1 from public.family_branches fb where fb.family_id=f and fb.branch_id=x.branch_id)))$$;
create function private.events_command(a text,d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.academy_events;c public.children;doc public.document_versions;g public.age_groups;batch public.event_registration_batches;item jsonb;ids uuid[];fid uuid;bid uuid;rid uuid;result jsonb;begin
 perform private.require_access(private.active() and private.mfa_ready());
 if a='events.create' then
  perform private.require_access(private.event_staff((d->>'branch_id')::uuid));
  if d->'policy_acknowledged' is distinct from 'true'::jsonb then raise exception 'Acknowledge the synthetic event policy' using errcode='22023';end if;
  if not exists(select 1 from public.branches b join public.branch_sports s on s.branch_id=b.id where b.id=(d->>'branch_id')::uuid and b.active and not b.provisional and s.sport=(d->>'sport')::public.sport_id)
   or not exists(select 1 from public.venues v where v.id=(d->>'venue_id')::uuid and v.branch_id=(d->>'branch_id')::uuid)
   or not exists(select 1 from public.sport_levels l where l.id=(d->>'level_id')::uuid and l.active and l.sport=(d->>'sport')::public.sport_id)
   or not exists(select 1 from public.document_versions v where v.id=(d->>'document_id')::uuid and v.purpose='waiver' and v.synthetic)
   or (d->>'starts_at')::timestamptz<=now() then raise exception 'Event configuration unavailable' using errcode='P0409';end if;
  insert into public.academy_events(branch_id,venue_id,sport,level_id,age_group_id,document_id,title,starts_at,ends_at,capacity,created_by) values((d->>'branch_id')::uuid,(d->>'venue_id')::uuid,(d->>'sport')::public.sport_id,(d->>'level_id')::uuid,(d->>'age_group_id')::uuid,(d->>'document_id')::uuid,trim(d->>'title'),(d->>'starts_at')::timestamptz,(d->>'ends_at')::timestamptz,(d->>'capacity')::int,auth.uid()) returning * into e;
  return jsonb_build_object('event_id',e.id);
 end if;
 if a='events.cancel_registration' then
  select * into batch from public.event_registration_batches where id=(d->>'batch_id')::uuid;
  perform private.require_access(batch.id is not null and private.family_owner(batch.family_id));
  select * into e from public.academy_events where id=batch.event_id for update;
  if e.starts_at<=now() then raise exception 'Registration changes closed' using errcode='P0409';end if;
  update public.event_registration_batches set status='cancelled',cancelled_at=coalesce(cancelled_at,now()) where id=batch.id;
  update public.event_registrations set status='cancelled' where batch_id=batch.id;
  return jsonb_build_object('batch_id',batch.id,'status','cancelled');
 end if;
 select * into e from public.academy_events where id=(d->>'event_id')::uuid for update;
 if e.id is null then raise exception 'Event unavailable' using errcode='P0409';end if;
 if a='events.cancel' then
  perform private.require_access(private.event_staff(e.branch_id));
  if length(trim(coalesce(d->>'reason',''))) not between 5 and 500 then raise exception 'Cancellation reason required' using errcode='22023';end if;
  update public.academy_events set status='cancelled',cancellation_reason=trim(d->>'reason') where id=e.id;
  update public.event_registration_batches set status='cancelled',cancelled_at=coalesce(cancelled_at,now()) where event_id=e.id;
  update public.event_registrations set status='cancelled' where event_id=e.id;
  for fid in select distinct family_id from public.event_registration_batches where event_id=e.id loop
   perform private.emit_product_event('event_cancelled',e.id,fid,e.branch_id,'Event cancelled','Your one-off event registration was cancelled.','/parent?view=Events');
  end loop;
  return jsonb_build_object('event_id',e.id,'status','cancelled');
 elsif a<>'events.register' then raise exception 'Unknown event command' using errcode='22023';end if;
 fid:=(d->>'family_id')::uuid;
 perform private.require_access(private.family_owner(fid));
 if e.status<>'open' or e.starts_at<=now() or not exists(select 1 from public.branches b join public.branch_sports s on s.branch_id=b.id where b.id=e.branch_id and b.active and not b.provisional and s.sport=e.sport)
  or not exists(select 1 from public.sport_levels l where l.id=e.level_id and l.active and l.sport=e.sport)
  or not exists(select 1 from public.venues v where v.id=e.venue_id and v.branch_id=e.branch_id) then raise exception 'Event unavailable' using errcode='P0409';end if;
 if jsonb_typeof(d->'children') is distinct from 'array' or jsonb_array_length(d->'children') not between 1 and 8 then raise exception 'Choose one to eight children' using errcode='22023';end if;
 select array_agg((x->>'child_id')::uuid) into ids from jsonb_array_elements(d->'children') x;
 if cardinality(ids)<>(select count(distinct v) from unnest(ids) v) then raise exception 'Choose each child once' using errcode='22023';end if;
 select * into doc from public.document_versions where id=e.document_id;
 select * into g from public.age_groups where id=e.age_group_id;
 if doc.purpose<>'waiver' or not doc.synthetic then raise exception 'Event waiver unavailable' using errcode='P0409';end if;
 if (select count(*) from public.event_registrations where event_id=e.id and status='registered')+cardinality(ids)>e.capacity then raise exception 'Event capacity unavailable for the whole family selection' using errcode='P0409';end if;
 for item in select value from jsonb_array_elements(d->'children') loop
  select * into c from public.children where id=(item->>'child_id')::uuid;
  perform private.require_access(c.id is not null and c.family_id=fid);
  if item->'accepted' is distinct from 'true'::jsonb or (item->>'document_id')::uuid is distinct from e.document_id then raise exception 'Accept the current waiver for every child' using errcode='22023';end if;
  if not coalesce(private.age_fits(c.dob,c.reported_age,c.age_captured_on,(e.starts_at at time zone 'Asia/Dubai')::date,g.min_age,g.max_age),false)
   or not exists(select 1 from public.child_sports s where s.child_id=c.id and s.sport=e.sport and s.status='reviewed' and s.level_id=e.level_id) then raise exception 'Child does not meet the event age and assessed level requirements' using errcode='P0409';end if;
  if exists(select 1 from public.session_roster r join public.class_sessions s on s.id=r.session_id left join public.enrollments n on n.id=r.enrollment_id left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id where coalesce(n.child_id,q.child_id)=c.id and not r.cancelled and s.status='scheduled' and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(e.starts_at,e.ends_at,'[)')) then raise exception 'Child already has an overlapping class session' using errcode='P0409';end if;
  if exists(select 1 from public.event_registrations r join public.academy_events x on x.id=r.event_id where r.child_id=c.id and r.status='registered' and x.status='open' and tstzrange(x.starts_at,x.ends_at,'[)')&&tstzrange(e.starts_at,e.ends_at,'[)')) then raise exception 'Child already has an overlapping event' using errcode='P0409';end if;
 end loop;
 -- The guardian's explicit registration links this family to the selected event branch.
 insert into public.family_branches(family_id,branch_id) values(fid,e.branch_id) on conflict do nothing;
 insert into public.event_registration_batches(event_id,family_id,guardian_id) values(e.id,fid,auth.uid()) returning id into bid;
 for item in select value from jsonb_array_elements(d->'children') loop
  insert into public.event_registrations(batch_id,event_id,family_id,child_id) values(bid,e.id,fid,(item->>'child_id')::uuid) returning id into rid;
  insert into public.event_consents(registration_id,child_id,family_id,document_id,document_version,document_body,guardian_id) values(rid,(item->>'child_id')::uuid,fid,doc.id,doc.version,doc.body,auth.uid());
 end loop;
 perform private.emit_product_event('event_registered',bid,fid,e.branch_id,'Event registration confirmed','Your selected children are registered for the one-off event.','/parent?view=Events');
 result:=jsonb_build_object('batch_id',bid,'event_id',e.id,'registered',cardinality(ids));return result;
end$$;
revoke all on function private.event_consent_immutable(),private.events_command(text,jsonb),private.event_staff(uuid),private.event_record_access(uuid,uuid) from public,anon,authenticated;
grant execute on function private.event_staff(uuid),private.event_record_access(uuid,uuid) to authenticated,service_role;
do $$declare t text;begin foreach t in array array['academy_events','event_registration_batches','event_registrations','event_consents'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);execute format('create trigger event_audit after insert or update or delete on public.%I for each row execute function private.product_audit()',t);
end loop;end$$;
create policy academy_event_read on public.academy_events for select to authenticated using(private.active() and private.mfa_ready() and (private.event_staff(branch_id) or (private.has_role(array['parent']::public.academy_role[]) and exists(select 1 from public.branches b where b.id=branch_id and b.active and not b.provisional))));
create policy event_batch_read on public.event_registration_batches for select to authenticated using(private.event_record_access(family_id,event_id));
create policy event_registration_read on public.event_registrations for select to authenticated using(private.event_record_access(family_id,event_id));
create policy event_consent_read on public.event_consents for select to authenticated using(private.family_owner(family_id) or exists(select 1 from public.event_registrations r where r.id=registration_id and private.event_record_access(r.family_id,r.event_id)));
-- Full FK indexes for new event tables; the previous advisor migration precedes these.
do $$declare r record;cols text;begin for r in select c.conname,c.conrelid,c.conkey,t.relname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where c.contype='f' and n.nspname='public' and t.relname in ('academy_events','event_registration_batches','event_registrations','event_consents') loop
 if not exists(select 1 from pg_index i where i.indrelid=r.conrelid and i.indisvalid and i.indisready and i.indpred is null and i.indnkeyatts>=cardinality(r.conkey) and (select array_agg(k.attnum::smallint order by k.ord) from unnest(i.indkey) with ordinality k(attnum,ord) where k.ord<=cardinality(r.conkey))=r.conkey) then
 select string_agg(quote_ident(a.attname),',' order by k.ord) into cols from unnest(r.conkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=r.conrelid and a.attnum=k.attnum;
 execute format('create index %I on public.%I(%s)','fk_'||left(r.relname,28)||'_'||substr(md5(r.conname),1,16),r.relname,cols);end if;end loop;end$$;

-- Shared write serialization also protects against a later regular session placement/reschedule.
create function private.event_schedule_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare kid uuid;s public.class_sessions;begin
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if tg_table_name='session_roster' then
  if new.cancelled then return new;end if;
  select * into s from public.class_sessions where id=new.session_id;
  select coalesce((select child_id from public.enrollments where id=new.enrollment_id),(select q.child_id from public.trial_bookings b join public.trial_enquiries q on q.id=b.enquiry_id where b.id=new.trial_booking_id)) into kid;
  if s.status='scheduled' and exists(select 1 from public.event_registrations r join public.academy_events e on e.id=r.event_id where r.child_id=kid and r.status='registered' and e.status='open' and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')) then raise exception 'Child already has an overlapping event' using errcode='P0409';end if;
 elsif tg_table_name='class_sessions' and new.status='scheduled' then
  if exists(select 1 from public.session_roster r left join public.enrollments n on n.id=r.enrollment_id left join public.trial_bookings b on b.id=r.trial_booking_id left join public.trial_enquiries q on q.id=b.enquiry_id join public.event_registrations er on er.child_id=coalesce(n.child_id,q.child_id) join public.academy_events e on e.id=er.event_id where r.session_id=new.id and not r.cancelled and er.status='registered' and e.status='open' and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'Session would overlap a registered child event' using errcode='P0409';end if;
 end if;return new;
end$$;
revoke all on function private.event_schedule_guard() from public,anon,authenticated;
create trigger event_roster_conflict before insert or update on public.session_roster for each row execute function private.event_schedule_guard();
create trigger event_session_conflict before update of starts_at,ends_at,status on public.class_sessions for each row execute function private.event_schedule_guard();
