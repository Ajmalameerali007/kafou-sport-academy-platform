-- KAFOU is a single-organization academy. Authorization comes from live records.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
create type public.academy_role as enum ('super_admin','admin','sales','branch','coach','parent');
create type public.sport_id as enum ('swimming','football','karate','badminton');
create table public.organizations(id uuid primary key default gen_random_uuid(), slug text unique not null check(slug='kafou'), name text not null);
create function private.org_id() returns uuid language sql stable security definer set search_path='' as $$ select id from public.organizations where slug='kafou' $$;
create table public.profiles(id uuid primary key references auth.users on delete restrict, organization_id uuid not null default private.org_id() references public.organizations, name text not null, mobile text not null default '', active boolean not null default true, created_at timestamptz not null default now());
create table public.branches(id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.org_id() references public.organizations, slug text unique not null check(slug ~ '^[a-z0-9-]+$'), name text not null check(length(name) between 2 and 100), name_ar text not null default '', area text not null default '', provisional boolean not null default true, active boolean not null default true);
create table public.venues(id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches, name text not null, address text not null, operating_information text not null default '');
create table public.branch_sports(branch_id uuid references public.branches, sport public.sport_id not null, primary key(branch_id,sport));
create table public.role_assignments(user_id uuid references public.profiles, role public.academy_role, primary key(user_id,role));
create table public.branch_permissions(user_id uuid references public.profiles, branch_id uuid references public.branches, primary key(user_id,branch_id));
create table public.families(id uuid primary key default gen_random_uuid(), organization_id uuid not null default private.org_id() references public.organizations, name text not null, mobile text not null default '', email text not null default '', created_at timestamptz not null default now());
create table public.guardians(family_id uuid references public.families, user_id uuid references public.profiles, primary key(family_id,user_id));
create table public.family_branches(family_id uuid references public.families, branch_id uuid references public.branches, primary key(family_id,branch_id));
create table public.children(id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families, name text not null check(length(name) between 2 and 100), dob date check(dob > '1900-01-01'), reported_age int check(reported_age between 1 and 17), age_captured_on date, created_at timestamptz not null default now());
create table public.child_sports(id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children, sport public.sport_id not null, level text, status text not null default 'interest' check(status in ('interest','reviewed')), unique(child_id,sport));
create table public.leads(id uuid primary key default gen_random_uuid(), branch_id uuid references public.branches, assigned_to uuid references public.profiles, parent_name text not null, mobile text not null, email text not null default '', source text not null default 'website' check(source in ('website','social','whatsapp','phone','walk_in','referral','ai')), stage text not null default 'new' check(stage in ('new','contacted','interested','trial_offered','lost')), lost_reason text, follow_up_at timestamptz, duplicate_review boolean not null default false, family_id uuid references public.families, created_at timestamptz not null default now());
create table public.trial_enquiries(id uuid primary key default gen_random_uuid(), lead_id uuid not null unique references public.leads, submitted_by uuid references public.profiles, child_id uuid references public.children, child_name text not null, reported_age int not null check(reported_age between 1 and 17), age_captured_on date not null default current_date, sport public.sport_id not null, experience text not null check(experience in ('beginner','some','training','unsure')), status text not null default 'requested' check(status='requested'), reference text unique not null default ('KAF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))), created_at timestamptz not null default now());
create table public.lead_activities(id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads, actor_id uuid references public.profiles, kind text not null, note text not null, created_at timestamptz not null default now());
create table public.consent_records(id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families, actor_id uuid not null references public.profiles, kind text not null check(kind in ('privacy','contact','media')), version text not null, granted boolean not null, created_at timestamptz not null default now());
create table public.staff_invitations(id uuid primary key default gen_random_uuid(), email text not null, role public.academy_role not null check(role <> 'parent'), branch_ids uuid[] not null default '{}', invited_by uuid not null references public.profiles, auth_user_id uuid, expires_at timestamptz not null default now()+interval '24 hours', accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now());
create table public.audit_events(id bigint generated always as identity primary key, actor_id uuid, action text not null, entity text not null, entity_id text, previous_value jsonb, new_value jsonb, created_at timestamptz not null default now());
create table private.request_keys(key uuid primary key, actor text not null, payload_hash text not null, response jsonb not null);
create table private.rate_limits(key text primary key, window_start timestamptz not null, hits int not null);

create function private.active() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and active and organization_id=private.org_id()) $$;
create function private.has_role(roles public.academy_role[]) returns boolean language sql stable security definer set search_path='' as $$ select private.active() and exists(select 1 from public.role_assignments where user_id=auth.uid() and role=any(roles)) $$;
create function private.head_office() returns boolean language sql stable security definer set search_path='' as $$ select private.has_role(array['admin','super_admin']::public.academy_role[]) and (not private.has_role(array['super_admin']::public.academy_role[]) or auth.jwt()->>'aal'='aal2') $$;
create function private.super_admin() returns boolean language sql stable security definer set search_path='' as $$ select private.has_role(array['super_admin']::public.academy_role[]) and auth.jwt()->>'aal'='aal2' $$;
create function private.branch_access(b uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.head_office() or (private.has_role(array['sales','branch']::public.academy_role[]) and exists(select 1 from public.branch_permissions where user_id=auth.uid() and branch_id=b)) $$;
create function private.family_owner(f uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.active() and exists(select 1 from public.guardians where family_id=f and user_id=auth.uid()) $$;
create function private.family_access(f uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.family_owner(f) or private.head_office() or (private.has_role(array['branch']::public.academy_role[]) and exists(select 1 from public.family_branches fb join public.branch_permissions bp using(branch_id) where fb.family_id=f and bp.user_id=auth.uid())) $$;
create function private.require_access(ok boolean) returns void language plpgsql set search_path='' as $$ begin if not coalesce(ok,false) then raise exception 'Access denied' using errcode='42501'; end if; end $$;
-- Helpers are callable for policy evaluation, but never writable by application roles.
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- No direct mutation grants: domain commands below own validation, invariants and audit.
do $$ declare t text; begin foreach t in array array['organizations','profiles','branches','venues','branch_sports','role_assignments','branch_permissions','families','guardians','family_branches','children','child_sports','leads','trial_enquiries','lead_activities','consent_records','staff_invitations','audit_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop; end $$;
grant usage,select on sequence public.audit_events_id_seq to service_role;
create policy read_org on public.organizations for select to authenticated using(private.active());
create policy read_profiles on public.profiles for select to authenticated using(id=auth.uid() or private.super_admin());
create policy read_branches on public.branches for select to authenticated using(private.active() and (active or private.head_office()));
create policy read_venues on public.venues for select to authenticated using(private.branch_access(branch_id));
create policy read_sports on public.branch_sports for select to authenticated using(private.active());
create policy read_roles on public.role_assignments for select to authenticated using((user_id=auth.uid() and private.active()) or private.super_admin());
create policy read_permissions on public.branch_permissions for select to authenticated using((user_id=auth.uid() and private.active()) or private.super_admin());
create policy read_families on public.families for select to authenticated using(private.family_access(id));
create policy read_guardians on public.guardians for select to authenticated using(private.family_access(family_id));
create policy read_family_branches on public.family_branches for select to authenticated using(private.family_access(family_id));
create policy read_children on public.children for select to authenticated using(private.family_access(family_id));
create policy read_child_sports on public.child_sports for select to authenticated using(exists(select 1 from public.children c where c.id=child_id and private.family_access(c.family_id)));
create policy read_leads on public.leads for select to authenticated using(private.branch_access(branch_id));
create policy read_enquiries on public.trial_enquiries for select to authenticated using((submitted_by=auth.uid() and private.active()) or exists(select 1 from public.leads l where l.id=lead_id and private.branch_access(l.branch_id)));
create policy read_activities on public.lead_activities for select to authenticated using(exists(select 1 from public.leads l where l.id=lead_id and private.branch_access(l.branch_id)));
create policy read_consents on public.consent_records for select to authenticated using(private.family_access(family_id));
create policy read_invitations on public.staff_invitations for select to authenticated using(private.super_admin());
create policy read_audit on public.audit_events for select to authenticated using(private.head_office());

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare oldj jsonb; newj jsonb; begin
-- Field values containing names/contact/health/free text never enter the audit copy.
oldj := case when TG_OP='INSERT' then null else to_jsonb(old)-array['name','name_ar','parent_name','child_name','mobile','email','dob','note','address','operating_information','lost_reason'] end;
newj := case when TG_OP='DELETE' then null else to_jsonb(new)-array['name','name_ar','parent_name','child_name','mobile','email','dob','note','address','operating_information','lost_reason'] end;
insert into public.audit_events(actor_id,action,entity,entity_id,previous_value,new_value) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(newj->>'id',oldj->>'id',newj->>'user_id',oldj->>'user_id'),oldj,newj);
return coalesce(new,old); end $$;
do $$ declare t text; begin foreach t in array array['profiles','branches','venues','branch_sports','role_assignments','branch_permissions','families','guardians','family_branches','children','child_sports','leads','trial_enquiries','lead_activities','consent_records','staff_invitations'] loop execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t); end loop; end $$;
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin
insert into public.profiles(id,name,mobile) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'Parent'),100),left(coalesce(new.raw_user_meta_data->>'mobile',''),30));
insert into public.role_assignments(user_id,role) values(new.id,'parent'); return new; end $$;
create trigger create_profile after insert on auth.users for each row execute function private.create_profile();

