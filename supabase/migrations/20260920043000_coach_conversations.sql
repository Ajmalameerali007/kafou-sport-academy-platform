-- Child/enrollment conversations, separate from safety notes and support tickets.
-- Inactive until a real MFA owner approves a synthetic policy. No media attachments.
create table public.coach_message_policies(
 id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,
 version int not null,enabled boolean not null,review_required boolean not null default true,
 oversight boolean not null default true,approved_by uuid not null references public.profiles,
 created_at timestamptz not null default clock_timestamp(),unique(branch_id,version)
);
create table public.coach_conversations(
 id uuid primary key default gen_random_uuid(),enrollment_id uuid not null unique references public.enrollments,
 created_by uuid not null references public.profiles,escalated_at timestamptz,created_at timestamptz not null default now()
);
create table public.coach_messages(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.coach_conversations,
 author_id uuid not null references public.profiles,body text not null check(length(trim(body)) between 2 and 2000),
 policy_id uuid not null references public.coach_message_policies,request_key uuid not null,
 status text not null check(status in ('draft','published')),reviewed_by uuid references public.profiles,
 published_at timestamptz,created_at timestamptz not null default now(),unique(author_id,request_key),check((status='published')=(published_at is not null))
);
create table public.coach_message_reads(
 message_id uuid not null references public.coach_messages,user_id uuid not null references public.profiles,
 read_at timestamptz not null default now(),primary key(message_id,user_id)
);
create function private.coach_message_scope(eid uuid) returns text language sql stable security definer set search_path='' as $$
 select case when private.family_owner(k.family_id) and private.has_role(array['parent']::public.academy_role[]) then 'parent'
 when private.operations_staff(c.branch_id) and private.product_can('communications.coach',c.branch_id) and p.oversight then 'oversight'
 when p.enabled and n.status='active' and exists(select 1 from public.class_sessions s where s.class_id=c.id and private.development_coach_session(s.id)) then 'coach' end
 from public.enrollments n join public.children k on k.id=n.child_id join public.academy_classes c on c.id=n.class_id
 join lateral(select * from public.coach_message_policies where branch_id=c.branch_id order by version desc limit 1)p on true
 where n.id=eid and private.active() and private.mfa_ready()
