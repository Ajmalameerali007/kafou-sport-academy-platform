begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
select has_table('public','families','Family records exist');
select has_table('public','role_assignments','Server-managed roles exist');
select has_table('public','trial_enquiries','Durable enquiries exist');
select has_function('public','submit_enquiry',array['jsonb','uuid'],'Atomic enquiry boundary exists');
select * from finish();
rollback;
