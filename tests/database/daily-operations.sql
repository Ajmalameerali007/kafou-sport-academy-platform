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
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.daily_command('session.start','{"session_id":"97000000-0000-4000-8000-000000000001"}',gen_random_uuid())$$,'P0409','Clock in at this branch before starting the session','Coach delivery requires clock-in');
select lives_ok($$select public.daily_command('shift.in','{"branch_id":"92000000-0000-4000-8000-000000000001"}',gen_random_uuid())$$,'Coach clocks in');
select lives_ok($$select public.daily_command('shift.in','{"branch_id":"92000000-0000-4000-8000-000000000001"}',gen_random_uuid())$$,'Repeated clock in is idempotent');
select is(public.daily_read('shifts')->>'total','1','Only one shift exists');
select lives_ok($$select public.daily_command('session.start','{"session_id":"97000000-0000-4000-8000-000000000001"}',gen_random_uuid())$$,'Clocked-in coach starts assigned delivery');
select throws_ok($$select public.daily_command('session.start','{"session_id":"97000000-0000-4000-8000-000000000004"}',gen_random_uuid())$$,'42501',null,'Unassigned session denied');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.daily_command('student.arrive','{"id":"99000000-0000-4000-8000-000000000001","revision":0}',gen_random_uuid())$$,'Branch records arrival');
select is(public.attendance_register('97000000-0000-4000-8000-000000000001')->'marks'->>'99000000-0000-4000-8000-000000000001','present','Arrival populates canonical draft');
select throws_ok($$select public.daily_command('student.arrive','{"id":"99000000-0000-4000-8000-000000000001","revision":0}',gen_random_uuid())$$,'P0409',null,'Stale check-in rejected');
select set_config('test.expense',public.daily_command('expense.save','{"branch_id":"92000000-0000-4000-8000-000000000001","cost_date":"2026-09-22","title":"Pool equipment","category":"Equipment","amount_minor":10000}',gen_random_uuid())->>'id',true);
select lives_ok($$select public.daily_command('cost.submit',jsonb_build_object('id',current_setting('test.expense'),'revision',0),gen_random_uuid())$$,'Branch submits expense');
select throws_ok($$select public.daily_command('cost.review',jsonb_build_object('id',current_setting('test.expense'),'revision',1,'decision','approved','reason','Reviewed receipt'),gen_random_uuid())$$,'42501',null,'Branch cannot approve expense');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal2"}',true);
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30')->>'total','0','Other branch cannot read expense');
select throws_ok($$select public.daily_command('cost.submit',jsonb_build_object('id',current_setting('test.expense'),'revision',1),gen_random_uuid())$$,'42501',null,'Other branch cannot mutate expense');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.daily_command('cost.review',jsonb_build_object('id',current_setting('test.expense'),'revision',1,'decision','approved','reason','Reviewed receipt'),gen_random_uuid())$$,'Owner approves expense');
select lives_ok($$select public.daily_command('cost.pay',jsonb_build_object('id',current_setting('test.expense'),'revision',2,'amount_minor',4000,'method','bank','reference','DAILY-EXP-01','paid_on',current_date),'90000000-0000-4000-8000-000000000098')$$,'Partial payout recorded');
select lives_ok($$select public.daily_command('cost.pay',jsonb_build_object('id',current_setting('test.expense'),'revision',2,'amount_minor',4000,'method','bank','reference','DAILY-EXP-01','paid_on',current_date),'90000000-0000-4000-8000-000000000098')$$,'Payout retry is idempotent');
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30')->'summary'->>'approved_cost_minor','10000','Payout does not duplicate expense');
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30')->'summary'->>'paid_minor','4000','Payout counted once');
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30')->'summary'->>'outstanding_minor','6000','Liability reduced');
select throws_ok($$select public.daily_command('cost.pay',jsonb_build_object('id',current_setting('test.expense'),'revision',3,'amount_minor',7000,'method','bank','reference','DAILY-EXP-02','paid_on',current_date),gen_random_uuid())$$,'P0409',null,'Overpayment rejected');
select set_config('test.agreement',public.daily_command('salary.agreement','{"employee_id":"91000000-0000-4000-8000-000000000004","effective_from":"2026-09-01","effective_to":"2027-01-01","amount_minor":500000,"allocations":[{"branch_id":"92000000-0000-4000-8000-000000000001","amount_minor":300000},{"branch_id":null,"amount_minor":200000}]}',gen_random_uuid())->>'id',true);
select set_config('test.salary',public.daily_command('salary.draft',jsonb_build_object('agreement_id',current_setting('test.agreement'),'period_start','2026-09-01'),gen_random_uuid())->>'id',true);
select is(public.daily_command('salary.draft',jsonb_build_object('agreement_id',current_setting('test.agreement'),'period_start','2026-09-01'),gen_random_uuid())->>'id',current_setting('test.salary'),'Duplicate month returns same obligation');
select lives_ok($$select public.daily_command('cost.submit',jsonb_build_object('id',current_setting('test.salary'),'revision',0),gen_random_uuid())$$,'Submit salary');
select lives_ok($$select public.daily_command('cost.review',jsonb_build_object('id',current_setting('test.salary'),'revision',1,'decision','approved','reason','Monthly payroll approved'),gen_random_uuid())$$,'Approve salary');
select throws_ok($$select public.daily_command('cost.adjust',jsonb_build_object('id',current_setting('test.salary'),'revision',2,'adjustment_minor',100,'reason','Change old approval'),gen_random_uuid())$$,'P0409',null,'Approved salary basis cannot be rewritten');
select is(public.daily_read('salary','92000000-0000-4000-8000-000000000001','2026-09-01','2026-09-30')->'summary'->>'approved_cost_minor','300000','Branch salary attribution is its allocated contribution');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select is(public.daily_read('salary',null,'2026-09-01','2026-09-30')->>'total','1','Employee sees own salary');
select throws_ok($$select public.daily_command('cost.pay',jsonb_build_object('id',current_setting('test.salary'),'revision',2,'amount_minor',500000,'method','bank','reference','DAILY-SAL-01','paid_on',current_date),gen_random_uuid())$$,'42501',null,'Employee cannot pay own salary');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal2"}',true);
select is(public.daily_read('salary',null,'2026-09-01','2026-09-30')->>'total','0','Other employee cannot see salary');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.daily_read('today')$$,'42501',null,'Parent cannot access staff workspace');
reset role;
insert into public.product_permissions(user_id,permission,branch_id) values('91000000-0000-4000-8000-000000000007','accounts.payroll',null);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
select is(public.daily_read('salary',null,'2026-09-01','2026-09-30')->>'total','1','Explicit Accounts grant does not require admin role');
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30')->>'total','0','Payroll grant does not disclose expenses');
select throws_ok($$select public.daily_command('cost.pay',jsonb_build_object('id',current_setting('test.salary'),'revision',2,'amount_minor',300000,'method','bank','reference','DAILY-SAL-OVER','paid_on',current_date,'allocations',jsonb_build_array(jsonb_build_object('branch_id',null,'amount_minor',300000))),gen_random_uuid())$$,'P0409',null,'Payout cannot exceed a cost centre balance');
select lives_ok($$select public.daily_command('cost.pay',jsonb_build_object('id',current_setting('test.salary'),'revision',2,'amount_minor',300000,'method','bank','reference','DAILY-SAL-01','paid_on',current_date,'allocations',jsonb_build_array(jsonb_build_object('branch_id','92000000-0000-4000-8000-000000000001','amount_minor',300000))),'90000000-0000-4000-8000-000000000097')$$,'Accounts records explicitly allocated salary payment');
select is(public.daily_read('salary','92000000-0000-4000-8000-000000000001','2026-09-01','2026-09-30')->'summary'->>'outstanding_minor','0','Paid branch contribution has zero remaining liability');
select is(public.daily_read('salary',null,'2026-09-01','2026-09-30')->'summary'->>'outstanding_minor','200000','Central remaining cost stays visible');
reset role;
delete from public.product_permissions where user_id='91000000-0000-4000-8000-000000000007' and permission='accounts.payroll';
set local role authenticated;
select is(public.daily_read('salary',null,'2026-09-01','2026-09-30')->>'total','0','Revocation removes payroll visibility');
select throws_ok($$select public.daily_command('cost.pay',jsonb_build_object('id',current_setting('test.salary'),'revision',2,'amount_minor',300000,'method','bank','reference','DAILY-SAL-01','paid_on',current_date,'allocations',jsonb_build_array(jsonb_build_object('branch_id','92000000-0000-4000-8000-000000000001','amount_minor',300000))),'90000000-0000-4000-8000-000000000097')$$,'42501',null,'Revocation blocks cached payout response');
reset role;
insert into private.cost_obligations(kind,branch_id,cost_date,title,category,amount_minor,allocations,status,created_by)
 select 'expense','92000000-0000-4000-8000-000000000001','2026-09-22','Page boundary '||n,'Testing',100,jsonb_build_array(jsonb_build_object('branch_id','92000000-0000-4000-8000-000000000001','amount_minor',100)),'approved','91000000-0000-4000-8000-000000000001' from generate_series(1,60) n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(public.daily_read('expenses',null,'2026-09-01','2026-09-30')->'rows'),50,'Details are paginated');
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30')->>'total','61','Count includes unloaded rows');
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30')->'summary',public.daily_read('expenses',null,'2026-09-01','2026-09-30',50)->'summary','Totals do not change with pagination');
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30',0,'Page boundary 60')->>'total','1','Server search finds outside first page');
reset role;
select is((select count(*)::int from private.student_arrivals),1,'One canonical arrival');
select is((select count(*)::int from private.staff_shifts),1,'One canonical shift');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.daily_command('salary.end',jsonb_build_object('id',current_setting('test.agreement'),'effective_to','2026-10-01','reason','New agreement from October'),gen_random_uuid())$$,'End agreement prospectively without changing September obligation');
select lives_ok($$select public.daily_command('cost.reverse',jsonb_build_object('id',current_setting('test.expense'),'revision',3,'payout_id',(public.daily_read('expenses',null,'2026-09-01','2026-09-30',0,'',current_setting('test.expense')::uuid)->'payouts'->0->>'id'),'reference','DAILY-EXP-REV','reason','Incorrect payment entry'),gen_random_uuid())$$,'Reverse recorded payout through compensating entry');
select is(public.daily_read('expenses',null,'2026-09-01','2026-09-30',0,'Pool equipment')->'summary'->>'outstanding_minor','10000','Reversal restores expense liability');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.partial',public.daily_command('salary.agreement','{"employee_id":"91000000-0000-4000-8000-000000000008","effective_from":"2026-09-15","effective_to":"2026-12-01","amount_minor":100000,"allocations":[{"branch_id":null,"amount_minor":100000}]}',gen_random_uuid())->>'id',true);
select lives_ok($$select public.daily_command('salary.draft',jsonb_build_object('agreement_id',current_setting('test.partial'),'period_start','2026-09-01','reviewed_amount_minor',50000,'reason','Explicit first month amount reviewed','allocations',jsonb_build_array(jsonb_build_object('branch_id',null,'amount_minor',50000))),gen_random_uuid())$$,'Partial month uses an explicit reviewed amount, not automatic proration');
select lives_ok($$select public.daily_command('session.correct_start','{"session_id":"97000000-0000-4000-8000-000000000001","revision":0,"reason":"Reviewed delivery assignment"}',gen_random_uuid())$$,'Authorized staff can review delivery start');
reset role;
update public.class_sessions set status='completed',finalized_at=now() where id='97000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.daily_command('session.start','{"session_id":"97000000-0000-4000-8000-000000000002"}',gen_random_uuid())$$,'Finalized attendance does not prevent separate coaching delivery');
reset role;
update private.staff_shifts set clocked_in_at=now()-interval '2 days';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.daily_command('shift.out',jsonb_build_object('id',public.daily_read('shifts')->'open_shift'->>'id'),gen_random_uuid())$$,'P0409',null,'Old open shift requires reviewed correction');
reset role;
select * from finish();rollback;