create function public.account_context() returns jsonb language sql stable security invoker set search_path='' as $$ select jsonb_build_object('userId',auth.uid(),'active',p.active,'name',p.name,'roles',coalesce((select jsonb_agg(role) from public.role_assignments where user_id=auth.uid()),'[]'),'branchIds',coalesce((select jsonb_agg(branch_id) from public.branch_permissions where user_id=auth.uid()),'[]'),'aal',coalesce(auth.jwt()->>'aal','aal1')) from public.profiles p where p.id=auth.uid() $$;
create function public.branch_preferences() returns jsonb language sql stable security definer set search_path='' as $$ select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'name',name,'name_ar',name_ar,'area',area,'provisional',provisional) order by slug),'[]') from public.branches where active $$;

create function public.consume_rate_limit(p_key text,p_limit int,p_seconds int) returns boolean language plpgsql security definer set search_path='' as $$ declare n int; begin
if auth.role()<>'service_role' then raise exception 'Access denied' using errcode='42501'; end if;
insert into private.rate_limits(key,window_start,hits) values(p_key,now(),1) on conflict(key) do update set hits=case when private.rate_limits.window_start < now()-make_interval(secs=>p_seconds) then 1 else private.rate_limits.hits+1 end, window_start=case when private.rate_limits.window_start < now()-make_interval(secs=>p_seconds) then now() else private.rate_limits.window_start end returning hits into n;
return n<=p_limit; end $$;

