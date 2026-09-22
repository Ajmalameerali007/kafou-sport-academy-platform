-- REVIEWED OPERATOR ACTION ONLY, never a migration or automatic post-deploy step.
-- Execute with the database tool's explicit project_id=cwdazidovxqeevmpicng AFTER
-- scripts/jobs/approve.mjs --staging succeeded against a real owner AAL2 session.
-- That RPC validates the provider issuer; target_ref alone cannot create approval.
-- This file does not forge JWT claims or create an approval.
begin;
do $$begin
 if not exists(select 1 from private.current_scheduled_controls('cwdazidovxqeevmpicng')) then
  raise exception 'No current owner-approved synthetic staging branch in this database' using errcode='42501';
 end if;
 if auth.uid() is not null then raise exception 'Use the reviewed database-owner operation, not a staff impersonation' using errcode='42501';end if;
end$$;
create extension if not exists pg_cron;
select cron.schedule('kafou-synthetic-inapp','* * * * *',$cron$select private.run_scheduled_jobs('cwdazidovxqeevmpicng',20);$cron$);
commit;
