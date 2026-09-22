-- Versioned synthetic/approved operational policy, no seeded policy in schema.
alter table public.class_sessions add column delivered_at timestamptz,add column delivered_by uuid references public.profiles;
create table public.academy_policies(id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,version int not null check(version>0),name text not null,synthetic boolean not null default true,makeup_days int not null check(makeup_days between 1 and 365),allow_absent boolean not null default false,allow_excused boolean not null default true,created_at timestamptz not null default now(),unique(branch_id,version));
create table public.makeup_credits(id uuid primary key default gen_random_uuid(),source_roster_id uuid not null unique references public.session_roster,child_id uuid not null references public.children,enrollment_id uuid not null references public.enrollments,branch_id uuid not null references public.branches,sport public.sport_id not null,level_id uuid not null references public.sport_levels,policy_id uuid not null references public.academy_policies,expires_at timestamptz not null,status text not null default 'available' check(status in ('available','reserved','consumed','revoked')),created_at timestamptz not null default now());
create table public.makeup_bookings(id uuid primary key default gen_random_uuid(),credit_id uuid not null references public.makeup_credits,session_id uuid not null references public.class_sessions,status text not null default 'reserved' check(status in ('reserved','attended','missed','cancelled')),reference text not null unique default ('MKP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),created_at timestamptz not null default now());
create unique index one_live_makeup on public.makeup_bookings(credit_id) where status<>'cancelled';
alter table public.session_roster add column makeup_booking_id uuid unique references public.makeup_bookings;
alter table public.session_roster drop constraint session_roster_check;
alter table public.session_roster add constraint roster_purpose_valid check((kind='trial' and trial_booking_id is not null and enrollment_id is null and makeup_booking_id is null) or (kind='enrollment' and enrollment_id is not null and trial_booking_id is null and makeup_booking_id is null) or (kind='makeup' and enrollment_id is not null and trial_booking_id is null and makeup_booking_id is not null));
alter table public.session_roster drop constraint session_roster_session_id_enrollment_id_key;
create unique index one_live_enrollment_roster on public.session_roster(session_id,enrollment_id) where not cancelled;
create table public.attendance_corrections(id uuid primary key default gen_random_uuid(),roster_id uuid not null references public.session_roster,previous_status text not null,new_status text not null,reason text not null check(length(reason) between 5 and 500),actor_id uuid not null references public.profiles,created_at timestamptz not null default now());
create table public.coach_substitutions(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.class_sessions,coach_id uuid not null references public.profiles,starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),revoked_at timestamptz,reason text not null,created_at timestamptz not null default now());
create table public.session_changes(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.class_sessions,actor_id uuid not null references public.profiles,kind text not null,previous_value jsonb not null,new_value jsonb not null,reason text not null,created_at timestamptz not null default now());
create table public.transfer_requests(id uuid primary key default gen_random_uuid(),enrollment_id uuid not null references public.enrollments,target_class_id uuid not null references public.academy_classes,reason text not null,status text not null default 'requested' check(status in ('requested','approved','declined')),requested_by uuid not null references public.profiles,resolution text,resolved_by uuid references public.profiles,created_at timestamptz not null default now());
create table public.waitlist_entries(id uuid primary key default gen_random_uuid(),child_id uuid not null references public.children,enrollment_id uuid not null references public.enrollments,session_id uuid not null references public.class_sessions,status text not null default 'waiting' check(status in ('waiting','offered','booked','expired','cancelled')),offered_until timestamptz,created_at timestamptz not null default now());
create unique index waitlist_once on public.waitlist_entries(child_id,session_id) where status in ('waiting','offered','booked');
create function private.academy_child_access(p_child uuid,p_branch uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.head_office() or exists(select 1 from public.children c where c.id=p_child and (private.family_owner(c.family_id) or (private.operations_staff(p_branch) and exists(select 1 from public.family_branches fb where fb.family_id=c.family_id and fb.branch_id=p_branch)))) $$;
create or replace function private.development_coach_session(sid uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.active() and private.mfa_ready() and private.has_role(array['coach']::public.academy_role[]) and exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=sid and c.active and s.status<>'cancelled' and (c.coach_id=auth.uid() or exists(select 1 from public.coach_substitutions a where a.session_id=s.id and a.coach_id=auth.uid() and a.revoked_at is null and now() between a.starts_at and a.ends_at)) and exists(select 1 from public.branch_permissions b where b.user_id=auth.uid() and b.branch_id=c.branch_id)) $$;
create function private.academy_eligible(p_child uuid,p_session uuid,p_branch uuid,p_sport public.sport_id,p_level uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id join public.age_groups a on a.id=c.age_group_id join public.children k on k.id=p_child where s.id=p_session and s.status='scheduled' and s.starts_at>now() and c.branch_id=p_branch and c.sport=p_sport and c.level_id=p_level and private.class_available(c) and private.age_fits(k.dob,k.reported_age,k.age_captured_on,(s.starts_at at time zone 'Asia/Dubai')::date,a.min_age,a.max_age) and not private.child_conflict(k.id,s.starts_at,s.ends_at))
$$;
create function private.makeup_credit_for(p_roster uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.session_roster;s public.class_sessions;c public.academy_classes;n public.enrollments;p public.academy_policies;rid uuid;begin
 select * into r from public.session_roster where id=p_roster;select * into s from public.class_sessions where id=r.session_id;select * into c from public.academy_classes where id=s.class_id;select * into n from public.enrollments where id=r.enrollment_id;
 if r.kind<>'enrollment' or r.cancelled or s.finalized_at is null or s.status='cancelled' then return null;end if;
 select * into p from public.academy_policies where branch_id=c.branch_id order by version desc limit 1;
 if p.id is null or not ((r.attendance='absent' and p.allow_absent) or (r.attendance='excused' and p.allow_excused)) then return null;end if;
 insert into public.makeup_credits(source_roster_id,child_id,enrollment_id,branch_id,sport,level_id,policy_id,expires_at) values(r.id,n.child_id,n.id,c.branch_id,c.sport,c.level_id,p.id,s.ends_at+make_interval(days=>p.makeup_days)) on conflict(source_roster_id) do update set status='available' where public.makeup_credits.status='revoked' returning id into rid;
 if rid is not null then perform private.emit_product_event('makeup.created',rid,(select family_id from public.children where id=n.child_id),c.branch_id,'Makeup credit available','An eligible absence has a replacement credit. Check its expiry and available sessions.','/parent?view=Makeups');end if;return rid;
end $$;
create function public.makeup_availability(p_credit uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare k public.makeup_credits;result jsonb;begin select * into k from public.makeup_credits where id=p_credit;perform private.require_access(private.academy_child_access(k.child_id,k.branch_id));
 if k.status<>'available' or k.expires_at<=now() then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(x order by starts_at),'[]') into result from (select s.id,s.starts_at,s.ends_at,c.name,v.name venue,s.capacity-(select count(*) from public.session_roster r where r.session_id=s.id and not cancelled)-(select count(*) from public.waitlist_entries w where w.session_id=s.id and w.status='offered' and w.offered_until>now()) places from public.class_sessions s join public.academy_classes c on c.id=s.class_id join public.venues v on v.id=c.venue_id where s.starts_at<=k.expires_at and private.academy_eligible(k.child_id,s.id,k.branch_id,k.sport,k.level_id)) x where places>0;return result;end $$;
create function private.academy_after_session() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.session_roster;n public.enrollments;c public.academy_classes;b public.makeup_bookings;v_family uuid;begin
 select * into c from public.academy_classes where id=new.class_id;
 if old.finalized_at is null and new.finalized_at is not null then
 for r in select * from public.session_roster where session_id=new.id and not cancelled loop
 if r.kind='enrollment' then perform private.commercial_roster_event(r.id,'consume','Attendance finalized');perform private.makeup_credit_for(r.id);
 elsif r.kind='makeup' then update public.makeup_bookings set status=case when r.attendance in ('present','late') then 'attended' else 'missed' end where id=r.makeup_booking_id returning * into b;update public.makeup_credits set status='consumed' where id=b.credit_id;end if;
 end loop;
 end if;
 if old.status<>'cancelled' and new.status='cancelled' then
 insert into public.session_changes(session_id,actor_id,kind,previous_value,new_value,reason) values(new.id,auth.uid(),'cancellation',jsonb_build_object('status',old.status),jsonb_build_object('status','cancelled'),coalesce(new.cancellation_reason,'Session cancelled'));
 for r in select * from public.session_roster where session_id=new.id and not cancelled loop
 if r.kind='enrollment' then perform private.commercial_roster_event(r.id,'release','Session cancelled');
 elsif r.kind='makeup' then update public.makeup_bookings set status='cancelled' where id=r.makeup_booking_id and status='reserved' returning * into b;update public.makeup_credits set status='available' where id=b.credit_id and status='reserved';end if;
 select coalesce((select k.family_id from public.enrollments e join public.children k on k.id=e.child_id where e.id=r.enrollment_id),(select k.family_id from public.trial_bookings tb join public.trial_enquiries q on q.id=tb.enquiry_id join public.children k on k.id=q.child_id where tb.id=r.trial_booking_id),(select k.family_id from public.makeup_bookings mb join public.makeup_credits mc on mc.id=mb.credit_id join public.children k on k.id=mc.child_id where mb.id=r.makeup_booking_id)) into v_family;
 if v_family is not null then perform private.emit_product_event('session.cancelled',new.id,v_family,c.branch_id,'Session cancelled',coalesce(new.cancellation_reason,'Contact reception for your next session.'),'/parent?view=Schedule');end if;
 end loop;update public.waitlist_entries set status='cancelled' where session_id=new.id and status in ('waiting','offered');
 end if;return null;end $$;
create trigger academy_session_effects after update on public.class_sessions for each row execute function private.academy_after_session();
create function private.academy_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare k public.makeup_credits;s public.class_sessions;c public.academy_classes;r public.session_roster;b public.makeup_bookings;n public.enrollments;w public.waitlist_entries;rid uuid;f uuid;reason text;v_old jsonb;begin
 perform private.require_access(private.active() and private.mfa_ready());reason:=trim(coalesce(p_data->>'reason',''));
 case p_action
 when 'academy.policy' then
 perform private.require_access(private.head_office());
 insert into public.academy_policies(branch_id,version,name,makeup_days,allow_absent,allow_excused,synthetic) values((p_data->>'branch_id')::uuid,coalesce((select max(version)+1 from public.academy_policies where branch_id=(p_data->>'branch_id')::uuid),1),p_data->>'name',(p_data->>'makeup_days')::int,coalesce((p_data->>'allow_absent')::boolean,false),true,true) returning id into rid;
 when 'academy.makeup.book' then
 select * into k from public.makeup_credits where id=(p_data->>'credit_id')::uuid for update;perform private.require_access(private.academy_child_access(k.child_id,k.branch_id));
 select * into b from public.makeup_bookings where credit_id=k.id and status<>'cancelled';if found then if b.session_id=(p_data->>'session_id')::uuid then return jsonb_build_object('id',b.id,'reference',b.reference);else raise exception 'Credit already used' using errcode='P0409';end if;end if;
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;
 if k.status<>'available' or k.expires_at<now() or s.starts_at>k.expires_at or not private.academy_eligible(k.child_id,s.id,k.branch_id,k.sport,k.level_id) then raise exception 'Credit or session not eligible' using errcode='P0409';end if;
 if (select count(*) from public.session_roster where session_id=s.id and not cancelled)+(select count(*) from public.waitlist_entries where session_id=s.id and status='offered' and offered_until>now())>=s.capacity then raise exception 'Session full' using errcode='P0409';end if;
 insert into public.makeup_bookings(credit_id,session_id) values(k.id,s.id) returning * into b;
 insert into public.session_roster(session_id,enrollment_id,kind,makeup_booking_id) values(s.id,k.enrollment_id,'makeup',b.id);update public.makeup_credits set status='reserved' where id=k.id;rid:=b.id;
 perform private.emit_product_event('makeup.booked',rid,(select family_id from public.children where id=k.child_id),k.branch_id,'Makeup confirmed','Your replacement session is booked. Check the schedule for details.','/parent?view=Makeups');
 when 'academy.makeup.cancel' then
 select * into b from public.makeup_bookings where id=(p_data->>'id')::uuid for update;select * into k from public.makeup_credits where id=b.credit_id for update;perform private.require_access(private.academy_child_access(k.child_id,k.branch_id));
 select * into s from public.class_sessions where id=b.session_id;
 if b.status='cancelled' then return jsonb_build_object('id',b.id);end if;
 if b.status<>'reserved' or s.starts_at<=now() then raise exception 'Replacement already started' using errcode='P0409';end if;
 update public.makeup_bookings set status='cancelled' where id=b.id;update public.session_roster set cancelled=true where makeup_booking_id=b.id;update public.makeup_credits set status='available' where id=k.id;rid:=b.id;
 when 'academy.attendance.correct' then
 select * into r from public.session_roster where id=(p_data->>'roster_id')::uuid for update;select * into s from public.class_sessions where id=r.session_id;select * into c from public.academy_classes where id=s.class_id;perform private.require_access(private.product_can('attendance.correct',c.branch_id));
 if s.finalized_at is null or s.status='cancelled' or r.cancelled or length(reason)<5 or p_data->>'attendance' not in ('present','late','absent','excused') then raise exception 'Invalid correction' using errcode='22023';end if;
 if r.attendance=p_data->>'attendance' then return jsonb_build_object('id',r.id);end if;
 select * into k from public.makeup_credits where source_roster_id=r.id for update;
 if k.status in ('reserved','consumed') then raise exception 'Resolve replacement before correcting source attendance' using errcode='P0409';end if;
 insert into public.attendance_corrections(roster_id,previous_status,new_status,reason,actor_id) values(r.id,r.attendance,p_data->>'attendance',reason,auth.uid()) returning id into rid;
 update public.makeup_credits set status='revoked' where id=k.id;
 perform private.commercial_roster_event(r.id,'reverse',reason);update public.session_roster set attendance=p_data->>'attendance' where id=r.id;perform private.commercial_roster_event(r.id,'consume',reason);
 if r.kind='trial' then raise exception 'Trial corrections require reviewed trial outcome; not enabled' using errcode='P0409';end if;
 perform private.makeup_credit_for(r.id);
 when 'academy.session.complete' then
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;select * into c from public.academy_classes where id=s.class_id;
 perform private.require_access(private.operations_staff(c.branch_id) or private.development_coach_session(s.id));
 if s.status='cancelled' or s.ends_at>now() or s.finalized_at is null then raise exception 'Resolve attendance and finish session first' using errcode='P0409';end if;
 update public.class_sessions set delivered_at=coalesce(delivered_at,now()),delivered_by=coalesce(delivered_by,auth.uid()) where id=s.id;rid:=s.id;
 when 'academy.session.cancel' then
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;select * into c from public.academy_classes where id=s.class_id;perform private.require_access(private.operations_staff(c.branch_id));
 if length(reason)<5 or s.finalized_at is not null or s.delivered_at is not null then raise exception 'Completed history cannot be cancelled' using errcode='P0409';end if;
 perform public.operations_command('session.cancel',jsonb_build_object('id',s.id,'reason',reason));rid:=s.id;
 when 'academy.session.move' then
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;select * into c from public.academy_classes where id=s.class_id;perform private.require_access(private.head_office());
 if s.finalized_at is not null or s.status<>'scheduled' or length(reason)<5 or (p_data->>'starts_at')::timestamptz<=now() or (p_data->>'ends_at')::timestamptz<=(p_data->>'starts_at')::timestamptz then raise exception 'Invalid occurrence change' using errcode='P0409';end if;
 if exists(select 1 from public.class_sessions x join public.academy_classes a on a.id=x.class_id where x.id<>s.id and x.status<>'cancelled' and (a.coach_id=c.coach_id or a.venue_id=c.venue_id) and tstzrange(x.starts_at,x.ends_at,'[)') && tstzrange((p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,'[)')) then raise exception 'Coach or venue clash' using errcode='P0409';end if;
 if exists(select 1 from public.session_roster rr left join public.enrollments nn on nn.id=rr.enrollment_id left join public.trial_bookings tb on tb.id=rr.trial_booking_id left join public.trial_enquiries tq on tq.id=tb.enquiry_id where rr.session_id=s.id and not rr.cancelled and exists(select 1 from public.session_roster r2 left join public.enrollments n2 on n2.id=r2.enrollment_id left join public.trial_bookings tb2 on tb2.id=r2.trial_booking_id left join public.trial_enquiries tq2 on tq2.id=tb2.enquiry_id join public.class_sessions s2 on s2.id=r2.session_id where coalesce(n2.child_id,tq2.child_id)=coalesce(nn.child_id,tq.child_id) and not r2.cancelled and s2.id<>s.id and s2.status<>'cancelled' and tstzrange(s2.starts_at,s2.ends_at,'[)') && tstzrange((p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,'[)'))) then raise exception 'Participant has overlapping session' using errcode='P0409';end if;
 v_old:=jsonb_build_object('starts_at',s.starts_at,'ends_at',s.ends_at);update public.class_sessions set starts_at=(p_data->>'starts_at')::timestamptz,ends_at=(p_data->>'ends_at')::timestamptz where id=s.id;
 insert into public.session_changes(session_id,actor_id,kind,previous_value,new_value,reason) values(s.id,auth.uid(),'time',v_old,p_data-'reason',reason) returning id into rid;
 for f in select distinct ch.family_id from public.session_roster rr left join public.enrollments e on e.id=rr.enrollment_id left join public.trial_bookings tb on tb.id=rr.trial_booking_id left join public.trial_enquiries tq on tq.id=tb.enquiry_id join public.children ch on ch.id=coalesce(e.child_id,tq.child_id) where rr.session_id=s.id and not rr.cancelled loop perform private.emit_product_event('session.changed.'||f::text,rid,f,c.branch_id,'Session time changed',reason,'/parent?view=Schedule');end loop;
 when 'academy.substitute' then
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid;select * into c from public.academy_classes where id=s.class_id;perform private.require_access(private.head_office());
 if not exists(select 1 from public.profiles p join public.role_assignments r0 on r0.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id where p.id=(p_data->>'coach_id')::uuid and p.active and r0.role='coach' and bp.branch_id=c.branch_id) or length(reason)<5 then raise exception 'Active permitted coach required' using errcode='22023';end if;
 insert into public.coach_substitutions(session_id,coach_id,starts_at,ends_at,reason) values(s.id,(p_data->>'coach_id')::uuid,(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,reason) returning id into rid;
 when 'academy.substitute.revoke' then perform private.require_access(private.head_office());update public.coach_substitutions set revoked_at=now() where id=(p_data->>'id')::uuid returning id into rid;
 when 'academy.transfer.request' then
 select * into n from public.enrollments where id=(p_data->>'enrollment_id')::uuid;select * into c from public.academy_classes where id=n.class_id;perform private.require_access(private.academy_child_access(n.child_id,c.branch_id));
 if length(reason)<5 then raise exception 'Reason required' using errcode='22023';end if;
 insert into public.transfer_requests(enrollment_id,target_class_id,reason,requested_by) values(n.id,(p_data->>'target_class_id')::uuid,reason,auth.uid()) returning id into rid;
 when 'academy.waitlist.join' then
 select * into n from public.enrollments where id=(p_data->>'enrollment_id')::uuid;select * into c from public.academy_classes where id=n.class_id;perform private.require_access(private.academy_child_access(n.child_id,c.branch_id));
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid;
 if n.status<>'active' or not private.academy_eligible(n.child_id,s.id,c.branch_id,c.sport,c.level_id) then raise exception 'Ineligible session' using errcode='P0409';end if;
 insert into public.waitlist_entries(child_id,enrollment_id,session_id) values(n.child_id,n.id,s.id) returning id into rid;
 when 'academy.waitlist.offer' then
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;select * into c from public.academy_classes where id=s.class_id;perform private.require_access(private.operations_staff(c.branch_id));
 update public.waitlist_entries set status='expired' where session_id=s.id and status='offered' and offered_until<=now();
 if s.status<>'scheduled' or s.starts_at<=now() or (select count(*) from public.session_roster where session_id=s.id and not cancelled)+(select count(*) from public.waitlist_entries where session_id=s.id and status='offered')>=s.capacity then raise exception 'No available offer' using errcode='P0409';end if;
 select * into w from public.waitlist_entries where session_id=s.id and status='waiting' order by created_at,id limit 1 for update;
 if w.id is null then raise exception 'No waiting entry' using errcode='P0409';end if;
 if not private.academy_eligible(w.child_id,s.id,c.branch_id,c.sport,c.level_id) then update public.waitlist_entries set status='expired' where id=w.id;return jsonb_build_object('id',w.id,'status','expired');end if;
 update public.waitlist_entries set status='offered',offered_until=least(s.starts_at,now()+interval '24 hours') where id=w.id;rid:=w.id;
 perform private.emit_product_event('waitlist.offer',rid,(select family_id from public.children where id=w.child_id),c.branch_id,'A session place is available','Accept before the offer expires. An offer is not a confirmed booking.','/parent?view=Schedule');
 when 'academy.waitlist.accept' then
 select * into w from public.waitlist_entries where id=(p_data->>'id')::uuid for update;select * into s from public.class_sessions where id=w.session_id for update;select * into c from public.academy_classes where id=s.class_id;perform private.require_access(private.academy_child_access(w.child_id,c.branch_id));
 if w.status='booked' then return jsonb_build_object('id',w.id);end if;
 if w.status<>'offered' or w.offered_until<=now() or not private.academy_eligible(w.child_id,s.id,c.branch_id,c.sport,c.level_id) or (select count(*) from public.session_roster where session_id=s.id and not cancelled)>=s.capacity then raise exception 'Offer no longer available' using errcode='P0409';end if;
 insert into public.session_roster(session_id,enrollment_id,kind) values(s.id,w.enrollment_id,'enrollment') returning id into rid;perform private.commercial_roster_event(rid,'reserve','Waitlist accepted');update public.waitlist_entries set status='booked' where id=w.id;rid:=w.id;
 else raise exception 'Unknown academy command' using errcode='22023';end case;
 if rid is null then raise exception 'Record not found' using errcode='P0002';end if;return jsonb_build_object('id',rid);
end $$;
revoke all on function private.academy_child_access(uuid,uuid),private.academy_eligible(uuid,uuid,uuid,public.sport_id,uuid),private.makeup_credit_for(uuid),private.academy_after_session(),private.academy_command(text,jsonb) from public,anon,authenticated;
grant execute on function private.academy_child_access(uuid,uuid) to authenticated,service_role;
revoke all on function public.makeup_availability(uuid) from public,anon;grant execute on function public.makeup_availability(uuid) to authenticated;
do $$declare t text;begin foreach t in array array['academy_policies','makeup_credits','makeup_bookings','attendance_corrections','coach_substitutions','session_changes','transfer_requests','waitlist_entries'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);execute format('create trigger product_audit after insert or update or delete on public.%I for each row execute function private.product_audit()',t);
 end loop;end $$;
create policy academy_policy_read on public.academy_policies for select to authenticated using(private.active() and private.mfa_ready());
create policy makeup_read on public.makeup_credits for select to authenticated using(private.academy_child_access(child_id,branch_id));
create policy makeup_booking_read on public.makeup_bookings for select to authenticated using(exists(select 1 from public.makeup_credits k where k.id=credit_id));
create policy correction_read on public.attendance_corrections for select to authenticated using(exists(select 1 from public.session_roster r where r.id=roster_id));
create policy substitution_read on public.coach_substitutions for select to authenticated using(private.head_office() or (coach_id=auth.uid() and private.active() and private.mfa_ready() and revoked_at is null and now() between starts_at and ends_at));
create policy change_read on public.session_changes for select to authenticated using(exists(select 1 from public.class_sessions s where s.id=session_id));
create policy transfer_read on public.transfer_requests for select to authenticated using(exists(select 1 from public.enrollments n where n.id=enrollment_id));
create policy waitlist_read on public.waitlist_entries for select to authenticated using(exists(select 1 from public.enrollments n where n.id=enrollment_id));
