begin;
select no_plan();
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
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select public.submit_enquiry('{"parentName":"Parent","mobile":"+971500000001","childName":"Six Year Old","age":"6","sport":"swimming","experience":"beginner","preferredBranch":"journey-test"}','51000000-0000-0000-0000-000000000001');
select is(jsonb_array_length(public.trial_availability((select id from public.trial_enquiries))),2,'Beginner aged six has two eligible dated sessions');
select lives_ok($$select public.operations_command('trial.book',jsonb_build_object('enquiry_id',(select id from public.trial_enquiries),'session_id','26000000-0000-0000-0000-000000000001'))$$,'Parent books eligible trial');
select lives_ok($$select public.operations_command('trial.book',jsonb_build_object('enquiry_id',(select id from public.trial_enquiries),'session_id','26000000-0000-0000-0000-000000000001'))$$,'Retry returns original booking');
select is((select count(*)::int from public.trial_bookings),1,'One booking on retry');
select is((select count(*)::int from public.session_roster),1,'One persisted trial roster entry');
select throws_ok($$select public.operations_command('attendance.finalize','{"session_id":"26000000-0000-0000-0000-000000000001","entries":[]}')$$,'42501',null,'Parent cannot finalize attendance');
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.session_roster),0,'Other family cannot see roster');
select throws_ok($$select public.trial_availability((select id from public.trial_enquiries limit 1))$$,'42501',null,'Unauthorized enquiry rejected');
select public.submit_enquiry('{"parentName":"Other","mobile":"+971500000002","childName":"Another Child","age":"6","sport":"swimming","experience":"beginner","preferredBranch":"journey-test"}','51000000-0000-0000-0000-000000000002');
select throws_ok($$select public.operations_command('trial.book',jsonb_build_object('enquiry_id',(select id from public.trial_enquiries),'session_id','26000000-0000-0000-0000-000000000001'))$$,'P0409',null,'Final place cannot be double booked');
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.operations_command('attendance.finalize','{"session_id":"26000000-0000-0000-0000-000000000001","entries":[]}')$$,'P0409',null,'Future attendance cannot be finalized');
reset role;
update public.class_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id='26000000-0000-0000-0000-000000000001';
set local role authenticated;
select lives_ok($$select public.operations_command('attendance.finalize',jsonb_build_object('session_id','26000000-0000-0000-0000-000000000001','entries',(select jsonb_agg(jsonb_build_object('id',id,'attendance','present')) from public.session_roster)))$$,'Branch finalizes actual roster');
select is((select status from public.trial_bookings limit 1),'attended','Attendance advances trial history');
select throws_ok($$select public.operations_command('attendance.finalize','{"session_id":"26000000-0000-0000-0000-000000000001","entries":[]}')$$,'P0409',null,'Finalized attendance is locked');
select lives_ok($$select public.operations_command('trial.convert',jsonb_build_object('id',(select id from public.trial_bookings limit 1),'class_id','25000000-0000-0000-0000-000000000001'))$$,'Convert creates enrollment preserving original lead');
select lives_ok($$select public.operations_command('trial.convert',jsonb_build_object('id',(select id from public.trial_bookings limit 1),'class_id','25000000-0000-0000-0000-000000000001'))$$,'Conversion is idempotent');
select is((select count(*)::int from public.enrollments),1,'One persisted active enrollment');
select is((select count(*)::int from public.session_roster where session_id='26000000-0000-0000-0000-000000000002'),1,'Enrollment is placed on upcoming session');
select throws_ok($$select public.academy_command('lead.update',jsonb_build_object('id',(select lead_id from public.trial_enquiries where child_id is not null),'branch_id','21000000-0000-0000-0000-000000000001','stage','new'))$$,'P0409',null,'Manual CRM updates cannot erase conversion history');
select * from finish(); rollback;
