begin;
create schema test_schedule;
-- Entire ordinary suite rolls back. Concurrency runs use these same fixtures in a throwaway database.
create function test_schedule.sid(x text) returns uuid language sql immutable as $$select md5('schedule-extension-'||x)::uuid$$;
create function test_schedule.cmd(a text,d jsonb) returns jsonb language sql as $$select public.product_command(a,d,gen_random_uuid())$$;
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at)
select test_schedule.sid(x),x||'-schedule@example.test',jsonb_build_object('name',x),now() from unnest(array['owner','coach','other-coach','branch','parent','other-parent']) x;
insert into public.role_assignments values (test_schedule.sid('owner'),'super_admin'),(test_schedule.sid('coach'),'coach'),(test_schedule.sid('other-coach'),'coach'),(test_schedule.sid('branch'),'branch');
insert into public.branches(id,slug,name,provisional) values(test_schedule.sid('branch-a'),'schedule-extension-a','Synthetic schedule branch',false),(test_schedule.sid('branch-b'),'schedule-extension-b','Other schedule branch',false);
insert into public.branch_sports values(test_schedule.sid('branch-a'),'swimming'),(test_schedule.sid('branch-b'),'swimming');
insert into public.branch_permissions select test_schedule.sid(x),test_schedule.sid('branch-a') from unnest(array['coach','other-coach','branch']) x;
insert into public.branch_permissions values(test_schedule.sid('other-coach'),test_schedule.sid('branch-b'));
insert into public.venues(id,branch_id,name,address) values(test_schedule.sid('venue-a'),test_schedule.sid('branch-a'),'Source pool','Synthetic'),(test_schedule.sid('venue-b'),test_schedule.sid('branch-b'),'Target pool','Synthetic');
insert into public.sport_levels(id,sport,name,rank) values(test_schedule.sid('level'),'swimming','Schedule test level',321);
insert into public.age_groups(id,name,min_age,max_age) values(test_schedule.sid('ages'),'Schedule test ages',5,10);
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes)
values(test_schedule.sid('class-a'),test_schedule.sid('branch-a'),test_schedule.sid('venue-a'),test_schedule.sid('coach'),'swimming',test_schedule.sid('level'),test_schedule.sid('ages'),'Source class',5,array[0],'17:00',60),
(test_schedule.sid('class-b'),test_schedule.sid('branch-b'),test_schedule.sid('venue-b'),test_schedule.sid('other-coach'),'swimming',test_schedule.sid('level'),test_schedule.sid('ages'),'Target class',5,array[0],'17:00',60);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity)
select test_schedule.sid(x),test_schedule.sid('class-a'),now()+d,now()+d+interval '1 hour',5 from (values('past',interval '-2 hours'),('earlier',interval '1 day'),('anchor',interval '2 days'),('adjacent',interval '2 days 1 hour')) v(x,d);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values(test_schedule.sid('target'),test_schedule.sid('class-b'),now()+interval '4 days',now()+interval '4 days 1 hour',1),(test_schedule.sid('race'),test_schedule.sid('class-a'),now()+interval '10 days',now()+interval '10 days 1 hour',1);
insert into public.families(id,name) values(test_schedule.sid('family'),'Schedule test family'),(test_schedule.sid('other-family'),'Other schedule family');
insert into public.guardians values(test_schedule.sid('family'),test_schedule.sid('parent')),(test_schedule.sid('other-family'),test_schedule.sid('other-parent'));
insert into public.family_branches values(test_schedule.sid('family'),test_schedule.sid('branch-a')),(test_schedule.sid('other-family'),test_schedule.sid('branch-a'));
insert into public.children(id,family_id,name,reported_age,age_captured_on) values(test_schedule.sid('child'),test_schedule.sid('family'),'Schedule Athlete',7,current_date),(test_schedule.sid('other-child'),test_schedule.sid('other-family'),'Other Athlete',7,current_date),(test_schedule.sid('trial-child'),test_schedule.sid('other-family'),'Trial Athlete',7,current_date);
insert into public.child_sports(child_id,sport,level_id,level,status) select test_schedule.sid(x),'swimming',test_schedule.sid('level'),'Schedule test level','reviewed' from unnest(array['child','other-child','trial-child']) x;
insert into public.enrollments(id,child_id,class_id) values(test_schedule.sid('enrollment'),test_schedule.sid('child'),test_schedule.sid('class-a')),(test_schedule.sid('other-enrollment'),test_schedule.sid('other-child'),test_schedule.sid('class-a'));
insert into public.session_roster(id,session_id,enrollment_id,kind,attendance) values(test_schedule.sid('past-roster'),test_schedule.sid('past'),test_schedule.sid('enrollment'),'enrollment','excused'),(test_schedule.sid('anchor-roster'),test_schedule.sid('anchor'),test_schedule.sid('enrollment'),'enrollment',null);
update public.class_sessions set finalized_at=now(),status='completed' where id=test_schedule.sid('past');

insert into public.academy_policies(id,branch_id,version,name,makeup_days) values(test_schedule.sid('policy'),test_schedule.sid('branch-a'),1,'Synthetic concurrency policy',30);
insert into public.makeup_credits(id,source_roster_id,child_id,enrollment_id,branch_id,sport,level_id,policy_id,expires_at) values(test_schedule.sid('credit'),test_schedule.sid('past-roster'),test_schedule.sid('child'),test_schedule.sid('enrollment'),test_schedule.sid('branch-a'),'swimming',test_schedule.sid('level'),test_schedule.sid('policy'),now()+interval '30 days');
insert into public.leads(id,branch_id,parent_name,mobile,family_id) values(test_schedule.sid('lead'),test_schedule.sid('branch-a'),'Synthetic trial guardian','+971500099991',test_schedule.sid('other-family'));
insert into public.trial_enquiries(id,lead_id,submitted_by,child_id,child_name,reported_age,sport,experience,starting_level_id) values(test_schedule.sid('enquiry'),test_schedule.sid('lead'),test_schedule.sid('other-parent'),test_schedule.sid('trial-child'),'Trial Athlete',7,'swimming','beginner',test_schedule.sid('level'));
grant usage on schema test_schedule to authenticated;
commit;
