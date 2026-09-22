-- Independently reviewed, measurable targets retain their published plan and lifecycle evidence.
create table public.development_targets(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.class_sessions,
 child_id uuid not null references public.children,sport public.sport_id not null,
 baseline_result_id uuid not null references public.development_results,criteria_id uuid not null references public.development_criteria,
 metric_key text not null,label text not null,label_ar text not null default '',unit text not null,direction text not null check(direction in('higher','lower')),
 baseline_value numeric not null,target_value numeric not null,title text not null check(length(trim(title)) between 3 and 1000),due_on date not null,
 author_id uuid not null references public.profiles,status text not null default 'draft' check(status in('draft','submitted','approved','rejected','published','completion_submitted','completed','withdrawn')),
 reviewed_by uuid references public.profiles,published_at timestamptz,
 completion_result_id uuid references public.development_results,completion_by uuid references public.profiles,completed_at timestamptz,
 withdrawal_reason text check(length(trim(withdrawal_reason)) between 3 and 3000),withdrawn_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((status in('published','completion_submitted','completed','withdrawn'))=(published_at is not null)),
 check((status='withdrawn')=(withdrawn_at is not null)),
 check(status<>'completed' or (completion_result_id is not null and completed_at is not null))
);
create unique index development_target_active_metric on public.development_targets(child_id,criteria_id,metric_key) where status not in('completed','withdrawn','rejected');
create index development_target_session on public.development_targets(session_id);
create index development_target_baseline on public.development_targets(baseline_result_id);
create index development_target_criteria on public.development_targets(criteria_id);
create index development_target_author on public.development_targets(author_id);
create index development_target_reviewer on public.development_targets(reviewed_by);
create index development_target_completion_result on public.development_targets(completion_result_id);
create index development_target_completion_actor on public.development_targets(completion_by);
create index development_target_child on public.development_targets(child_id);
create table public.development_target_reviews(
 id uuid primary key default gen_random_uuid(),target_id uuid not null references public.development_targets,
 stage text not null check(stage in('plan','completion')),decision text not null check(decision in('approved','rejected')),
 reason text not null check(length(trim(reason)) between 3 and 3000),reviewer_id uuid not null references public.profiles,
 result_id uuid references public.development_results,created_at timestamptz not null default now()
);
create index development_target_review_target on public.development_target_reviews(target_id);
create index development_target_review_actor on public.development_target_reviews(reviewer_id);
create index development_target_review_result on public.development_target_reviews(result_id);
create table public.development_target_events(
 id uuid primary key default gen_random_uuid(),target_id uuid not null references public.development_targets,
 action text not null check(action in('draft','submitted','approved','rejected','published','completion_submitted','completion_rejected','completed','withdrawn')),
 actor_id uuid not null references public.profiles,created_at timestamptz not null default now()
);
create index development_target_event_target on public.development_target_events(target_id);
create index development_target_event_actor on public.development_target_events(actor_id);

