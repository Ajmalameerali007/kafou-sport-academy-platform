begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('a3000000-0000-4000-8000-000000000001','audit-reason-branch@example.test','{"name":"Branch staff"}',now()),
('a3000000-0000-4000-8000-000000000002','audit-reason-coach@example.test','{"name":"Reason coach"}',now());
delete from public.role_assignments where user_id in ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002');
insert into public.role_assignments values
('a3000000-0000-4000-8000-000000000001','branch'),
('a3000000-0000-4000-8000-000000000002','coach');
insert into public.branches(id,slug,name,provisional) values
('a3100000-0000-4000-8000-000000000001','audit-reason-branch','Audit reason branch',false);
insert into public.branch_permissions values
('a3000000-0000-4000-8000-000000000001','a3100000-0000-4000-8000-000000000001');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select set_config('audit_reason_test.baseline_id',(select coalesce(max(id),0)::text from public.audit_events),true);
select lives_ok($$select public.operations_command('lead.create',jsonb_build_object('branch_id','a3100000-0000-4000-8000-000000000001','parent_name','Reason Parent','child_name','Reason Child','mobile','+971500000001','source','walk_in','sport','football','age',8,'experience','beginner','reason','Walk-in enquiry logged manually'))$$,'operations_command captures a lead create with a reason');
select lives_ok($$select public.operations_command('lead.create',jsonb_build_object('branch_id','a3100000-0000-4000-8000-000000000001','parent_name','No Reason Parent','child_name','No Reason Child','mobile','+971500000002','source','walk_in','sport','football','age',8,'experience','beginner'))$$,'operations_command works without a reason');

reset role; set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.product_command('coach.profile.update',jsonb_build_object('bio','Certified instructor.','qualifications',jsonb_build_array(),'reason','Annual profile refresh'),gen_random_uuid())$$,'product_command captures a coach profile update with a reason');

-- audit_events is only readable by head office; drop back to the unrestricted session role to inspect it.
reset role;
select is((select reason from public.audit_events where entity='leads' and id>current_setting('audit_reason_test.baseline_id')::bigint order by id asc limit 1),'Walk-in enquiry logged manually','Reason is persisted on the leads audit row via operations_command');
select is((select reason from public.audit_events where entity='leads' and id>current_setting('audit_reason_test.baseline_id')::bigint order by id desc limit 1),null,'Reason is null when not supplied');
select is((select reason from public.audit_events where entity='profiles' and (new_value->>'id')='a3000000-0000-4000-8000-000000000002' order by id desc limit 1),'Annual profile refresh','Reason is persisted on the profiles audit row via product_command');

select throws_ok($$select public.operations_command_before_reason('lead.create','{}')$$,'42883',null,'The renamed pre-reason function is no longer reachable from the public schema');

select * from finish();
rollback;
