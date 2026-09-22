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

reset role;
update public.branches set synthetic=true where id='d2000000-0000-4000-8000-000000000001';
create function pg_temp.chat(a text,d jsonb) returns jsonb language sql as $$select public.coach_conversation_command(a,d,gen_random_uuid())$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select pg_temp.chat('open','{"enrollment_id":"d3000000-0000-4000-8000-000000000003"}')$$,'42501',null,'Messaging is inactive without policy');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select pg_temp.chat('policy','{"branch_id":"d2000000-0000-4000-8000-000000000001","enabled":true,"review_required":true}')$$,'Owner approves synthetic reviewed-reply policy');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select set_config('test.conversation',pg_temp.chat('open','{"enrollment_id":"d3000000-0000-4000-8000-000000000003"}')->>'id',true);
select lives_ok($$select pg_temp.chat('reply',jsonb_build_object('conversation_id',current_setting('test.conversation'),'body','Can we practice this skill at home?'))$$,'Parent message is persisted');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select set_config('test.message',pg_temp.chat('reply',jsonb_build_object('conversation_id',current_setting('test.conversation'),'body','Use the reviewed home exercise.'))->>'id',true);
select is((select status from public.coach_messages where id=current_setting('test.message')::uuid),'draft','Coach reply waits for oversight review');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.coach_messages),1,'Parent cannot read unpublished coach response');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select pg_temp.chat('publish',jsonb_build_object('conversation_id',current_setting('test.conversation'),'id',current_setting('test.message')))$$,'Oversight publishes approved reply');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.coach_messages),2,'Parent sees approved response after refresh');
select lives_ok($$select pg_temp.chat('read',jsonb_build_object('conversation_id',current_setting('test.conversation'),'message_ids',jsonb_build_array(current_setting('test.message'))))$$,'Explicit displayed message creates read receipt');
select is((select count(*)::int from public.coach_message_reads),1,'Only displayed message is marked read');
select lives_ok($$select pg_temp.chat('escalate',jsonb_build_object('conversation_id',current_setting('test.conversation')))$$,'Parent can escalate to operations');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.coach_messages),0,'Unrelated parent sees no history');
select throws_ok($$select pg_temp.chat('reply',jsonb_build_object('conversation_id',current_setting('test.conversation'),'body','Unrelated family attempt'))$$,'42501',null,'Known conversation ID does not confer access');
reset role;
delete from public.branch_permissions where user_id='d1000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::int from public.coach_messages),0,'Assignment permission removal immediately revokes coach history');
select throws_ok($$select pg_temp.chat('reply',jsonb_build_object('conversation_id',current_setting('test.conversation'),'body','Old coach attempting reply'))$$,'42501',null,'Revoked coach cannot send');
reset role;
select throws_ok($$update public.coach_messages set body='Changed after sending'$$,'42501',null,'Sent message content is immutable even to a privileged writer');
select throws_ok($$delete from public.coach_messages$$,'42501',null,'Conversation history cannot be silently deleted');
select * from finish();rollback;
