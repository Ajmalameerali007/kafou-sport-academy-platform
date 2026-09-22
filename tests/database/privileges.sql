begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select has_function('private','mfa_ready',array[]::text[],'MFA applies to every privileged workspace');
select has_function('private','validate_invitation',array[]::text[],'Invitation branch scope is validated');
select throws_ok($$update public.audit_events set action='changed'$$,'42501',null,'Audit is append-only even for privileged maintenance');
select * from finish();rollback;
