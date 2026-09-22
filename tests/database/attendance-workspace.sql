begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('91000000-0000-4000-8000-000000000001','coach-finalization-owner@example.test','{"name":"Coach finalization owner"}',now()),
('91000000-0000-4000-8000-000000000002','coach-finalization-parent@example.test','{"name":"Coach finalization parent"}',now()),
('91000000-0000-4000-8000-000000000003','coach-finalization-other@example.test','{"name":"Other family"}',now()),
('91000000-0000-4000-8000-000000000004','coach-finalization-branch@example.test','{"name":"Coach finalization branch"}',now()),
('91000000-0000-4000-8000-000000000005','coach-finalization-coach@example.test','{"name":"Assigned coach"}',now()),
('91000000-0000-4000-8000-000000000006','coach-finalization-substitute@example.test','{"name":"Other coach"}',now()),
('91000000-0000-4000-8000-000000000007','coach-finalization-sales@example.test','{"name":"Coach finalization sales"}',now()),
('91000000-0000-4000-8000-000000000008','coach-finalization-other-branch@example.test','{"name":"Other branch"}',now());
delete from public.role_assignments where user_id in ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000006','91000000-0000-4000-8000-000000000007','91000000-0000-4000-8000-000000000008');
insert into public.role_assignments values('91000000-0000-4000-8000-000000000001','super_admin'),('91000000-0000-4000-8000-000000000004','branch'),('91000000-0000-4000-8000-000000000005','coach'),('91000000-0000-4000-8000-000000000006','coach'),('91000000-0000-4000-8000-000000000007','sales'),('91000000-0000-4000-8000-000000000008','branch');
insert into public.branches(id,slug,name,provisional) values('92000000-0000-4000-8000-000000000001','coach-finalization-product-one','Coach finalization one',false),('92000000-0000-4000-8000-000000000002','coach-finalization-product-two','Coach finalization two',false);
insert into public.branch_sports values('92000000-0000-4000-8000-000000000001','swimming'),('92000000-0000-4000-8000-000000000002','swimming');
insert into public.branch_permissions values('91000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000002'),('91000000-0000-4000-8000-000000000007','92000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000008','92000000-0000-4000-8000-000000000002');
insert into public.families(id,name) values('93000000-0000-4000-8000-000000000001','Coach finalization family'),('93000000-0000-4000-8000-000000000002','Other academy family');
insert into public.guardians values('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002'),('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003');
insert into public.family_branches values('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,dob) values('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Coach finalization child','2018-01-01');
insert into public.child_sports(child_id,sport) values('94000000-0000-4000-8000-000000000001','swimming');
insert into public.venues(id,branch_id,name,address) values('95000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Coach finalization pool one','Synthetic'),('95000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','Coach finalization pool two','Synthetic');
insert into public.sport_levels(id,sport,name,rank) values('95000000-0000-4000-8000-000000000003','swimming','Coach finalization product level',101),('95000000-0000-4000-8000-000000000004','swimming','Coach finalization product next level',102);
insert into public.age_groups(id,name,min_age,max_age) values('95000000-0000-4000-8000-000000000005','Coach finalization product ages',1,17);
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) values
('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000005','swimming','95000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000005','Coach finalization correct class',1,array[0],'16:00',60),
('96000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000006','swimming','95000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000005','Coach finalization other branch',1,array[0],'16:00',60),
('96000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000005','swimming','95000000-0000-4000-8000-000000000004','95000000-0000-4000-8000-000000000005','Coach finalization other level',1,array[0],'16:00',60);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values
('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',now()-interval '3 hours',now()-interval '2 hours',1),
('97000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001',now()+interval '2 days',now()+interval '2 days 1 hour',1),
('97000000-0000-4000-8000-000000000003','96000000-0000-4000-8000-000000000001',now()+interval '3 days',now()+interval '3 days 1 hour',1),
('97000000-0000-4000-8000-000000000004','96000000-0000-4000-8000-000000000002',now()+interval '4 days',now()+interval '4 days 1 hour',1),
('97000000-0000-4000-8000-000000000005','96000000-0000-4000-8000-000000000003',now()+interval '5 days',now()+interval '5 days 1 hour',1);
insert into public.enrollments(id,child_id,class_id) values('98000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001');
insert into public.session_roster(id,session_id,enrollment_id,kind) values('99000000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','enrollment');

