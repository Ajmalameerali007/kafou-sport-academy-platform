begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select has_function('public','bootstrap_admin',array['uuid'],'First admin has a controlled bootstrap boundary');
select has_function('public','staff_directory',array[]::text[],'Branch staff can select permitted assignees without seeing profiles');
select has_function('public','confirmed_locations',array[]::text[],'Provisional branches are excluded from confirmed locations');
select * from finish();rollback;
