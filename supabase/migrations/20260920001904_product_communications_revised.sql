-- Private operational notices, recipient previews and scheduled in-app delivery.
create function private.coach_notice_access(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and private.has_role(array['coach']::public.academy_role[]) and exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=sid and (c.coach_id=auth.uid() or exists(select 1 from public.coach_substitutions a where a.session_id=s.id and a.coach_id=auth.uid() and a.revoked_at is null and now() between a.starts_at and a.ends_at)) and exists(select 1 from public.branch_permissions b where b.branch_id=c.branch_id and b.user_id=auth.uid()))
$$;
revoke all on function private.coach_notice_access(uuid) from public,anon;grant execute on function private.coach_notice_access(uuid) to authenticated;
drop policy change_read on public.session_changes;
create policy change_read on public.session_changes for select to authenticated using(exists(select 1 from public.class_sessions s where s.id=session_id) or private.coach_notice_access(session_id));
create or replace function public.development_sessions() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x order by x.starts_at),'[]'::jsonb) from (
 select s.id,c.id class_id,c.branch_id,c.name,c.sport,c.level_id,s.starts_at,s.ends_at,s.status,s.finalized_at,s.finalized_by,s.delivered_at,s.delivered_by,s.capacity,v.name venue_name,c.coach_id,p.name coach_name,private.development_coach_session(s.id) can_coach,
 case when s.status='cancelled' or not (private.development_coach_session(s.id) or private.development_reviewer(s.id)) then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'name',k.name,'roster_id',r.id,'kind',r.kind,'attendance',r.attendance) order by k.name) from public.session_roster r left join public.enrollments n on n.id=r.enrollment_id left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id join public.children k on k.id=coalesce(n.child_id,q.child_id) where r.session_id=s.id and not r.cancelled and private.development_session_child(s.id,k.id)),'[]'::jsonb) end students
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id join public.venues v on v.id=c.venue_id join public.profiles p on p.id=c.coach_id
 where (private.coach_notice_access(s.id) or private.development_reviewer(s.id)) and s.starts_at between now()-interval '90 days' and now()+interval '45 days' order by s.starts_at desc limit 200) x
$$;
create function public.family_schedule() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x order by x.starts_at),'[]'::jsonb) from (
 select s.id,c.id class_id,c.name,c.branch_id,c.sport,c.level_id,s.starts_at,s.ends_at,s.status,s.finalized_at,s.delivered_at,s.capacity,v.name venue_name,p.name coach_name,
 coalesce((select jsonb_agg(jsonb_build_object('id',coalesce(n.child_id,q.child_id),'name',coalesce(k.name,q.child_name),'roster_id',r.id,'kind',r.kind,'attendance',r.attendance,'cancelled',r.cancelled)) from public.session_roster r left join public.enrollments n on n.id=r.enrollment_id left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id left join public.children k on k.id=coalesce(n.child_id,q.child_id) where r.session_id=s.id and ((k.id is not null and private.family_owner(k.family_id)) or (q.child_id is null and q.submitted_by=auth.uid() and private.has_role(array['parent']::public.academy_role[])))),'[]') students
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id join public.venues v on v.id=c.venue_id join public.profiles p on p.id=c.coach_id
 where private.active() and private.mfa_ready() and private.has_role(array['parent']::public.academy_role[]) and exists(select 1 from public.session_roster r left join public.enrollments n on n.id=r.enrollment_id left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id left join public.children k on k.id=coalesce(n.child_id,q.child_id) where r.session_id=s.id and (private.family_owner(k.family_id) or (q.child_id is null and q.submitted_by=auth.uid()))) order by s.starts_at desc limit 300) x
$$;
revoke all on function public.family_schedule() from public,anon;grant execute on function public.family_schedule() to authenticated;
create table public.communication_templates(id uuid primary key default gen_random_uuid(),name text not null,language text not null check(language in ('en','ar')),purpose text not null check(purpose in ('operational','marketing')),subject text not null check(length(subject) between 2 and 160),body text not null check(length(body) between 5 and 800),version int not null,created_by uuid not null references public.profiles,created_at timestamptz not null default now(),unique(name,language,version));
create table public.communication_batches(id uuid primary key default gen_random_uuid(),template_id uuid not null references public.communication_templates,branch_id uuid not null references public.branches,scheduled_at timestamptz not null,status text not null default 'scheduled' check(status in ('scheduled','sent','cancelled')),created_by uuid not null references public.profiles,sent_at timestamptz,created_at timestamptz not null default now());
create table public.communication_recipients(id uuid primary key default gen_random_uuid(),batch_id uuid not null references public.communication_batches,family_id uuid not null references public.families,user_id uuid not null references public.profiles,status text not null default 'queued' check(status in ('queued','sent','revoked')),notification_id uuid references public.notifications,unique(batch_id,user_id,family_id));
create function private.communication_audience(b uuid,purpose text) returns table(family_id uuid,user_id uuid,name text) language sql stable security definer set search_path='' as $$
 select distinct on(g.user_id) f.id,g.user_id,p.name from public.families f join public.family_branches fb on fb.family_id=f.id join public.guardians g on g.family_id=f.id join public.profiles p on p.id=g.user_id where fb.branch_id=b and p.active and exists(select 1 from public.role_assignments ra where ra.user_id=p.id and ra.role='parent') and (purpose='operational' or coalesce((select cr.granted from public.consent_records cr where cr.family_id=f.id and cr.kind='contact' order by cr.created_at desc limit 1),false)) order by g.user_id,f.id
