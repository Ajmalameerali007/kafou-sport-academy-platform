begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('71000000-0000-4000-8000-000000000001','commercial-owner@example.test','{"name":"Commercial owner"}',now()),
('71000000-0000-4000-8000-000000000002','commercial-parent@example.test','{"name":"Commercial parent"}',now()),
('71000000-0000-4000-8000-000000000003','commercial-coach@example.test','{"name":"Commercial coach"}',now()),
('71000000-0000-4000-8000-000000000004','commercial-admin@example.test','{"name":"Commercial admin"}',now()),
('71000000-0000-4000-8000-000000000005','commercial-other@example.test','{"name":"Other parent"}',now()),
('71000000-0000-4000-8000-000000000006','commercial-sales@example.test','{"name":"Commercial sales"}',now());
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

update public.class_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour',delivered_at=now(),delivered_by='71000000-0000-4000-8000-000000000003' where id='76000000-0000-4000-8000-000000000005';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.product_command('commercial.compensation.rate',jsonb_build_object('branch_id','72000000-0000-4000-8000-000000000001','coach_id','71000000-0000-4000-8000-000000000003','amount_minor',12005,'effective_from',(now() at time zone 'Asia/Dubai')::date-1,'effective_to',(now() at time zone 'Asia/Dubai')::date+1),gen_random_uuid());
select set_config('test.accrual',(public.product_command('commercial.compensation.accrue','{"session_id":"76000000-0000-4000-8000-000000000005"}',gen_random_uuid())->>'id'),true);
select throws_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','SYNTHETIC-PAY-1','reason','Synthetic offline settlement'),gen_random_uuid())$$,'P0409',null,'Unapproved compensation cannot be recorded paid');
select public.product_command('commercial.compensation.review',jsonb_build_object('id',current_setting('test.accrual'),'decision','approved','reason','Synthetic review completed'),gen_random_uuid());
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','SYNTHETIC-PAY-1','reason','Synthetic offline settlement'),gen_random_uuid())$$,'42501',null,'Head Office requires separate financial authority');
reset role;
insert into public.product_permissions(user_id,permission,branch_id,granted_by) values('71000000-0000-4000-8000-000000000004','finance.compensation','72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','SYNTHETIC-PAY-1','reason','Synthetic offline settlement'),gen_random_uuid())$$,'42501',null,'Review permission is not payment permission');
reset role;
insert into public.product_permissions(user_id,permission,branch_id,granted_by) values('71000000-0000-4000-8000-000000000004','finance.compensation_payment','72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','SYNTHETIC-PAY-1','reason','Synthetic offline settlement'),'75000000-0000-4000-8000-000000000041')$$,'Authorized offline settlement persists');
select lives_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','SYNTHETIC-PAY-1','reason','Synthetic offline settlement'),'75000000-0000-4000-8000-000000000041')$$,'Same-key settlement retry returns original');
select is((select sum(amount_minor)::bigint from public.commercial_compensation_settlements where accrual_id=current_setting('test.accrual')::uuid),12005::bigint,'Exact compensation amount recorded once');
select throws_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','SYNTHETIC-PAY-2','reason','Another offline settlement'),gen_random_uuid())$$,'P0409',null,'Different request cannot pay twice');
select set_config('test.settlement',(select id::text from public.commercial_compensation_settlements where accrual_id=current_setting('test.accrual')::uuid and amount_minor>0),true);
select lives_ok($$select public.product_command('commercial.compensation.reverse',jsonb_build_object('id',current_setting('test.settlement'),'reference','SYNTHETIC-CORRECTION-1','reason','Synthetic correction preserves history'),gen_random_uuid())$$,'Correction appends compensating entry');
select is((select sum(amount_minor)::bigint from public.commercial_compensation_settlements where accrual_id=current_setting('test.accrual')::uuid),0::bigint,'Correction restores approved unpaid balance');
select is((select count(*)::int from public.commercial_compensation_settlements where accrual_id=current_setting('test.accrual')::uuid),2,'Original remains with reversal');
select throws_ok($$select public.product_command('commercial.compensation.reverse',jsonb_build_object('id',current_setting('test.settlement'),'reference','SYNTHETIC-CORRECTION-2','reason','No duplicate correction'),gen_random_uuid())$$,'P0409',null,'Duplicate correction denied');
select throws_ok($$update public.commercial_compensation_settlements set amount_minor=1$$,'42501',null,'Direct edits denied');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.commercial_compensation_settlements),0,'Coach cannot see finance ledger');
select throws_ok($$select public.product_command('commercial.compensation.settle',jsonb_build_object('id',current_setting('test.accrual'),'reference','COACH-FAKE','reason','Unauthorized fake payment'),gen_random_uuid())$$,'42501',null,'Coach cannot claim compensation paid');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.commercial_compensation_settlements),0,'Sales cannot see finance ledger');
reset role;
select throws_ok($$delete from public.commercial_compensation_settlements$$,'42501',null,'Maintenance cannot silently delete posted history');
select is((select count(*)::int from public.audit_events where entity='commercial_compensation_settlements' and entity_id::text in (select id::text from public.commercial_compensation_settlements where accrual_id=current_setting('test.accrual')::uuid)),2,'Both ledger actions have attributable audit events');
select ok(not has_function_privilege('authenticated','private.commercial_command(text,jsonb)','execute'),'Dispatcher remains private');
select * from finish();
rollback;
