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

-- Already-published synthetic measurement fixtures; the target workflow below uses only public commands.
insert into public.development_criteria(id,sport,level_id,version,title,criteria,created_by) values
('e1000000-0000-4000-8000-000000000001','swimming','d2000000-0000-4000-8000-000000000003',1,'Synthetic distance','[{"key":"distance","label":"Distance","unit":"m","min":0,"max":100,"direction":"higher"}]','d1000000-0000-4000-8000-000000000003'),
('e1000000-0000-4000-8000-000000000002','swimming','d2000000-0000-4000-8000-000000000003',2,'Changed distance version','[{"key":"distance","label":"Distance","unit":"m","min":0,"max":100,"direction":"higher"}]','d1000000-0000-4000-8000-000000000003');
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values('e1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000006',now()-interval '1 hour',now(),10);
insert into public.session_roster(session_id,enrollment_id,kind,attendance) values('e1000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000003','enrollment','present');
insert into public.development_assessments(id,session_id,child_id,criteria_id,author_id,scores,summary,status,reviewed_by,published_at) values
('e2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000007','d3000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','{"distance":20}','Published baseline','published','d1000000-0000-4000-8000-000000000003',now()-interval '2 days'),
('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002','{"distance":50}','Published improvement','published','d1000000-0000-4000-8000-000000000003',now()),
('e2000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','{"distance":60}','Different metric version','published','d1000000-0000-4000-8000-000000000003',now());
insert into public.development_results(id,assessment_id,child_id,sport,criteria_id,metric_key,label,value,unit,direction,measured_at) values
('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000002','swimming','e1000000-0000-4000-8000-000000000001','distance','Distance',20,'m','higher',now()-interval '2 hours'),
('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000002','swimming','e1000000-0000-4000-8000-000000000001','distance','Distance',50,'m','higher',now()-interval '1 hour'),
('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000002','swimming','e1000000-0000-4000-8000-000000000002','distance','Distance',60,'m','higher',now()-interval '1 hour');
create function pg_temp.target_cmd(action text,data jsonb) returns jsonb language sql as $$select public.product_command(action,data,gen_random_uuid())$$;
create function pg_temp.target_save(value numeric,tid uuid default null) returns jsonb language sql as $$select pg_temp.target_cmd('development.target.save',jsonb_build_object('id',tid,'session_id','d2000000-0000-4000-8000-000000000007','baseline_result_id','e3000000-0000-4000-8000-000000000001','title','Swim fifty metres','target_value',value,'due_on',((now() at time zone 'Asia/Dubai')::date+30)::text))$$;
grant execute on function pg_temp.target_cmd(text,jsonb),pg_temp.target_save(numeric,uuid) to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select pg_temp.target_save(50)$$,'42501',null,'Parent cannot author a tracked training target');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select pg_temp.target_save(10)$$,'22023',null,'Target must improve on the published baseline in the correct direction');
select throws_ok($$select pg_temp.target_save(101)$$,'22023',null,'Target must stay within its versioned criterion range');
select lives_ok($$select pg_temp.target_save(50)$$,'Assigned coach creates a measurable draft from published evidence');
select set_config('test.target',(select id::text from public.development_targets),true);
select throws_ok($$select pg_temp.target_save(60)$$,'P0409',null,'Duplicate active targets for the same athlete metric version are prevented');
select throws_ok($$update public.development_targets set status='completed'$$,'42501',null,'Direct target mutation cannot bypass the lifecycle');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.development_targets),0,'Families cannot see target drafts');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select pg_temp.target_cmd('development.target.submit',jsonb_build_object('id',current_setting('test.target')))$$,'Assigned author submits target for review');
select throws_ok($$select pg_temp.target_save(60,current_setting('test.target')::uuid)$$,'P0409',null,'Submitted target cannot be edited');
select throws_ok($$select pg_temp.target_cmd('development.target.publish',jsonb_build_object('id',current_setting('test.target')))$$,'42501',null,'Coach cannot publish targets');
reset role;
insert into public.role_assignments values('d1000000-0000-4000-8000-000000000002','admin');
insert into public.product_permissions(user_id,permission) values('d1000000-0000-4000-8000-000000000002','development.review');
set local role authenticated;
select throws_ok($$select pg_temp.target_cmd('development.target.review',jsonb_build_object('id',current_setting('test.target'),'decision','approved','reason','Self approval'))$$,'42501',null,'Coach cannot review their own target even with an additional Head Office grant');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select pg_temp.target_cmd('development.target.publish',jsonb_build_object('id',current_setting('test.target')))$$,'P0409',null,'Target publication requires an approved independent review');
select lives_ok($$select pg_temp.target_cmd('development.target.review',jsonb_build_object('id',current_setting('test.target'),'decision','rejected','reason','Private review: revise the target'))$$,'Reviewer can return a target for revision');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select pg_temp.target_save(50,current_setting('test.target')::uuid)$$,'Assigned author can revise a returned draft');
select lives_ok($$select pg_temp.target_cmd('development.target.submit',jsonb_build_object('id',current_setting('test.target')))$$,'Revised target submits again');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select pg_temp.target_cmd('development.target.review',jsonb_build_object('id',current_setting('test.target'),'decision','approved','reason','Private review: measurable and achievable'))$$,'Independent reviewer approves the target');
select lives_ok($$select pg_temp.target_cmd('development.target.publish',jsonb_build_object('id',current_setting('test.target')))$$,'Authorized reviewer publishes the approved target');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select status from public.development_targets),'published','Family sees the active published target');
select is((select target_value from public.development_targets),50::numeric,'Family sees the actual numeric target');
select is((select count(*)::int from public.development_target_reviews),0,'Internal review reasons remain hidden from families');
select is((select count(*)::int from public.development_target_events),1,'Family history contains only the published lifecycle event');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.development_targets),0,'Unrelated families cannot read published targets');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select pg_temp.target_cmd('development.target.completion.submit',jsonb_build_object('id',current_setting('test.target'),'result_id','e3000000-0000-4000-8000-000000000001'))$$,'22023',null,'The original baseline cannot prove target completion');
select throws_ok($$select pg_temp.target_cmd('development.target.completion.submit',jsonb_build_object('id',current_setting('test.target'),'result_id','e3000000-0000-4000-8000-000000000003'))$$,'22023',null,'Completion cannot compare incompatible criterion versions');
select lives_ok($$select pg_temp.target_cmd('development.target.completion.submit',jsonb_build_object('id',current_setting('test.target'),'result_id','e3000000-0000-4000-8000-000000000002'))$$,'Coach submits a later published measurement meeting the exact target');
select is((select status from public.development_targets),'completion_submitted','Evidence submission alone does not mark a target complete');
select throws_ok($$select pg_temp.target_cmd('development.target.completion.review',jsonb_build_object('id',current_setting('test.target'),'decision','approved','reason','Self completion review'))$$,'42501',null,'Completion submitter cannot approve their own completion claim');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select pg_temp.target_cmd('development.target.completion.review',jsonb_build_object('id',current_setting('test.target'),'decision','rejected','reason','Private completion review: confirm the recording'))$$,'Reviewer can reject a completion claim without removing the published target');
select is((select status from public.development_targets),'published','Rejected completion returns the same target to active');
select is((select completion_result_id from public.development_targets),null::uuid,'Rejected candidate is cleared while its review history remains');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select pg_temp.target_cmd('development.target.completion.submit',jsonb_build_object('id',current_setting('test.target'),'result_id','e3000000-0000-4000-8000-000000000002'))$$,'Coach may resubmit valid evidence after feedback');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select pg_temp.target_cmd('development.target.completion.review',jsonb_build_object('id',current_setting('test.target'),'decision','approved','reason','Private completion review: evidence confirmed'))$$,'Independent reviewer confirms completion');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select status from public.development_targets),'completed','Family sees independently confirmed completion');
select is((select count(*)::int from public.development_target_reviews),0,'Completion review reasons also remain private');
select is((select count(*)::int from public.development_target_events),2,'Family history has publication and confirmed completion only');
select throws_ok($$select pg_temp.target_cmd('development.target.withdraw',jsonb_build_object('id',current_setting('test.target'),'reason','Parent correction'))$$,'42501',null,'Parent cannot withdraw a coaching target');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select pg_temp.target_cmd('development.target.withdraw',jsonb_build_object('id',current_setting('test.target'),'reason','Recorded completion needs correction'))$$,'Authorized academy reviewer withdraws a completed target with a family-facing reason');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select status from public.development_targets),'withdrawn','Family retains the withdrawn historical target');
select is((select withdrawal_reason from public.development_targets),'Recorded completion needs correction','Withdrawal reason is explicitly family-facing');
reset role;
select throws_ok($$update public.development_targets set target_value=99 where id=current_setting('test.target')::uuid$$,'42501',null,'A published target plan cannot be rewritten even after withdrawal');
select throws_ok($$delete from public.development_target_reviews$$,'42501',null,'Review evidence is append-only');
select throws_ok($$delete from public.development_target_events$$,'42501',null,'Target lifecycle history is append-only');
delete from public.role_assignments where user_id='d1000000-0000-4000-8000-000000000002' and role='admin';
delete from public.branch_permissions where user_id='d1000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.development_targets),0,'Revoked coach branch access also removes target history');
select throws_ok($$select pg_temp.target_save(60)$$,'42501',null,'Revoked coach cannot create another target');
reset role;
insert into public.branch_permissions values('d1000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001');
insert into public.role_assignments values('d1000000-0000-4000-8000-000000000004','sales');
insert into public.product_permissions(user_id,permission) values('d1000000-0000-4000-8000-000000000004','development.review');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.development_targets),0,'Sales has no target directory even with an erroneous review grant');
select throws_ok($$select pg_temp.target_save(60)$$,'42501',null,'Sales cannot create targets');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select pg_temp.target_save(60)$$,'A withdrawn target releases the same metric for a new independently reviewed plan');
select set_config('test.target.next',(select id::text from public.development_targets where status='draft'),true);
select pg_temp.target_cmd('development.target.submit',jsonb_build_object('id',current_setting('test.target.next')));
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select pg_temp.target_cmd('development.target.review',jsonb_build_object('id',current_setting('test.target.next'),'decision','approved','reason','New target reviewed'));
select pg_temp.target_cmd('development.target.publish',jsonb_build_object('id',current_setting('test.target.next')));
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select pg_temp.target_cmd('development.target.completion.submit',jsonb_build_object('id',current_setting('test.target.next'),'result_id','e3000000-0000-4000-8000-000000000002'))$$,'22023',null,'Published evidence below the target cannot claim completion');
reset role;
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values('e4000000-0000-4000-8000-000000000001','target-substitute@example.test','{"name":"Synthetic substitute"}',now());
insert into public.role_assignments values('e4000000-0000-4000-8000-000000000001','coach');
insert into public.branch_permissions values('e4000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001');
insert into public.coach_substitutions(session_id,coach_id,starts_at,ends_at,reason) values('d2000000-0000-4000-8000-000000000007','e4000000-0000-4000-8000-000000000001',now()-interval '1 hour',now()+interval '1 hour','Synthetic target handover');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.development_targets),2,'Current substitute sees the relevant assigned athlete targets');
reset role;
update public.coach_substitutions set revoked_at=now() where coach_id='e4000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::int from public.development_targets),0,'Revoked substitute immediately loses target access');
select throws_ok($$select pg_temp.target_cmd('development.target.completion.submit',jsonb_build_object('id',current_setting('test.target.next'),'result_id','e3000000-0000-4000-8000-000000000002'))$$,'42501',null,'Revoked substitute cannot submit completion claims');
reset role;
delete from public.guardians where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.development_targets),0,'Revoked guardian loses target history immediately');
reset role;
select * from finish();rollback;
