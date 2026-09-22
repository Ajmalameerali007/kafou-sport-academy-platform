begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('a4000000-0000-4000-8000-000000000001','sibling-alloc-admin@example.test','{"name":"Finance staff"}',now());
delete from public.role_assignments where user_id='a4000000-0000-4000-8000-000000000001';
insert into public.role_assignments values('a4000000-0000-4000-8000-000000000001','admin');
insert into public.branches(id,slug,name,provisional) values('a4100000-0000-4000-8000-000000000001','sibling-alloc-branch','Sibling allocation branch',false);
insert into public.branch_sports values('a4100000-0000-4000-8000-000000000001','swimming');
insert into public.product_permissions(user_id,branch_id,permission) values
('a4000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','finance.payment'),
('a4000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','finance.invoices'),
('a4000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','finance.view');
insert into public.families(id,name) values
('a4200000-0000-4000-8000-000000000001','Sibling family'),
('a4200000-0000-4000-8000-000000000002','Other family');
insert into public.children(id,family_id,name,reported_age) values
('a4300000-0000-4000-8000-000000000001','a4200000-0000-4000-8000-000000000001','Sibling one',6),
('a4300000-0000-4000-8000-000000000002','a4200000-0000-4000-8000-000000000001','Sibling two',8),
('a4300000-0000-4000-8000-000000000003','a4200000-0000-4000-8000-000000000002','Other child',7);
insert into public.child_sports(child_id,sport) values
('a4300000-0000-4000-8000-000000000001','swimming'),
('a4300000-0000-4000-8000-000000000002','swimming'),
('a4300000-0000-4000-8000-000000000003','swimming');
insert into public.commercial_packages(id,branch_id,sport,name,price_minor,session_allowance,terms,created_by) values
('a4400000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001','swimming','Sibling package',10000,4,'Explicit synthetic price only','a4000000-0000-4000-8000-000000000001');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.product_command('commercial.invoice.create','{"family_id":"a4200000-0000-4000-8000-000000000001","branch_id":"a4100000-0000-4000-8000-000000000001","reference":"SIB-INV-1","lines":[{"child_id":"a4300000-0000-4000-8000-000000000001","package_id":"a4400000-0000-4000-8000-000000000001","quantity":1}]}','a4900000-0000-4000-8000-000000000001')$$,'First sibling invoice is created');
select lives_ok($$select public.product_command('commercial.invoice.create','{"family_id":"a4200000-0000-4000-8000-000000000001","branch_id":"a4100000-0000-4000-8000-000000000001","reference":"SIB-INV-2","lines":[{"child_id":"a4300000-0000-4000-8000-000000000002","package_id":"a4400000-0000-4000-8000-000000000001","quantity":1}]}','a4900000-0000-4000-8000-000000000002')$$,'Second sibling invoice is created');
select lives_ok($$select public.product_command('commercial.invoice.create','{"family_id":"a4200000-0000-4000-8000-000000000002","branch_id":"a4100000-0000-4000-8000-000000000001","reference":"OTHER-INV-1","lines":[{"child_id":"a4300000-0000-4000-8000-000000000003","package_id":"a4400000-0000-4000-8000-000000000001","quantity":1}]}','a4900000-0000-4000-8000-000000000003')$$,'Unrelated family invoice is created');

select set_config('test.inv1',(select id::text from public.commercial_invoices where author_reference='SIB-INV-1'),true);
select set_config('test.inv2',(select id::text from public.commercial_invoices where author_reference='SIB-INV-2'),true);
select set_config('test.inv_other',(select id::text from public.commercial_invoices where author_reference='OTHER-INV-1'),true);

select lives_ok($$select public.product_command('commercial.payment.record','{"family_id":"a4200000-0000-4000-8000-000000000001","branch_id":"a4100000-0000-4000-8000-000000000001","amount_minor":20000,"method":"cash","reference":"SIB-PAY-1"}','a4900000-0000-4000-8000-000000000004')$$,'A single family payment covering both invoices is recorded');
select set_config('test.pay',(select id::text from public.commercial_payments where reference='SIB-PAY-1'),true);

select throws_ok($$select public.product_command('commercial.payment.allocate-split',jsonb_build_object('payment_id',current_setting('test.pay')::uuid,'allocations',jsonb_build_array(jsonb_build_object('invoice_id',current_setting('test.inv1')::uuid,'amount_minor',10000))),gen_random_uuid())$$,'22023',null,'A single allocation cannot use the split action');
select throws_ok($$select public.product_command('commercial.payment.allocate-split',jsonb_build_object('payment_id',current_setting('test.pay')::uuid,'allocations',jsonb_build_array(jsonb_build_object('invoice_id',current_setting('test.inv1')::uuid,'amount_minor',10000),jsonb_build_object('invoice_id',current_setting('test.inv_other')::uuid,'amount_minor',10000))),gen_random_uuid())$$,'22023',null,'An invoice outside the payment family is rejected');
select lives_ok($$select public.product_command('commercial.payment.allocate-split',jsonb_build_object('payment_id',current_setting('test.pay')::uuid,'allocations',jsonb_build_array(jsonb_build_object('invoice_id',current_setting('test.inv1')::uuid,'amount_minor',10000),jsonb_build_object('invoice_id',current_setting('test.inv2')::uuid,'amount_minor',10000))),gen_random_uuid())$$,'One payment is split across two sibling invoices atomically');
select is((select count(*)::int from public.commercial_allocations where payment_id=current_setting('test.pay')::uuid),2,'Two allocation rows were created');
select is((select sum(amount_minor)::bigint from public.commercial_allocations where payment_id=current_setting('test.pay')::uuid),20000::bigint,'The full payment amount is allocated across both invoices');
select throws_ok($$select public.product_command('commercial.payment.allocate-split',jsonb_build_object('payment_id',current_setting('test.pay')::uuid,'allocations',jsonb_build_array(jsonb_build_object('invoice_id',current_setting('test.inv1')::uuid,'amount_minor',5000),jsonb_build_object('invoice_id',current_setting('test.inv2')::uuid,'amount_minor',5000))),gen_random_uuid())$$,'P0409',null,'A payment cannot be split beyond its unallocated balance');

select * from finish();
rollback;
