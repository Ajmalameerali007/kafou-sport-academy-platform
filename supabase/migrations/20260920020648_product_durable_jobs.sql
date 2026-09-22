-- Synthetic staging only. No control rows, cron extension, cron jobs or external sends are installed.
-- Workers have NO user JWT. Approval and original broadcast creator are recorded separately.
create table private.scheduled_job_controls (
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches,
 target_ref text not null check(target_ref in ('kafou-local','cwdazidovxqeevmpicng')),
 enabled boolean not null, approved_by uuid not null references public.profiles,
 reason text not null check(length(trim(reason)) between 8 and 300),
 created_at timestamptz not null default clock_timestamp()
);
create index scheduled_controls_branch on private.scheduled_job_controls(branch_id,created_at desc,id desc);
create index scheduled_controls_approver on private.scheduled_job_controls(approved_by);
create table private.scheduled_jobs (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('broadcast','renewal','waitlist_expiry')),
 entity_id uuid not null, branch_id uuid not null references public.branches,
 state text not null default 'pending' check(state in ('pending','retry','succeeded','cancelled','staff_review','failed')),
 failures int not null default 0, next_attempt_at timestamptz not null default now(),
 last_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(kind,entity_id)
);
create index scheduled_jobs_branch on private.scheduled_jobs(branch_id);
create index scheduled_jobs_due on private.scheduled_jobs(next_attempt_at,id) where state in ('pending','retry');
create table private.scheduled_job_runs (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references private.scheduled_jobs,
 control_id uuid not null references private.scheduled_job_controls,
 creator_id uuid references public.profiles,
 outcome text not null check(outcome in ('continued','succeeded','cancelled','staff_review','retry','failed')),
 error_code text check(error_code is null or error_code ~ '^[A-Z0-9_]{2,40}$'),
 affected int not null default 0, started_at timestamptz not null, finished_at timestamptz not null default clock_timestamp()
);
create index scheduled_runs_job on private.scheduled_job_runs(job_id,started_at desc);
create index scheduled_runs_control on private.scheduled_job_runs(control_id);
create index scheduled_runs_creator on private.scheduled_job_runs(creator_id);
create table private.scheduled_job_effects (
 job_id uuid not null references private.scheduled_jobs, event_id uuid not null references public.product_events,
 primary key(job_id,event_id)
);
create index scheduled_effect_event on private.scheduled_job_effects(event_id);
do $$declare t text;begin foreach t in array array['scheduled_job_controls','scheduled_jobs','scheduled_job_runs','scheduled_job_effects'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
end loop;end $$;
create function private.scheduled_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Scheduler history is append only' using errcode='42501';end$$;
create trigger controls_immutable before update or delete on private.scheduled_job_controls for each row execute function private.scheduled_immutable();
create trigger runs_immutable before update or delete on private.scheduled_job_runs for each row execute function private.scheduled_immutable();
create trigger effects_immutable before update or delete on private.scheduled_job_effects for each row execute function private.scheduled_immutable();

-- Explicit actor lookup, never simulated auth.uid() or AAL2. This checks authority for a previously
-- approved unattended task; interactive approval still requires the real owner's current AAL2.
create function private.scheduled_owner_current(p_actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.role_assignments r on r.user_id=p.id where p.id=p_actor and p.active and r.role='super_admin')
$$;
create function private.scheduled_broadcaster_current(p_actor uuid,p_branch uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_actor and p.active and (
 exists(select 1 from public.role_assignments r where r.user_id=p.id and r.role='super_admin') or
 (exists(select 1 from public.role_assignments r where r.user_id=p.id and r.role='admin') and exists(select 1 from public.product_permissions x where x.user_id=p.id and x.permission='communications.broadcast' and (x.branch_id is null or x.branch_id=p_branch)))))
$$;
create function private.configure_scheduled_jobs(p_branch uuid,p_enabled boolean,p_target text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 perform private.require_access(private.active() and private.super_admin() and private.mfa_ready());
 if p_target not in ('kafou-local','cwdazidovxqeevmpicng') or p_target is null or p_enabled is null or length(trim(p_reason)) not between 8 and 300 or p_reason is null then raise exception 'Explicit synthetic staging target and reason required' using errcode='22023';end if;
 if auth.jwt()->>'iss' is distinct from (case p_target when 'kafou-local' then 'http://127.0.0.1:56321/auth/v1' else 'https://cwdazidovxqeevmpicng.supabase.co/auth/v1' end) then raise exception 'Validated owner session belongs to a different environment' using errcode='42501';end if;
 if not exists(select 1 from public.branches where id=p_branch and (not p_enabled or (active and not provisional and synthetic))) then raise exception 'Confirmed active branch required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 insert into private.scheduled_job_controls(branch_id,target_ref,enabled,approved_by,reason) values(p_branch,p_target,p_enabled,auth.uid(),trim(p_reason)) returning id into rid;
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(auth.uid(),'SCHEDULER_APPROVAL','scheduled_job_controls',rid::text,jsonb_build_object('enabled',p_enabled,'branch_id',p_branch,'target_ref',p_target));
 return rid;
end$$;
create function public.scheduler_configure(p_branch uuid,p_enabled boolean,p_target text,p_reason text) returns uuid language sql security invoker set search_path='' as $$select private.configure_scheduled_jobs(p_branch,p_enabled,p_target,p_reason)$$;

create function private.current_scheduled_controls(p_target text) returns setof private.scheduled_job_controls language sql stable security definer set search_path='' as $$
 select c.* from (select distinct on(branch_id) * from private.scheduled_job_controls order by branch_id,created_at desc,id desc) c
 join public.branches b on b.id=c.branch_id where c.target_ref=p_target and c.enabled and b.active and not b.provisional and b.synthetic and private.scheduled_owner_current(c.approved_by)
$$;

-- Only a database owner/cron SQL job can enter this boundary. JWT-bearing human sessions are rejected.
-- Bounded work is committed atomically with its attempt and effects. A failed item rolls back alone.
create function private.run_scheduled_jobs(p_target text,p_limit integer default 20) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.scheduled_jobs;ctl private.scheduled_job_controls;batch public.communication_batches;tmpl public.communication_templates;
 rec public.communication_recipients;member public.commercial_memberships;waiting public.waitlist_entries;
 started timestamptz;result_state text;code text;affected int;processed int:=0;eid uuid;nid uuid;reminder uuid;creator uuid;today date:=(now() at time zone 'Asia/Dubai')::date;
begin
 if auth.uid() is not null then raise exception 'Worker requires a system database connection without a user JWT' using errcode='42501';end if;
 if p_target not in ('kafou-local','cwdazidovxqeevmpicng') or p_target is null or p_limit is null or p_limit not between 1 and 25 then raise exception 'Invalid bounded synthetic worker request' using errcode='22023';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('kafou-operational-writes',0)) then return jsonb_build_object('status','busy','processed',0);end if;
 if not exists(select 1 from private.current_scheduled_controls(p_target)) then return jsonb_build_object('status','disabled','processed',0);end if;
 insert into private.scheduled_jobs(kind,entity_id,branch_id)
 select 'broadcast',b.id,b.branch_id from public.communication_batches b join private.current_scheduled_controls(p_target) c on c.branch_id=b.branch_id
 where b.status='scheduled' and b.scheduled_at<=now() and not exists(select 1 from private.scheduled_jobs j0 where j0.kind='broadcast' and j0.entity_id=b.id)
 order by b.scheduled_at,b.id limit 50 on conflict do nothing;
 insert into private.scheduled_jobs(kind,entity_id,branch_id)
 select 'renewal',m.id,m.branch_id from public.commercial_memberships m join private.current_scheduled_controls(p_target) c on c.branch_id=m.branch_id join public.commercial_packages p on p.id=m.package_id
 where m.status='active' and m.expires_on between today and today+7 and p.policy_status='synthetic' and not exists(select 1 from public.commercial_memberships n where n.renewed_from=m.id)
 and not exists(select 1 from public.commercial_renewal_reminders r where r.membership_id=m.id)
 and not exists(select 1 from private.scheduled_jobs j0 where j0.kind='renewal' and j0.entity_id=m.id)
 order by m.expires_on,m.id limit 50 on conflict do nothing;
 insert into private.scheduled_jobs(kind,entity_id,branch_id)
 select 'waitlist_expiry',w.id,a.branch_id from public.waitlist_entries w join public.class_sessions s on s.id=w.session_id join public.academy_classes a on a.id=s.class_id join private.current_scheduled_controls(p_target) c on c.branch_id=a.branch_id
 where w.status='offered' and w.offered_until<=now() and exists(select 1 from public.children k join public.families f on f.id=k.family_id where k.id=w.child_id and k.synthetic and f.synthetic) and not exists(select 1 from private.scheduled_jobs j0 where j0.kind='waitlist_expiry' and j0.entity_id=w.id)
 order by w.offered_until,w.id limit 50 on conflict do nothing;
 for j in select x.* from private.scheduled_jobs x join private.current_scheduled_controls(p_target) c on c.branch_id=x.branch_id where x.state in ('pending','retry') and x.next_attempt_at<=now() order by x.next_attempt_at,x.id limit p_limit for update of x skip locked loop
 select * into ctl from private.current_scheduled_controls(p_target) where branch_id=j.branch_id;
 if ctl.id is null then continue;end if;
 started:=clock_timestamp();result_state:='succeeded';code:=null;affected:=0;creator:=null;
 begin
 if j.kind='broadcast' then
 select * into batch from public.communication_batches where id=j.entity_id for update;creator:=batch.created_by;
 if batch.id is null or batch.status<>'scheduled' or batch.scheduled_at>now() then result_state:='cancelled';code:='BATCH_NOT_DUE';
 elsif not private.scheduled_broadcaster_current(batch.created_by,batch.branch_id) then result_state:='cancelled';code:='CREATOR_AUTHORITY_REVOKED';
 else
 select * into tmpl from public.communication_templates where id=batch.template_id;
 for rec in select * from public.communication_recipients where batch_id=batch.id and status='queued' order by id limit 100 for update loop
 if not exists(select 1 from private.communication_audience(batch.branch_id,tmpl.purpose) a where a.user_id=rec.user_id and a.family_id=rec.family_id and exists(select 1 from public.families f where f.id=a.family_id and f.synthetic) and exists(select 1 from public.profiles p where p.id=a.user_id and p.synthetic)) then
 update public.communication_recipients set status='revoked' where id=rec.id;
 else
 insert into public.product_events(kind,entity_id,family_id,branch_id,actor_id) values('communication.published',batch.id,rec.family_id,batch.branch_id,null) on conflict(kind,entity_id,family_id) do update set kind=excluded.kind returning id into eid;
 insert into public.notifications(event_id,recipient_id,title,body,href) values(eid,rec.user_id,tmpl.subject,tmpl.body,'/parent?view=Notifications') on conflict(event_id,recipient_id) do update set event_id=excluded.event_id returning id into nid;
 insert into public.delivery_outbox(event_id,recipient_id,channel) select eid,rec.user_id,c.channel from(values('email'),('whatsapp'),('push')) c(channel) on conflict do nothing;
 insert into private.scheduled_job_effects(job_id,event_id) values(j.id,eid) on conflict do nothing;
 update public.communication_recipients set status='sent',notification_id=nid where id=rec.id;
 end if;affected:=affected+1;
 end loop;
 if exists(select 1 from public.communication_recipients where batch_id=batch.id and status='queued') then result_state:='continued';else update public.communication_batches set status='sent',sent_at=now() where id=batch.id;end if;
 end if;
 elsif j.kind='renewal' then
 select * into member from public.commercial_memberships where id=j.entity_id for update;
 if member.id is null or member.status<>'active' or member.expires_on not between today and today+7 or exists(select 1 from public.commercial_memberships where renewed_from=member.id)
 or not exists(select 1 from public.commercial_packages where id=member.package_id and policy_status='synthetic')
 or not exists(select 1 from public.family_branches where family_id=member.family_id and branch_id=member.branch_id)
 or not exists(select 1 from public.children where id=member.child_id and family_id=member.family_id and synthetic)
 or not exists(select 1 from public.families where id=member.family_id and synthetic) then result_state:='cancelled';code:='MEMBERSHIP_NO_LONGER_ELIGIBLE';
 else
 insert into public.commercial_renewal_reminders(membership_id,due_on) values(member.id,member.expires_on-7) on conflict(membership_id) do nothing returning id into reminder;
 if reminder is not null then
 insert into public.product_events(kind,entity_id,family_id,branch_id,actor_id) values('membership.renewal_due',reminder,member.family_id,member.branch_id,null) on conflict(kind,entity_id,family_id) do update set kind=excluded.kind returning id into eid;
 insert into public.notifications(event_id,recipient_id,title,body,href) select eid,g.user_id,'Membership renewal due','Your membership ends within seven days. Review the next month and explicitly accept its package.','/parent?view=Memberships' from public.guardians g join public.profiles p on p.id=g.user_id where g.family_id=member.family_id and p.active and p.synthetic and exists(select 1 from public.role_assignments r where r.user_id=p.id and r.role='parent') on conflict do nothing;
 insert into public.delivery_outbox(event_id,recipient_id,channel) select eid,n.recipient_id,c.channel from public.notifications n cross join(values('email'),('whatsapp'),('push')) c(channel) where n.event_id=eid on conflict do nothing;
 insert into private.scheduled_job_effects(job_id,event_id) values(j.id,eid) on conflict do nothing;affected:=1;
 end if;end if;
 else
 select * into waiting from public.waitlist_entries where id=j.entity_id for update;
 if waiting.status='offered' and waiting.offered_until<=now() and exists(select 1 from public.children k join public.families f on f.id=k.family_id where k.id=waiting.child_id and k.synthetic and f.synthetic) then update public.waitlist_entries set status='expired' where id=waiting.id;affected:=1;result_state:='staff_review';code:='NEXT_OFFER_REQUIRES_STAFF';
 else result_state:='cancelled';code:='OFFER_NO_LONGER_EXPIRED';end if;
 end if;
 exception when others then
 get stacked diagnostics code=returned_sqlstate;
 result_state:=case when j.failures+1>=5 then 'failed' else 'retry' end;affected:=0;
 end;
 update private.scheduled_jobs set state=case when result_state='continued' then 'pending' else result_state end,
 failures=case when result_state in ('retry','failed') then failures+1 else 0 end,
 next_attempt_at=case when result_state='retry' then now()+make_interval(secs=>least(3600,30*(2^least(j.failures,6))::int)) else now() end,
 last_code=code,updated_at=clock_timestamp() where id=j.id;
 insert into private.scheduled_job_runs(job_id,control_id,creator_id,outcome,error_code,affected,started_at) values(j.id,ctl.id,creator,result_state,code,affected,started);
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value) values(null,'SYSTEM_JOB','scheduled_jobs',j.id::text,jsonb_build_object('kind',j.kind,'state',result_state,'control_id',ctl.id,'approved_by',ctl.approved_by,'creator_id',creator,'affected',affected,'code',code));
 processed:=processed+1;
 end loop;
 return jsonb_build_object('status','processed','processed',processed,'external_delivery','not_configured');
