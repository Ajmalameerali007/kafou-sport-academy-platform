begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
('91000000-0000-4000-8000-000000000001','community-owner@example.test','{"name":"Community owner"}',now()),
('91000000-0000-4000-8000-000000000002','community-parent@example.test','{"name":"Community parent"}',now()),
('91000000-0000-4000-8000-000000000003','community-invited@example.test','{"name":"Invited guardian"}',now()),
('91000000-0000-4000-8000-000000000004','community-other@example.test','{"name":"Other family"}',now()),
('91000000-0000-4000-8000-000000000005','community-branch@example.test','{"name":"Community branch"}',now()),
('91000000-0000-4000-8000-000000000006','community-coach@example.test','{"name":"Community coach"}',now()),
('91000000-0000-4000-8000-000000000007','community-sales@example.test','{"name":"Community sales"}',now()),
('91000000-0000-4000-8000-000000000008','community-pending@example.test','{"name":"Pending guardian"}',now()),
('91000000-0000-4000-8000-000000000009','community-other-branch@example.test','{"name":"Other branch"}',now());
delete from public.role_assignments where user_id in ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000006','91000000-0000-4000-8000-000000000007','91000000-0000-4000-8000-000000000009');
insert into public.role_assignments values('91000000-0000-4000-8000-000000000001','super_admin'),('91000000-0000-4000-8000-000000000005','branch'),('91000000-0000-4000-8000-000000000006','coach'),('91000000-0000-4000-8000-000000000007','sales'),('91000000-0000-4000-8000-000000000009','branch');
insert into public.branches(id,slug,name,provisional) values('92000000-0000-4000-8000-000000000001','community-product-one','Community one',false),('92000000-0000-4000-8000-000000000002','community-product-two','Community two',false);
insert into public.branch_sports values('92000000-0000-4000-8000-000000000001','swimming');
insert into public.branch_permissions values('91000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000007','92000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000009','92000000-0000-4000-8000-000000000002');
insert into public.families(id,name) values('93000000-0000-4000-8000-000000000001','Community family'),('93000000-0000-4000-8000-000000000002','Other community family');
insert into public.guardians values('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002'),('93000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000004');
insert into public.family_branches values('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001');
insert into public.children(id,family_id,name,dob) values('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Community child','2018-01-01'),('94000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','Other community child','2018-01-01');
insert into public.venues(id,branch_id,name,address) values('95000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Community pool','Synthetic');
insert into public.sport_levels(id,sport,name,rank) values('95000000-0000-4000-8000-000000000002','swimming','Community product level',104);
insert into public.age_groups(id,name,min_age,max_age) values('95000000-0000-4000-8000-000000000003','Community product ages',1,17);
insert into public.academy_classes(id,branch_id,venue_id,coach_id,sport,level_id,age_group_id,name,capacity,weekdays,local_time,duration_minutes) values('96000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000006','swimming','95000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000003','Community class',5,array[0],'16:00',60);
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity) values('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',now()+interval '2 days',now()+interval '2 days 1 hour',5);
insert into public.enrollments(id,child_id,class_id) values('98000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001');
insert into public.session_roster(session_id,enrollment_id,kind) values('97000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','enrollment');
-- Search must find records beyond the first 200 workspace rows.
insert into public.children(id,family_id,name,dob)
select md5('workspace-search-'||i)::uuid,'93000000-0000-4000-8000-000000000001','Searchneedle '||lpad(i::text,3,'0'),'2018-01-01' from generate_series(1,205) i;
insert into public.children(family_id,name,dob) values('93000000-0000-4000-8000-000000000002','Searchneedle hidden sibling','2018-01-01');
insert into public.leads(branch_id,parent_name,mobile) values('92000000-0000-4000-8000-000000000001','Searchlead visible','+971500000100'),('92000000-0000-4000-8000-000000000002','Searchlead secret','+971500000101');
insert into public.class_sessions(id,class_id,starts_at,ends_at,capacity)
select md5('search-session-'||i)::uuid,'96000000-0000-4000-8000-000000000001',now()+interval '3 days'+i*interval '1 hour',now()+interval '3 days 30 minutes'+i*interval '1 hour',5 from generate_series(1,205) i;
select set_config('test.search_session_time',(select starts_at::text from public.class_sessions where id=md5('search-session-205')::uuid),true);
select has_function('public','workspace_search',array['text','text[]','text','integer','uuid','uuid'],'Server search RPC exists');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((public.workspace_search('Searchneedle',array['child'])->>'total')::int,205,'Exact authorized count includes beyond 200, excludes another family');
select is(jsonb_array_length(public.workspace_search('Searchneedle',array['child'])->'items'),20,'Default page is bounded');
select is((public.workspace_search('Searchneedle 205',array['child'])->>'total')::int,1,'Finds a matching child beyond the loaded workspace page');
select is((public.workspace_search('searchNEEDLE 205',array['child'])->>'total')::int,1,'Case-insensitive literal query');
select is((public.workspace_search('Searchneedle%',array['child'])->>'total')::int,0,'SQL wildcard characters are literal');
select set_config('test.search_cursor',public.workspace_search('Searchneedle',array['child'])->>'next_cursor',true);
select is(jsonb_array_length(public.workspace_search('Searchneedle',array['child'],current_setting('test.search_cursor'))->'items'),20,'Next cursor returns another bounded page');
select ok(not exists(select 1 from jsonb_array_elements(public.workspace_search('Searchneedle',array['child'])->'items') a join jsonb_array_elements(public.workspace_search('Searchneedle',array['child'],current_setting('test.search_cursor'))->'items') b on a->>'id'=b->>'id'),'Stable cursor pages do not overlap');
select is(public.workspace_search('Searchneedle',array['child']),public.workspace_search('Searchneedle',array['child']),'Repeated unchanged query gives identical order and cursor');
select is((public.workspace_search('Searchneedle',array['child'],null,50,null,md5('workspace-search-205')::uuid)->>'total')::int,1,'Optional selected child restricts results');
select is((public.workspace_search('Searchneedle',array['child'],null,20,'92000000-0000-4000-8000-000000000002')->>'total')::int,0,'Branch filter only narrows authorized rows');
select is((public.workspace_search('Searchlead',array['lead'])->>'total')::int,0,'Parent cannot search lead identities');
select throws_ok($$select public.workspace_search('x')$$,'22023',null,'Too-short query rejected');
select throws_ok($$select public.workspace_search(repeat('x',81))$$,'22023',null,'Oversized query rejected');
select throws_ok($$select public.workspace_search('needle',array['audit'])$$,'22023',null,'Unsupported entity rejected');
select throws_ok($$select public.workspace_search('needle',array['child'],'child:invalid')$$,'22023',null,'Malformed cursor rejected');
select throws_ok($$select public.workspace_search('needle',array['child'],null,51)$$,'22023',null,'Page size cannot exceed 50');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
select is((public.workspace_search('Searchneedle',array['child'])->>'total')::int,205,'Branch sees only explicitly linked family');
reset role;delete from public.family_branches where family_id='93000000-0000-4000-8000-000000000001';set local role authenticated;
select is((public.workspace_search('Searchneedle',array['child'],current_setting('test.search_cursor'))->>'total')::int,0,'Unlink immediately removes result count on later page');
select is(jsonb_array_length(public.workspace_search('Searchneedle',array['child'])->'items'),0,'Unlink immediately removes snippets');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1"}',true);
select is((public.workspace_search('Searchlead',array['lead'])->>'total')::int,1,'Sales searches only own branch leads');
select is((public.workspace_search('Searchneedle',array['child','family'])->>'total')::int,0,'Sales cannot search families or children');
reset role;delete from public.branch_permissions where user_id='91000000-0000-4000-8000-000000000007';set local role authenticated;
select is((public.workspace_search('Searchlead',array['lead'])->>'total')::int,0,'Sales branch revocation removes counts');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}',true);
select is((public.workspace_search('Searchneedle',array['child','family','lead'])->>'total')::int,0,'Coach cannot discover private family/child/lead records');
select is((public.workspace_search('Community class',array['session'])->>'total')::int,206,'Coach can search own assigned session metadata beyond 200');
select is((public.workspace_search(current_setting('test.search_session_time'),array['session'])->>'total')::int,1,'Coach lookup finds a specific session beyond legacy 200-row projection');
select is(public.workspace_search_session(md5('search-session-205')::uuid)->>'id',md5('search-session-205')::uuid::text,'Coach opens beyond-200 session through same current assignment scope');
select is(public.workspace_search_session('97000000-0000-4000-8000-000000000001')->>'id','97000000-0000-4000-8000-000000000001','Coach can hydrate exactly an assigned session');
select ok(not (public.workspace_search('Community class',array['session'])->'items'->0 ? 'students'),'Coach search does not return rosters');
reset role;delete from public.branch_permissions where user_id='91000000-0000-4000-8000-000000000006';set local role authenticated;
select is(public.workspace_search_session('97000000-0000-4000-8000-000000000001'),null::jsonb,'Revoked coach cannot hydrate known session');
select is((public.workspace_search('Community class',array['session'])->>'total')::int,0,'Coach branch revocation removes session search immediately');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
reset role;delete from public.guardians where user_id='91000000-0000-4000-8000-000000000002';set local role authenticated;
select is((public.workspace_search('Searchneedle',array['child'],current_setting('test.search_cursor'))->>'total')::int,0,'Guardian revocation invalidates subsequent cursor page');
reset role;update public.profiles set active=false where id='91000000-0000-4000-8000-000000000002';set local role authenticated;
select throws_ok($$select public.workspace_search('Searchneedle')$$,'42501',null,'Inactive account cannot search');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.workspace_search('Searchneedle')$$,'42501',null,'Owner must satisfy AAL2');
reset role;set local role anon;
select throws_ok($$select public.workspace_search('Searchneedle')$$,'42501',null,'Anonymous role has no search execute grant');
reset role;
select * from finish();rollback;