create function public.submit_enquiry(p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid; lid uuid; eid uuid; ref text; existing private.request_keys; result jsonb; actor text:=coalesce(auth.uid()::text,'guest'); h text:=md5(p_data::text); cid uuid; begin
perform private.require_access(auth.role()='service_role' or private.active());
perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
select * into existing from private.request_keys where key=p_key;
if found then if existing.actor<>actor or existing.payload_hash<>h then raise exception 'Submission key conflict' using errcode='23505'; end if; return existing.response; end if;
if length(trim(p_data->>'parentName')) not between 2 and 100 or length(trim(p_data->>'childName')) not between 2 and 100 or coalesce(p_data->>'mobile','') !~ '^\+?[0-9 ()-]{9,25}$' or coalesce(p_data->>'age','') !~ '^[0-9]{1,2}$' then raise exception 'Invalid enquiry' using errcode='22023'; end if;
if nullif(p_data->>'preferredBranch','') is not null then select id into b from public.branches where slug=p_data->>'preferredBranch' and active; if b is null then raise exception 'Invalid branch' using errcode='22023'; end if; end if;
cid:=nullif(p_data->>'childId','')::uuid;
if cid is not null then perform private.require_access(exists(select 1 from public.children where id=cid and private.family_owner(family_id))); end if;
insert into public.leads(branch_id,parent_name,mobile,email,duplicate_review) values(b,trim(p_data->>'parentName'),trim(p_data->>'mobile'),left(coalesce(p_data->>'email',''),254),exists(select 1 from public.leads where mobile=trim(p_data->>'mobile'))) returning id into lid;
insert into public.trial_enquiries(lead_id,submitted_by,child_id,child_name,reported_age,sport,experience) values(lid,auth.uid(),cid,trim(p_data->>'childName'),(p_data->>'age')::int,(p_data->>'sport')::public.sport_id,coalesce(nullif(p_data->>'experience',''),'unsure')) returning id,reference into eid,ref;
insert into public.lead_activities(lead_id,actor_id,kind,note) values(lid,auth.uid(),'enquiry_received','Trial enquiry received; no session reserved.');
result:=jsonb_build_object('requestId',eid,'reference',ref,'status','requested');
insert into private.request_keys values(p_key,actor,h,result); return result; end $$;

-- A single transactional command boundary; every branch rechecks current database permissions.
create function public.academy_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid; c uuid; b uuid; l public.leads; r uuid; uid uuid; roles public.academy_role[]; bid uuid; inv public.staff_invitations; begin
perform private.require_access(private.active());
case p_action
when 'family.create' then
 perform private.require_access(private.has_role(array['parent']::public.academy_role[]));
 if exists(select 1 from public.guardians where user_id=auth.uid()) then raise exception 'Family already exists' using errcode='23505'; end if;
 insert into public.families(name,mobile,email) values(p_data->>'name',coalesce(p_data->>'mobile',''),coalesce(p_data->>'email','')) returning id into r;
 insert into public.guardians values(r,auth.uid());
when 'family.update' then
 f:=(p_data->>'id')::uuid; perform private.require_access(private.family_access(f));
 update public.families set name=p_data->>'name',mobile=coalesce(p_data->>'mobile',''),email=coalesce(p_data->>'email','') where id=f returning id into r;
when 'child.save' then
 f:=(p_data->>'family_id')::uuid; perform private.require_access(private.family_access(f));
 c:=nullif(p_data->>'id','')::uuid;
 if nullif(p_data->>'dob','')::date > current_date then raise exception 'Invalid birth date' using errcode='22023'; end if;
 if c is null then insert into public.children(family_id,name,dob,reported_age,age_captured_on) values(f,p_data->>'name',nullif(p_data->>'dob','')::date,nullif(p_data->>'reported_age','')::int,current_date) returning id into r;
 else update public.children set name=p_data->>'name',dob=nullif(p_data->>'dob','')::date,reported_age=nullif(p_data->>'reported_age','')::int,age_captured_on=current_date where id=c and family_id=f returning id into r; end if;
when 'child.sport' then
 c:=(p_data->>'child_id')::uuid; select family_id into f from public.children where id=c; perform private.require_access(private.family_access(f));
 if nullif(p_data->>'level','') is not null then perform private.require_access(private.head_office()); end if;
 insert into public.child_sports(child_id,sport,level,status) values(c,(p_data->>'sport')::public.sport_id,nullif(p_data->>'level',''),case when nullif(p_data->>'level','') is null then 'interest' else 'reviewed' end) on conflict(child_id,sport) do nothing returning id into r;
when 'consent.record' then
 f:=(p_data->>'family_id')::uuid; perform private.require_access(private.family_owner(f));
 insert into public.consent_records(family_id,actor_id,kind,version,granted) values(f,auth.uid(),p_data->>'kind','staging-v1',(p_data->>'granted')::boolean) returning id into r;
when 'lead.update' then
 select * into l from public.leads where id=(p_data->>'id')::uuid for update; perform private.require_access(private.branch_access(l.branch_id));
 b:=nullif(p_data->>'branch_id','')::uuid; if b is distinct from l.branch_id then perform private.require_access(private.head_office() and exists(select 1 from public.branches where id=b and active)); end if;
 uid:=nullif(p_data->>'assigned_to','')::uuid;
 if uid is not null then perform private.require_access(exists(select 1 from public.branch_permissions bp join public.profiles p on p.id=bp.user_id join public.role_assignments ra on ra.user_id=p.id where p.active and bp.user_id=uid and bp.branch_id=b and ra.role in ('sales','branch'))); end if;
 if p_data->>'stage'='lost' and length(trim(coalesce(p_data->>'lost_reason','')))<2 then raise exception 'Lost reason required' using errcode='22023'; end if;
 update public.leads set branch_id=b,assigned_to=uid,stage=p_data->>'stage',lost_reason=nullif(p_data->>'lost_reason',''),follow_up_at=nullif(p_data->>'follow_up_at','')::timestamptz where id=l.id returning id into r;
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'updated', 'Enquiry status or assignment updated.');
when 'lead.note' then
 select * into l from public.leads where id=(p_data->>'id')::uuid; perform private.require_access(private.branch_access(l.branch_id));
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'note',p_data->>'note') returning id into r;
when 'lead.convert' then
 select * into l from public.leads where id=(p_data->>'id')::uuid for update;
 perform private.require_access(private.head_office() or (private.has_role(array['branch']::public.academy_role[]) and private.branch_access(l.branch_id)));
 if l.family_id is not null then raise exception 'Already linked' using errcode='23505'; end if;
 f:=nullif(p_data->>'family_id','')::uuid;
 if f is not null then perform private.require_access(private.family_access(f)); else insert into public.families(name,mobile,email) values(l.parent_name,l.mobile,l.email) returning id into f; end if;
 if l.branch_id is not null then insert into public.family_branches values(f,l.branch_id) on conflict do nothing; end if;
 insert into public.children(family_id,name,reported_age,age_captured_on) select f,child_name,reported_age,age_captured_on from public.trial_enquiries where lead_id=l.id returning id into c;
 insert into public.child_sports(child_id,sport) select c,sport from public.trial_enquiries where lead_id=l.id;
 update public.leads set family_id=f where id=l.id;
 update public.trial_enquiries set child_id=c where lead_id=l.id;
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'family_linked','Family and child linked. No enrollment or sale created.'); r:=f;
when 'branch.save' then
 perform private.require_access(private.head_office());
 b:=nullif(p_data->>'id','')::uuid;
 if b is null then insert into public.branches(slug,name,name_ar,area,provisional) values(p_data->>'slug',p_data->>'name',coalesce(p_data->>'name_ar',''),coalesce(p_data->>'area',''),true) returning id into r;
 else update public.branches set name=p_data->>'name',name_ar=coalesce(p_data->>'name_ar',''),area=coalesce(p_data->>'area',''),provisional=(p_data->>'provisional')::boolean,active=(p_data->>'active')::boolean where id=b returning id into r; end if;
