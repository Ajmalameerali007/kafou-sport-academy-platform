-- Synthetic, opt-in branch policy. No emergency contact is projected to a coach without a current enabled version.
create table public.development_emergency_policies(
 id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,
 version int not null check(version>0),enabled boolean not null,minutes_before int not null check(minutes_before between 0 and 360),
 synthetic boolean not null default true check(synthetic),created_by uuid not null references public.profiles,created_at timestamptz not null default now(),
 unique(branch_id,version)
);
create index development_emergency_policy_actor on public.development_emergency_policies(created_by);
alter table public.development_emergency_policies enable row level security;
revoke all on public.development_emergency_policies from public,anon,authenticated;
grant select on public.development_emergency_policies to authenticated;grant all on public.development_emergency_policies to service_role;
create policy emergency_policy_read on public.development_emergency_policies for select to authenticated using(private.head_office() and private.product_can('development.configure',branch_id));
create trigger emergency_policy_immutable before update or delete on public.development_emergency_policies for each row execute function private.immutable_record();
create trigger emergency_policy_audit after insert on public.development_emergency_policies for each row execute function private.product_audit();

-- This narrow projection deliberately omits family IDs, guardian IDs, email and historical contacts.
create function private.development_coach_emergency_rows() returns table(id uuid,session_id uuid,child_id uuid,contact_name text,mobile text,relationship text)
language sql stable security definer set search_path='' as $$
 select r.id,s.id,k.id,ec.name,ec.mobile,ec.relationship
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id
 join public.branches b on b.id=c.branch_id and b.active
 join lateral(select p.enabled,p.minutes_before from public.development_emergency_policies p where p.branch_id=c.branch_id order by p.version desc limit 1) policy on policy.enabled
 join public.session_roster r on r.session_id=s.id and not r.cancelled
 left join public.enrollments n on n.id=r.enrollment_id
 left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id
 join public.children k on k.id=coalesce(n.child_id,q.child_id)
 join public.family_emergency_contacts ec on ec.family_id=k.family_id
 where private.development_coach_session(s.id) and not private.has_role(array['sales']::public.academy_role[])
 and private.development_session_child(s.id,k.id)
 and now()>=s.starts_at-make_interval(mins=>policy.minutes_before) and now()<s.ends_at
$$;
revoke all on function private.development_coach_emergency_rows() from public,anon;
grant execute on function private.development_coach_emergency_rows() to authenticated,service_role;
create view public.development_coach_emergency_contacts with(security_invoker=true,security_barrier=true) as select * from private.development_coach_emergency_rows();
revoke all on public.development_coach_emergency_contacts from public,anon;grant select on public.development_coach_emergency_contacts to authenticated,service_role;

alter function private.development_command(text,jsonb) rename to development_guidance_command;
create function private.development_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare bid uuid;rid uuid;begin
 if p_action<>'development.emergency.policy' then return private.development_guidance_command(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready());
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 bid:=(p_data->>'branch_id')::uuid;
 perform private.require_access(private.head_office() and private.product_can('development.configure',bid));
 if not exists(select 1 from public.branches where id=bid and active) then raise exception 'Active branch required' using errcode='P0409';end if;
 if p_data->'synthetic_acknowledged' is distinct from 'true'::jsonb or jsonb_typeof(p_data->'enabled') is distinct from 'boolean' or jsonb_typeof(p_data->'minutes_before') is distinct from 'number' or coalesce(p_data->>'minutes_before','') !~ '^[0-9]+$' or (p_data->>'minutes_before')::numeric not between 0 and 360 then raise exception 'Explicit synthetic acknowledgement and a 0 to 360 minute window are required' using errcode='22023';end if;
 insert into public.development_emergency_policies(branch_id,version,enabled,minutes_before,created_by)
 select bid,coalesce(max(version),0)+1,(p_data->>'enabled')::boolean,(p_data->>'minutes_before')::int,auth.uid() from public.development_emergency_policies where branch_id=bid returning id into rid;
 return jsonb_build_object('id',rid);
end $$;
revoke all on function private.development_command(text,jsonb),private.development_guidance_command(text,jsonb) from public,anon,authenticated;
