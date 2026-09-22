-- Linking an enquiry to a verified child replaces the submitter capability with guardian ownership.
create or replace function private.enquiry_access(e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.mfa_ready() and exists(select 1 from public.trial_enquiries q join public.leads l on l.id=q.lead_id where q.id=e and (private.branch_access(l.branch_id) or (private.has_role(array['parent']::public.academy_role[]) and q.submitted_by=auth.uid() and (q.child_id is null or exists(select 1 from public.children k where k.id=q.child_id and private.family_owner(k.family_id))))))
$$;
create or replace function private.roster_access(r public.session_roster) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=r.session_id and private.operations_staff(c.branch_id)) or exists(select 1 from public.trial_bookings b join public.trial_enquiries q on q.id=b.enquiry_id where b.id=r.trial_booking_id and q.submitted_by=auth.uid() and private.has_role(array['parent']::public.academy_role[]) and private.mfa_ready() and (q.child_id is null or exists(select 1 from public.children k where k.id=q.child_id and private.family_owner(k.family_id)))) or exists(select 1 from public.enrollments n join public.children k on k.id=n.child_id where n.id=r.enrollment_id and private.family_owner(k.family_id))
$$;
create function private.product_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Versioned or posted history is immutable' using errcode='P0409';end $$;
revoke all on function private.product_immutable() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['academy_policies','document_versions','document_acceptances','communication_templates','file_access_events','transfer_decisions'] loop execute format('create trigger immutable_history before update or delete on public.%I for each row execute function private.product_immutable()',t);end loop;end $$;

create function private.product_access_revision() returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object(
 'roles',(select coalesce(jsonb_agg(r.role order by r.role),'[]') from public.role_assignments r where r.user_id=auth.uid()),
 'branches',(select coalesce(jsonb_agg(b.branch_id order by b.branch_id),'[]') from public.branch_permissions b where b.user_id=auth.uid()),
 'grants',(select coalesce(jsonb_agg(jsonb_build_array(p.permission,p.branch_id) order by p.id),'[]') from public.product_permissions p where p.user_id=auth.uid()),
 'families',(select coalesce(jsonb_agg(g.family_id order by g.family_id),'[]') from public.guardians g where g.user_id=auth.uid()),
 'family_branches',(select coalesce(jsonb_agg(jsonb_build_array(fb.family_id,fb.branch_id) order by fb.family_id,fb.branch_id),'[]') from public.family_branches fb where private.head_office() or exists(select 1 from public.branch_permissions bp where bp.user_id=auth.uid() and bp.branch_id=fb.branch_id) or exists(select 1 from public.guardians g where g.family_id=fb.family_id and g.user_id=auth.uid())),
 'classes',(select coalesce(jsonb_agg(jsonb_build_array(c.id,c.active,c.branch_id) order by c.id),'[]') from public.academy_classes c where c.coach_id=auth.uid()),
 'substitutions',(select coalesce(jsonb_agg(jsonb_build_array(a.id,a.revoked_at,a.starts_at,a.ends_at) order by a.id),'[]') from public.coach_substitutions a where a.coach_id=auth.uid() and a.revoked_at is null and now() between a.starts_at and a.ends_at)
 )::text)
$$;
revoke all on function private.product_access_revision() from public,anon,authenticated;

drop policy read_enquiries on public.trial_enquiries;
create policy read_enquiries on public.trial_enquiries for select to authenticated using(private.enquiry_access(id));
create or replace function public.coach_sessions() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(public.development_sessions()) x where private.has_role(array['coach']::public.academy_role[]) and private.coach_notice_access((x->>'id')::uuid) and ((x->>'can_coach')::boolean or x->>'status'='cancelled')
$$;