$$;
create function private.coach_message_read(mid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.coach_messages m join public.coach_conversations c on c.id=m.conversation_id where m.id=mid and private.coach_message_scope(c.enrollment_id) is not null and (m.status='published' or m.author_id=auth.uid() or private.coach_message_scope(c.enrollment_id)='oversight'))
$$;
revoke all on function private.coach_message_scope(uuid),private.coach_message_read(uuid) from public,anon;
grant execute on function private.coach_message_scope(uuid),private.coach_message_read(uuid) to authenticated;
do $$declare t text;begin foreach t in array array['coach_message_policies','coach_conversations','coach_messages','coach_message_reads'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;end$$;
create policy coach_policy_read on public.coach_message_policies for select to authenticated using(private.active() and private.mfa_ready());
create policy coach_conversation_read on public.coach_conversations for select to authenticated using(private.coach_message_scope(enrollment_id) is not null);
create policy coach_message_select on public.coach_messages for select to authenticated using(private.coach_message_read(id));
create policy coach_message_receipt on public.coach_message_reads for select to authenticated using(private.coach_message_read(message_id));
create trigger coach_policy_immutable before update or delete on public.coach_message_policies for each row execute function private.immutable_record();
create function public.coach_conversation_command(p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.enrollments;c public.academy_classes;conv public.coach_conversations;msg public.coach_messages;p public.coach_message_policies;scope text;rid uuid;begin
 perform private.require_access(private.active() and private.mfa_ready());
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if p_action='policy' then
 perform private.require_access(private.super_admin() and auth.jwt()->>'aal'='aal2');
 if not exists(select 1 from public.branches where id=(p_data->>'branch_id')::uuid and synthetic and active and not provisional) then raise exception 'Confirmed synthetic branch required' using errcode='22023';end if;
 insert into public.coach_message_policies(branch_id,version,enabled,review_required,oversight,approved_by)
 select (p_data->>'branch_id')::uuid,coalesce(max(version),0)+1,(p_data->>'enabled')::boolean,(p_data->>'review_required')::boolean,true,auth.uid() from public.coach_message_policies where branch_id=(p_data->>'branch_id')::uuid returning id into rid;
 return jsonb_build_object('id',rid);
 end if;
 if p_action='open' then
 select * into n from public.enrollments where id=(p_data->>'enrollment_id')::uuid;
 else
 select * into conv from public.coach_conversations where id=(p_data->>'conversation_id')::uuid;
 select * into n from public.enrollments where id=conv.enrollment_id;
 end if;
 scope:=private.coach_message_scope(n.id);perform private.require_access(scope is not null);
 select * into c from public.academy_classes where id=n.class_id;
 select * into p from public.coach_message_policies where branch_id=c.branch_id order by version desc limit 1;
 if p_action='read' then
 insert into public.coach_message_reads(message_id,user_id) select m.id,auth.uid() from public.coach_messages m where m.conversation_id=conv.id and m.id in (select v::uuid from jsonb_array_elements_text(p_data->'message_ids') v limit 200) and m.status='published' and private.coach_message_read(m.id) on conflict do nothing;
 return jsonb_build_object('id',conv.id);
 end if;
 if not p.enabled or not private.scheduled_owner_current(p.approved_by) or n.status<>'active' then raise exception 'Conversation policy or enrollment is inactive' using errcode='P0409';end if;
 if p_action='open' then
 insert into public.coach_conversations(enrollment_id,created_by) values(n.id,auth.uid()) on conflict(enrollment_id) do update set enrollment_id=excluded.enrollment_id returning id into rid;
 elsif p_action='reply' then
 select * into msg from public.coach_messages where author_id=auth.uid() and request_key=p_key;
 if msg.id is not null then
 if msg.conversation_id<>conv.id or msg.body is distinct from trim(p_data->>'body') then raise exception 'Request key reused with changed message' using errcode='P0409';end if;return jsonb_build_object('id',msg.id);end if;
 insert into public.coach_messages(conversation_id,author_id,body,policy_id,request_key,status,published_at)
 values(conv.id,auth.uid(),trim(p_data->>'body'),p.id,p_key,case when scope='coach' and p.review_required then 'draft' else 'published' end,case when scope='coach' and p.review_required then null else now() end) returning id into rid;
 elsif p_action='publish' then
 perform private.require_access(scope='oversight');
 select * into msg from public.coach_messages where id=(p_data->>'id')::uuid and conversation_id=conv.id for update;
 perform private.require_access(msg.id is not null and msg.author_id<>auth.uid());
 -- Revoked authors cannot publish through an old queued draft.
 if not exists(select 1 from public.profiles pr join public.role_assignments ra on ra.user_id=pr.id join public.branch_permissions bp on bp.user_id=pr.id where pr.id=msg.author_id and pr.active and ra.role='coach' and bp.branch_id=c.branch_id and (c.coach_id=pr.id or exists(select 1 from public.coach_substitutions sub join public.class_sessions s on s.id=sub.session_id where s.class_id=c.id and sub.coach_id=pr.id and sub.revoked_at is null and now() between sub.starts_at and sub.ends_at))) then raise exception 'Coach assignment changed' using errcode='P0409';end if;
 update public.coach_messages set status='published',published_at=coalesce(published_at,now()),reviewed_by=auth.uid() where id=msg.id returning id into rid;
 elsif p_action='escalate' then
 update public.coach_conversations set escalated_at=coalesce(escalated_at,now()) where id=conv.id returning id into rid;
 else raise exception 'Unknown conversation action' using errcode='22023';end if;
 insert into public.audit_events(actor_id,action,entity,entity_id) values(auth.uid(),'COACH_MESSAGE_'||upper(p_action),'coach_conversations',coalesce(conv.id,rid)::text);
 return jsonb_build_object('id',rid);
end $$;
revoke all on function public.coach_conversation_command(text,jsonb,uuid) from public,anon;
grant execute on function public.coach_conversation_command(text,jsonb,uuid) to authenticated;
create index on public.coach_message_policies(approved_by);
create index on public.coach_conversations(created_by);
create index on public.coach_messages(conversation_id);
create index on public.coach_messages(policy_id);
create index on public.coach_messages(reviewed_by);
create index on public.coach_message_reads(user_id);
create function public.coach_conversation_options() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'child_name',k.name,'class_name',c.name,'scope',private.coach_message_scope(n.id),'enabled',p.enabled,'review_required',p.review_required) order by k.name),'[]')
 from public.enrollments n join public.children k on k.id=n.child_id join public.academy_classes c on c.id=n.class_id
 join lateral(select * from public.coach_message_policies where branch_id=c.branch_id order by version desc limit 1)p on true
 where private.coach_message_scope(n.id) is not null
$$;
revoke all on function public.coach_conversation_options() from public,anon;
grant execute on function public.coach_conversation_options() to authenticated;

create function public.coach_message_receipts(p_conversation uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]') from (select m.id,count(r.user_id) read_count from public.coach_messages m left join public.coach_message_reads r on r.message_id=m.id and r.user_id<>m.author_id where m.conversation_id=p_conversation and private.coach_message_read(m.id) group by m.id)x
$$;
revoke all on function public.coach_message_receipts(uuid) from public,anon;
grant execute on function public.coach_message_receipts(uuid) to authenticated;
