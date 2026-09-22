-- Tighten staff approval: a different authorized person reviews the reference.
alter function public.staff_photo_info(uuid) rename to staff_photo_info_before_review;
revoke all on function public.staff_photo_info_before_review(uuid) from public,anon,authenticated;
create function public.staff_photo_info(p_staff uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select public.staff_photo_info_before_review(p_staff)||jsonb_build_object('can_approve',p_staff<>auth.uid() and (public.staff_photo_info_before_review(p_staff)->>'can_approve')::boolean)
$$;
alter function public.staff_reference_approve(uuid,uuid) rename to staff_reference_approve_before_review;
revoke all on function public.staff_reference_approve_before_review(uuid,uuid) from public,anon,authenticated;
create function public.staff_reference_approve(p_staff uuid,p_reference uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform private.require_access(p_staff<>auth.uid());
 perform private.require_access(exists(select 1 from private.staff_photo_references where id=p_reference and staff_id=p_staff and created_at>now()-interval '30 days'));
 return public.staff_reference_approve_before_review(p_staff,p_reference);
end $$;
revoke all on function public.staff_photo_info(uuid),public.staff_reference_approve(uuid,uuid) from public,anon;
grant execute on function public.staff_photo_info(uuid),public.staff_reference_approve(uuid,uuid) to authenticated;
alter function public.staff_photo_info(uuid) owner to postgres;
alter function public.staff_reference_approve(uuid,uuid) owner to postgres;

-- Local rehearsal creates real trial/roster records in synthetic scope only.
-- The application signs the request only against the known loopback deployment.
create table private.checkin_rehearsals(session_id uuid primary key references public.class_sessions,base_class uuid not null references public.academy_classes,created_by uuid not null references public.profiles,created_at timestamptz not null default now());
revoke all on private.checkin_rehearsals from public,anon,authenticated,service_role;
alter table private.checkin_rehearsals owner to postgres;
create function public.checkin_rehearsal_options() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'branch_id',c.branch_id) order by c.name),'[]')
 from public.academy_classes c join public.branches b on b.id=c.branch_id join public.profiles p on p.id=c.coach_id
 where private.active() and private.mfa_ready() and exists(select 1 from public.profiles where id=auth.uid() and synthetic)
 and c.synthetic and b.synthetic and p.synthetic and p.active and c.active and b.active and c.name not like 'CHECK-IN TEST%'
 and (private.operations_staff(c.branch_id) or (c.coach_id=auth.uid() and private.product_can('attendance.finalize',c.branch_id)))
$$;
create function public.checkin_rehearsal(p_payload text,p_signature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb; c public.academy_classes; cls uuid; sid uuid; fid uuid; guardian uuid; child uuid; lead uuid; enquiry uuid; booking uuid; age int;
begin
 v:=private.attendance_photo_proof(p_payload,p_signature);
 perform private.require_access(v->>'kind'='checkin_rehearsal');
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 perform private.require_access(exists(select 1 from jsonb_array_elements(public.checkin_rehearsal_options()) opt where opt->>'id'=v->>'class_id'));
 select * into c from public.academy_classes where id=(v->>'class_id')::uuid;
 select r.session_id into sid from private.checkin_rehearsals r join public.class_sessions s on s.id=r.session_id where r.base_class=c.id and s.status='scheduled' and s.finalized_at is null and s.ends_at>now() order by r.created_at desc limit 1;
 if sid is not null then return jsonb_build_object('id',sid);end if;
 if (select count(*) from private.checkin_rehearsals r where r.base_class=c.id and (r.created_at at time zone 'Asia/Dubai')::date=(now() at time zone 'Asia/Dubai')::date)>=10 then raise exception 'Daily rehearsal limit reached' using errcode='P0409';end if;
 select f.id,g.user_id into fid,guardian from public.families f join public.family_branches fb on fb.family_id=f.id join public.guardians g on g.family_id=f.id join public.profiles p on p.id=g.user_id where fb.branch_id=c.branch_id and f.synthetic and p.synthetic and p.active order by f.created_at limit 1;
 if fid is null then raise exception 'This branch needs a synthetic parent family before rehearsal.' using errcode='P0409';end if;
 select (min_age+max_age)/2 into age from public.age_groups where id=c.age_group_id;
 select ac.id into cls from public.academy_classes ac where ac.branch_id=c.branch_id and ac.name='CHECK-IN TEST · '||c.name and ac.coach_id=c.coach_id and ac.level_id=c.level_id and ac.age_group_id=c.age_group_id limit 1;
 if cls is null then
  insert into public.academy_classes(branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes,synthetic)
  values(c.branch_id,c.venue_id,c.coach_id,c.sport,c.level_id,c.age_group_id,'CHECK-IN TEST · '||c.name,4,c.weekdays,c.local_time,30,true) returning id into cls;
 end if;
 insert into public.class_sessions(class_id,starts_at,ends_at,capacity) values(cls,clock_timestamp()-interval '1 minute',clock_timestamp()+interval '29 minutes',4) returning id into sid;
 insert into public.children(family_id,name,reported_age,age_captured_on) values(fid,'TEST · Trial learner '||upper(left(sid::text,4)),age,current_date) returning id into child;
 insert into public.child_sports(child_id,sport,level_id,status) values(child,c.sport,c.level_id,'interest');
 insert into public.leads(branch_id,parent_name,mobile,email,family_id,stage,assigned_to,source) select c.branch_id,'TEST · Check-in rehearsal',f.mobile,f.email,f.id,'trial_booked',auth.uid(),'walk_in' from public.families f where f.id=fid returning id into lead;
 insert into public.trial_enquiries(lead_id,child_id,submitted_by,child_name,reported_age,sport,experience,starting_level_id) select lead,child,guardian,k.name,age,c.sport,'beginner',c.level_id from public.children k where k.id=child returning id into enquiry;
 insert into public.trial_bookings(enquiry_id,session_id,level_id,booked_by) values(enquiry,sid,c.level_id,auth.uid()) returning id into booking;
 insert into public.session_roster(session_id,trial_booking_id,kind) values(sid,booking,'trial');
 insert into private.checkin_rehearsals values(sid,c.id,auth.uid(),now());
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(auth.uid(),'synthetic_checkin_rehearsal','class_sessions',sid::text,jsonb_build_object('child_id',child,'branch_id',c.branch_id));
 return jsonb_build_object('id',sid);
end $$;
revoke all on function public.checkin_rehearsal_options(),public.checkin_rehearsal(text,text) from public,anon;
grant execute on function public.checkin_rehearsal_options(),public.checkin_rehearsal(text,text) to authenticated;
alter function public.checkin_rehearsal_options() owner to postgres;
alter function public.checkin_rehearsal(text,text) owner to postgres;
