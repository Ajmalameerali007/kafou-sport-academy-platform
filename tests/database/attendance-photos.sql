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


insert into private.attendance_engine_key(secret) values('isolated-test-key');
update public.children set synthetic=true where id='94000000-0000-4000-8000-000000000001';
create function pg_temp.proof(payload jsonb) returns text language sql as $$select encode(extensions.hmac(payload::text,'isolated-test-key','sha256'),'hex')$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.attendance_photo_consent('94000000-0000-4000-8000-000000000001',true)$$,'Guardian explicitly opts in separately');
select throws_ok($$select public.attendance_reference_candidate('{}','fake')$$,'42501',null,'Unsigned references rejected');
select lives_ok($$with v as(select jsonb_build_object('actor',auth.uid(),'time',extract(epoch from now()),'kind','reference','child','94000000-0000-4000-8000-000000000001','reference','99000000-0000-4000-8000-000000000088','version',1,'sha256',repeat('a',64),'model','test-plumbing') p) select public.attendance_reference_candidate(p::text,pg_temp.proof(p)) from v$$,'Signed validated candidate awaits staff approval');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.attendance_photo_scope('97000000-0000-4000-8000-000000000001')->0->>'status','missing_reference','Candidate not eligible before staff approval');
select lives_ok($$select public.attendance_reference_approve('94000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000088')$$,'Owner confirms correct subject reference');
select lives_ok($$select public.attendance_draft_command('97000000-0000-4000-8000-000000000001','save',0,public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','{}','90000000-0000-4000-8000-000000000077')$$,'Save blank before photo for retry regression');
select lives_ok($$with v as(select jsonb_build_object('kind','session','actor',auth.uid(),'time',extract(epoch from now()),'session','97000000-0000-4000-8000-000000000001','scope',public.attendance_photo_scope('97000000-0000-4000-8000-000000000001'),'revision',1,'roster_token',public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','sha256',repeat('b',64),'matched',jsonb_build_array('99000000-0000-4000-8000-000000000001'),'exceptions','[]'::jsonb,'processing_ms',1) p) select public.attendance_photo_accept(p::text,pg_temp.proof(p)) from v$$,'Signed match populates shared draft automatically');
select lives_ok($$select public.attendance_draft_command('97000000-0000-4000-8000-000000000001','save',0,public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','{}','90000000-0000-4000-8000-000000000077')$$,'Old save replay does not clear newer photo provenance');
select is(public.attendance_register('97000000-0000-4000-8000-000000000001')->'marks'->>'99000000-0000-4000-8000-000000000001','present','Strong match present in draft');
select is(public.attendance_register('97000000-0000-4000-8000-000000000001')->'marks'->>'99000000-0000-4000-8000-000000000002',null,'Unmatched participant never becomes absent');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.attendance_photo_consent('94000000-0000-4000-8000-000000000001',false)$$,'Guardian withdraws consent');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.attendance_draft_command('97000000-0000-4000-8000-000000000001','finish',2,public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','{}',gen_random_uuid())$$,'P0409',null,'Consent withdrawal blocks finalization of automatic mark');
select lives_ok($$select public.attendance_manual_review('97000000-0000-4000-8000-000000000001',2,public.attendance_register('97000000-0000-4000-8000-000000000001')->>'roster_token','99000000-0000-4000-8000-000000000001',gen_random_uuid())$$,'Staff can manually confirm the unchanged Present after withdrawal');
select is(public.attendance_register('97000000-0000-4000-8000-000000000001')->'photo_review_required','[]'::jsonb,'Manual review removes revoked provenance');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.attendance_reference_info('94000000-0000-4000-8000-000000000001')$$,'42501',null,'Branch without photo grant cannot read biometric reference information');
reset role;
update public.session_roster set cancelled=true where id='99000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.attendance_register('97000000-0000-4000-8000-000000000001')->'marks','{}'::jsonb,'Cancelled roster marks do not poison subsequent saves');
select throws_ok($$select public.attendance_request_review('97000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000002','Please check attendance',gen_random_uuid())$$,'22023',null,'Correction requests require finalized attendance');
reset role;select * from finish();rollback;
