-- Shared product boundary. No hosted data is seeded by migrations.
create table public.product_permissions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,permission text not null check(permission ~ '^[a-z]+\.[a-z_]+$'),branch_id uuid references public.branches,granted_by uuid references public.profiles,created_at timestamptz not null default now(),unique nulls not distinct(user_id,permission,branch_id));
create function private.product_can(p_permission text,p_branch uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select private.mfa_ready() and private.active() and (private.super_admin() or (
 private.has_role(array['admin','branch','coach']::public.academy_role[]) and exists(select 1 from public.product_permissions p where p.user_id=auth.uid() and p.permission=p_permission and (p.branch_id is null or p.branch_id=p_branch)) and (private.head_office() or exists(select 1 from public.branch_permissions b where b.user_id=auth.uid() and (p_branch is null or b.branch_id=p_branch)))))
$$;
create table public.product_events(id uuid primary key default gen_random_uuid(),kind text not null,entity_id uuid not null,family_id uuid references public.families,branch_id uuid references public.branches,actor_id uuid references public.profiles,created_at timestamptz not null default now(),unique nulls not distinct(kind,entity_id,family_id));
create table public.notifications(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.product_events,recipient_id uuid not null references public.profiles,title text not null,body text not null,href text not null check(href like '/%'),read_at timestamptz,created_at timestamptz not null default now(),unique(event_id,recipient_id));
create table public.delivery_outbox(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.product_events,recipient_id uuid not null references public.profiles,channel text not null check(channel in ('email','whatsapp','push')),status text not null default 'not_configured' check(status in ('queued','sent','delivered','failed','not_configured')),attempts int not null default 0,next_attempt_at timestamptz,last_error_code text,created_at timestamptz not null default now(),unique(event_id,recipient_id,channel));
create table private.product_requests(actor_id uuid not null references public.profiles,key uuid not null,payload_hash text not null,access_hash text not null,response jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,key));
create function private.emit_product_event(p_kind text,p_entity uuid,p_family uuid,p_branch uuid,p_title text,p_body text,p_href text) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid; begin
 insert into public.product_events(kind,entity_id,family_id,branch_id,actor_id) values(p_kind,p_entity,p_family,p_branch,auth.uid()) on conflict(kind,entity_id,family_id) do nothing returning id into eid;
 if eid is null then select id into eid from public.product_events where kind=p_kind and entity_id=p_entity and family_id is not distinct from p_family; return eid; end if;
 insert into public.notifications(event_id,recipient_id,title,body,href) select eid,g.user_id,left(p_title,160),left(p_body,800),p_href from public.guardians g join public.profiles p on p.id=g.user_id where g.family_id=p_family and p.active and exists(select 1 from public.role_assignments r where r.user_id=p.id and r.role='parent') on conflict do nothing;
 insert into public.delivery_outbox(event_id,recipient_id,channel) select eid,n.recipient_id,c.channel from public.notifications n cross join (values('email'),('whatsapp'),('push')) c(channel) where n.event_id=eid on conflict do nothing;
 return eid;
end $$;
create function public.product_command(p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.product_requests; result jsonb; fingerprint text; access_fingerprint text; begin
 perform private.require_access(private.active() and private.mfa_ready());
 if p_key is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>24000 then raise exception 'Invalid command' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if p_action='academy.session.move' then raise exception 'Use schedule.move with entitlement reconciliation' using errcode='P0409';end if;
 if split_part(p_action,'.',1)='coach_attendance' then perform private.require_access(private.coach_attendance_access((p_data->>'session_id')::uuid));end if;
 if p_action='communication.preview' then return private.communication_command(p_action,p_data);end if;
 if p_action='schedule.preview' then return private.operations_extension_command(p_action,p_data);end if;
 access_fingerprint:=private.product_access_revision();
 fingerprint:=md5(p_action||p_data::text);
 select * into old from private.product_requests where actor_id=auth.uid() and key=p_key;
 if found then if old.access_hash is distinct from access_fingerprint then raise exception 'Access changed; submit a newly authorized request' using errcode='42501';end if; if old.payload_hash<>fingerprint then raise exception 'Idempotency mismatch' using errcode='P0409'; end if;return old.response;end if;
 case split_part(p_action,'.',1)
 when 'commercial' then result:=private.commercial_command(p_action,p_data);
 when 'coach_attendance' then result:=private.coach_attendance_command(p_action,p_data);
 when 'academy' then result:=private.academy_command(p_action,p_data);
 when 'development' then result:=private.development_command(p_action,p_data);
 when 'community' then result:=private.community_command(p_action,p_data);
 when 'files' then result:=private.files_command(p_action,p_data);
 when 'communication' then result:=private.communication_command(p_action,p_data);
 when 'schedule' then result:=private.operations_extension_command(p_action,p_data);
 when 'engagement' then result:=private.engagement_command(p_action,p_data);
 when 'events' then result:=private.events_command(p_action,p_data);
 when 'permission' then
 perform private.require_access(private.super_admin());
 if p_action='permission.grant' then
 insert into public.product_permissions(user_id,permission,branch_id,granted_by) values((p_data->>'user_id')::uuid,p_data->>'permission',nullif(p_data->>'branch_id','')::uuid,auth.uid()) on conflict do nothing;
 elsif p_action='permission.revoke' then delete from public.product_permissions where id=(p_data->>'id')::uuid;
 else raise exception 'Unknown command' using errcode='22023';end if;
 result:=jsonb_build_object('saved',true);
 else raise exception 'Unknown command' using errcode='22023';end case;
 insert into private.product_requests(actor_id,key,payload_hash,access_hash,response) values(auth.uid(),p_key,fingerprint,private.product_access_revision(),result);
 return result;
end $$;
create function private.product_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb; begin
 v:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(auth.uid(),tg_op,tg_table_name,v->>'id',jsonb_build_object('status',v->>'status','record_id',v->>'id'));
 return null;
end $$;
revoke all on function private.product_can(text,uuid),private.emit_product_event(text,uuid,uuid,uuid,text,text,text),private.product_audit() from public,anon,authenticated;
grant execute on function private.product_can(text,uuid) to authenticated,service_role;
revoke all on function public.product_command(text,jsonb,uuid) from public,anon;
grant execute on function public.product_command(text,jsonb,uuid) to authenticated;
alter table private.product_requests enable row level security;
do $$ declare t text;begin foreach t in array array['product_permissions','product_events','notifications','delivery_outbox'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;end $$;
create policy permission_read on public.product_permissions for select to authenticated using(private.mfa_ready() and private.active() and (user_id=auth.uid() or private.super_admin()));
create policy event_read on public.product_events for select to authenticated using(private.head_office() or private.operations_staff(branch_id) or private.family_owner(family_id));
create policy notification_read on public.notifications for select to authenticated using(private.active() and private.mfa_ready() and recipient_id=auth.uid() and exists(select 1 from public.product_events e where e.id=event_id and private.family_owner(e.family_id)));
create policy outbox_read on public.delivery_outbox for select to authenticated using(private.head_office() or (recipient_id=auth.uid() and private.active() and private.mfa_ready() and exists(select 1 from public.product_events e where e.id=event_id and private.family_owner(e.family_id))));
create trigger product_permission_audit after insert or update or delete on public.product_permissions for each row execute function private.product_audit();
