-- Coaching evidence is private until independently reviewed and published.
-- No authenticated direct mutation grants. Criteria, measured results and level history are append-only.
create table public.development_criteria (
 id uuid primary key default gen_random_uuid(), sport public.sport_id not null,
 level_id uuid not null references public.sport_levels, version integer not null check(version>0),
 title text not null check(length(trim(title)) between 2 and 120), criteria jsonb not null,
 created_by uuid not null references public.profiles, created_at timestamptz not null default now(),
 unique(level_id,version), check(jsonb_typeof(criteria)='array' and jsonb_array_length(criteria) between 1 and 20)
);
create table public.development_session_plans (
 id uuid primary key default gen_random_uuid(), session_id uuid not null unique references public.class_sessions,
 coach_id uuid not null references public.profiles, objectives text not null check(length(trim(objectives)) between 3 and 3000),
 activities text not null check(length(trim(activities)) between 3 and 3000), internal_note text not null default '' check(length(internal_note)<=3000),
 updated_at timestamptz not null default now()
);
create table public.development_assessments (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.class_sessions,
 child_id uuid not null references public.children, criteria_id uuid not null references public.development_criteria,
 author_id uuid not null references public.profiles, scores jsonb not null default '{}',
 summary text not null check(length(trim(summary)) between 3 and 3000),
 recommended_level_id uuid references public.sport_levels,
 status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','published')),
 submitted_at timestamptz, reviewed_by uuid references public.profiles, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(session_id,child_id,criteria_id), check(jsonb_typeof(scores)='object'),
 check((status='published')=(published_at is not null))
);
-- Never put private notes on a row that a parent may SELECT after publication.
create table public.development_assessment_notes (
 assessment_id uuid primary key references public.development_assessments,
 internal_note text not null default '' check(length(internal_note)<=3000)
);
create table public.development_reports (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.class_sessions,
 child_id uuid not null references public.children, sport public.sport_id not null, month date not null check(extract(day from month)=1),
 version integer not null check(version>0), author_id uuid not null references public.profiles,
 summary text not null check(length(trim(summary)) between 3 and 3000), evidence_ids uuid[] not null check(cardinality(evidence_ids) between 1 and 30),
 status text not null default 'draft' check(status in ('draft','submitted','approved','rejected','published')),
 reviewed_by uuid references public.profiles, submitted_at timestamptz, published_at timestamptz, created_at timestamptz not null default now(),
 unique(child_id,sport,month,version), check((status='published')=(published_at is not null))
);
create table public.development_reviews (
 id uuid primary key default gen_random_uuid(), assessment_id uuid references public.development_assessments,
 report_id uuid references public.development_reports, reviewer_id uuid not null references public.profiles,
 decision text not null check(decision in ('approved','rejected')), reason text not null check(length(trim(reason)) between 3 and 3000),
 created_at timestamptz not null default now(), check(num_nonnulls(assessment_id,report_id)=1)
);
create table public.development_results (
 id uuid primary key default gen_random_uuid(), assessment_id uuid not null references public.development_assessments,
 child_id uuid not null references public.children, sport public.sport_id not null,
 criteria_id uuid not null references public.development_criteria, metric_key text not null,
 label text not null, label_ar text not null default '', value numeric not null, unit text not null,
 direction text not null check(direction in ('higher','lower')), measured_at timestamptz not null,
 unique(assessment_id,metric_key)
);
create table public.development_level_history (
 id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children,
 sport public.sport_id not null, from_level_id uuid references public.sport_levels, to_level_id uuid not null references public.sport_levels,
 assessment_id uuid not null unique references public.development_assessments, approved_by uuid not null references public.profiles,
 reason text not null check(length(trim(reason)) between 3 and 3000), created_at timestamptz not null default now()
);
create table public.development_certificates (
 id uuid primary key default gen_random_uuid(), reference text not null unique default ('KAF-CERT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),
 assessment_id uuid not null unique references public.development_assessments, child_id uuid not null references public.children,
 recipient_name text not null, sport public.sport_id not null, level_name text not null,
 title text not null check(length(trim(title)) between 2 and 120), issued_by uuid not null references public.profiles, issued_at timestamptz not null default now()
);
create table public.development_certificate_revocations (
 certificate_id uuid primary key references public.development_certificates, revoked_by uuid not null references public.profiles,
 reason text not null check(length(trim(reason)) between 3 and 3000), revoked_at timestamptz not null default now()
);
create index development_assessment_child on public.development_assessments(child_id,status);
create index development_assessment_session on public.development_assessments(session_id);
create index development_report_child on public.development_reports(child_id,status);
create index development_result_child on public.development_results(child_id,criteria_id,metric_key);
create index development_history_child on public.development_level_history(child_id,sport);
create index development_certificate_child on public.development_certificates(child_id);

create function private.development_coach_session(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.mfa_ready() and private.has_role(array['coach']::public.academy_role[]) and exists (
 select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id
 join public.branch_permissions bp on bp.branch_id=c.branch_id and bp.user_id=auth.uid()
 where s.id=sid and c.coach_id=auth.uid() and c.active and s.status<>'cancelled')
$$;
create function private.development_session_child(sid uuid,cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.session_roster r
 left join public.enrollments n on n.id=r.enrollment_id and n.status='active'
 left join public.trial_bookings b on b.id=r.trial_booking_id and b.status in ('booked','attended','converted')
 left join public.trial_enquiries q on q.id=b.enquiry_id
 where r.session_id=sid and not r.cancelled and coalesce(n.child_id,q.child_id)=cid)
$$;
create function private.development_parent(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.children c where c.id=cid and private.family_owner(c.family_id))
$$;
create function private.development_reviewer(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.head_office() and exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=sid and (private.product_can('development.review',c.branch_id) or private.product_can('development.publish',c.branch_id)))
$$;
create function private.development_staff(sid uuid,cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.development_reviewer(sid) or (private.development_coach_session(sid) and private.development_session_child(sid,cid))
$$;
create function private.development_assessment_access(aid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.development_assessments a where a.id=aid and (private.development_staff(a.session_id,a.child_id) or (a.status='published' and private.development_parent(a.child_id))))
$$;
create function private.development_scores_valid(criteria jsonb,scores jsonb,complete boolean) returns boolean language plpgsql immutable set search_path='' as $$
declare item record; definition jsonb; begin
 if jsonb_typeof(scores) is distinct from 'object' or jsonb_typeof(criteria) is distinct from 'array' then return false; end if;
 if complete and (select count(*) from jsonb_object_keys(scores))<>jsonb_array_length(criteria) then return false; end if;
 for item in select * from jsonb_each(scores) loop
   select d into definition from jsonb_array_elements(criteria) d where d->>'key'=item.key;
   if definition is null or jsonb_typeof(item.value)<>'number' then return false; end if;
   if (item.value::text)::numeric not between (definition->>'min')::numeric and (definition->>'max')::numeric then return false; end if;
 end loop;
 return true;
end $$;
create function private.development_certificate_access(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.development_certificates c where c.id=cid and private.development_assessment_access(c.assessment_id))
$$;
create function private.development_certificate_revoked(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.development_certificate_revocations r where r.certificate_id=cid)
$$;
create function private.development_lock_published() returns trigger language plpgsql set search_path='' as $$ begin
 if old.status='published' then raise exception 'Published evidence is immutable' using errcode='42501'; end if;
 return new;
end $$;
create trigger development_assessment_published before update or delete on public.development_assessments for each row execute function private.development_lock_published();
create trigger development_report_published before update or delete on public.development_reports for each row execute function private.development_lock_published();

do $$ declare t text; begin foreach t in array array['development_criteria','development_session_plans','development_assessments','development_assessment_notes','development_reviews','development_results','development_level_history','development_reports','development_certificates','development_certificate_revocations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create trigger development_audit after insert or update or delete on public.%I for each row execute function private.product_audit()',t);
end loop;
foreach t in array array['development_criteria','development_reviews','development_results','development_level_history','development_certificates','development_certificate_revocations'] loop
 execute format('create trigger development_append_only before update or delete on public.%I for each row execute function private.immutable_record()',t);
end loop; end $$;
create policy development_criteria_read on public.development_criteria for select to authenticated using(private.active() and private.mfa_ready());
create policy development_plan_read on public.development_session_plans for select to authenticated using(private.development_coach_session(session_id) or private.development_reviewer(session_id));
create policy development_assessment_read on public.development_assessments for select to authenticated using(private.development_staff(session_id,child_id) or (status='published' and private.development_parent(child_id)));
create policy development_notes_read on public.development_assessment_notes for select to authenticated using(exists(select 1 from public.development_assessments a where a.id=assessment_id and private.development_staff(a.session_id,a.child_id)));
create policy development_review_read on public.development_reviews for select to authenticated using(exists(select 1 from public.development_assessments a where a.id=assessment_id and private.development_staff(a.session_id,a.child_id)) or exists(select 1 from public.development_reports r where r.id=report_id and private.development_staff(r.session_id,r.child_id)));
create policy development_results_read on public.development_results for select to authenticated using(private.development_assessment_access(assessment_id));
create policy development_history_read on public.development_level_history for select to authenticated using(private.development_assessment_access(assessment_id));
create policy development_report_read on public.development_reports for select to authenticated using(private.development_staff(session_id,child_id) or (status='published' and private.development_parent(child_id)));
create policy development_certificate_read on public.development_certificates for select to authenticated using(private.development_assessment_access(assessment_id) and not private.development_certificate_revoked(id));
-- Revocation reasons are explicitly family-facing, never internal review notes.
create policy development_revocation_read on public.development_certificate_revocations for select to authenticated using(private.development_certificate_access(certificate_id));

-- Explicit projection avoids widening children/families RLS for coaches.
create function public.development_sessions() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x order by x.starts_at),'[]'::jsonb) from (
 select s.id,c.id class_id,c.branch_id,c.name,c.sport,c.level_id,s.starts_at,s.ends_at,s.status,private.development_coach_session(s.id) can_coach,
 coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'name',k.name) order by k.name) from public.children k where private.development_session_child(s.id,k.id)),'[]'::jsonb) students
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id
 where (private.development_coach_session(s.id) or private.development_reviewer(s.id))
 and s.starts_at between now()-interval '90 days' and now()+interval '45 days'
 order by s.starts_at desc limit 200) x
