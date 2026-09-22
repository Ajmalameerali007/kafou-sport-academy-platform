-- Reuse the durable worker, run history, retries and current scheduler approval.
-- No policy or schedule is enabled by this migration.
create table public.development_automation_policies(
 id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,
 kind text not null check(kind in ('monthly_report','completion_certificate')),
 version int not null check(version>0),enabled boolean not null,
 approved_by uuid not null references public.profiles,created_at timestamptz not null default clock_timestamp(),
 title text not null check(length(title) between 2 and 120),unique(branch_id,kind,version)
);
alter table public.development_automation_policies enable row level security;
revoke all on public.development_automation_policies from public,anon,authenticated;
grant select on public.development_automation_policies to authenticated;
create policy automation_policy_read on public.development_automation_policies for select to authenticated using(private.head_office());
create trigger automation_policy_immutable before update or delete on public.development_automation_policies for each row execute function private.immutable_record();
create function public.development_automation_configure(p_branch uuid,p_kind text,p_enabled boolean,p_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 perform private.require_access(private.super_admin() and auth.jwt()->>'aal'='aal2');
 if not exists(select 1 from public.branches where id=p_branch and synthetic and active and not provisional) then raise exception 'Confirmed synthetic branch required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 insert into public.development_automation_policies(branch_id,kind,version,enabled,approved_by,title)
 select p_branch,p_kind,coalesce(max(version),0)+1,p_enabled,auth.uid(),p_title from public.development_automation_policies where branch_id=p_branch and kind=p_kind returning id into rid;
 return rid;
end $$;
revoke all on function public.development_automation_configure(uuid,text,boolean,text) from public,anon;
grant execute on function public.development_automation_configure(uuid,text,boolean,text) to authenticated;
create table private.development_automation_candidates(
 id uuid primary key default gen_random_uuid(),policy_id uuid not null references public.development_automation_policies,
 source_key text not null,child_id uuid not null references public.children,sport public.sport_id not null,
 month date,history_id uuid references public.development_level_history,
 unique(policy_id,source_key),check(num_nonnulls(month,history_id)=1)
);
revoke all on private.development_automation_candidates from public,anon,authenticated,service_role;
alter table public.development_reports add column automation_policy_id uuid references public.development_automation_policies;
alter table public.development_certificates add column automation_policy_id uuid references public.development_automation_policies;
create unique index one_automated_month on public.development_reports(child_id,sport,month) where automation_policy_id is not null;
create unique index one_automated_achievement on public.development_certificates(assessment_id) where automation_policy_id is not null;
alter table private.scheduled_jobs drop constraint scheduled_jobs_kind_check;
alter table private.scheduled_jobs add constraint scheduled_jobs_kind_check check(kind in ('broadcast','renewal','waitlist_expiry','monthly_report','completion_certificate'));
create function private.current_development_policies() returns setof public.development_automation_policies language sql stable security definer set search_path='' as $$
 select p.* from (select distinct on(branch_id,kind) * from public.development_automation_policies order by branch_id,kind,version desc) p
 where p.enabled and private.scheduled_owner_current(p.approved_by)
$$;
create function private.discover_development_jobs(p_target text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into private.development_automation_candidates(policy_id,source_key,child_id,sport,month)
 select p.id,a.child_id::text||':'||c.sport::text||':'||date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date::text,a.child_id,c.sport,date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date
 from public.development_assessments a join public.class_sessions s on s.id=a.session_id join public.academy_classes c on c.id=s.class_id
 join private.current_development_policies() p on p.branch_id=c.branch_id and p.kind='monthly_report'
 join private.current_scheduled_controls(p_target) ctl on ctl.branch_id=c.branch_id join public.children k on k.id=a.child_id join public.families f on f.id=k.family_id
 where not exists(select 1 from private.development_automation_candidates q where q.policy_id=p.id and q.child_id=a.child_id and q.sport=c.sport and q.month=date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date) and a.status='published' and k.synthetic and f.synthetic and s.status<>'cancelled'
 and s.starts_at < date_trunc('month',now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai'
 and not exists(select 1 from public.development_reports r where r.child_id=a.child_id and r.sport=c.sport and r.month=date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date and r.automation_policy_id is not null)
 group by p.id,a.child_id,c.sport,date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date
 order by date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date,a.child_id limit 50 on conflict do nothing;
 insert into private.development_automation_candidates(policy_id,source_key,child_id,sport,history_id)
 select p.id,h.id::text,h.child_id,h.sport,h.id from public.development_level_history h join public.development_assessments a on a.id=h.assessment_id
 join public.class_sessions s on s.id=a.session_id join public.academy_classes c on c.id=s.class_id join private.current_development_policies() p on p.branch_id=c.branch_id and p.kind='completion_certificate'
 join private.current_scheduled_controls(p_target) ctl on ctl.branch_id=c.branch_id join public.children k on k.id=h.child_id join public.families f on f.id=k.family_id
 where not exists(select 1 from private.development_automation_candidates q where q.policy_id=p.id and q.history_id=h.id) and a.status='published' and k.synthetic and f.synthetic and not exists(select 1 from public.development_level_reversals r where r.history_id=h.id)
 and not exists(select 1 from public.development_certificates cert where cert.assessment_id=h.assessment_id)
 order by h.created_at,h.id limit 50 on conflict do nothing;
 insert into private.scheduled_jobs(kind,entity_id,branch_id)
 select p.kind,x.id,p.branch_id from private.development_automation_candidates x join private.current_development_policies() p on p.id=x.policy_id join private.current_scheduled_controls(p_target) ctl on ctl.branch_id=p.branch_id on conflict do nothing;
end $$;
create function private.execute_development_job(j private.scheduled_jobs) returns integer language plpgsql security definer set search_path='' as $$
declare x private.development_automation_candidates;p public.development_automation_policies;h public.development_level_history;a public.development_assessments;c public.academy_classes;
 k public.children;ev uuid[];sid uuid;rid uuid;eid uuid;coach uuid;begin
 select * into x from private.development_automation_candidates where id=j.entity_id;
 select * into p from private.current_development_policies() where id=x.policy_id and branch_id=j.branch_id;
 if p.id is null then return 0;end if;
 select * into k from public.children where id=x.child_id and synthetic;
 if k.id is null or not exists(select 1 from public.families where id=k.family_id and synthetic) then return 0;end if;
 if p.kind='monthly_report' then
 if exists(select 1 from public.development_reports where child_id=k.id and sport=x.sport and month=x.month and automation_policy_id is not null) then return 0;end if;
 select array_agg(z.id order by z.starts_at,z.id) into ev from (
 select a0.id,s.starts_at from public.development_assessments a0 join public.class_sessions s on s.id=a0.session_id join public.academy_classes cc on cc.id=s.class_id
 where a0.child_id=k.id and a0.status='published' and cc.branch_id=p.branch_id and cc.sport=x.sport and s.status<>'cancelled' and date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date=x.month order by s.starts_at,a0.id limit 30) z;
 if cardinality(ev) is null then return 0;end if;
 select session_id into sid from public.development_assessments where id=ev[1];
 select * into c from public.academy_classes where id=(select class_id from public.class_sessions where id=sid);coach:=c.coach_id;
 if not exists(select 1 from public.profiles pr join public.role_assignments ra on ra.user_id=pr.id join public.branch_permissions bp on bp.user_id=pr.id where pr.id=coach and pr.active and ra.role='coach' and bp.branch_id=c.branch_id) then raise exception 'Current coach needed' using errcode='P0409';end if;
 insert into public.development_reports(session_id,child_id,sport,month,version,author_id,summary,evidence_ids,automation_policy_id)
 select sid,k.id,x.sport,x.month,coalesce(max(version),0)+1,coach,'Automatic factual draft: '||cardinality(ev)||' published assessment(s) selected for '||x.month::text||'. Coach review and submission required. Up to30assessments are included in chronological order.',ev,p.id from public.development_reports where child_id=k.id and sport=x.sport and month=x.month;
 -- No notification, publication or external outbox effect for drafts.
 else
 select * into h from public.development_level_history where id=x.history_id;
 select * into a from public.development_assessments where id=h.assessment_id;
 if h.id is null or a.status<>'published' or exists(select 1 from public.development_level_reversals where history_id=h.id) or exists(select 1 from public.development_certificates where assessment_id=a.id) then return 0;end if;
 insert into public.development_certificates(assessment_id,child_id,recipient_name,sport,level_name,title,issued_by,automation_policy_id)
 select a.id,k.id,k.name,h.sport,l.name,p.title,p.approved_by,p.id from public.sport_levels l where l.id=h.to_level_id returning id into rid;
 insert into public.product_events(kind,entity_id,family_id,branch_id,actor_id) values('development.certificate.issued',rid,k.family_id,j.branch_id,null) returning id into eid;
 insert into public.notifications(event_id,recipient_id,title,body,href) select eid,g.user_id,'Achievement certificate available','Your approved achievement certificate is ready for private download.','/parent?view=Progress' from public.guardians g join public.profiles pr on pr.id=g.user_id where g.family_id=k.family_id and pr.active and pr.synthetic on conflict do nothing;
 insert into public.delivery_outbox(event_id,recipient_id,channel) select eid,n.recipient_id,ch.channel from public.notifications n cross join(values('email'),('whatsapp'),('push')) ch(channel) where n.event_id=eid on conflict do nothing;
 insert into private.scheduled_job_effects values(j.id,eid) on conflict do nothing;
 end if;return 1;
end $$;
revoke all on function private.current_development_policies(),private.discover_development_jobs(text),private.execute_development_job(private.scheduled_jobs) from public,anon,authenticated,service_role;

create or replace function private.run_scheduled_jobs(p_target text,p_limit integer default 20) returns jsonb language plpgsql security definer set search_path='' as $$
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
 perform private.discover_development_jobs(p_target);
 for j in select x.* from private.scheduled_jobs x join private.current_scheduled_controls(p_target) c on c.branch_id=x.branch_id where x.state in ('pending','retry') and x.next_attempt_at<=now() order by x.next_attempt_at,x.id limit p_limit for update of x skip locked loop
 select * into ctl from private.current_scheduled_controls(p_target) where branch_id=j.branch_id;
 if ctl.id is null then continue;end if;
 started:=clock_timestamp();result_state:='succeeded';code:=null;affected:=0;creator:=null;
 begin
 if j.kind in ('monthly_report','completion_certificate') then
 affected:=private.execute_development_job(j);if affected=0 then result_state:='cancelled';code:='POLICY_OR_EVIDENCE_CHANGED';end if;
 elsif j.kind='broadcast' then
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


create index on public.development_automation_policies(approved_by);
create index on private.development_automation_candidates(child_id);
create index on private.development_automation_candidates(history_id);
create index on public.development_reports(automation_policy_id);
create index on public.development_certificates(automation_policy_id);
