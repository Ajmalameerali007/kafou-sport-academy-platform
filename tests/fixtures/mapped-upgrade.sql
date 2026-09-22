-- Disposable mapped-schema upgrade fixture; no Auth session or provider calls.
begin;
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('71000000-0000-4000-8000-000000000001','commercial-owner@example.test','{"name":"Commercial owner"}',now()),
('71000000-0000-4000-8000-000000000002','commercial-parent@example.test','{"name":"Commercial parent"}',now()),
('71000000-0000-4000-8000-000000000003','commercial-coach@example.test','{"name":"Commercial coach"}',now()),
('71000000-0000-4000-8000-000000000004','commercial-admin@example.test','{"name":"Commercial admin"}',now()),
('71000000-0000-4000-8000-000000000005','commercial-other@example.test','{"name":"Other parent"}',now()),
('71000000-0000-4000-8000-000000000006','commercial-sales@example.test','{"name":"Commercial sales"}',now());
delete from public.role_assignments where user_id in ('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000006');
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
insert into public.children(id,family_id,name,dob) values('74000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000001','Overscheduled child','2018-01-01');
insert into public.child_sports(child_id,sport) values('74000000-0000-4000-8000-000000000002','swimming');
insert into public.enrollments(id,child_id,class_id) values('76000000-0000-4000-8000-000000000008','74000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000004');
insert into public.class_sessions(class_id,starts_at,ends_at,capacity) select '76000000-0000-4000-8000-000000000004',now()+make_interval(days=>n),now()+make_interval(days=>n,hours=>1),10 from generate_series(4,12) n;
insert into public.session_roster(session_id,enrollment_id,kind) select id,'76000000-0000-4000-8000-000000000008','enrollment' from public.class_sessions where class_id='76000000-0000-4000-8000-000000000004' and id<>'76000000-0000-4000-8000-000000000005';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.commercial_package',(public.product_command('commercial.package.create','{"branch_id":"72000000-0000-4000-8000-000000000001","sport":"swimming","name":"Synthetic eight sessions","name_ar":"ثماني حصص","price_minor":25010,"session_allowance":8,"terms":"Synthetic monthly package","terms_ar":"باقة شهرية تجريبية"}','75000000-0000-4000-8000-000000000001')->>'id'),true);
select set_config('test.commercial_member',(public.product_command('commercial.membership.start',jsonb_build_object('package_id',current_setting('test.commercial_package'),'child_id','74000000-0000-4000-8000-000000000001','starts_on',(now() at time zone 'Asia/Dubai')::date,'accepted',true),'75000000-0000-4000-8000-000000000002')->>'id'),true);
select set_config('test.commercial_invoice',(select id::text from public.commercial_invoices where membership_id=current_setting('test.commercial_member')::uuid),true);
select public.product_command('commercial.payment.record',jsonb_build_object('family_id','73000000-0000-4000-8000-000000000001','branch_id','72000000-0000-4000-8000-000000000001','amount_minor',25010,'method','cash','reference','UPGRADE-SYNTHETIC-OFFLINE','invoice_id',current_setting('test.commercial_invoice')),'75000000-0000-4000-8000-000000000004');
reset role;
update public.profiles set synthetic=true;
update public.branches set synthetic=true;
commit;