end$$;

create function private.scheduled_jobs_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare clock_active boolean:=false;clock_table regclass;begin
 perform private.require_access(private.active() and private.super_admin() and private.mfa_ready());
 clock_table:=to_regclass('cron.job');
 if clock_table is not null then execute format('select coalesce(bool_or(active),false) from %s where jobname=''kafou-synthetic-inapp'' and database=current_database()',clock_table) into clock_active;end if;
 return jsonb_build_object('clock_active',clock_active,'last_success',(select max(finished_at) from private.scheduled_job_runs where outcome in ('succeeded','staff_review')),'controls',coalesce((select jsonb_agg(x) from (select distinct on(c.branch_id) c.id,c.branch_id,c.target_ref,c.enabled,c.approved_by,c.created_at,(c.enabled and b.active and not b.provisional and b.synthetic and private.scheduled_owner_current(c.approved_by)) effective_enabled from private.scheduled_job_controls c join public.branches b on b.id=c.branch_id order by c.branch_id,c.created_at desc,c.id desc) x),'[]'::jsonb),
 'counts',coalesce((select jsonb_object_agg(state,n) from(select state,count(*) n from private.scheduled_jobs group by state) q),'{}'::jsonb),
 'recent_runs',coalesce((select jsonb_agg(x) from(select r.id,r.job_id,j.kind,j.entity_id,j.branch_id,r.control_id,r.creator_id,r.outcome,r.error_code,r.affected,r.started_at,r.finished_at from private.scheduled_job_runs r join private.scheduled_jobs j on j.id=r.job_id order by r.started_at desc,r.id limit 50) x),'[]'::jsonb),
 'staff_queue',coalesce((select jsonb_agg(x) from(select j.id,j.entity_id,w.session_id,j.branch_id,j.updated_at from private.scheduled_jobs j join public.waitlist_entries w on w.id=j.entity_id where j.state='staff_review' order by j.updated_at,j.id limit 50) x),'[]'::jsonb));
end$$;
create function public.scheduler_status() returns jsonb language sql stable security invoker set search_path='' as $$select private.scheduled_jobs_status()$$;
revoke all on function private.scheduled_immutable(),private.scheduled_owner_current(uuid),private.scheduled_broadcaster_current(uuid,uuid),private.current_scheduled_controls(text),private.run_scheduled_jobs(text,integer) from public,anon,authenticated,service_role;
revoke all on function private.configure_scheduled_jobs(uuid,boolean,text,text),private.scheduled_jobs_status(),public.scheduler_configure(uuid,boolean,text,text),public.scheduler_status() from public,anon,authenticated,service_role;
grant execute on function private.configure_scheduled_jobs(uuid,boolean,text,text),private.scheduled_jobs_status(),public.scheduler_configure(uuid,boolean,text,text),public.scheduler_status() to authenticated;