update public.class_sessions set capacity=2 where id='97000000-0000-4000-8000-000000000001';
insert into public.academy_policies(branch_id,version,name,makeup_days) values('92000000-0000-4000-8000-000000000001',1,'Coach test policy',30);
insert into public.leads(id,branch_id,parent_name,mobile,stage) values('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Coach trial parent','+971500000001','trial_booked');
insert into public.trial_enquiries(id,lead_id,submitted_by,child_name,reported_age,sport,experience) values('93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','Unlinked trial athlete',8,'swimming','beginner');
insert into public.trial_bookings(id,enquiry_id,session_id,level_id) values('93000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000003');
insert into public.session_roster(id,session_id,trial_booking_id,kind) values('99000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000003','trial');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(public.attendance_register('97000000-0000-4000-8000-000000000001')->'roster'),2,'Complete register includes trial and regular');
select lives_ok($$select public.attendance_draft_command('97000000-0000-4000-8000-000000000001','save',0, public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','{"99000000-0000-4000-8000-000000000001":"excused","99000000-0000-4000-8000-000000000002":"late"}',gen_random_uuid())$$,'Branch saves shared draft without finalizing');
select is(public.attendance_register('97000000-0000-4000-8000-000000000001')->>'revision','1','Draft revision advances');
select throws_ok($$select public.attendance_draft_command('97000000-0000-4000-8000-000000000001','save',0,public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','{}',gen_random_uuid())$$,'P0409',null,'Stale actor cannot overwrite draft');
reset role;
select ok((select attendance is null from public.session_roster where id='99000000-0000-4000-8000-000000000001'),'Draft never leaks to canonical parent attendance');
insert into public.product_permissions(user_id,permission,branch_id) values('91000000-0000-4000-8000-000000000005','attendance.finalize','92000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select is(public.attendance_register('97000000-0000-4000-8000-000000000001')->'marks'->>'99000000-0000-4000-8000-000000000002','late','Coach sees the same Branch draft');
select lives_ok($$select public.attendance_draft_command('97000000-0000-4000-8000-000000000001','finish',1,public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','{}','90000000-0000-4000-8000-000000000099')$$,'Assigned granted coach finishes shared draft');
select lives_ok($$select public.attendance_draft_command('97000000-0000-4000-8000-000000000001','finish',1,public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','{}','90000000-0000-4000-8000-000000000099')$$,'Same key finish retry idempotent');
select throws_ok($$select public.attendance_register('97000000-0000-4000-8000-000000000004')$$,'42501',null,'Unassigned other branch denied');
reset role;
select is((select count(*)::int from public.makeup_credits where source_roster_id='99000000-0000-4000-8000-000000000001'),1,'One eligible credit despite repeated finish');
select ok((select delivered_at is null from public.class_sessions where id='97000000-0000-4000-8000-000000000001'),'Attendance is not coach delivery');
delete from public.product_permissions where user_id='91000000-0000-4000-8000-000000000005';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select is(public.attendance_register('97000000-0000-4000-8000-000000000001')->>'can_mark','false','Revocation removes open-session editing');
select throws_ok($$select public.attendance_draft_command('97000000-0000-4000-8000-000000000001','finish',1,public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','{}','90000000-0000-4000-8000-000000000099')$$,'42501',null,'Revocation denies cached success');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.attendance_register('97000000-0000-4000-8000-000000000001')$$,'42501',null,'Parent cannot access draft register or other participants');
reset role;select * from finish();rollback;