when 'venue.save' then
 perform private.require_access(private.head_office());
 insert into public.venues(branch_id,name,address,operating_information) values((p_data->>'branch_id')::uuid,p_data->>'name',p_data->>'address',coalesce(p_data->>'operating_information','')) returning id into r;
when 'branch.sports' then
 perform private.require_access(private.head_office()); b:=(p_data->>'branch_id')::uuid;
 delete from public.branch_sports where branch_id=b;
 insert into public.branch_sports select b,value::public.sport_id from jsonb_array_elements_text(p_data->'sports'); r:=b;
when 'staff.access' then
 perform private.require_access(private.super_admin()); uid:=(p_data->>'user_id')::uuid;
 perform private.require_access(uid<>auth.uid());
 roles:=array(select value::public.academy_role from jsonb_array_elements_text(p_data->'roles'));
 if cardinality(roles)=0 then raise exception 'At least one role required' using errcode='22023'; end if;
 update public.profiles set active=(p_data->>'active')::boolean where id=uid returning id into r;
 delete from public.role_assignments where user_id=uid;
 insert into public.role_assignments select uid,unnest(roles);
 delete from public.branch_permissions where user_id=uid;
 insert into public.branch_permissions select uid,value::uuid from jsonb_array_elements_text(p_data->'branch_ids');
