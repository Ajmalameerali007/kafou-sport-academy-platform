begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('71000000-0000-4000-8000-000000000001','commercial-owner@example.test','{"name":"Commercial owner"}',now()),
('71000000-0000-4000-8000-000000000002','commercial-parent@example.test','{"name":"Commercial parent"}',now()),
('71000000-0000-4000-8000-000000000003','commercial-coach@example.test','{"name":"Commercial coach"}',now()),
('71000000-0000-4000-8000-000000000004','commercial-admin@example.test','{"name":"Commercial admin"}',now()),
('71000000-0000-4000-8000-000000000005','commercial-other@example.test','{"name":"Other parent"}',now()),
('71000000-0000-4000-8000-000000000006','commercial-sales@example.test','{"name":"Commercial sales"}',now());
delete from public.role_assignments where user_id::text like '71000000-%' and user_id<>'71000000-0000-4000-8000-000000000002';
insert into public.role_assignments values ('71000000-0000-4000-8000-000000000001','super_admin'),('71000000-0000-4000-8000-000000000003','coach'),('71000000-0000-4000-8000-000000000004','admin'),('71000000-0000-4000-8000-000000000006','sales');
insert into public.branches(id,slug,name,provisional) values('72000000-0000-4000-8000-000000000001','commercial-test','Commercial test',false);
insert into public.branch_sports values('72000000-0000-4000-8000-000000000001','swimming');
insert into public.families(id,name) values('73000000-0000-4000-8000-000000000001','Commercial family');
insert into public.guardians values('73000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002');
insert into public.children(id,family_id,name,dob) values('74000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','Commercial child','2018-01-01');
insert into public.child_sports(child_id,sport) values('74000000-0000-4000-8000-000000000001','swimming');
insert into public.branch_permissions values('71000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001');
insert into public.venues(id,branch_id,name,address) values('76000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','Commercial pool','Synthetic');
insert into public.sport_levels(id,sport,name,rank) values('76000000-0000-4000-8000-000000000002','swimming','Commercial level',99);
insert into public.age_groups(id,name,min_age,max_age) values('76000000-0000-4000-8000-000000000003','Commercial ages',1,17);
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) values('76000000-0000-4000-8000-000000000004','72000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003','swimming','76000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000003','Commercial swim',10,array[0],'16:00',60);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values('76000000-0000-4000-8000-000000000005','76000000-0000-4000-8000-000000000004',now()+interval '2 days',now()+interval '2 days 1 hour',10);
insert into public.enrollments(id,child_id,class_id) values('76000000-0000-4000-8000-000000000006','74000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000004');
insert into public.session_roster(id,session_id,enrollment_id,kind) values('76000000-0000-4000-8000-000000000007','76000000-0000-4000-8000-000000000005','76000000-0000-4000-8000-000000000006','enrollment');
insert into public.family_branches values('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001');
insert into public.branches(id,slug,name,provisional) values('72000000-0000-4000-8000-000000000002','central-test-b','Second branch',false);
insert into public.branch_sports values('72000000-0000-4000-8000-000000000002','swimming');
insert into public.role_assignments values('71000000-0000-4000-8000-000000000005','branch');
insert into public.branch_permissions values('71000000-0000-4000-8000-000000000005','72000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.catalogue',(public.product_command('commercial.catalogue.save',jsonb_build_object('name','Central swimming','sport','swimming','price_minor',12000,'duration_months',2,'session_allowance',8,'min_age',6,'max_age',12,'terms','Synthetic agreed package terms','offers',jsonb_build_array(jsonb_build_object('branch_id','72000000-0000-4000-8000-000000000001','enabled',true),jsonb_build_object('branch_id','72000000-0000-4000-8000-000000000002','enabled',false))),gen_random_uuid())->>'id'),true);
select is((select count(*)::int from public.commercial_packages where catalogue_id=current_setting('test.catalogue')::uuid),2,'One central catalogue owns two branch offers');
select set_config('test.offer',(select id::text from public.commercial_packages where catalogue_id=current_setting('test.catalogue')::uuid and active),true);
select set_config('test.member',(public.product_command('commercial.membership.start',jsonb_build_object('child_id','74000000-0000-4000-8000-000000000001','package_id',current_setting('test.offer'),'starts_on',current_date,'accepted',true),gen_random_uuid())->>'id'),true);
select is((select expires_on from public.commercial_memberships where id=current_setting('test.member')::uuid),(current_date+interval '2 months')::date,'Configured duration becomes the purchased contract');
select set_config('test.invoice',(select id::text from public.commercial_invoices where membership_id=current_setting('test.member')::uuid),true);
select lives_ok($$select public.product_command('commercial.payment.record',jsonb_build_object('family_id','73000000-0000-4000-8000-000000000001','branch_id','72000000-0000-4000-8000-000000000001','invoice_id',current_setting('test.invoice'),'amount_minor',12000,'method','cash','reference','CENTRAL-CASH-1'),gen_random_uuid())$$,'Invoice-led payment is atomic');
select is((public.management_invoice(current_setting('test.invoice')::uuid)->>'balance')::int,0,'Full invoice detail reflects received payment');
select is((select status from public.commercial_memberships where id=current_setting('test.member')::uuid),'active','Payment activates membership');
select lives_ok($$select public.product_command('commercial.package.status',jsonb_build_object('id',current_setting('test.offer'),'active',false),gen_random_uuid())$$,'Owner disables offer');
select is((select status from public.commercial_memberships where id=current_setting('test.member')::uuid),'active','Disable preserves purchased membership');
select throws_ok($$select public.product_command('commercial.membership.renew',jsonb_build_object('id',current_setting('test.member'),'accepted',true),gen_random_uuid())$$,'P0409',null,'Old disabled offer cannot renew');
select is(jsonb_array_length(public.branch_records('families','72000000-0000-4000-8000-000000000002',0)),0,'Other branch has no unrelated families');
select is((public.management_finance(current_date,current_date,'72000000-0000-4000-8000-000000000001')->'branches'->0->'finance'->>'receivedMinor')::int,12000,'Branch A has complete collections');
select is((public.management_finance(current_date,current_date,'72000000-0000-4000-8000-000000000002')->'branches'->0->'finance'->>'receivedMinor')::int,0,'Branch B does not count Branch A payment');
select set_config('test.rate',(public.product_command('commercial.agreement.create',jsonb_build_object('coach_id','71000000-0000-4000-8000-000000000003','branch_id','72000000-0000-4000-8000-000000000001','basis','session','amount_minor',5000,'effective_from',current_date-5,'effective_to',current_date+5,'cancellation_rule','unpaid','substitute_rule','actual_coach'),gen_random_uuid())->>'id'),true);
select throws_ok($$select public.product_command('commercial.compensation.accrue',jsonb_build_object('session_id','76000000-0000-4000-8000-000000000005'),gen_random_uuid())$$,'P0409',null,'Scheduled work is not payable');
reset role;
update public.class_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',finalized_at=now() where id='76000000-0000-4000-8000-000000000005';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.daily_command('session.start',jsonb_build_object('session_id','76000000-0000-4000-8000-000000000005','reason','Authorized branch cover for test'),gen_random_uuid())$$,'Owner records authorized session start');
select lives_ok($$select public.product_command('academy.session.complete',jsonb_build_object('session_id','76000000-0000-4000-8000-000000000005'),gen_random_uuid())$$,'Branch/owner completion resolves actual coach and creates pending earnings');
select set_config('test.accrual',(select id::text from public.commercial_compensation_accruals where rate_id=current_setting('test.rate')::uuid),true);
select is((select amount_minor from public.commercial_compensation_accruals where id=current_setting('test.accrual')::uuid),5000,'One eligible session accrues exact agreed amount');
select is((select coach_id::text from public.commercial_compensation_accruals where id=current_setting('test.accrual')::uuid),'71000000-0000-4000-8000-000000000003','Earnings belong to coach, not admin finalizing');
select lives_ok($$select public.product_command('commercial.compensation.review',jsonb_build_object('id',current_setting('test.accrual'),'decision','approved','reason','Completed coaching reviewed'),gen_random_uuid())$$,'Authorized approval preserves rate snapshot');
select lives_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','CENTRAL-COACH-1','reason','Offline transfer already completed'),gen_random_uuid())$$,'Offline payout recorded without provider');
select is((public.management_finance(current_date,current_date,'72000000-0000-4000-8000-000000000001')->'branches'->0->>'earnedMinor')::int,5000,'Payout does not duplicate earned cost');
select is((public.management_finance(current_date,current_date,'72000000-0000-4000-8000-000000000001')->'branches'->0->>'coachOutstandingMinor')::int,0,'Payout clears outstanding earnings');
select throws_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','CENTRAL-COACH-2','reason','No duplicate settlement allowed'),gen_random_uuid())$$,'P0409',null,'Duplicate payout prevented');


