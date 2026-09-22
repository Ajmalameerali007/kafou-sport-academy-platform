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
insert into public.families(id,name) values('31000000-0000-0000-0000-000000000001','Age family');
insert into public.guardians values('31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001');
insert into public.children(id,family_id,name,reported_age,age_captured_on) values('41000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','Older Child',15,current_date);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select public.submit_enquiry('{"parentName":"Parent","mobile":"+971500000001","childName":"Older Child","childId":"41000000-0000-0000-0000-000000000001","age":"6","sport":"swimming","experience":"beginner","preferredBranch":"journey-test"}','51000000-0000-0000-0000-000000000006');
select is(jsonb_array_length(public.trial_availability((select id from public.trial_enquiries))),0,'Linked child recorded age takes priority over enquiry age');
select throws_ok($q$select public.operations_command('trial.book',jsonb_build_object('enquiry_id',(select id from public.trial_enquiries),'session_id','26000000-0000-0000-0000-000000000001'))$q$,'42501',null,'Parent cannot lower linked child age through enquiry');
reset role;
update public.children set reported_age=6 where id='41000000-0000-0000-0000-000000000001';
insert into public.child_sports(child_id,sport,level,status) values('41000000-0000-0000-0000-000000000001','swimming','Reviewed advanced level','reviewed');
set local role authenticated;
select is(jsonb_array_length(public.trial_availability((select id from public.trial_enquiries))),0,'Unmapped reviewed level does not silently fall back to beginner');
select * from finish(); rollback;