when 'invitation.create' then
 perform private.require_access(private.super_admin());
 insert into public.staff_invitations(email,role,branch_ids,invited_by) values(lower(p_data->>'email'),(p_data->>'role')::public.academy_role,array(select value::uuid from jsonb_array_elements_text(p_data->'branch_ids')),auth.uid()) returning id into r;
when 'invitation.accept' then
 select * into inv from public.staff_invitations where id=(p_data->>'id')::uuid for update;
 perform private.require_access(inv.auth_user_id=auth.uid() and inv.revoked_at is null and inv.expires_at>now() and inv.accepted_at is null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null));
 insert into public.role_assignments values(auth.uid(),inv.role) on conflict do nothing;
 insert into public.branch_permissions select auth.uid(),unnest(inv.branch_ids) on conflict do nothing;
 update public.staff_invitations set accepted_at=now() where id=inv.id returning id into r;
else raise exception 'Unknown action' using errcode='22023'; end case;
if r is null then raise exception 'Record not found or unchanged' using errcode='P0002'; end if;
return jsonb_build_object('id',r); end $$;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.account_context() to authenticated;
grant execute on function public.branch_preferences() to anon,authenticated,service_role;
grant execute on function public.consume_rate_limit(text,int,int) to service_role;
grant execute on function public.submit_enquiry(jsonb,uuid) to authenticated,service_role;
grant execute on function public.academy_command(text,jsonb) to authenticated;
revoke all on all functions in schema private from public;
-- audit/auth triggers need no direct client execute permission.
revoke execute on function private.audit_change(),private.create_profile() from authenticated,service_role;
create index leads_branch_created on public.leads(branch_id,created_at desc);
create index leads_mobile on public.leads(mobile);
create index child_family on public.children(family_id);
create index activity_lead on public.lead_activities(lead_id,created_at);
create index enquiry_submitter on public.trial_enquiries(submitted_by);
