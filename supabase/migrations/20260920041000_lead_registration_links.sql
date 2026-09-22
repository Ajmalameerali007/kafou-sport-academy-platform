-- Staff-issued capability continues an enquiry; it never grants guardianship.
create table private.lead_registration_links (
 id uuid primary key default gen_random_uuid(),lead_id uuid not null references public.leads,
 token_hash text not null unique,created_by uuid not null references public.profiles,
 created_at timestamptz not null default now(),expires_at timestamptz not null,
 revoked_at timestamptz,used_at timestamptz,used_by uuid references public.profiles,
 child_id uuid references public.children,enquiry_id uuid references public.trial_enquiries,
 check(expires_at>created_at)
);
revoke all on private.lead_registration_links from public,anon,authenticated;
create function public.registration_link(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.leads;q public.trial_enquiries;link private.lead_registration_links;c public.children;token text;rid uuid;begin
 perform private.require_access(private.active() and private.mfa_ready());
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if p_action in ('issue','list','revoke') then
  select * into l from public.leads where id=(p_data->>'lead_id')::uuid for update;
  perform private.require_access(l.id is not null and private.branch_access(l.branch_id));
  if p_action='list' then
   return coalesce((select jsonb_agg(jsonb_build_object('id',id,'created_at',created_at,'expires_at',expires_at,'status',case when revoked_at is not null then 'revoked' when used_at is not null then 'used' when expires_at<=now() then 'expired' else 'active' end) order by created_at desc) from private.lead_registration_links where lead_id=l.id),'[]');
  elsif p_action='revoke' then
   update private.lead_registration_links set revoked_at=coalesce(revoked_at,now()) where id=(p_data->>'id')::uuid and lead_id=l.id returning id into rid;
   perform private.require_access(rid is not null);
   insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'registration_link_revoked','Registration link revoked.');
   return jsonb_build_object('id',rid);
  end if;
  -- Reissuing revokes previous unused capabilities. No raw token is retained.
  update private.lead_registration_links set revoked_at=now() where lead_id=l.id and used_at is null and revoked_at is null;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into private.lead_registration_links(lead_id,token_hash,created_by,expires_at) values(l.id,encode(extensions.digest(token,'sha256'),'hex'),auth.uid(),now()+interval '48 hours') returning id into rid;
  insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'registration_link_issued','Registration link issued for48hours. No external message sent.');
  return jsonb_build_object('id',rid,'token',token,'expiresAt',now()+interval '48 hours');
 elsif p_action='continue' then
  perform private.require_access(private.has_role(array['parent']::public.academy_role[]) and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null));
  if coalesce(p_data->>'token','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid registration link' using errcode='42501';end if;
  select * into link from private.lead_registration_links where token_hash=encode(extensions.digest(p_data->>'token','sha256'),'hex') for update;
  perform private.require_access(link.id is not null and link.revoked_at is null and link.expires_at>now());
  select * into c from public.children where id=(p_data->>'child_id')::uuid;
  perform private.require_access(c.id is not null and private.family_owner(c.family_id));
  if link.used_at is not null then
   perform private.require_access(link.used_by=auth.uid() and link.child_id=c.id);
   return jsonb_build_object('id',link.enquiry_id,'childId',c.id);
  end if;
  select * into l from public.leads where id=link.lead_id for update;
  perform private.require_access(l.family_id is null or l.family_id=c.family_id);
  select * into q from public.trial_enquiries where lead_id=l.id for update;
  if q.id is null then raise exception 'Staff must add trial details before registration' using errcode='P0409';end if;
  perform private.require_access((q.child_id is null or q.child_id=c.id) and (q.submitted_by is null or q.submitted_by=auth.uid()));
  if exists(select 1 from public.trial_bookings where enquiry_id=q.id and status not in ('cancelled','missed')) and q.child_id is distinct from c.id then raise exception 'Staff must resolve the existing trial before linking' using errcode='P0409';end if;
  if not exists(select 1 from public.child_sports where child_id=c.id and sport=q.sport) then raise exception 'Child sport must match the enquiry' using errcode='22023';end if;
  insert into public.family_branches values(c.family_id,l.branch_id) on conflict do nothing;
  update public.leads set family_id=c.family_id where id=l.id;
  update public.trial_enquiries set child_id=c.id,submitted_by=auth.uid(),child_name=c.name,reported_age=coalesce(extract(year from age(current_date,c.dob))::int,c.reported_age),age_captured_on=current_date where id=q.id;
  update private.lead_registration_links set used_at=now(),used_by=auth.uid(),child_id=c.id,enquiry_id=q.id where id=link.id;
  insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'registration_continued','Authenticated guardian explicitly linked their child. No new lead, family, payment or enrollment created.');
  return jsonb_build_object('id',q.id,'childId',c.id);
 end if;
 raise exception 'Unknown registration action' using errcode='22023';
end $$;
revoke all on function public.registration_link(text,jsonb) from public,anon;
grant execute on function public.registration_link(text,jsonb) to authenticated;

create index on private.lead_registration_links(lead_id);
create index on private.lead_registration_links(created_by);
create index on private.lead_registration_links(used_by);
create index on private.lead_registration_links(child_id);
create index on private.lead_registration_links(enquiry_id);
