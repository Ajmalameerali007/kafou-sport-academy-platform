begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('81000000-0000-4000-8000-000000000001','academy-owner@example.test','{"name":"Academy owner"}',now()),
('81000000-0000-4000-8000-000000000002','academy-parent@example.test','{"name":"Academy parent"}',now()),
('81000000-0000-4000-8000-000000000003','academy-other@example.test','{"name":"Other family"}',now()),
('81000000-0000-4000-8000-000000000004','academy-branch@example.test','{"name":"Academy branch"}',now()),
('81000000-0000-4000-8000-000000000005','academy-coach@example.test','{"name":"Assigned coach"}',now()),
('81000000-0000-4000-8000-000000000006','academy-substitute@example.test','{"name":"Other coach"}',now()),
('81000000-0000-4000-8000-000000000007','academy-sales@example.test','{"name":"Academy sales"}',now()),
('81000000-0000-4000-8000-000000000008','academy-other-branch@example.test','{"name":"Other branch"}',now());
delete from public.role_assignments where user_id in ('81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000005','81000000-0000-4000-8000-000000000006','81000000-0000-4000-8000-000000000007','81000000-0000-4000-8000-000000000008');
insert into public.role_assignments values('81000000-0000-4000-8000-000000000001','super_admin'),('81000000-0000-4000-8000-000000000004','branch'),('81000000-0000-4000-8000-000000000005','coach'),('81000000-0000-4000-8000-000000000006','coach'),('81000000-0000-4000-8000-000000000007','sales'),('81000000-0000-4000-8000-000000000008','branch');
insert into public.branches(id,slug,name,provisional) values('82000000-0000-4000-8000-000000000001','academy-product-one','Academy one',false),('82000000-0000-4000-8000-000000000002','academy-product-two','Academy two',false);
insert into public.branch_sports values('82000000-0000-4000-8000-000000000001','swimming'),('82000000-0000-4000-8000-000000000002','swimming');
insert into public.branch_permissions values('81000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000001'),('81000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000001'),('81000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000001'),('81000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000002'),('81000000-0000-4000-8000-000000000007','82000000-0000-4000-8000-000000000001'),('81000000-0000-4000-8000-000000000008','82000000-0000-4000-8000-000000000002');
insert into public.families(id,name) values('83000000-0000-4000-8000-000000000001','Academy family'),('83000000-0000-4000-8000-000000000002','Other academy family');
insert into public.guardians values('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002'),('83000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003');
insert into public.family_branches values('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,dob) values('84000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','Academy child','2018-01-01');
insert into public.child_sports(child_id,sport) values('84000000-0000-4000-8000-000000000001','swimming');
insert into public.venues(id,branch_id,name,address) values('85000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','Academy pool one','Synthetic'),('85000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','Academy pool two','Synthetic');
insert into public.sport_levels(id,sport,name,rank) values('85000000-0000-4000-8000-000000000003','swimming','Academy product level',101),('85000000-0000-4000-8000-000000000004','swimming','Academy product next level',102);
insert into public.age_groups(id,name,min_age,max_age) values('85000000-0000-4000-8000-000000000005','Academy product ages',1,17);
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) values
('86000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000005','swimming','85000000-0000-4000-8000-000000000003','85000000-0000-4000-8000-000000000005','Academy correct class',1,array[0],'16:00',60),
('86000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000006','swimming','85000000-0000-4000-8000-000000000003','85000000-0000-4000-8000-000000000005','Academy other branch',1,array[0],'16:00',60),
('86000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000005','swimming','85000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000005','Academy other level',1,array[0],'16:00',60);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values
('87000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001',now()-interval '3 hours',now()-interval '2 hours',1),
('87000000-0000-4000-8000-000000000002','86000000-0000-4000-8000-000000000001',now()+interval '2 days',now()+interval '2 days 1 hour',1),
('87000000-0000-4000-8000-000000000003','86000000-0000-4000-8000-000000000001',now()+interval '3 days',now()+interval '3 days 1 hour',1),
('87000000-0000-4000-8000-000000000004','86000000-0000-4000-8000-000000000002',now()+interval '4 days',now()+interval '4 days 1 hour',1),
('87000000-0000-4000-8000-000000000005','86000000-0000-4000-8000-000000000003',now()+interval '5 days',now()+interval '5 days 1 hour',1);
insert into public.enrollments(id,child_id,class_id) values('88000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','86000000-0000-4000-8000-000000000001');
insert into public.session_roster(id,session_id,enrollment_id,kind) values('89000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000001','enrollment');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.product_command('academy.policy','{"branch_id":"82000000-0000-4000-8000-000000000001","name":"Synthetic makeup policy","makeup_days":30,"allow_absent":false}','8a000000-0000-4000-8000-000000000001')$$,'Owner configures versioned makeup policy');
select set_config('test.academy_package',(public.product_command('commercial.package.create','{"branch_id":"82000000-0000-4000-8000-000000000001","sport":"swimming","name":"Synthetic academy integration package","price_minor":0,"session_allowance":20,"terms":"Synthetic free test package"}','8a000000-0000-4000-8000-000000000021')->>'id'),true);
select set_config('test.academy_member',(public.product_command('commercial.membership.start',jsonb_build_object('package_id',current_setting('test.academy_package'),'child_id','84000000-0000-4000-8000-000000000001','starts_on',(now() at time zone 'Asia/Dubai')::date,'accepted',true),'8a000000-0000-4000-8000-000000000022')->>'id'),true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.operations_command('attendance.finalize','{"session_id":"87000000-0000-4000-8000-000000000001","entries":[{"id":"89000000-0000-4000-8000-000000000001","attendance":"excused"}]}')$$,'42501',null,'Parent cannot finalize attendance');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.operations_command('attendance.finalize','{"session_id":"87000000-0000-4000-8000-000000000001","entries":[{"id":"89000000-0000-4000-8000-000000000001","attendance":"excused"}]}')$$,'42501',null,'Coach has no implicit front-desk attendance permission');
select throws_ok($$select public.product_command('academy.session.complete','{"session_id":"87000000-0000-4000-8000-000000000003"}','8a000000-0000-4000-8000-000000000002')$$,'P0409',null,'Coach cannot complete future undelivered session');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.operations_command('attendance.finalize','{"session_id":"87000000-0000-4000-8000-000000000001","entries":[{"id":"89000000-0000-4000-8000-000000000001","attendance":"excused"}]}')$$,'Front desk finalizes actual excused absence');
select ok((select delivered_at is null from public.class_sessions where id='87000000-0000-4000-8000-000000000001'),'Attendance does not imply coach delivery completion');
select is((select count(*)::int from public.makeup_credits where source_roster_id='89000000-0000-4000-8000-000000000001'),1,'One eligible absence creates one credit');
-- Branch permission alone does not outlive explicit family unlinking.
select set_config('test.unlinked_credit',(select id::text from public.makeup_credits where child_id='84000000-0000-4000-8000-000000000001'),true);
reset role;
delete from public.family_branches where family_id='83000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::int from public.makeup_credits where child_id='84000000-0000-4000-8000-000000000001'),0,'Removing family branch link removes makeup record access');
select throws_ok($$select public.makeup_availability(current_setting('test.unlinked_credit')::uuid)$$,'42501',null,'Unlinked branch cannot request makeup availability');
select throws_ok($$select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',current_setting('test.unlinked_credit'),'session_id','87000000-0000-4000-8000-000000000002'),gen_random_uuid())$$,'42501',null,'Unlinked branch cannot book known makeup credit');
reset role;
insert into public.family_branches values('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001');
set local role authenticated;

reset role;
select is((select sum(consumed_delta)::int from public.entitlement_ledger where membership_id=current_setting('test.academy_member')::uuid),1,'Original absence consumes exactly one membership entitlement');
set local role authenticated;
select throws_ok($$select public.operations_command('attendance.finalize','{"session_id":"87000000-0000-4000-8000-000000000001","entries":[{"id":"89000000-0000-4000-8000-000000000001","attendance":"excused"}]}')$$,'P0409',null,'Repeated finalization cannot create another credit');
select set_config('test.academy_credit',(select id::text from public.makeup_credits where source_roster_id='89000000-0000-4000-8000-000000000001'),true);
select throws_ok($$select public.product_command('academy.attendance.correct','{"roster_id":"89000000-0000-4000-8000-000000000001","attendance":"present","reason":"Reviewed correction"}','8a000000-0000-4000-8000-000000000003')$$,'42501',null,'Attendance finalization never implies correction authority');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.product_command('commercial.compensation.accrue','{"session_id":"87000000-0000-4000-8000-000000000001"}','8a000000-0000-4000-8000-000000000023')$$,'P0409',null,'Finalized attendance on an ended session is insufficient for compensation');
select lives_ok($$select public.product_command('academy.attendance.correct','{"roster_id":"89000000-0000-4000-8000-000000000001","attendance":"present","reason":"Reviewed correction"}','8a000000-0000-4000-8000-000000000004')$$,'Authorized correction preserves history');
select is((select status from public.makeup_credits where id=current_setting('test.academy_credit')::uuid),'revoked','Correcting eligible absence revokes unused credit');
select lives_ok($$select public.product_command('academy.attendance.correct','{"roster_id":"89000000-0000-4000-8000-000000000001","attendance":"excused","reason":"Documented excused absence"}','8a000000-0000-4000-8000-000000000005')$$,'Corrected eligible absence restores same credit');
select is((select count(*)::int from public.makeup_credits where source_roster_id='89000000-0000-4000-8000-000000000001'),1,'Correction never duplicates source credit');
select is((select count(*)::int from public.attendance_corrections where roster_id='89000000-0000-4000-8000-000000000001'),2,'Both attendance corrections retained');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.makeup_credits where id=current_setting('test.academy_credit')::uuid),0,'Unrelated family cannot read makeup credit');
select throws_ok($$select public.makeup_availability(current_setting('test.academy_credit')::uuid)$$,'42501',null,'Unrelated family cannot query credit availability');
select throws_ok($$select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',current_setting('test.academy_credit'),'session_id','87000000-0000-4000-8000-000000000002'),'8a000000-0000-4000-8000-000000000006')$$,'42501',null,'Unrelated family cannot book known credit');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.makeup_availability(current_setting('test.academy_credit')::uuid)$$,'42501',null,'Another branch cannot inspect credit');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is(jsonb_array_length(public.makeup_availability(current_setting('test.academy_credit')::uuid)),2,'Availability enforces branch and level');
select throws_ok($$select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',current_setting('test.academy_credit'),'session_id','87000000-0000-4000-8000-000000000004'),'8a000000-0000-4000-8000-000000000007')$$,'P0409',null,'Direct request cannot bypass same-branch eligibility');
select lives_ok($$select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',current_setting('test.academy_credit'),'session_id','87000000-0000-4000-8000-000000000002'),'8a000000-0000-4000-8000-000000000008')$$,'Parent reserves eligible makeup');
select lives_ok($$select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',current_setting('test.academy_credit'),'session_id','87000000-0000-4000-8000-000000000002'),'8a000000-0000-4000-8000-000000000009')$$,'Different request key retry returns original makeup');
select is((select count(*)::int from public.makeup_bookings where credit_id=current_setting('test.academy_credit')::uuid),1,'Booking retry never duplicates reservation');
select is((select status from public.makeup_credits where id=current_setting('test.academy_credit')::uuid),'reserved','Credit reserved atomically');
select throws_ok($$select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',current_setting('test.academy_credit'),'session_id','87000000-0000-4000-8000-000000000003'),'8a000000-0000-4000-8000-000000000010')$$,'P0409',null,'A reserved credit cannot book another session');
select set_config('test.academy_booking',(select id::text from public.makeup_bookings where credit_id=current_setting('test.academy_credit')::uuid and status='reserved'),true);
select lives_ok($$select public.product_command('academy.makeup.cancel',jsonb_build_object('id',current_setting('test.academy_booking')),'8a000000-0000-4000-8000-000000000011')$$,'Parent cancellation releases makeup');
select is((select status from public.makeup_credits where id=current_setting('test.academy_credit')::uuid),'available','Cancelled replacement restores credit');
select lives_ok($$select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',current_setting('test.academy_credit'),'session_id','87000000-0000-4000-8000-000000000002'),'8a000000-0000-4000-8000-000000000012')$$,'Parent can rebook the same session after cancellation');
select throws_ok($$select public.product_command('academy.session.cancel','{"session_id":"87000000-0000-4000-8000-000000000002","reason":"Parent attempted class cancellation"}','8a000000-0000-4000-8000-000000000013')$$,'42501',null,'Family cannot cancel the whole class session');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.product_command('academy.session.cancel','{"session_id":"87000000-0000-4000-8000-000000000002","reason":"Synthetic pool closure"}','8a000000-0000-4000-8000-000000000014')$$,'Branch cancellation restores reserved makeup');
select is((select status from public.makeup_credits where id=current_setting('test.academy_credit')::uuid),'available','Whole-session cancellation restores credit');
select is((select count(*)::int from public.session_roster where session_id='87000000-0000-4000-8000-000000000002' and not cancelled),0,'Whole-session cancellation releases capacity');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.product_command('academy.makeup.book',jsonb_build_object('credit_id',current_setting('test.academy_credit'),'session_id','87000000-0000-4000-8000-000000000003'),'8a000000-0000-4000-8000-000000000015')$$,'Restored credit books another session');
reset role;
update public.class_sessions set starts_at=now()-interval '90 minutes',ends_at=now()-interval '30 minutes' where id='87000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.operations_command('attendance.finalize',jsonb_build_object('session_id','87000000-0000-4000-8000-000000000003','entries',(select jsonb_agg(jsonb_build_object('id',id,'attendance','absent')) from public.session_roster where session_id='87000000-0000-4000-8000-000000000003' and not cancelled)))$$,'Missed makeup consumes the original credit');
select is((select status from public.makeup_credits where id=current_setting('test.academy_credit')::uuid),'consumed','Makeup attendance finalization consumes credit');
select is((select count(*)::int from public.makeup_credits where child_id='84000000-0000-4000-8000-000000000001'),1,'Missing a makeup never creates another makeup credit');
reset role;
select is((select sum(consumed_delta)::int from public.entitlement_ledger where membership_id=current_setting('test.academy_member')::uuid),1,'Makeup never deducts a second ordinary entitlement');
select is((select sum(available_delta)::int from public.entitlement_ledger where membership_id=current_setting('test.academy_member')::uuid),19,'Correction and makeup leave reconciled package balance');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.product_command('academy.session.complete','{"session_id":"87000000-0000-4000-8000-000000000003"}','8a000000-0000-4000-8000-000000000016')$$,'42501',null,'Unassigned coach cannot complete another coach session');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.daily_command('shift.in','{"branch_id":"82000000-0000-4000-8000-000000000001"}',gen_random_uuid())$$,'Coach clocks in independently');
select lives_ok($$select public.daily_command('session.start','{"session_id":"87000000-0000-4000-8000-000000000003"}',gen_random_uuid())$$,'Coach starts assigned delivery');
select lives_ok($$select public.product_command('academy.session.complete','{"session_id":"87000000-0000-4000-8000-000000000003"}','8a000000-0000-4000-8000-000000000017')$$,'Assigned coach explicitly confirms delivered session');
reset role;
select is((select delivered_by from public.class_sessions where id='87000000-0000-4000-8000-000000000003'),'81000000-0000-4000-8000-000000000005'::uuid,'Delivery persists actual coach independently of attendance author');
select is((select finalized_by from public.class_sessions where id='87000000-0000-4000-8000-000000000003'),'81000000-0000-4000-8000-000000000004'::uuid,'Attendance author remains front desk');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.product_command('commercial.compensation.rate',jsonb_build_object('branch_id','82000000-0000-4000-8000-000000000001','coach_id','81000000-0000-4000-8000-000000000005','amount_minor',8000,'effective_from',(now() at time zone 'Asia/Dubai')::date-1,'effective_to',(now() at time zone 'Asia/Dubai')::date+2),'8a000000-0000-4000-8000-000000000024')$$,'Owner defines dated compensation rate');
select lives_ok($$select public.product_command('commercial.compensation.accrue','{"session_id":"87000000-0000-4000-8000-000000000003"}','8a000000-0000-4000-8000-000000000025')$$,'Explicit delivery accrues actual coach compensation');
select lives_ok($$select public.product_command('commercial.compensation.accrue','{"session_id":"87000000-0000-4000-8000-000000000003"}','8a000000-0000-4000-8000-000000000026')$$,'Repeated accrual never duplicates liability');
select is((select count(*)::int from public.commercial_compensation_accruals where session_id='87000000-0000-4000-8000-000000000003'),1,'One compensation accrual per delivered session');
select is((select amount_minor from public.commercial_compensation_accruals where session_id='87000000-0000-4000-8000-000000000003'),8000,'Accrual snapshots exact dated rate');
select lives_ok($$select public.product_command('commercial.compensation.review',jsonb_build_object('id',(select id from public.commercial_compensation_accruals where session_id='87000000-0000-4000-8000-000000000003'),'decision','approved','reason','Reviewed explicit coach delivery'),'8a000000-0000-4000-8000-000000000027')$$,'Owner reviews accrued compensation without payout');
select throws_ok($$select public.product_command('academy.attendance.correct','{"roster_id":"89000000-0000-4000-8000-000000000001","attendance":"present","reason":"Attempt to erase consumed source"}','8a000000-0000-4000-8000-000000000018')$$,'P0409',null,'Consumed replacement blocks source correction');
select lives_ok($$select public.product_command('academy.substitute',jsonb_build_object('session_id','87000000-0000-4000-8000-000000000001','coach_id','81000000-0000-4000-8000-000000000006','starts_at',now()-interval '1 day','ends_at',now()+interval '1 day','reason','Synthetic replacement coach'),'8a000000-0000-4000-8000-000000000019')$$,'Authorized substitute assignment records its author');
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.daily_command('shift.in','{"branch_id":"82000000-0000-4000-8000-000000000001"}',gen_random_uuid())$$,'Coach clocks in independently');
select lives_ok($$select public.daily_command('session.start','{"session_id":"87000000-0000-4000-8000-000000000001"}',gen_random_uuid())$$,'Coach starts assigned delivery');
select lives_ok($$select public.product_command('academy.session.complete','{"session_id":"87000000-0000-4000-8000-000000000001"}','8a000000-0000-4000-8000-000000000020')$$,'Current permitted substitute can confirm actual delivery');
select throws_ok($$update public.makeup_credits set status='available'$$,'42501',null,'Authenticated client cannot replenish credits directly');
select * from finish();rollback;