create function private.development_target_staff(sid uuid,cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not private.has_role(array['sales']::public.academy_role[]) and private.development_staff(sid,cid)
$$;
create function private.development_target_access(tid uuid,internal boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.development_targets t where t.id=tid and (private.development_target_staff(t.session_id,t.child_id) or (not internal and t.published_at is not null and private.development_parent(t.child_id))))
$$;
revoke all on function private.development_target_staff(uuid,uuid),private.development_target_access(uuid,boolean) from public,anon;
grant execute on function private.development_target_staff(uuid,uuid),private.development_target_access(uuid,boolean) to authenticated,service_role;
do $$declare t text;begin foreach t in array array['development_targets','development_target_reviews','development_target_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create trigger target_audit after insert or update or delete on public.%I for each row execute function private.product_audit()',t);
end loop;end $$;
create policy target_read on public.development_targets for select to authenticated using(private.development_target_staff(session_id,child_id) or (published_at is not null and private.development_parent(child_id)));
create policy target_review_read on public.development_target_reviews for select to authenticated using(private.development_target_access(target_id,true));
create policy target_event_read on public.development_target_events for select to authenticated using(private.development_target_access(target_id,true) or (action in('published','completed','withdrawn') and private.development_target_access(target_id,false)));
create trigger target_review_immutable before update or delete on public.development_target_reviews for each row execute function private.immutable_record();
create trigger target_event_immutable before update or delete on public.development_target_events for each row execute function private.immutable_record();
create function private.development_target_lock() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Target history cannot be deleted' using errcode='42501';end if;
 if row(new.session_id,new.child_id,new.sport,new.baseline_result_id,new.criteria_id,new.metric_key,new.label,new.label_ar,new.unit,new.direction,new.baseline_value,new.author_id,new.created_at) is distinct from row(old.session_id,old.child_id,old.sport,old.baseline_result_id,old.criteria_id,old.metric_key,old.label,old.label_ar,old.unit,old.direction,old.baseline_value,old.author_id,old.created_at)
 or (old.published_at is not null and row(new.title,new.target_value,new.due_on,new.published_at) is distinct from row(old.title,old.target_value,old.due_on,old.published_at)) then raise exception 'Published target plan and baseline are immutable' using errcode='42501';end if;
 return new;
end $$;
create trigger target_plan_immutable before update or delete on public.development_targets for each row execute function private.development_target_lock();
revoke all on function private.development_target_lock() from public,anon,authenticated;

alter function private.development_command(text,jsonb) rename to development_emergency_command;
create function private.development_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.development_targets;base public.development_results;proof public.development_results;standard public.development_criteria;
 sid uuid;bid uuid;rid uuid;fid uuid;metric jsonb;value numeric;due date;event_action text;decision text;
begin
 if p_action not like 'development.target.%' then return private.development_emergency_command(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready() and not private.has_role(array['sales']::public.academy_role[]));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if p_action='development.target.save' then
  sid:=(p_data->>'session_id')::uuid;
  select * into base from public.development_results where id=(p_data->>'baseline_result_id')::uuid;
  perform private.require_access(private.development_coach_session(sid) and private.development_session_child(sid,base.child_id));
  if base.id is null or not exists(select 1 from public.development_assessments a where a.id=base.assessment_id and a.status='published') or not exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=sid and c.sport=base.sport) then raise exception 'Published baseline must match the assigned athlete and sport' using errcode='22023';end if;
  select * into standard from public.development_criteria where id=base.criteria_id;
  select d into metric from jsonb_array_elements(standard.criteria) d where d->>'key'=base.metric_key;
  if jsonb_typeof(p_data->'target_value') is distinct from 'number' or length(trim(coalesce(p_data->>'title',''))) not between 3 and 1000 or coalesce(p_data->>'due_on','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'A bounded title, value and due date are required' using errcode='22023';end if;
  value:=(p_data->>'target_value')::numeric;due:=(p_data->>'due_on')::date;
  if value not between (metric->>'min')::numeric and (metric->>'max')::numeric or (base.direction='higher' and value<=base.value) or (base.direction='lower' and value>=base.value) or due not between (now() at time zone 'Asia/Dubai')::date and (now() at time zone 'Asia/Dubai')::date+366 then raise exception 'Target must improve the baseline within its range and a 366 day planning window' using errcode='22023';end if;
  rid:=nullif(p_data->>'id','')::uuid;
  if rid is not null then
   select * into target from public.development_targets where id=rid for update;
   perform private.require_access(target.author_id=auth.uid() and target.session_id=sid and target.baseline_result_id=base.id);
   if target.status not in('draft','rejected') then raise exception 'Submitted target plan is locked' using errcode='P0409';end if;
  end if;
  if exists(select 1 from public.development_targets t where t.child_id=base.child_id and t.criteria_id=base.criteria_id and t.metric_key=base.metric_key and t.status not in('completed','withdrawn','rejected') and t.id is distinct from rid) then raise exception 'An active target already exists for this metric version' using errcode='P0409';end if;
  if rid is null then
   insert into public.development_targets(session_id,child_id,sport,baseline_result_id,criteria_id,metric_key,label,label_ar,unit,direction,baseline_value,target_value,title,due_on,author_id)
   values(sid,base.child_id,base.sport,base.id,base.criteria_id,base.metric_key,base.label,base.label_ar,base.unit,base.direction,base.value,value,trim(p_data->>'title'),due,auth.uid()) returning id into rid;
  else update public.development_targets set title=trim(p_data->>'title'),target_value=value,due_on=due,status='draft',reviewed_by=null,updated_at=now() where id=rid;end if;
  event_action:='draft';
 else
  select * into target from public.development_targets where id=(p_data->>'id')::uuid for update;
  if target.id is null then raise exception 'Target unavailable' using errcode='42501';end if;
  rid:=target.id;
  select c.branch_id into bid from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=target.session_id;
  case p_action
  when 'development.target.submit' then
   perform private.require_access(target.author_id=auth.uid() and private.development_coach_session(target.session_id) and private.development_session_child(target.session_id,target.child_id));
   if target.status<>'draft' then raise exception 'Only a draft target can be submitted' using errcode='P0409';end if;
   update public.development_targets set status='submitted',updated_at=now() where id=rid;event_action:='submitted';
  when 'development.target.review' then
   perform private.require_access(private.head_office() and private.product_can('development.review',bid) and auth.uid()<>target.author_id);
   decision:=p_data->>'decision';
   if target.status<>'submitted' or coalesce(decision,'') not in('approved','rejected') then raise exception 'Target is not awaiting plan review' using errcode='P0409';end if;
   if length(trim(coalesce(p_data->>'reason',''))) not between 3 and 3000 then raise exception 'Review reason required' using errcode='22023';end if;
   insert into public.development_target_reviews(target_id,stage,decision,reason,reviewer_id) values(rid,'plan',decision,trim(p_data->>'reason'),auth.uid());
   update public.development_targets set status=decision,reviewed_by=auth.uid(),updated_at=now() where id=rid;event_action:=decision;
  when 'development.target.publish' then
   perform private.require_access(private.head_office() and private.product_can('development.publish',bid) and auth.uid()<>target.author_id);
   if target.status<>'approved' or target.reviewed_by is null then raise exception 'Independent approved review required' using errcode='P0409';end if;
   update public.development_targets set status='published',published_at=now(),updated_at=now() where id=rid;event_action:='published';
  when 'development.target.completion.submit' then
   perform private.require_access(private.development_coach_session(target.session_id) and private.development_session_child(target.session_id,target.child_id));
   if target.status<>'published' then raise exception 'Only an active published target accepts completion evidence' using errcode='P0409';end if;
   select * into proof from public.development_results where id=(p_data->>'result_id')::uuid;
   select * into base from public.development_results where id=target.baseline_result_id;
   if proof.id is null or proof.child_id<>target.child_id or proof.criteria_id<>target.criteria_id or proof.metric_key<>target.metric_key or proof.unit<>target.unit or proof.direction<>target.direction or proof.measured_at<=base.measured_at or (target.direction='higher' and proof.value<target.target_value) or (target.direction='lower' and proof.value>target.target_value) or not exists(select 1 from public.development_assessments a where a.id=proof.assessment_id and a.status='published' and a.published_at>=target.published_at and private.development_staff(a.session_id,a.child_id)) then raise exception 'Later compatible published evidence meeting the target is required' using errcode='22023';end if;
   update public.development_targets set status='completion_submitted',completion_result_id=proof.id,completion_by=auth.uid(),updated_at=now() where id=rid;event_action:='completion_submitted';
  when 'development.target.completion.review' then
   perform private.require_access(private.head_office() and private.product_can('development.review',bid) and auth.uid()<>target.completion_by and auth.uid()<>target.author_id);
   decision:=p_data->>'decision';
   if target.status<>'completion_submitted' or coalesce(decision,'') not in('approved','rejected') then raise exception 'Target is not awaiting completion review' using errcode='P0409';end if;
   if length(trim(coalesce(p_data->>'reason',''))) not between 3 and 3000 then raise exception 'Review reason required' using errcode='22023';end if;
   insert into public.development_target_reviews(target_id,stage,decision,reason,reviewer_id,result_id) values(rid,'completion',decision,trim(p_data->>'reason'),auth.uid(),target.completion_result_id);
   update public.development_targets set status=case when decision='approved' then 'completed' else 'published' end,completed_at=case when decision='approved' then now() end,completion_result_id=case when decision='approved' then completion_result_id end,completion_by=case when decision='approved' then completion_by end,updated_at=now() where id=rid;
   event_action:=case when decision='approved' then 'completed' else 'completion_rejected' end;
  when 'development.target.withdraw' then
   perform private.require_access(private.head_office() and private.product_can('development.publish',bid));
   if target.status not in('published','completion_submitted','completed') then raise exception 'Only a published target can be withdrawn' using errcode='P0409';end if;
   if length(trim(coalesce(p_data->>'reason',''))) not between 3 and 3000 then raise exception 'Family-facing withdrawal reason required' using errcode='22023';end if;
   update public.development_targets set status='withdrawn',withdrawal_reason=trim(p_data->>'reason'),withdrawn_at=now(),updated_at=now() where id=rid;event_action:='withdrawn';
  else raise exception 'Unknown target action' using errcode='22023';
  end case;
 end if;
 insert into public.development_target_events(target_id,action,actor_id) values(rid,event_action,auth.uid());
 if event_action in('published','completed','withdrawn') then
  select k.family_id into fid from public.children k where k.id=target.child_id;
  perform private.emit_product_event('development.target.'||event_action,rid,fid,bid,'Training target updated','A reviewed training target update is ready in your child journey.','/parent?view=Progress');
 end if;
 return jsonb_build_object('id',rid);
end $$;
revoke all on function private.development_command(text,jsonb),private.development_emergency_command(text,jsonb) from public,anon,authenticated;
