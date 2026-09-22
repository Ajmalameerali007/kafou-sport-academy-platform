begin;
select no_plan();
create function pg_temp.attempt(q text) returns text language plpgsql as $$ begin begin execute q; raise exception using errcode='P9001'; exception when others then return SQLSTATE; end; end $$;
update public.sport_levels set entry_level=false where sport='swimming';
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('11000000-0000-0000-0000-000000000001','journey-parent@example.test','{"name":"Parent"}',now()),
('11000000-0000-0000-0000-000000000002','journey-branch@example.test','{"name":"Branch"}',now()),
('11000000-0000-0000-0000-000000000003','journey-coach@example.test','{"name":"Coach"}',now()),
('11000000-0000-0000-0000-000000000004','journey-other@example.test','{"name":"Other"}',now());
insert into public.role_assignments values('11000000-0000-0000-0000-000000000002','branch'),('11000000-0000-0000-0000-000000000003','coach');
insert into public.branches(id,slug,name,provisional) values('21000000-0000-0000-0000-000000000001','journey-test','Synthetic Dubai',false);
insert into public.branch_permissions values('11000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000001'),('11000000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000001');
insert into public.venues(id,branch_id,name,address) values('22000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','Synthetic pool','Test only');
insert into public.branch_sports values('21000000-0000-0000-0000-000000000001','swimming');
insert into public.sport_levels(id,sport,name,rank,entry_level) values('23000000-0000-0000-0000-000000000001','swimming','Synthetic beginner',0,true);
insert into public.age_groups(id,name,min_age,max_age) values('24000000-0000-0000-0000-000000000001','Synthetic ages 5–8',5,8);
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) values('25000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000003','swimming','23000000-0000-0000-0000-000000000001','24000000-0000-0000-0000-000000000001','Synthetic Swim',1,array[0,2],'17:00',60);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values('26000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000001',now()+interval '2 days',now()+interval '2 days 1 hour',1),('26000000-0000-0000-0000-000000000002','25000000-0000-0000-0000-000000000001',now()+interval '4 days',now()+interval '4 days 1 hour',1);

insert into public.families(id,name) values('31000000-0000-0000-0000-000000000001','Regression family');
insert into public.guardians values('31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001');
insert into public.family_branches values('31000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001');
insert into public.children(id,family_id,name,reported_age,age_captured_on) values('41000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','Child Six',6,current_date);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select public.submit_enquiry('{"parentName":"Parent","mobile":"+971500000001","childName":"Child Six","childId":"41000000-0000-0000-0000-000000000001","age":"6","sport":"swimming","experience":"beginner","preferredBranch":"journey-test"}','51000000-0000-0000-0000-000000000009');
select public.operations_command('trial.book',jsonb_build_object('enquiry_id',(select id from public.trial_enquiries),'session_id','26000000-0000-0000-0000-000000000001'));
reset role;
update public.class_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id='26000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select public.operations_command('attendance.finalize',jsonb_build_object('session_id','26000000-0000-0000-0000-000000000001','entries',(select jsonb_agg(jsonb_build_object('id',id,'attendance','absent')) from public.session_roster)));
select is((select status from public.trial_bookings limit 1),'missed','No-show releases the trial for rebooking');
select is((select stage from public.leads limit 1),'contacted','No-show returns lead to follow-up');
reset role;
-- Reconfigure this rollback-only fixture to an attended trial for conversion boundary tests.
update public.trial_bookings set status='attended';
update public.leads set stage='trial_attended';
update public.session_roster set attendance='present';
update public.profiles set active=false where id='11000000-0000-0000-0000-000000000003';
set local role authenticated;
select is(pg_temp.attempt(format('select public.operations_command(%L,%L::jsonb)','trial.convert',jsonb_build_object('id',(select id from public.trial_bookings limit 1),'class_id','25000000-0000-0000-0000-000000000001'))),'P0409','Inactive coach blocks conversion');
reset role;
update public.profiles set active=true where id='11000000-0000-0000-0000-000000000003';
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) select '25000000-0000-0000-0000-000000000002',branch_id,venue_id,coach_id,sport,level_id,age_group_id,'Conflicting class',capacity,weekdays,local_time,duration_minutes from public.academy_classes where id='25000000-0000-0000-0000-000000000001';
insert into public.enrollments(id,child_id,class_id) values('61000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','25000000-0000-0000-0000-000000000002');
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) select '26000000-0000-0000-0000-000000000003','25000000-0000-0000-0000-000000000002',starts_at,ends_at,capacity from public.class_sessions where id='26000000-0000-0000-0000-000000000002';
insert into public.session_roster(session_id,enrollment_id,kind) values('26000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000001','enrollment');
set local role authenticated;
select is(pg_temp.attempt(format('select public.operations_command(%L,%L::jsonb)','trial.convert',jsonb_build_object('id',(select id from public.trial_bookings limit 1),'class_id','25000000-0000-0000-0000-000000000001'))),'P0409','Overlapping child enrollment cannot be converted');
reset role;
-- Remove fixture ownership and request a verified-parent offer for an orphaned staff record.
delete from public.guardians where family_id='31000000-0000-0000-0000-000000000001';
set local role authenticated;
select is(pg_temp.attempt($q$select public.operations_command('family.offer','{"family_id":"31000000-0000-0000-0000-000000000001","user_id":"11000000-0000-0000-0000-000000000001"}')$q$),'P9001','Reception can issue a scoped verified-parent family offer');
select throws_ok($q$select public.operations_command('family.link',jsonb_build_object('enquiry_id',(select id from public.trial_enquiries where child_id='41000000-0000-0000-0000-000000000001'),'child_id','41000000-0000-0000-0000-000000000001','token',repeat('a',48)))$q$,'P0409',null,'Booked or attended identities cannot be reassociated');
reset role;
create temp table offer(value jsonb); grant all on offer to authenticated;
set local role authenticated;
insert into offer select public.operations_command('family.offer','{"family_id":"31000000-0000-0000-0000-000000000001","user_id":"11000000-0000-0000-0000-000000000001"}');
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok($q$select public.operations_command('family.accept',jsonb_build_object('token',(select value->>'token' from offer)))$q$,'42501',null,'Another verified parent cannot use family offer');
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok($q$select public.operations_command('family.accept',jsonb_build_object('token',(select value->>'token' from offer)))$q$,'Verified invited parent accepts the original family');
select is((select id::text from public.children where id='41000000-0000-0000-0000-000000000001'),'41000000-0000-0000-0000-000000000001','Family offer preserves original child identity');
select throws_ok($q$select public.operations_command('family.accept',jsonb_build_object('token',(select value->>'token' from offer)))$q$,'42501',null,'Family offer cannot be reused');
select * from finish(); rollback;