select is((public.management_earnings('71000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001',0)->'rows'->0->>'paid_minor')::int,5000,'Coach ledger row has complete paid balance');
-- Hourly agreements accrue the completed session duration, not one flat rate.
select set_config('test.hour_rate',(public.product_command('commercial.agreement.create',jsonb_build_object('coach_id','71000000-0000-4000-8000-000000000003','branch_id','72000000-0000-4000-8000-000000000001','basis','hour','amount_minor',4000,'effective_from',date_trunc('month',current_date)-interval '4 months','effective_to',date_trunc('month',current_date)-interval '3 months','cancellation_rule','unpaid','substitute_rule','actual_coach'),gen_random_uuid())->>'id'),true);
reset role;
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity,finalized_at) values('76000000-0000-4000-8000-000000000015','76000000-0000-4000-8000-000000000004',date_trunc('month',current_date)-interval '4 months'+interval '1 day 10 hours',date_trunc('month',current_date)-interval '4 months'+interval '1 day 11 hours 30 minutes',10,now());
set local role authenticated;
select lives_ok($$select public.daily_command('session.start',jsonb_build_object('session_id','76000000-0000-4000-8000-000000000015','reason','Authorized branch cover for test'),gen_random_uuid())$$,'Owner records authorized session start');
select lives_ok($$select public.product_command('academy.session.complete',jsonb_build_object('session_id','76000000-0000-4000-8000-000000000015'),gen_random_uuid())$$,'Completed hourly session creates earnings');
select is((select amount_minor from public.commercial_compensation_accruals where rate_id=current_setting('test.hour_rate')::uuid),6000,'Ninety-minute delivery earns one and a half hourly units');
select is((select units from public.commercial_compensation_accruals where rate_id=current_setting('test.hour_rate')::uuid),1.5::numeric,'Duration calculation is retained in earning history');
-- Revision preserves the sold contract and its paid invoice.
select lives_ok($$select public.product_command('commercial.catalogue.save',jsonb_build_object('id',current_setting('test.catalogue'),'name','Central swimming revised','sport','swimming','price_minor',18000,'duration_months',3,'session_allowance',12,'min_age',6,'max_age',12,'terms','New synthetic terms','offers',jsonb_build_array(jsonb_build_object('branch_id','72000000-0000-4000-8000-000000000001','enabled',true))),gen_random_uuid())$$,'Central price change creates a new offer');
select is((select price_minor from public.commercial_packages where id=current_setting('test.offer')::uuid),12000,'Sold price remains immutable after a new offer');
select is((select package_id::text from public.commercial_memberships where id=current_setting('test.member')::uuid),current_setting('test.offer'),'Existing membership retains original benefits');
select throws_ok($$select public.product_command('commercial.package.status',jsonb_build_object('id',current_setting('test.offer'),'active',true),gen_random_uuid())$$,'P0409',null,'Superseded offer cannot be reenabled via old link');
-- Monthly agreements use completed calendar periods and the existing approval ledger.
select set_config('test.month_rate',(public.product_command('commercial.agreement.create',jsonb_build_object('coach_id','71000000-0000-4000-8000-000000000003','branch_id','72000000-0000-4000-8000-000000000001','basis','month','amount_minor',30000,'effective_from',date_trunc('month',current_date)-interval '2 months','effective_to',date_trunc('month',current_date),'cancellation_rule','unpaid','substitute_rule','actual_coach'),gen_random_uuid())->>'id'),true);
select set_config('test.month',(public.product_command('commercial.compensation.month',jsonb_build_object('id',current_setting('test.month_rate'),'period_start',date_trunc('month',current_date)-interval '1 month'),gen_random_uuid())->>'id'),true);
select is((public.product_command('commercial.compensation.month',jsonb_build_object('id',current_setting('test.month_rate'),'period_start',date_trunc('month',current_date)-interval '1 month'),gen_random_uuid())->>'id'),current_setting('test.month'),'Repeated monthly calculation returns one earning');
select is((select amount_minor from public.commercial_compensation_accruals where id=current_setting('test.month')::uuid),30000,'Monthly amount uses configured fixed rate');
select lives_ok($$select public.product_command('commercial.compensation.review',jsonb_build_object('id',current_setting('test.month'),'decision','approved','reason','Full previous month reviewed'),gen_random_uuid())$$,'Monthly work uses authorized approval');
select lives_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.month'),'reference','CENTRAL-MONTHLY','reason','Synthetic offline monthly settlement'),gen_random_uuid())$$,'Monthly payout settles approved liability');
select throws_ok($$select public.product_command('commercial.compensation.month',jsonb_build_object('id',current_setting('test.month_rate'),'period_start',date_trunc('month',current_date)),gen_random_uuid())$$,'P0409',null,'Current incomplete month cannot accrue');
-- Exercise every permitted scoped reader including views and composite-key tables.
create function pg_temp.all_branch_readers() returns void language plpgsql as $$declare r record;begin for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v') and has_table_privilege('authenticated',c.oid,'select') loop perform public.branch_records(r.relname,'72000000-0000-4000-8000-000000000001');end loop;end$$;
select lives_ok($$select pg_temp.all_branch_readers()$$,'All scoped table and view readers resolve their relationships');
select lives_ok($$select public.product_command('commercial.coach.save','{"id":"71000000-0000-4000-8000-000000000003","name":"Archived coach","mobile":"","active":false}',gen_random_uuid())$$,'Coach can be deactivated');
select is((select count(*)::int from public.commercial_compensation_accruals where id=current_setting('test.accrual')::uuid),1,'Deactivation preserves earnings');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.management_earnings(null,'72000000-0000-4000-8000-000000000001',0)$$,'42501',null,'Branch B cannot read branch A earnings');
select throws_ok($$select public.branch_records('commercial_payments','72000000-0000-4000-8000-000000000001',0)$$,'42501',null,'Branch B cannot read A through branch API');
select throws_ok($$select public.management_invoice(current_setting('test.invoice')::uuid)$$,'42501',null,'Branch B cannot open A invoice');
select throws_ok($$select public.product_command('commercial.package.status',jsonb_build_object('id',current_setting('test.offer'),'active',true),gen_random_uuid())$$,'42501',null,'Branch role cannot configure packages');
select * from finish();rollback;