$$;
revoke all on function public.development_sessions() from public,anon;
grant execute on function public.development_sessions() to authenticated;

create function private.development_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.development_assessments; cr public.development_criteria; rp public.development_reports;
 s public.class_sessions; cls public.academy_classes; lev public.sport_levels; previous_level uuid;
 cert public.development_certificates; rid uuid; cid uuid; fid uuid; item jsonb; definitions jsonb; month_date date; evidence uuid[]; n int;
begin
 perform private.require_access(private.active() and private.mfa_ready());
 if octet_length(p_data::text)>24000 then raise exception 'Request too large' using errcode='22023'; end if;
 -- Same transaction lock as other academy commands; each branch rechecks live role/assignment data.
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 case p_action
 when 'development.criteria.create' then
  perform private.require_access(private.head_office() and private.product_can('development.configure',null));
  select * into lev from public.sport_levels where id=(p_data->>'level_id')::uuid and active and sport=(p_data->>'sport')::public.sport_id;
  if lev.id is null then raise exception 'Sport and level do not match' using errcode='22023'; end if;
  definitions:=p_data->'criteria';
  if jsonb_typeof(definitions) is distinct from 'array' or jsonb_array_length(definitions) not between 1 and 20 then raise exception 'Criteria required' using errcode='22023'; end if;
  if (select count(distinct d->>'key') from jsonb_array_elements(definitions) d)<>jsonb_array_length(definitions) then raise exception 'Metric keys must be unique' using errcode='22023'; end if;
  for item in select * from jsonb_array_elements(definitions) loop
   if coalesce(item->>'key','') !~ '^[a-z][a-z0-9_]{0,39}$' or length(trim(coalesce(item->>'label',''))) not between 2 and 120 or length(coalesce(item->>'label_ar',''))>120 or length(trim(coalesce(item->>'unit',''))) not between 1 and 20 or coalesce(item->>'direction','') not in ('higher','lower') or jsonb_typeof(item->'min') is distinct from 'number' or jsonb_typeof(item->'max') is distinct from 'number' then raise exception 'Invalid metric definition' using errcode='22023'; end if;
   if (item->>'min')::numeric not between -1000000 and 1000000 or (item->>'max')::numeric not between -1000000 and 1000000 or (item->>'max')::numeric<=(item->>'min')::numeric then raise exception 'Invalid metric range' using errcode='22023'; end if;
  end loop;
  insert into public.development_criteria(sport,level_id,version,title,criteria,created_by)
  select lev.sport,lev.id,coalesce(max(version),0)+1,p_data->>'title',definitions,auth.uid() from public.development_criteria where level_id=lev.id returning id into rid;
 when 'development.plan.save' then
  select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid;
  perform private.require_access(private.development_coach_session(s.id));
  if s.status='cancelled' then raise exception 'Cancelled session' using errcode='P0409'; end if;
  insert into public.development_session_plans(session_id,coach_id,objectives,activities,internal_note) values(s.id,auth.uid(),p_data->>'objectives',p_data->>'activities',coalesce(p_data->>'internal_note',''))
  on conflict(session_id) do update set coach_id=auth.uid(),objectives=excluded.objectives,activities=excluded.activities,internal_note=excluded.internal_note,updated_at=now() returning id into rid;
 when 'development.assessment.save' then
  select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid;
  cid:=(p_data->>'child_id')::uuid;
  perform private.require_access(private.development_coach_session(s.id) and private.development_session_child(s.id,cid));
  select * into cls from public.academy_classes where id=s.class_id;
  select * into cr from public.development_criteria where id=(p_data->>'criteria_id')::uuid;
  if cr.id is null or cr.sport<>cls.sport or cr.level_id<>cls.level_id or s.starts_at>now() then raise exception 'Assessment must match a started session and its level' using errcode='22023'; end if;
  if not private.development_scores_valid(cr.criteria,p_data->'scores',false) then raise exception 'Scores must match metric keys, units and ranges' using errcode='22023'; end if;
  rid:=nullif(p_data->>'recommended_level_id','')::uuid;
  if rid is not null and not exists(select 1 from public.sport_levels l join public.sport_levels base on base.id=cr.level_id where l.id=rid and l.sport=cr.sport and l.active and l.rank>base.rank) then raise exception 'Recommendation must be a higher level in the same sport' using errcode='22023'; end if;
  if nullif(p_data->>'id','') is null then
   insert into public.development_assessments(session_id,child_id,criteria_id,author_id,scores,summary,recommended_level_id) values(s.id,cid,cr.id,auth.uid(),p_data->'scores',p_data->>'summary',rid) returning id into rid;
  else
   select * into a from public.development_assessments where id=(p_data->>'id')::uuid for update;
   perform private.require_access(a.author_id=auth.uid() and a.session_id=s.id and a.child_id=cid and a.criteria_id=cr.id);
   if a.status not in ('draft','rejected') then raise exception 'Submitted assessment is locked' using errcode='P0409'; end if;
   update public.development_assessments set scores=p_data->'scores',summary=p_data->>'summary',recommended_level_id=rid,status='draft',reviewed_by=null,submitted_at=null,updated_at=now() where id=a.id returning id into rid;
  end if;
  insert into public.development_assessment_notes(assessment_id,internal_note) values(rid,coalesce(p_data->>'internal_note','')) on conflict(assessment_id) do update set internal_note=excluded.internal_note;
 when 'development.assessment.submit','development.assessment.review','development.assessment.publish','development.level.approve','development.certificate.issue' then
  select * into a from public.development_assessments where id=coalesce(nullif(p_data->>'assessment_id',''),p_data->>'id')::uuid for update;
  select * into s from public.class_sessions where id=a.session_id;
  select * into cls from public.academy_classes where id=s.class_id;
  select * into cr from public.development_criteria where id=a.criteria_id;
  if p_action='development.assessment.submit' then
   perform private.require_access(a.author_id=auth.uid() and private.development_coach_session(a.session_id) and private.development_session_child(a.session_id,a.child_id));
   if a.status<>'draft' or not private.development_scores_valid(cr.criteria,a.scores,true) then raise exception 'Complete all criteria before submitting a draft' using errcode='P0409'; end if;
   update public.development_assessments set status='submitted',submitted_at=now(),updated_at=now() where id=a.id returning id into rid;
  elsif p_action='development.assessment.review' then
   perform private.require_access(private.head_office() and private.product_can('development.review',cls.branch_id) and auth.uid()<>a.author_id);
   if a.status<>'submitted' or coalesce(p_data->>'decision','') not in ('approved','rejected') then raise exception 'Assessment is not awaiting review' using errcode='P0409'; end if;
   insert into public.development_reviews(assessment_id,reviewer_id,decision,reason) values(a.id,auth.uid(),p_data->>'decision',p_data->>'reason');
   update public.development_assessments set status=p_data->>'decision',reviewed_by=auth.uid(),updated_at=now() where id=a.id returning id into rid;
  elsif p_action='development.assessment.publish' then
   perform private.require_access(private.head_office() and private.product_can('development.publish',cls.branch_id) and auth.uid()<>a.author_id);
   if a.status<>'approved' or a.reviewed_by is null then raise exception 'Approved review required before publishing' using errcode='P0409'; end if;
   update public.development_assessments set status='published',published_at=now(),updated_at=now() where id=a.id returning id into rid;
   insert into public.development_results(assessment_id,child_id,sport,criteria_id,metric_key,label,label_ar,value,unit,direction,measured_at)
   select a.id,a.child_id,cr.sport,cr.id,d->>'key',d->>'label',coalesce(d->>'label_ar',''),(a.scores->>(d->>'key'))::numeric,d->>'unit',d->>'direction',s.starts_at from jsonb_array_elements(cr.criteria) d;
   select family_id into fid from public.children where id=a.child_id;
   perform private.emit_product_event('development.assessment.published',a.id,fid,cls.branch_id,'New progress assessment','A reviewed assessment is ready in your child journey.','/parent?view=Progress');
  elsif p_action='development.level.approve' then
   perform private.require_access(private.head_office() and private.product_can('development.review',cls.branch_id) and auth.uid()<>a.author_id);
   if a.status<>'published' or a.recommended_level_id is null then raise exception 'Published recommendation required' using errcode='P0409'; end if;
   select level_id into previous_level from public.child_sports where child_id=a.child_id and sport=cr.sport for update;
   if exists(select 1 from public.development_level_history where assessment_id=a.id) then raise exception 'Recommendation already decided' using errcode='P0409'; end if;
   select * into lev from public.sport_levels where id=a.recommended_level_id and active and sport=cr.sport;
   if lev.id is null or previous_level is distinct from cr.level_id or not exists(select 1 from public.sport_levels l where l.id=previous_level and l.rank<lev.rank) then raise exception 'Current level changed; assess current level before progression' using errcode='P0409'; end if;
   insert into public.development_level_history(child_id,sport,from_level_id,to_level_id,assessment_id,approved_by,reason) values(a.child_id,cr.sport,previous_level,lev.id,a.id,auth.uid(),p_data->>'reason') returning id into rid;
   update public.child_sports set level_id=lev.id,level=lev.name,status='reviewed' where child_id=a.child_id and sport=cr.sport;
   select family_id into fid from public.children where id=a.child_id;
   perform private.emit_product_event('development.level.approved',rid,fid,cls.branch_id,'Sport level updated','Your child has a newly approved sport level. Class arrangements are unchanged.','/parent?view=Progress');
  else
   perform private.require_access(private.head_office() and private.product_can('development.certify',cls.branch_id));
   if a.status<>'published' then raise exception 'Published evidence required for a certificate' using errcode='P0409'; end if;
   insert into public.development_certificates(assessment_id,child_id,recipient_name,sport,level_name,title,issued_by)
   select a.id,a.child_id,k.name,cr.sport,l.name,p_data->>'title',auth.uid() from public.children k join public.sport_levels l on l.id=coalesce((select h.to_level_id from public.development_level_history h where h.assessment_id=a.id),cr.level_id) where k.id=a.child_id returning id into rid;
  end if;
 when 'development.certificate.revoke' then
  select * into cert from public.development_certificates where id=(p_data->>'id')::uuid;
  select * into a from public.development_assessments where id=cert.assessment_id;
  select * into cls from public.academy_classes where id=(select class_id from public.class_sessions where id=a.session_id);
  perform private.require_access(private.head_office() and private.product_can('development.certify',cls.branch_id));
  insert into public.development_certificate_revocations(certificate_id,revoked_by,reason) values(cert.id,auth.uid(),p_data->>'reason') returning certificate_id into rid;
 when 'development.report.create' then
  select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid;
  cid:=(p_data->>'child_id')::uuid;
  perform private.require_access(private.development_coach_session(s.id) and private.development_session_child(s.id,cid));
  select * into cls from public.academy_classes where id=s.class_id;
  if coalesce(p_data->>'month','') !~ '^\d{4}-(0[1-9]|1[0-2])$' or jsonb_typeof(p_data->'evidence_ids') is distinct from 'array' then raise exception 'Report month and evidence required' using errcode='22023'; end if;
  month_date:=((p_data->>'month')||'-01')::date;
  evidence:=array(select v::uuid from jsonb_array_elements_text(p_data->'evidence_ids') v);
  select count(distinct x) into n from unnest(evidence) x;
  if n<>cardinality(evidence) or n not between 1 and 30 then raise exception 'Distinct evidence required' using errcode='22023'; end if;
  if exists(select 1 from unnest(evidence) x where not exists(select 1 from public.development_assessments da join public.development_criteria dc on dc.id=da.criteria_id join public.class_sessions ds on ds.id=da.session_id where da.id=x and da.child_id=cid and da.status='published' and dc.sport=cls.sport and date_trunc('month',ds.starts_at at time zone 'Asia/Dubai')::date=month_date and private.development_staff(da.session_id,da.child_id))) then raise exception 'Report evidence must be published for this child, sport and month' using errcode='22023'; end if;
  insert into public.development_reports(session_id,child_id,sport,month,version,author_id,summary,evidence_ids)
  select s.id,cid,cls.sport,month_date,coalesce(max(version),0)+1,auth.uid(),p_data->>'summary',evidence from public.development_reports where child_id=cid and sport=cls.sport and month=month_date returning id into rid;
 when 'development.report.submit','development.report.review','development.report.publish' then
  select * into rp from public.development_reports where id=(p_data->>'id')::uuid for update;
  select * into cls from public.academy_classes where id=(select class_id from public.class_sessions where id=rp.session_id);
  if p_action='development.report.submit' then
   perform private.require_access(rp.author_id=auth.uid() and private.development_coach_session(rp.session_id) and private.development_session_child(rp.session_id,rp.child_id));
   if rp.status<>'draft' then raise exception 'Only a draft report may be submitted' using errcode='P0409'; end if;
   update public.development_reports set status='submitted',submitted_at=now() where id=rp.id returning id into rid;
  elsif p_action='development.report.review' then
   perform private.require_access(private.head_office() and private.product_can('development.review',cls.branch_id) and auth.uid()<>rp.author_id);
   if rp.status<>'submitted' or coalesce(p_data->>'decision','') not in ('approved','rejected') then raise exception 'Report is not awaiting review' using errcode='P0409'; end if;
   insert into public.development_reviews(report_id,reviewer_id,decision,reason) values(rp.id,auth.uid(),p_data->>'decision',p_data->>'reason');
   update public.development_reports set status=p_data->>'decision',reviewed_by=auth.uid() where id=rp.id returning id into rid;
  else
   perform private.require_access(private.head_office() and private.product_can('development.publish',cls.branch_id) and auth.uid()<>rp.author_id);
   if rp.status<>'approved' or rp.reviewed_by is null then raise exception 'Approved review required before publishing' using errcode='P0409'; end if;
   update public.development_reports set status='published',published_at=now() where id=rp.id returning id into rid;
   select family_id into fid from public.children where id=rp.child_id;
   perform private.emit_product_event('development.report.published',rp.id,fid,cls.branch_id,'New monthly report','A reviewed monthly report is ready in your child journey.','/parent?view=Progress');
  end if;
 else raise exception 'Unknown development action' using errcode='22023';
 end case;
 if rid is null then raise exception 'Record not found or unchanged' using errcode='P0002'; end if;
 return jsonb_build_object('id',rid);
end $$;
revoke all on function private.development_command(text,jsonb) from public,anon,authenticated;
revoke all on function private.development_coach_session(uuid),private.development_session_child(uuid,uuid),private.development_parent(uuid),private.development_reviewer(uuid),private.development_staff(uuid,uuid),private.development_assessment_access(uuid),private.development_certificate_access(uuid),private.development_certificate_revoked(uuid),private.development_scores_valid(jsonb,jsonb,boolean),private.development_lock_published() from public,anon;
grant execute on function private.development_coach_session(uuid),private.development_session_child(uuid,uuid),private.development_parent(uuid),private.development_reviewer(uuid),private.development_staff(uuid,uuid),private.development_assessment_access(uuid),private.development_certificate_access(uuid),private.development_certificate_revoked(uuid) to authenticated,service_role;
