begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('a1000000-0000-4000-8000-000000000001','coach-profile-coach@example.test','{"name":"Profile coach"}',now()),
('a1000000-0000-4000-8000-000000000002','coach-profile-other-coach@example.test','{"name":"Other coach"}',now()),
('a1000000-0000-4000-8000-000000000003','coach-profile-owner@example.test','{"name":"Owner"}',now()),
('a1000000-0000-4000-8000-000000000004','coach-profile-branch@example.test','{"name":"Branch manager"}',now()),
('a1000000-0000-4000-8000-000000000005','coach-profile-other-branch@example.test','{"name":"Other branch manager"}',now());
delete from public.role_assignments where user_id in ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000005');
insert into public.role_assignments values
('a1000000-0000-4000-8000-000000000001','coach'),
('a1000000-0000-4000-8000-000000000002','coach'),
('a1000000-0000-4000-8000-000000000003','super_admin'),
('a1000000-0000-4000-8000-000000000004','branch'),
('a1000000-0000-4000-8000-000000000005','branch');
insert into public.branches(id,slug,name,provisional) values
('a2000000-0000-4000-8000-000000000001','coach-profile-branch-a','Coach profile branch A',false),
('a2000000-0000-4000-8000-000000000002','coach-profile-branch-b','Coach profile branch B',false);
insert into public.branch_permissions values
('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001'),
('a1000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000002');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.product_command('coach.profile.update','{"bio":"Certified swim instructor.","qualifications":["ASA Level 2","First aid"]}',gen_random_uuid())$$,'Coach can update their own profile');
select is((select bio from public.profiles where id='a1000000-0000-4000-8000-000000000001'),'Certified swim instructor.','Bio is saved');
select is((select qualifications from public.profiles where id='a1000000-0000-4000-8000-000000000001'),array['ASA Level 2','First aid'],'Qualifications are saved as a clean array');

select throws_ok($$select public.product_command('coach.profile.update','{"coach_id":"a1000000-0000-4000-8000-000000000002","bio":"Hijacked","qualifications":[]}',gen_random_uuid())$$,'42501',null,'Coach cannot update another coach profile');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.product_command('coach.profile.update','{"coach_id":"a1000000-0000-4000-8000-000000000002","bio":"Reviewed by head office.","qualifications":[]}',gen_random_uuid())$$,'Head office can correct any coach profile');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.product_command('coach.availability.save','{"branch_id":"a2000000-0000-4000-8000-000000000001","weekday":1,"start_time":"16:00","end_time":"18:00"}',gen_random_uuid())$$,'Coach can save an availability window');
select is((select count(*) from public.coach_availability where coach_id='a1000000-0000-4000-8000-000000000001')::int,1,'Exactly one window is stored');
select lives_ok($$select public.product_command('coach.availability.save','{"branch_id":"a2000000-0000-4000-8000-000000000001","weekday":1,"start_time":"16:00","end_time":"19:00"}',gen_random_uuid())$$,'Re-saving the same slot updates rather than duplicates');
select is((select end_time::text from public.coach_availability where coach_id='a1000000-0000-4000-8000-000000000001' and weekday=1),'19:00:00','Updated end time is stored');
select throws_ok($$select public.product_command('coach.availability.save','{"weekday":9,"start_time":"16:00","end_time":"18:00"}',gen_random_uuid())$$,'22023',null,'Invalid weekday is rejected');
select throws_ok($$select public.product_command('coach.availability.save','{"weekday":2,"start_time":"18:00","end_time":"16:00"}',gen_random_uuid())$$,'22023',null,'End time before start time is rejected');
select throws_ok($$select public.product_command('coach.availability.save','{"branch_id":"a2000000-0000-4000-8000-000000000002","weekday":2,"start_time":"16:00","end_time":"18:00"}',gen_random_uuid())$$,'42501',null,'Coach cannot claim availability at a branch they are not assigned to');

select set_config('test.window.id',(select id::text from public.coach_availability where coach_id='a1000000-0000-4000-8000-000000000001' and weekday=1),true);
select throws_ok($$select public.product_command('coach.availability.remove',jsonb_build_object('coach_id','a1000000-0000-4000-8000-000000000002','id',current_setting('test.window.id')),gen_random_uuid())$$,'42501',null,'Coach cannot remove another coach''s availability');
select lives_ok($$select public.product_command('coach.availability.remove',jsonb_build_object('id',current_setting('test.window.id')),gen_random_uuid())$$,'Coach can remove their own availability window');
select is((select count(*) from public.coach_availability where coach_id='a1000000-0000-4000-8000-000000000001')::int,0,'Window is gone');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.product_command('coach.availability.save','{"branch_id":"a2000000-0000-4000-8000-000000000001","weekday":3,"start_time":"09:00","end_time":"11:00"}',gen_random_uuid())$$,'Other coach records their own availability for the branch visibility checks');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.coach_availability where coach_id='a1000000-0000-4000-8000-000000000002')::int,1,'Branch manager on the same branch can read staged coach availability metadata');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.coach_availability where coach_id='a1000000-0000-4000-8000-000000000002')::int,0,'Manager at another branch cannot read a different branch''s coach availability');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select ok((select bool_or((row->>'bio') ilike '%Reviewed by head office%') from jsonb_array_elements(public.coach_directory()) row where row->>'id'='a1000000-0000-4000-8000-000000000002'),'Coach directory surfaces bio for head office');
reset role;
select * from finish();
rollback;