$$;
create function private.communication_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tmpl public.communication_templates;batch public.communication_batches;rec public.communication_recipients;b uuid;rid uuid;eid uuid;nid uuid;recipients jsonb;begin
 perform private.require_access(private.active() and private.mfa_ready() and private.head_office());b:=nullif(p_data->>'branch_id','')::uuid;
 case p_action
 when 'communication.template.create' then
 perform private.require_access(private.product_can('communications.broadcast',b));
 insert into public.communication_templates(name,language,purpose,subject,body,version,created_by) values(p_data->>'name',p_data->>'language',p_data->>'purpose',p_data->>'subject',p_data->>'body',coalesce((select max(version)+1 from public.communication_templates where name=p_data->>'name' and language=p_data->>'language'),1),auth.uid()) returning id into rid;
 when 'communication.preview','communication.schedule' then
 perform private.require_access(private.product_can('communications.broadcast',b));select * into tmpl from public.communication_templates where id=(p_data->>'template_id')::uuid;
 if tmpl.id is null then raise exception 'Template required' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('family_id',a.family_id,'user_id',a.user_id,'name',a.name)),'[]') into recipients from private.communication_audience(b,tmpl.purpose) a;
 if p_action='communication.preview' then return jsonb_build_object('recipients',recipients,'channel','in_app','external','not_configured');end if;
 if coalesce((p_data->>'confirmed')::boolean,false) is not true then raise exception 'Recipient review confirmation required' using errcode='22023';end if;
 insert into public.communication_batches(template_id,branch_id,scheduled_at,created_by) values(tmpl.id,b,(p_data->>'scheduled_at')::timestamptz,auth.uid()) returning id into rid;
 insert into public.communication_recipients(batch_id,family_id,user_id) select rid,a.family_id,a.user_id from private.communication_audience(b,tmpl.purpose) a;
 when 'communication.cancel' then
 select * into batch from public.communication_batches where id=(p_data->>'id')::uuid for update;perform private.require_access(private.product_can('communications.broadcast',batch.branch_id));
 if batch.status='sent' then raise exception 'Published message cannot be recalled' using errcode='P0409';end if;update public.communication_batches set status='cancelled' where id=batch.id;rid:=batch.id;
 when 'communication.dispatch' then
 select * into batch from public.communication_batches where id=(p_data->>'id')::uuid for update;perform private.require_access(private.product_can('communications.broadcast',batch.branch_id));
 if batch.status='sent' then return jsonb_build_object('id',batch.id);end if;
 if batch.status<>'scheduled' or batch.scheduled_at>now() then raise exception 'Batch is not due' using errcode='P0409';end if;select * into tmpl from public.communication_templates where id=batch.template_id;
 for rec in select * from public.communication_recipients where batch_id=batch.id loop
 if not exists(select 1 from private.communication_audience(batch.branch_id,tmpl.purpose) a where a.user_id=rec.user_id and a.family_id=rec.family_id) then update public.communication_recipients set status='revoked' where id=rec.id;continue;end if;
 insert into public.product_events(kind,entity_id,family_id,branch_id,actor_id) values('communication.published',batch.id,rec.family_id,batch.branch_id,auth.uid()) on conflict(kind,entity_id,family_id) do update set kind=excluded.kind returning id into eid;
 insert into public.notifications(event_id,recipient_id,title,body,href) values(eid,rec.user_id,tmpl.subject,tmpl.body,'/parent?view=Notifications') on conflict(event_id,recipient_id) do update set event_id=excluded.event_id returning id into nid;
 insert into public.delivery_outbox(event_id,recipient_id,channel) select eid,rec.user_id,c.channel from(values('email'),('whatsapp'),('push')) c(channel) on conflict do nothing;
 update public.communication_recipients set status='sent',notification_id=nid where id=rec.id;end loop;
 update public.communication_batches set status='sent',sent_at=now() where id=batch.id;rid:=batch.id;
 else raise exception 'Unknown communication command' using errcode='22023';end case;return jsonb_build_object('id',rid);
end $$;
revoke all on function private.communication_audience(uuid,text),private.communication_command(text,jsonb) from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['communication_templates','communication_batches','communication_recipients'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);execute format('create trigger product_audit after insert or update or delete on public.%I for each row execute function private.product_audit()',t);end loop;end $$;
create policy template_read on public.communication_templates for select to authenticated using(private.head_office());
create policy batch_read on public.communication_batches for select to authenticated using(private.product_can('communications.broadcast',branch_id));
create policy recipient_read on public.communication_recipients for select to authenticated using(exists(select 1 from public.communication_batches b where b.id=batch_id));

drop policy acknowledgement_read on public.operational_acknowledgements;
create policy acknowledgement_read on public.operational_acknowledgements for select to authenticated using(private.head_office() or (private.active() and private.mfa_ready() and user_id=auth.uid() and private.coach_notice_access(session_id)));
