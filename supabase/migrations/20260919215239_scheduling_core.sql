-- Recurring definitions are distinct from dated, capacity-controlled occurrences.
create table public.sport_levels(id uuid primary key default gen_random_uuid(), sport public.sport_id not null, name text not null check(length(name) between 1 and 80), name_ar text not null default '', rank int not null check(rank>=0), entry_level boolean not null default false, active boolean not null default true, unique(sport,name));
create unique index one_entry_level on public.sport_levels(sport) where entry_level and active;
create table public.age_groups(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 80), min_age int not null check(min_age between 1 and 17), max_age int not null check(max_age between min_age and 17));
create table public.academy_classes(id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches, venue_id uuid not null references public.venues, coach_id uuid not null references public.profiles, sport public.sport_id not null, level_id uuid not null references public.sport_levels, age_group_id uuid not null references public.age_groups, name text not null check(length(name) between 2 and 100), capacity int not null check(capacity between 1 and 100), weekdays int[] not null check(cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]), local_time time not null, duration_minutes int not null check(duration_minutes between 15 and 240), timezone text not null default 'Asia/Dubai' check(timezone='Asia/Dubai'), active boolean not null default true, created_at timestamptz not null default now());
create table public.class_sessions(id uuid primary key default gen_random_uuid(), class_id uuid not null references public.academy_classes, starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at), capacity int not null check(capacity between 1 and 100), status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')), finalized_at timestamptz, finalized_by uuid references public.profiles, cancellation_reason text, unique(class_id,starts_at));
create table public.trial_bookings(id uuid primary key default gen_random_uuid(), enquiry_id uuid not null references public.trial_enquiries, session_id uuid not null references public.class_sessions, reference text not null unique default ('TRI-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))), status text not null default 'booked' check(status in ('booked','attended','cancelled','converted','missed')), level_id uuid not null references public.sport_levels, override_reason text check(override_reason is null or length(trim(override_reason)) between 5 and 500), booked_by uuid references public.profiles, created_at timestamptz not null default now());
create unique index one_current_trial on public.trial_bookings(enquiry_id) where status not in ('cancelled','missed');
create table public.enrollments(id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children, class_id uuid not null references public.academy_classes, trial_booking_id uuid unique references public.trial_bookings, status text not null default 'active' check(status in ('active','ended')), package_state text not null default 'pending_configuration' check(package_state='pending_configuration'), enrolled_at timestamptz not null default now());
create unique index one_active_enrollment on public.enrollments(child_id,class_id) where status='active';
create table public.session_roster(id uuid primary key default gen_random_uuid(), session_id uuid not null references public.class_sessions, trial_booking_id uuid unique references public.trial_bookings, enrollment_id uuid references public.enrollments, kind text not null check(kind in ('trial','enrollment','makeup')), attendance text check(attendance in ('present','absent','late','excused')), cancelled boolean not null default false, check((kind='trial' and trial_booking_id is not null and enrollment_id is null) or (kind='enrollment' and enrollment_id is not null and trial_booking_id is null)), unique(session_id,enrollment_id));
create table public.operation_events(id uuid primary key default gen_random_uuid(), roster_id uuid not null references public.session_roster, kind text not null check(kind in ('absence_recorded','makeup_eligibility_pending')), created_at timestamptz not null default now(), unique(roster_id,kind));
-- Explicit two-party family linking: authenticated parent presents a random claim code.
create table private.family_claims(id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families, user_id uuid not null references public.profiles, token_hash text unique not null, purpose text not null default 'child_link' check(purpose in ('child_link','guardian')), expires_at timestamptz not null, used_at timestamptz);
alter table public.child_sports add column level_id uuid references public.sport_levels;
alter table public.trial_enquiries add column starting_level_id uuid references public.sport_levels;
alter table public.leads drop constraint leads_stage_check;
insert into public.lead_activities(lead_id,kind,note) select id,'pipeline_migration','Previous stage: '||stage from public.leads where stage in ('interested','trial_offered');
update public.leads set stage='contacted' where stage in ('interested','trial_offered');
alter table public.leads add constraint leads_stage_check check(stage in ('new','contacted','trial_booked','trial_attended','converted','lost'));

create function private.operations_staff(b uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.mfa_ready() and (private.head_office() or (private.has_role(array['branch']::public.academy_role[]) and private.branch_access(b))) $$;
create function private.enquiry_access(e uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.mfa_ready() and exists(select 1 from public.trial_enquiries q join public.leads l on l.id=q.lead_id where q.id=e and (private.branch_access(l.branch_id) or (private.has_role(array['parent']::public.academy_role[]) and q.submitted_by=auth.uid()))) $$;
create function private.class_access(c uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.academy_classes x where x.id=c and (private.branch_access(x.branch_id) or exists(select 1 from public.enrollments n join public.children k on k.id=n.child_id where n.class_id=x.id and private.family_owner(k.family_id)) or exists(select 1 from public.trial_bookings b join public.class_sessions s on s.id=b.session_id join public.trial_enquiries q on q.id=b.enquiry_id where s.class_id=x.id and q.submitted_by=auth.uid() and private.has_role(array['parent']::public.academy_role[]) and private.mfa_ready()))) $$;
create function private.roster_access(r public.session_roster) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=r.session_id and private.operations_staff(c.branch_id)) or exists(select 1 from public.trial_bookings b join public.trial_enquiries q on q.id=b.enquiry_id where b.id=r.trial_booking_id and q.submitted_by=auth.uid() and private.has_role(array['parent']::public.academy_role[]) and private.mfa_ready()) or exists(select 1 from public.enrollments n join public.children k on k.id=n.child_id where n.id=r.enrollment_id and private.family_owner(k.family_id)) $$;
revoke all on function private.operations_staff(uuid),private.enquiry_access(uuid),private.class_access(uuid),private.roster_access(public.session_roster) from public;
grant execute on function private.operations_staff(uuid),private.enquiry_access(uuid),private.class_access(uuid),private.roster_access(public.session_roster) to authenticated,service_role;
do $$ declare t text; begin foreach t in array array['sport_levels','age_groups','academy_classes','class_sessions','trial_bookings','enrollments','session_roster','operation_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
end loop; end $$;
create policy levels_read on public.sport_levels for select to authenticated using(private.active() and private.mfa_ready());
create policy ages_read on public.age_groups for select to authenticated using(private.active() and private.mfa_ready());
create policy classes_read on public.academy_classes for select to authenticated using(private.class_access(id));
create policy sessions_read on public.class_sessions for select to authenticated using(private.class_access(class_id));
create policy bookings_read on public.trial_bookings for select to authenticated using(private.enquiry_access(enquiry_id));
create policy enrollments_read on public.enrollments for select to authenticated using(exists(select 1 from public.children k where k.id=child_id and private.family_access(k.family_id)) and (exists(select 1 from public.academy_classes c where c.id=class_id and private.operations_staff(c.branch_id)) or exists(select 1 from public.children k where k.id=child_id and private.family_owner(k.family_id))));
create policy roster_read on public.session_roster for select to authenticated using(private.roster_access(session_roster));
create policy events_read on public.operation_events for select to authenticated using(exists(select 1 from public.session_roster r where r.id=roster_id and private.roster_access(r)));

create function private.age_fits(dob date,reported int,captured date,on_date date,lo int,hi int) returns boolean language sql immutable set search_path='' as $$ select case when dob is not null then extract(year from age(on_date,dob)) between lo and hi else captured is not null and on_date>=captured and reported+extract(year from age(on_date,captured))>=lo and reported+extract(year from age(on_date,captured))+case when on_date=captured then 0 else 1 end<=hi end $$;
create function private.trial_fits(q public.trial_enquiries,c public.academy_classes,s public.class_sessions) returns boolean language sql stable security definer set search_path='' as $$ select c.sport=q.sport and c.branch_id=(select branch_id from public.leads where id=q.lead_id) and c.level_id=coalesce(q.starting_level_id,(select cs.level_id from public.child_sports cs where cs.child_id=q.child_id and cs.sport=q.sport),case when exists(select 1 from public.child_sports cs where cs.child_id=q.child_id and cs.sport=q.sport and cs.status='reviewed' and cs.level is not null) then (select sl.id from public.child_sports cs join public.sport_levels sl on sl.name=cs.level and sl.sport=cs.sport and sl.active where cs.child_id=q.child_id and cs.sport=q.sport) when q.experience='beginner' then (select id from public.sport_levels where sport=q.sport and entry_level and active) end) and exists(select 1 from public.age_groups g where g.id=c.age_group_id and private.age_fits((select dob from public.children where id=q.child_id),coalesce((select reported_age from public.children where id=q.child_id),q.reported_age),coalesce((select age_captured_on from public.children where id=q.child_id),q.age_captured_on),(s.starts_at at time zone 'Asia/Dubai')::date,g.min_age,g.max_age)) $$;
revoke all on function private.age_fits(date,int,date,date,int,int),private.trial_fits(public.trial_enquiries,public.academy_classes,public.class_sessions) from public;

-- Sanitized availability contains no student identities, coach contact details or rosters.
create function public.trial_availability(p_enquiry uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q public.trial_enquiries; result jsonb; begin
perform private.require_access(private.enquiry_access(p_enquiry)); select * into q from public.trial_enquiries where id=p_enquiry;
select coalesce(jsonb_agg(x order by x.starts_at),'[]') into result from (
 select s.id,s.class_id,c.name,s.starts_at,s.ends_at,v.name venue,l.name level,l.name_ar level_ar,s.capacity-(select count(*) from public.session_roster r where r.session_id=s.id and not r.cancelled) places
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id join public.branches b on b.id=c.branch_id join public.venues v on v.id=c.venue_id join public.sport_levels l on l.id=c.level_id
 where c.active and b.active and not b.provisional and l.active and s.status='scheduled' and s.starts_at>now() and s.starts_at<now()+interval '90 days' and private.trial_fits(q,c,s) and exists(select 1 from public.branch_sports bs where bs.branch_id=b.id and bs.sport=c.sport) and exists(select 1 from public.profiles p join public.role_assignments ra on ra.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id where p.id=c.coach_id and p.active and ra.role='coach' and bp.branch_id=c.branch_id) and s.capacity>(select count(*) from public.session_roster r where r.session_id=s.id and not r.cancelled)
 order by s.starts_at limit 100
) x; return result; end $$;
revoke all on function public.trial_availability(uuid) from public,anon; grant execute on function public.trial_availability(uuid) to authenticated;

create function private.book_trial(eid uuid,sid uuid,reason text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.trial_enquiries; c public.academy_classes; s public.class_sessions; old public.trial_bookings; bid uuid; ref text; begin
perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
perform private.require_access(private.enquiry_access(eid));
select c0.* into c from public.academy_classes c0 join public.class_sessions s0 on s0.class_id=c0.id where s0.id=sid for update of c0;
select * into s from public.class_sessions where id=sid for update;
select * into q from public.trial_enquiries where id=eid for update;
if q.child_id is not null then perform 1 from public.children where id=q.child_id for update; end if;
select * into old from public.trial_bookings where enquiry_id=eid and status not in ('cancelled','missed');
if found then if old.session_id=sid then return jsonb_build_object('id',old.id,'reference',old.reference,'status',old.status); end if; raise exception 'A trial is already booked' using errcode='P0409'; end if;
perform private.require_access(c.branch_id=(select branch_id from public.leads where id=q.lead_id) and c.sport=q.sport);
if not coalesce(c.active and s.status='scheduled' and s.starts_at>now() and s.starts_at<now()+interval '90 days',false) or not exists(select 1 from public.branches where id=c.branch_id and active and not provisional) or not exists(select 1 from public.branch_sports where branch_id=c.branch_id and sport=c.sport) or not exists(select 1 from public.sport_levels where id=c.level_id and active) or not exists(select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id where p.id=c.coach_id and p.active and r.role='coach' and bp.branch_id=c.branch_id) then raise exception 'Session is unavailable' using errcode='P0409'; end if;
if (select stage from public.leads where id=q.lead_id) in ('lost','converted') then raise exception 'Lead is closed' using errcode='P0409'; end if;
if not coalesce(private.trial_fits(q,c,s),false) then
 perform private.require_access(private.operations_staff(c.branch_id));
 if length(trim(coalesce(reason,'')))<5 then raise exception 'Eligibility override requires a reason' using errcode='22023'; end if;
else reason:=null; end if;
if (select count(*) from public.session_roster where session_id=s.id and not cancelled)>=s.capacity then raise exception 'Session is full' using errcode='P0409'; end if;
if q.child_id is not null and exists(select 1 from public.session_roster r join public.class_sessions s2 on s2.id=r.session_id left join public.trial_bookings b on b.id=r.trial_booking_id left join public.trial_enquiries q2 on q2.id=b.enquiry_id left join public.enrollments n on n.id=r.enrollment_id where not r.cancelled and s2.status<>'cancelled' and coalesce(q2.child_id,n.child_id)=q.child_id and tstzrange(s2.starts_at,s2.ends_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)')) then raise exception 'Child already has a session at this time' using errcode='P0409'; end if;
if q.child_id is not null then insert into public.family_branches select family_id,c.branch_id from public.children where id=q.child_id on conflict do nothing; end if;
insert into public.trial_bookings(enquiry_id,session_id,level_id,override_reason,booked_by) values(q.id,s.id,c.level_id,reason,auth.uid()) returning id,reference into bid,ref;
insert into public.session_roster(session_id,trial_booking_id,kind) values(s.id,bid,'trial');
update public.leads set stage='trial_booked' where id=q.lead_id;
insert into public.lead_activities(lead_id,actor_id,kind,note) values(q.lead_id,auth.uid(),'trial_booked',ref);
return jsonb_build_object('id',bid,'reference',ref,'status','booked'); end $$;
revoke all on function private.book_trial(uuid,uuid,text) from public,anon,authenticated;

-- Keep old guarded commands internal; extend rather than bypass the existing boundary.
alter function public.academy_command(text,jsonb) set schema private;
alter function private.academy_command(text,jsonb) rename to foundation_command;
revoke all on function private.foundation_command(text,jsonb) from public,anon,authenticated;
create function public.academy_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.leads; begin
perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
if p_action='lead.update' then
 select * into l from public.leads where id=(p_data->>'id')::uuid for update;
 perform private.require_access(private.branch_access(l.branch_id));
 if l.stage in ('trial_booked','trial_attended','converted') then
   if p_data->>'stage' is distinct from l.stage or nullif(p_data->>'branch_id','')::uuid is distinct from l.branch_id then raise exception 'Use trial operations to change booked leads' using errcode='P0409'; end if;
 elsif coalesce(p_data->>'stage','') not in ('new','contacted','lost') then raise exception 'Invalid early pipeline stage' using errcode='22023'; end if;
end if;
return private.foundation_command(p_action,p_data); end $$;
revoke all on function public.academy_command(text,jsonb) from public,anon; grant execute on function public.academy_command(text,jsonb) to authenticated;

create function private.class_available(c public.academy_classes) returns boolean language sql stable security definer set search_path='' as $$ select c.active and exists(select 1 from public.branches where id=c.branch_id and active and not provisional) and exists(select 1 from public.venues where id=c.venue_id and branch_id=c.branch_id) and exists(select 1 from public.branch_sports where branch_id=c.branch_id and sport=c.sport) and exists(select 1 from public.sport_levels where id=c.level_id and sport=c.sport and active) and exists(select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id where p.id=c.coach_id and p.active and r.role='coach' and bp.branch_id=c.branch_id) $$;
revoke all on function private.class_available(public.academy_classes) from public,anon,authenticated;
create function private.child_conflict(k uuid,st timestamptz,en timestamptz) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.session_roster r join public.class_sessions s on s.id=r.session_id left join public.trial_bookings b on b.id=r.trial_booking_id left join public.trial_enquiries q on q.id=b.enquiry_id left join public.enrollments n on n.id=r.enrollment_id where not r.cancelled and s.status<>'cancelled' and coalesce(q.child_id,n.child_id)=k and tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange(st,en,'[)')) $$;
revoke all on function private.child_conflict(uuid,timestamptz,timestamptz) from public,anon,authenticated;

create function public.operations_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r uuid; b uuid; c public.academy_classes; s public.class_sessions; q public.trial_enquiries; bk public.trial_bookings; n public.enrollments; rr public.session_roster; d date; st timestamptz; en timestamptz; f uuid; cid uuid; result jsonb; i jsonb; claim private.family_claims; token text; cnt int:=0; begin
perform private.require_access(private.active() and private.mfa_ready());
perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
if octet_length(p_data::text)>24000 then raise exception 'Request too large' using errcode='22023'; end if;
case p_action
when 'level.save' then
 perform private.require_access(private.head_office());
 insert into public.sport_levels(sport,name,name_ar,rank,entry_level) values((p_data->>'sport')::public.sport_id,p_data->>'name',coalesce(p_data->>'name_ar',''),(p_data->>'rank')::int,(p_data->>'entry_level')::boolean) returning id into r;
when 'age.save' then
 perform private.require_access(private.head_office());
 insert into public.age_groups(name,min_age,max_age) values(p_data->>'name',(p_data->>'min_age')::int,(p_data->>'max_age')::int) returning id into r;
when 'class.create' then
 perform private.require_access(private.head_office()); b:=(p_data->>'branch_id')::uuid;
 perform private.require_access(exists(select 1 from public.branches where id=b and active and not provisional) and exists(select 1 from public.venues where id=(p_data->>'venue_id')::uuid and branch_id=b) and exists(select 1 from public.branch_sports where branch_id=b and sport=(p_data->>'sport')::public.sport_id) and exists(select 1 from public.sport_levels where id=(p_data->>'level_id')::uuid and sport=(p_data->>'sport')::public.sport_id and active) and exists(select 1 from public.profiles p join public.role_assignments ra on ra.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id where p.id=(p_data->>'coach_id')::uuid and p.active and ra.role='coach' and bp.branch_id=b));
 insert into public.academy_classes(branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) values(b,(p_data->>'venue_id')::uuid,(p_data->>'coach_id')::uuid,(p_data->>'sport')::public.sport_id,(p_data->>'level_id')::uuid,(p_data->>'age_group_id')::uuid,p_data->>'name',(p_data->>'capacity')::int,array(select value::int from jsonb_array_elements_text(p_data->'weekdays')),(p_data->>'local_time')::time,(p_data->>'duration_minutes')::int) returning id into r;
when 'class.status' then
 perform private.require_access(private.head_office());
 update public.academy_classes set active=(p_data->>'active')::boolean where id=(p_data->>'id')::uuid returning id into r;
when 'sessions.generate' then
 perform private.require_access(private.head_office());
 select * into c from public.academy_classes where id=(p_data->>'class_id')::uuid for update;
 if not coalesce(private.class_available(c),false) or (p_data->>'from')::date<(now() at time zone 'Asia/Dubai')::date or (p_data->>'to')::date<(p_data->>'from')::date or (p_data->>'to')::date>(p_data->>'from')::date+90 then raise exception 'Choose an active class and a range of up to 90 days' using errcode='22023'; end if;
 -- Serialize all timetable generation so venue/coach conflicts cannot race across classes.
 perform pg_advisory_xact_lock(hashtextextended('kafou-timetable',0));
 for d in select generate_series((p_data->>'from')::date,(p_data->>'to')::date,interval '1 day')::date loop
 if extract(dow from d)::int=any(c.weekdays) then
 st:=(d+c.local_time) at time zone c.timezone; en:=st+make_interval(mins=>c.duration_minutes);
 if st>now() and not exists(select 1 from public.class_sessions where class_id=c.id and starts_at=st) then
 if exists(select 1 from public.class_sessions x join public.academy_classes y on y.id=x.class_id where x.status<>'cancelled' and (y.coach_id=c.coach_id or y.venue_id=c.venue_id) and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange(st,en,'[)')) then raise exception 'Venue or coach schedule overlaps' using errcode='P0409'; end if;
 if exists(select 1 from public.enrollments n0 where n0.class_id=c.id and n0.status='active' and private.child_conflict(n0.child_id,st,en)) then raise exception 'An enrolled child has an overlapping session' using errcode='P0409'; end if;
insert into public.class_sessions(class_id,starts_at,ends_at,capacity) values(c.id,st,en,c.capacity) returning id into r;
 insert into public.session_roster(session_id,enrollment_id,kind) select r,id,'enrollment' from public.enrollments where class_id=c.id and status='active'; cnt:=cnt+1;
 end if; end if; end loop;
 return jsonb_build_object('id',c.id,'created',cnt);
when 'lead.create' then
 b:=(p_data->>'branch_id')::uuid; perform private.require_access(private.branch_access(b));
 if length(trim(coalesce(p_data->>'parent_name','')))<2 or length(trim(coalesce(p_data->>'child_name','')))<2 or coalesce(p_data->>'mobile','') !~ '^\+?[0-9 ()-]{9,25}$' then raise exception 'Parent, child and mobile required' using errcode='22023'; end if;
 insert into public.leads(branch_id,parent_name,mobile,email,source,assigned_to,duplicate_review) values(b,p_data->>'parent_name',p_data->>'mobile',coalesce(p_data->>'email',''),p_data->>'source',auth.uid(),exists(select 1 from public.leads where mobile=p_data->>'mobile')) returning id into r;
 insert into public.trial_enquiries(lead_id,child_name,reported_age,sport,experience) values(r,p_data->>'child_name',(p_data->>'age')::int,(p_data->>'sport')::public.sport_id,p_data->>'experience');
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(r,auth.uid(),'lead_created','Lead created by staff.');
when 'enquiry.level' then
 select * into q from public.trial_enquiries where id=(p_data->>'id')::uuid for update;
 perform private.require_access(exists(select 1 from public.leads where id=q.lead_id and private.operations_staff(branch_id)));
 if exists(select 1 from public.trial_bookings where enquiry_id=q.id and status not in ('cancelled','missed')) then raise exception 'Trial already allocated' using errcode='P0409'; end if;
 perform private.require_access(exists(select 1 from public.sport_levels where id=(p_data->>'level_id')::uuid and sport=q.sport and active));
 update public.trial_enquiries set starting_level_id=(p_data->>'level_id')::uuid where id=q.id returning id into r;
when 'trial.book' then return private.book_trial((p_data->>'enquiry_id')::uuid,(p_data->>'session_id')::uuid,nullif(p_data->>'override_reason',''));
when 'trial.cancel' then
 select x.* into c from public.academy_classes x join public.class_sessions y on y.class_id=x.id join public.trial_bookings z on z.session_id=y.id where z.id=(p_data->>'id')::uuid for update of x;
 select y.* into s from public.class_sessions y join public.trial_bookings z on z.session_id=y.id where z.id=(p_data->>'id')::uuid for update of y;
 select * into bk from public.trial_bookings where id=(p_data->>'id')::uuid for update;
 perform private.require_access(private.enquiry_access(bk.enquiry_id));
 if bk.status='cancelled' then return jsonb_build_object('id',bk.id); end if;
 if s.finalized_at is not null or s.starts_at<=now() or bk.status<>'booked' then raise exception 'Trial cannot be cancelled now' using errcode='P0409'; end if;
 update public.trial_bookings set status='cancelled' where id=bk.id returning id into r;
 update public.session_roster set cancelled=true where trial_booking_id=bk.id;
 update public.leads set stage='contacted' where id=(select lead_id from public.trial_enquiries where id=bk.enquiry_id);
 insert into public.lead_activities(lead_id,actor_id,kind,note) select lead_id,auth.uid(),'trial_cancelled','Trial cancelled.' from public.trial_enquiries where id=bk.enquiry_id;
when 'session.cancel' then
 select x.* into c from public.academy_classes x join public.class_sessions y on y.class_id=x.id where y.id=(p_data->>'id')::uuid for update of x;
 select * into s from public.class_sessions where id=(p_data->>'id')::uuid for update;
 perform private.require_access(private.operations_staff(c.branch_id));
 if s.finalized_at is not null then raise exception 'Attendance is finalized' using errcode='P0409'; end if;
 if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Cancellation reason required' using errcode='22023'; end if;
 update public.class_sessions set status='cancelled',cancellation_reason=p_data->>'reason' where id=s.id returning id into r;
 update public.trial_bookings set status='cancelled' where session_id=s.id and status='booked';
 update public.session_roster set cancelled=true where session_id=s.id;
 insert into public.lead_activities(lead_id,actor_id,kind,note) select q0.lead_id,auth.uid(),'session_cancelled','Trial session cancelled.' from public.trial_enquiries q0 join public.trial_bookings b0 on b0.enquiry_id=q0.id where b0.session_id=s.id;
 update public.leads set stage='contacted' where stage='trial_booked' and id in (select q0.lead_id from public.trial_enquiries q0 join public.trial_bookings b0 on b0.enquiry_id=q0.id where b0.session_id=s.id) and not exists(select 1 from public.trial_bookings b1 join public.trial_enquiries q1 on q1.id=b1.enquiry_id where q1.lead_id=public.leads.id and b1.status<>'cancelled');
when 'attendance.finalize' then
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;
 select * into c from public.academy_classes where id=s.class_id;
 perform private.require_access(private.operations_staff(c.branch_id));
 if s.finalized_at is not null then raise exception 'Attendance is finalized' using errcode='P0409'; end if;
 if s.status<>'scheduled' or s.starts_at>now() then raise exception 'Session has not started or is cancelled' using errcode='P0409'; end if;
 if jsonb_typeof(p_data->'entries') is distinct from 'array' or jsonb_array_length(p_data->'entries')<>(select count(*) from public.session_roster where session_id=s.id and not cancelled) or (select count(distinct value->>'id') from jsonb_array_elements(p_data->'entries'))<>jsonb_array_length(p_data->'entries') then raise exception 'Supply each roster entry exactly once' using errcode='22023'; end if;
 for i in select value from jsonb_array_elements(p_data->'entries') loop
 update public.session_roster set attendance=i->>'attendance' where id=(i->>'id')::uuid and session_id=s.id and not cancelled returning * into rr;
 if not found or rr.attendance is null then raise exception 'Invalid roster entry' using errcode='22023'; end if;
 if rr.attendance in ('absent','excused') then
 insert into public.operation_events(roster_id,kind) values(rr.id,'absence_recorded'),(rr.id,'makeup_eligibility_pending') on conflict do nothing;
 end if;
 if rr.kind='trial' and rr.attendance in ('absent','excused') then
 update public.trial_bookings set status='missed' where id=rr.trial_booking_id;
 update public.leads set stage='contacted' where id=(select q0.lead_id from public.trial_enquiries q0 join public.trial_bookings b0 on b0.enquiry_id=q0.id where b0.id=rr.trial_booking_id);
 insert into public.lead_activities(lead_id,actor_id,kind,note) select q0.lead_id,auth.uid(),'trial_missed','Trial missed; follow-up and a new trial may be arranged.' from public.trial_enquiries q0 join public.trial_bookings b0 on b0.enquiry_id=q0.id where b0.id=rr.trial_booking_id;
 end if;
 if rr.kind='trial' and rr.attendance in ('present','late') then
 update public.trial_bookings set status='attended' where id=rr.trial_booking_id;
 update public.leads set stage='trial_attended' where id=(select q0.lead_id from public.trial_enquiries q0 join public.trial_bookings b0 on b0.enquiry_id=q0.id where b0.id=rr.trial_booking_id);
 insert into public.lead_activities(lead_id,actor_id,kind,note) select q0.lead_id,auth.uid(),'trial_attended','Trial attendance finalized.' from public.trial_enquiries q0 join public.trial_bookings b0 on b0.enquiry_id=q0.id where b0.id=rr.trial_booking_id;
 end if;
 end loop;
 update public.class_sessions set finalized_at=now(),finalized_by=auth.uid(),status='completed' where id=s.id returning id into r;
when 'trial.convert' then
 select x.* into c from public.academy_classes x where x.id=(p_data->>'class_id')::uuid for update;
 select * into bk from public.trial_bookings where id=(p_data->>'id')::uuid for update;
 select * into q from public.trial_enquiries where id=bk.enquiry_id for update;
 perform private.require_access(private.operations_staff(c.branch_id) and exists(select 1 from public.leads where id=q.lead_id and branch_id=c.branch_id));
 select * into n from public.enrollments where trial_booking_id=bk.id;
 if found then if n.class_id<>c.id then raise exception 'Already converted to another class' using errcode='P0409'; end if; return jsonb_build_object('id',n.id); end if;
 if bk.status<>'attended' or not coalesce(private.class_available(c),false) or c.sport<>q.sport or c.level_id<>bk.level_id then raise exception 'An attended trial and compatible class are required' using errcode='P0409'; end if;
 if q.child_id is null and q.submitted_by is not null then
 select family_id into f from public.guardians where user_id=q.submitted_by order by family_id limit 1;
 if f is null then
 insert into public.families(name,mobile,email) select parent_name,mobile,email from public.leads where id=q.lead_id returning id into f;
 insert into public.guardians values(f,q.submitted_by); end if;
 insert into public.children(family_id,name,reported_age,age_captured_on) values(f,q.child_name,q.reported_age,q.age_captured_on) returning id into cid;
 insert into public.family_branches values(f,c.branch_id) on conflict do nothing;
 update public.trial_enquiries set child_id=cid where id=q.id;
 update public.leads set family_id=f where id=q.lead_id; select * into q from public.trial_enquiries where id=q.id;
 end if;
 if q.child_id is null or (select family_id from public.leads where id=q.lead_id) is null then
 result:=private.foundation_command('lead.convert',jsonb_build_object('id',q.lead_id)); select * into q from public.trial_enquiries where id=q.id;
 end if;
 cid:=q.child_id; perform 1 from public.children where id=cid for update; select family_id into f from public.children where id=cid; perform private.require_access(private.family_access(f));
 if not exists(select 1 from public.age_groups g where g.id=c.age_group_id and private.age_fits((select dob from public.children where id=cid),coalesce((select reported_age from public.children where id=cid),q.reported_age),coalesce((select age_captured_on from public.children where id=cid),q.age_captured_on),(now() at time zone 'Asia/Dubai')::date,g.min_age,g.max_age)) and length(trim(coalesce(p_data->>'override_reason','')))<5 then raise exception 'Age override requires a reason' using errcode='22023'; end if;
 if (select count(*) from public.enrollments where class_id=c.id and status='active')>=c.capacity then raise exception 'Class is full' using errcode='P0409'; end if;
 for s in select * from public.class_sessions where class_id=c.id and starts_at>now() and status='scheduled' order by starts_at for update loop
 if private.child_conflict(cid,s.starts_at,s.ends_at) then raise exception 'Child has an overlapping session' using errcode='P0409'; end if;
if (select count(*) from public.session_roster where session_id=s.id and not cancelled)>=s.capacity then raise exception 'Upcoming session is full' using errcode='P0409'; end if;
 end loop;
 insert into public.enrollments(child_id,class_id,trial_booking_id) values(cid,c.id,bk.id) returning id into r;
 insert into public.session_roster(session_id,enrollment_id,kind) select id,r,'enrollment' from public.class_sessions where class_id=c.id and starts_at>now() and status='scheduled';
 insert into public.child_sports(child_id,sport,level,level_id,status) values(cid,c.sport,(select name from public.sport_levels where id=c.level_id),c.level_id,'reviewed') on conflict(child_id,sport) do update set level_id=excluded.level_id,level=excluded.level,status='reviewed';
 update public.trial_bookings set status='converted' where id=bk.id;
 update public.leads set stage='converted' where id=q.lead_id;
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(q.lead_id,auth.uid(),'enrolled','Active enrollment created. Package configuration pending.');
 if nullif(p_data->>'override_reason','') is not null then insert into public.lead_activities(lead_id,actor_id,kind,note) values(q.lead_id,auth.uid(),'allocation_override',p_data->>'override_reason'); end if;
when 'family.claim' then
 f:=(p_data->>'family_id')::uuid; perform private.require_access(private.family_owner(f));
 token:=encode(extensions.gen_random_bytes(24),'hex');
 insert into private.family_claims(family_id,user_id,token_hash,expires_at) values(f,auth.uid(),md5(token),now()+interval '24 hours');
 return jsonb_build_object('token',token,'expiresInHours',24);
when 'family.offer' then
 f:=(p_data->>'family_id')::uuid;
 perform private.require_access(private.family_access(f) and (private.head_office() or private.has_role(array['branch']::public.academy_role[])));
 perform private.require_access(exists(select 1 from public.profiles p join auth.users u on u.id=p.id join public.role_assignments r0 on r0.user_id=p.id where p.id=(p_data->>'user_id')::uuid and p.active and u.email_confirmed_at is not null and r0.role='parent'));
 token:=encode(extensions.gen_random_bytes(24),'hex');
 insert into private.family_claims(family_id,user_id,token_hash,expires_at,purpose) values(f,(p_data->>'user_id')::uuid,md5(token),now()+interval '24 hours','guardian');
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(auth.uid(),'guardian_offer','families',f::text,jsonb_build_object('user_id',p_data->>'user_id'));
 return jsonb_build_object('token',token);
when 'family.accept' then
 select * into claim from private.family_claims where token_hash=md5(p_data->>'token') and purpose='guardian' and used_at is null and expires_at>now() for update;
 perform private.require_access(claim.user_id=auth.uid() and private.has_role(array['parent']::public.academy_role[]) and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null));
 insert into public.guardians values(claim.family_id,auth.uid()) on conflict do nothing;
 update private.family_claims set used_at=now() where id=claim.id;
 update public.trial_enquiries set submitted_by=auth.uid() where submitted_by is null and child_id in (select id from public.children where family_id=claim.family_id);
 r:=claim.family_id;
when 'family.link' then
 select * into q from public.trial_enquiries where id=(p_data->>'enquiry_id')::uuid for update;
 select branch_id into b from public.leads where id=q.lead_id;
 perform private.require_access(private.operations_staff(b));
 if exists(select 1 from public.trial_bookings where enquiry_id=q.id and status not in ('cancelled','missed')) then raise exception 'Link child before booking; cancel an unstarted trial first' using errcode='P0409'; end if;
 select * into claim from private.family_claims where token_hash=md5(p_data->>'token') and purpose='child_link' and used_at is null and expires_at>now() for update;
 perform private.require_access(claim.id is not null and exists(select 1 from public.profiles where id=claim.user_id and active) and exists(select 1 from public.role_assignments where user_id=claim.user_id and role='parent'));
 cid:=(p_data->>'child_id')::uuid;
 perform private.require_access(exists(select 1 from public.children where id=cid and family_id=claim.family_id));
 if q.child_id is not null and q.child_id<>cid then raise exception 'Enquiry already linked to another child' using errcode='P0409'; end if;
 insert into public.family_branches values(claim.family_id,b) on conflict do nothing;
 update public.leads set family_id=claim.family_id where id=q.lead_id;
 update public.trial_enquiries set child_id=cid,submitted_by=claim.user_id where id=q.id returning id into r;
 update private.family_claims set used_at=now() where id=claim.id;
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(q.lead_id,auth.uid(),'family_linked','Parent-authorized child linked with a single-use claim.');
else raise exception 'Unknown operation' using errcode='22023'; end case;
if r is null then raise exception 'Record not found' using errcode='P0002'; end if;
return jsonb_build_object('id',r); end $$;
revoke all on function public.operations_command(text,jsonb) from public,anon; grant execute on function public.operations_command(text,jsonb) to authenticated;

create index sessions_class on public.class_sessions(class_id,starts_at);
create index bookings_session on public.trial_bookings(session_id);
create index roster_session on public.session_roster(session_id) where not cancelled;
create index enrollment_class on public.enrollments(class_id) where status='active';
create index enrollment_child on public.enrollments(child_id);
create index classes_branch on public.academy_classes(branch_id);
create index classes_venue on public.academy_classes(venue_id);
create index classes_coach on public.academy_classes(coach_id);
create index classes_level on public.academy_classes(level_id);
create index classes_age on public.academy_classes(age_group_id);
create index booking_level on public.trial_bookings(level_id);
create index booking_actor on public.trial_bookings(booked_by);
create index roster_enrollment on public.session_roster(enrollment_id);
create index finalized_actor on public.class_sessions(finalized_by);
create index enquiry_level on public.trial_enquiries(starting_level_id);
create index child_sport_level on public.child_sports(level_id);
