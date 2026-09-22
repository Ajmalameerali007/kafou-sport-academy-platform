-- Explicit synthetic markers are set by the guarded staging seed, never user metadata.
alter table public.profiles add column synthetic boolean not null default false;
alter table public.branches add column synthetic boolean not null default false;
alter table public.families add column synthetic boolean not null default false;
alter table public.children add column synthetic boolean not null default false;
alter table public.leads add column synthetic boolean not null default false;
alter table public.academy_classes add column synthetic boolean not null default false;
create function public.coach_directory() returns jsonb language sql stable security definer set search_path='' as $$ select coalesce(jsonb_agg(x),'[]') from (select p.id,p.name,jsonb_agg(bp.branch_id) branch_ids from public.profiles p join public.role_assignments r on r.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id where private.head_office() and p.active and r.role='coach' group by p.id,p.name) x $$;
revoke all on function public.coach_directory() from public,anon; grant execute on function public.coach_directory() to authenticated;
create function public.coach_sessions() returns jsonb language sql stable security definer set search_path='' as $$ select coalesce(jsonb_agg(x order by x.starts_at),'[]') from (
select s.id,c.name,s.starts_at,s.ends_at,s.status,coalesce((select jsonb_agg(jsonb_build_object('name',coalesce(q.child_name,k.name),'kind',r.kind)) from public.session_roster r left join public.trial_bookings b on b.id=r.trial_booking_id left join public.trial_enquiries q on q.id=b.enquiry_id left join public.enrollments n on n.id=r.enrollment_id left join public.children k on k.id=n.child_id where r.session_id=s.id and not r.cancelled),'[]') students from public.class_sessions s join public.academy_classes c on c.id=s.class_id where private.has_role(array['coach']::public.academy_role[]) and private.mfa_ready() and c.coach_id=auth.uid() and exists(select 1 from public.branch_permissions where user_id=auth.uid() and branch_id=c.branch_id) and s.starts_at between now()-interval '7 days' and now()+interval '30 days' order by s.starts_at limit 100
) x $$;
revoke all on function public.coach_sessions() from public,anon; grant execute on function public.coach_sessions() to authenticated;
-- The server permits guest operations only with a signed, short-lived enquiry cookie.
-- These elevated operations are not executable by anonymous or authenticated database clients.
create function public.guest_trial(p_enquiry uuid,p_session uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; original_claims text; begin
perform private.require_access(auth.role()='service_role');
-- Guest privileges are explicitly scoped inside private.enquiry_access, not simulated identity.
if p_session is null then return public.trial_availability(p_enquiry); end if;
return private.book_trial(p_enquiry,p_session,null); end $$;
revoke all on function public.guest_trial(uuid,uuid) from public,anon,authenticated; grant execute on function public.guest_trial(uuid,uuid) to service_role;
create or replace function private.enquiry_access(e uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.trial_enquiries q join public.leads l on l.id=q.lead_id where q.id=e and ((auth.role()='service_role' and q.submitted_by is null) or (private.mfa_ready() and (private.branch_access(l.branch_id) or (private.has_role(array['parent']::public.academy_role[]) and q.submitted_by=auth.uid()))))) $$;
-- Synthetic lineage is protected database state, not editable signup metadata.
create function private.synthetic_lineage() returns trigger language plpgsql security definer set search_path='' as $$ begin
if TG_TABLE_NAME='children' then new.synthetic:=coalesce((select synthetic from public.families where id=new.family_id),false);
elsif TG_TABLE_NAME in ('leads','academy_classes') then new.synthetic:=coalesce((select synthetic from public.branches where id=new.branch_id),false) or coalesce((select synthetic from public.profiles where id=auth.uid()),false);
elsif TG_TABLE_NAME='families' then new.synthetic:=new.synthetic or coalesce((select synthetic from public.profiles where id=auth.uid()),false);
end if; return new; end $$;
revoke all on function private.synthetic_lineage() from public,anon,authenticated;
create trigger synthetic_lineage before insert on public.children for each row execute function private.synthetic_lineage();
create trigger synthetic_lineage before insert on public.leads for each row execute function private.synthetic_lineage();
create trigger synthetic_lineage before insert on public.academy_classes for each row execute function private.synthetic_lineage();
create trigger synthetic_lineage before insert on public.families for each row execute function private.synthetic_lineage();
