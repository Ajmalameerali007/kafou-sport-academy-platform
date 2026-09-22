begin;
select no_plan();
-- All fixture identities and writes roll back; no shared demo records are changed.
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('f1100000-0000-4000-8000-000000000001','guest-coach@example.test','{"name":"Guest fixture coach"}',now()),
('f1100000-0000-4000-8000-000000000002','guest-parent@example.test','{"name":"Guest fixture parent"}',now());
delete from public.role_assignments where user_id='f1100000-0000-4000-8000-000000000001';
insert into public.role_assignments values('f1100000-0000-4000-8000-000000000001','coach');
insert into public.branches(id,slug,name,provisional) values('f1200000-0000-4000-8000-000000000001','guest-capability-test','Guest fixture branch',false);
insert into public.branch_sports values('f1200000-0000-4000-8000-000000000001','karate');
insert into public.branch_permissions values('f1100000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001');
insert into public.venues(id,branch_id,name,address) values('f1300000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','Guest fixture venue','Synthetic');
insert into public.sport_levels(id,sport,name,rank) values('f1400000-0000-4000-8000-000000000001','karate','Guest fixture level',999);
insert into public.age_groups(id,name,min_age,max_age) values('f1400000-0000-4000-8000-000000000002','Guest fixture ages',1,17);
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) values
('f1500000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000001','karate','f1400000-0000-4000-8000-000000000001','f1400000-0000-4000-8000-000000000002','Guest fixture class',1,array[0],'16:00',60);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values('f1600000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000001',now()+interval '2 days',now()+interval '2 days 1 hour',1);
insert into public.families(id,name) values('f1700000-0000-4000-8000-000000000001','Guest fixture family');
insert into public.guardians values('f1700000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000002');
insert into public.children(id,family_id,name,reported_age) values('f1800000-0000-4000-8000-000000000001','f1700000-0000-4000-8000-000000000001','Guest fixture child',6);
insert into public.leads(id,branch_id,parent_name,mobile) values
('f1900000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','Guest one','+971500000001'),
('f1900000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000001','Guest two','+971500000002'),
('f1900000-0000-4000-8000-000000000003','f1200000-0000-4000-8000-000000000001','Signed-in parent','+971500000003');
insert into public.trial_enquiries(id,lead_id,submitted_by,child_name,reported_age,sport,experience,starting_level_id) values
('f1a00000-0000-4000-8000-000000000001','f1900000-0000-4000-8000-000000000001',null,'Guest one child',6,'karate','beginner','f1400000-0000-4000-8000-000000000001'),
('f1a00000-0000-4000-8000-000000000002','f1900000-0000-4000-8000-000000000002',null,'Guest two child',6,'karate','beginner','f1400000-0000-4000-8000-000000000001'),
('f1a00000-0000-4000-8000-000000000003','f1900000-0000-4000-8000-000000000003','f1100000-0000-4000-8000-000000000002','Signed-in child',6,'karate','beginner','f1400000-0000-4000-8000-000000000001');

set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000001')$$,'Server capability returns availability for unlinked guest enquiry');
select lives_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000001','f1600000-0000-4000-8000-000000000001')$$,'Server capability books eligible guest trial');
select lives_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000001','f1600000-0000-4000-8000-000000000001')$$,'Guest booking retry is idempotent');
select is((select count(*)::int from public.session_roster where session_id='f1600000-0000-4000-8000-000000000001' and not cancelled),1,'Guest retry creates exactly one occupied place');
select throws_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000002','f1600000-0000-4000-8000-000000000001')$$,'P0409',null,'Second guest cannot overbook the last place');
select throws_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000003')$$,'42501',null,'Guest capability cannot access signed-in parent enquiry');
select throws_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000099')$$,'42501',null,'Unknown enquiry remains denied');
reset role;
update public.trial_enquiries set child_id='f1800000-0000-4000-8000-000000000001' where id in ('f1a00000-0000-4000-8000-000000000001','f1a00000-0000-4000-8000-000000000003');
set local role service_role;
select throws_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000001')$$,'42501',null,'Linking guest enquiry to verified child revokes availability capability');
select throws_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000001','f1600000-0000-4000-8000-000000000001')$$,'42501',null,'Linked guest cannot replay previously successful booking');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f1100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000002')$$,'42501',null,'Authenticated database client cannot invoke server capability');
select lives_ok($$select public.trial_availability('f1a00000-0000-4000-8000-000000000003')$$,'Current guardian keeps access to own linked enquiry');
select throws_ok($$select public.trial_availability('f1a00000-0000-4000-8000-000000000002')$$,'42501',null,'Signed-in parent cannot access unrelated guest enquiry');
reset role;
delete from public.guardians where family_id='f1700000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.trial_availability('f1a00000-0000-4000-8000-000000000003')$$,'42501',null,'Former guardian cannot use submitter identity to retain linked enquiry access');
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select throws_ok($$select public.guest_trial('f1a00000-0000-4000-8000-000000000002')$$,'42501',null,'Anonymous database client cannot invoke server capability');
select throws_ok($$select public.trial_availability('f1a00000-0000-4000-8000-000000000002')$$,'42501',null,'Anonymous database client cannot bypass signed-cookie route');
select * from finish();
rollback;
