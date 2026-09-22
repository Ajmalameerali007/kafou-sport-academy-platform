-- The server verifies the signed, expiring enquiry cookie before using guest_trial.
-- A verified child link ends that guest capability; current guardian checks remain
-- mandatory for authenticated submitters and are never replaced by old ownership.
create or replace function private.enquiry_access(e uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.trial_enquiries q join public.leads l on l.id=q.lead_id
  where q.id=e and (
   (auth.role()='service_role' and q.submitted_by is null and q.child_id is null)
   or (
    private.mfa_ready() and (
     private.branch_access(l.branch_id)
     or (
      private.has_role(array['parent']::public.academy_role[])
      and q.submitted_by=auth.uid()
      and (q.child_id is null or exists(
       select 1 from public.children k
       where k.id=q.child_id and private.family_owner(k.family_id)
      ))
     )
    )
   )
  )
 )
$$;
revoke all on function private.enquiry_access(uuid) from public,anon;
grant execute on function private.enquiry_access(uuid) to authenticated,service_role;
-- Reassert that the capability wrapper is never a public database endpoint.
revoke all on function public.guest_trial(uuid,uuid) from public,anon,authenticated;
grant execute on function public.guest_trial(uuid,uuid) to service_role;
