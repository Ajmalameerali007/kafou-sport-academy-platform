begin;
select no_plan();
-- Isolated synthetic records; the enclosing transaction rolls every write back.
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('d1000000-0000-4000-8000-000000000001','development-parent@example.test','{"name":"Parent"}',now()),
('d1000000-0000-4000-8000-000000000002','development-coach@example.test','{"name":"Coach"}',now()),
('d1000000-0000-4000-8000-000000000003','development-reviewer@example.test','{"name":"Reviewer"}',now()),
('d1000000-0000-4000-8000-000000000004','development-other@example.test','{"name":"Other"}',now());
insert into public.role_assignments values ('d1000000-0000-4000-8000-000000000002','coach'),('d1000000-0000-4000-8000-000000000003','super_admin');
insert into public.branches(id,slug,name,provisional) values('d2000000-0000-4000-8000-000000000001','development-test','Synthetic development',false);
insert into public.branch_permissions values('d1000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001');
insert into public.venues(id,branch_id,name,address) values('d2000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','Test pool','Synthetic');
insert into public.sport_levels(id,sport,name,rank) values('d2000000-0000-4000-8000-000000000003','swimming','Development beginner',10),('d2000000-0000-4000-8000-000000000004','swimming','Development next',11);
insert into public.age_groups(id,name,min_age,max_age) values('d2000000-0000-4000-8000-000000000005','Development ages',5,10);
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) values('d2000000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','swimming','d2000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000005','Development session',10,array[0],'17:00',60);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values('d2000000-0000-4000-8000-000000000007','d2000000-0000-4000-8000-000000000006',now()-interval '2 hours',now()-interval '1 hour',10);
insert into public.families(id,name) values('d3000000-0000-4000-8000-000000000001','Development family');
insert into public.guardians values('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,reported_age,age_captured_on) values('d3000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','Synthetic Athlete',7,current_date);
insert into public.child_sports(child_id,sport,level_id,level,status) values('d3000000-0000-4000-8000-000000000002','swimming','d2000000-0000-4000-8000-000000000003','Development beginner','reviewed');
insert into public.enrollments(id,child_id,class_id) values('d3000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000006');
insert into public.session_roster(session_id,enrollment_id,kind,attendance) values('d2000000-0000-4000-8000-000000000007','d3000000-0000-4000-8000-000000000003','enrollment','present');

insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity,status,finalized_at,finalized_by)
select ('d4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'d2000000-0000-4000-8000-000000000006',timestamptz '2026-09-19 06:00+04'+n*interval '2 minutes',timestamptz '2026-09-19 06:01+04'+n*interval '2 minutes',10,case when n=251 then 'cancelled' else 'completed' end,now(),'d1000000-0000-4000-8000-000000000002' from generate_series(1,251)n;
insert into public.session_roster(session_id,enrollment_id,kind,attendance)
select ('d4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'d3000000-0000-4000-8000-000000000003','enrollment',case when n<=125 then 'present' when n<=185 then 'absent' when n<=215 then 'excused' else null end from generate_series(1,251)n;
create function pg_temp.summary() returns jsonb language sql as $$select public.business_report('2026-09-19','2026-09-19','d2000000-0000-4000-8000-000000000001','swimming')$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is((pg_temp.summary()->'operations'->>'total')::int,251,'Full session total includes status breakdown beyond page boundary');
select is((pg_temp.summary()->'operations'->>'sessions')::int,250,'Cancelled occurrence excluded from utilization');
select is((pg_temp.summary()->'operations'->>'booked')::int,250,'All live roster entries counted');
select is((pg_temp.summary()->'operations'->>'absent')::int,60,'Explicit absences counted separately');
select is((pg_temp.summary()->'operations'->>'excused')::int,30,'Excused absences counted separately');
select ok(abs((pg_temp.summary()->'operations'->>'attendanceRate')::numeric-125.0/215)<0.000001,'Unmarked rows do not enter attendance denominator');
select is((pg_temp.summary()->'operations'->>'utilization')::numeric,0.1::numeric,'Capacity counted once per session');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((pg_temp.summary()->'operations'->>'sessions')::int,250,'Coach aggregate has no200row projection cap');
reset role;
delete from public.branch_permissions where user_id='d1000000-0000-4000-8000-000000000002';
set local role authenticated;
select is((pg_temp.summary()->'operations'->>'sessions')::int,0,'Current assignment permissions rechecked for aggregate');
reset role;
select * from finish();rollback;
