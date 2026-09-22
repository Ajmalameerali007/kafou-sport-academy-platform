-- Non-cash engagement: immutable rules, source-backed qualification and compensating reward entries.
create table public.engagement_reward_rules(
 id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,
 code text not null check(code ~ '^[a-z][a-z0-9_]{2,39}$'),version int not null check(version>0),
 title text not null check(length(trim(title)) between 2 and 120),description text not null check(length(trim(description)) between 5 and 2000),
 source_kind text not null check(source_kind in ('challenge','recognition','referral')),
 unit text not null check(unit in ('badge','star','point')),quantity int not null check(quantity between 1 and 1000),
 created_by uuid not null references public.profiles,published_at timestamptz,created_at timestamptz not null default now(),unique(branch_id,code,version)
);
create table public.engagement_challenges(
 id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,sport public.sport_id not null,level_id uuid references public.sport_levels,
 title text not null check(length(trim(title)) between 2 and 120),description text not null check(length(trim(description)) between 5 and 2000),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),rule jsonb not null check(jsonb_typeof(rule)='object'),
 reward_policy_id uuid not null references public.engagement_reward_rules,created_by uuid not null references public.profiles,
 published_at timestamptz,created_at timestamptz not null default now()
);
create table public.engagement_entries(
 id uuid primary key default gen_random_uuid(),challenge_id uuid not null references public.engagement_challenges,child_id uuid not null references public.children,
 joined_by uuid not null references public.profiles,status text not null default 'joined' check(status in ('joined','pending_review','completed')),
 joined_at timestamptz not null default now(),unique(challenge_id,child_id)
);
create table public.engagement_completions(
 id uuid primary key default gen_random_uuid(),entry_id uuid not null unique references public.engagement_entries,
 evidence jsonb not null,status text not null default 'submitted' check(status in ('submitted','approved','rejected','published')),
 submitted_by uuid not null references public.profiles,reviewed_by uuid references public.profiles,
 published_at timestamptz,submitted_at timestamptz not null default now(),check((status='published')=(published_at is not null))
);
create table public.engagement_referral_campaigns(
 id uuid primary key default gen_random_uuid(),branch_id uuid not null references public.branches,
 title text not null check(length(trim(title)) between 2 and 120),description text not null check(length(trim(description)) between 5 and 2000),
 qualification text not null default 'first_fully_paid_membership' check(qualification='first_fully_paid_membership'),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),reward_policy_id uuid not null references public.engagement_reward_rules,
 created_by uuid not null references public.profiles,published_at timestamptz,created_at timestamptz not null default now()
);
create table public.engagement_referral_codes(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.engagement_referral_campaigns,
 family_id uuid not null references public.families,code text not null unique default ('KRF-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 created_by uuid not null references public.profiles,created_at timestamptz not null default now(),unique(campaign_id,family_id)
);
-- Internal qualification records never disclose another family's identity or payment evidence to a referrer.
create table public.engagement_referral_claims(
 id uuid primary key default gen_random_uuid(),code_id uuid not null references public.engagement_referral_codes,
 referred_family_id uuid not null unique references public.families,submitted_by uuid not null references public.profiles,
 status text not null default 'submitted' check(status in ('submitted','approved','rejected','published')),
 qualified_membership_id uuid references public.commercial_memberships,reviewed_by uuid references public.profiles,
 published_at timestamptz,created_at timestamptz not null default now(),check((status='published')=(published_at is not null))
);
create table public.engagement_reviews(
 id uuid primary key default gen_random_uuid(),completion_id uuid references public.engagement_completions,
 referral_id uuid references public.engagement_referral_claims,reviewer_id uuid not null references public.profiles,
 decision text not null check(decision in ('approved','rejected')),reason text not null check(length(trim(reason)) between 5 and 2000),
 created_at timestamptz not null default now(),check(num_nonnulls(completion_id,referral_id)=1)
);
create table public.engagement_reward_ledger(
 id uuid primary key default gen_random_uuid(),policy_id uuid not null references public.engagement_reward_rules,
 family_id uuid not null references public.families,child_id uuid references public.children,
 completion_id uuid references public.engagement_completions,recognition_id uuid references public.recognition_nominations,
 referral_id uuid references public.engagement_referral_claims,kind text not null check(kind in ('grant','reversal')),
 unit text not null check(unit in ('badge','star','point')),delta int not null check(delta<>0 and abs(delta)<=1000),
 reversal_of uuid unique references public.engagement_reward_ledger,reason text not null check(length(trim(reason)) between 5 and 2000),
 created_by uuid not null references public.profiles,created_at timestamptz not null default now(),
 check(num_nonnulls(completion_id,recognition_id,referral_id)=1),
 check((kind='grant' and delta>0 and reversal_of is null) or (kind='reversal' and delta<0 and reversal_of is not null))
);
create unique index engagement_completion_grant_once on public.engagement_reward_ledger(completion_id) where kind='grant';
create unique index engagement_recognition_grant_once on public.engagement_reward_ledger(recognition_id) where kind='grant';
create unique index engagement_referral_grant_once on public.engagement_reward_ledger(referral_id) where kind='grant';
create index engagement_entries_child on public.engagement_entries(child_id);
create index engagement_rewards_family on public.engagement_reward_ledger(family_id,child_id);
create index engagement_claim_code on public.engagement_referral_claims(code_id);
create index engagement_challenge_branch on public.engagement_challenges(branch_id,sport);

create function private.engagement_staff(b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.head_office() and (private.product_can('engagement.configure',b) or private.product_can('engagement.review',b) or private.product_can('engagement.grant',b))
$$;
create function private.engagement_coach(cid uuid,b uuid,sp public.sport_id) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.enrollments e join public.academy_classes c on c.id=e.class_id join public.class_sessions s on s.class_id=c.id
 where e.child_id=cid and e.status='active' and c.branch_id=b and c.sport=sp and private.development_coach_session(s.id) and private.development_session_child(s.id,cid))
$$;
create function private.engagement_entry_staff(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.engagement_entries e join public.engagement_challenges c on c.id=e.challenge_id where e.id=eid and (private.engagement_staff(c.branch_id) or private.engagement_coach(e.child_id,c.branch_id,c.sport)))
$$;
create function private.engagement_entry_owner(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.engagement_entries e where e.id=eid and private.development_parent(e.child_id))
$$;
create function private.engagement_referral_staff(rid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.engagement_referral_claims r join public.engagement_referral_codes code on code.id=r.code_id join public.engagement_referral_campaigns c on c.id=code.campaign_id where r.id=rid and private.engagement_staff(c.branch_id))
$$;
create function private.engagement_lock_published() returns trigger language plpgsql set search_path='' as $$begin
 if old.published_at is not null then raise exception 'Published engagement record is immutable' using errcode='42501';end if;return new;
end $$;
create function private.engagement_proof(eid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.engagement_entries;c public.engagement_challenges;ids uuid[];definition jsonb;begin
 select * into e from public.engagement_entries where id=eid;select * into c from public.engagement_challenges where id=e.challenge_id;
 if c.id is null or c.published_at is null then raise exception 'Published challenge required' using errcode='P0409';end if;
 if c.rule->>'kind'='attendance' then
 select array_agg(distinct r.id) into ids from public.session_roster r join public.enrollments n on n.id=r.enrollment_id join public.class_sessions s on s.id=r.session_id join public.academy_classes cl on cl.id=s.class_id
 where n.child_id=e.child_id and cl.branch_id=c.branch_id and cl.sport=c.sport and not r.cancelled and r.attendance in ('present','late') and s.finalized_at is not null and s.status<>'cancelled' and s.ends_at<=now() and s.starts_at>=c.starts_at and s.starts_at<c.ends_at;
 return jsonb_build_object('kind','attendance','qualified',coalesce(cardinality(ids),0)>=(c.rule->>'count')::int,'count',coalesce(cardinality(ids),0),'required',(c.rule->>'count')::int,'roster_ids',coalesce(ids,'{}'::uuid[]));
 end if;
 select d into definition from public.development_criteria v cross join lateral jsonb_array_elements(v.criteria) d where v.id=(c.rule->>'criteria_id')::uuid and d->>'key'=c.rule->>'metric_key';
 select array_agg(r.id) into ids from public.development_results r join public.development_assessments a on a.id=r.assessment_id join public.class_sessions s on s.id=a.session_id join public.academy_classes cl on cl.id=s.class_id
 where r.child_id=e.child_id and cl.branch_id=c.branch_id and r.sport=c.sport and r.criteria_id=(c.rule->>'criteria_id')::uuid and r.metric_key=c.rule->>'metric_key' and a.status='published' and r.measured_at>=c.starts_at and r.measured_at<c.ends_at
 and case when definition->>'direction'='lower' then r.value<=(c.rule->>'target')::numeric else r.value>=(c.rule->>'target')::numeric end;
 return jsonb_build_object('kind','metric','qualified',coalesce(cardinality(ids),0)>0,'criteria_id',c.rule->>'criteria_id','metric_key',c.rule->>'metric_key','target',(c.rule->>'target')::numeric,'unit',definition->>'unit','direction',definition->>'direction','result_ids',coalesce(ids,'{}'::uuid[]));
end $$;
create function private.engagement_referral_evidence(rid uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare r public.engagement_referral_claims;campaign public.engagement_referral_campaigns;result uuid;begin
 select * into r from public.engagement_referral_claims where id=rid;
 select c.* into campaign from public.engagement_referral_codes code join public.engagement_referral_campaigns c on c.id=code.campaign_id where code.id=r.code_id;
 -- All families have at most one referred signup, and the first membership must follow the referral.
 select m.id into result from public.commercial_memberships m join public.commercial_invoices i on i.membership_id=m.id
 where m.family_id=r.referred_family_id and m.branch_id=campaign.branch_id and m.created_at>=r.created_at and m.created_at<campaign.ends_at and m.renewed_from is null
 and not exists(select 1 from public.commercial_memberships earlier where earlier.family_id=m.family_id and (earlier.created_at,earlier.id)<(m.created_at,m.id))
 and (select coalesce(sum(l.quantity::bigint*l.unit_minor),0) from public.commercial_invoice_lines l where l.invoice_id=i.id)>0
 and (select coalesce(sum(a.amount_minor),0) from public.commercial_allocations a where a.invoice_id=i.id)>=(select coalesce(sum(l.quantity::bigint*l.unit_minor),0) from public.commercial_invoice_lines l where l.invoice_id=i.id)
 order by m.created_at,m.id limit 1;
 return result;
end $$;

do $$declare t text;begin foreach t in array array['engagement_reward_rules','engagement_challenges','engagement_entries','engagement_completions','engagement_reviews','engagement_reward_ledger','engagement_referral_campaigns','engagement_referral_codes','engagement_referral_claims'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);
 execute format('create trigger engagement_audit after insert or update or delete on public.%I for each row execute function private.product_audit()',t);
end loop;
foreach t in array array['engagement_reward_rules','engagement_challenges','engagement_completions','engagement_referral_campaigns','engagement_referral_claims'] loop execute format('create trigger engagement_published before update or delete on public.%I for each row execute function private.engagement_lock_published()',t);end loop;
foreach t in array array['engagement_reviews','engagement_reward_ledger','engagement_referral_codes'] loop execute format('create trigger engagement_immutable before update or delete on public.%I for each row execute function private.immutable_record()',t);end loop;end $$;
create policy engagement_rule_read on public.engagement_reward_rules for select to authenticated using(private.engagement_staff(branch_id) or (published_at is not null and private.active() and private.mfa_ready()));
create policy engagement_challenge_read on public.engagement_challenges for select to authenticated using(private.engagement_staff(branch_id) or (published_at is not null and private.active() and private.mfa_ready()));
create policy engagement_entry_read on public.engagement_entries for select to authenticated using(private.engagement_entry_staff(id) or private.development_parent(child_id));
create policy engagement_completion_read on public.engagement_completions for select to authenticated using(private.engagement_entry_staff(entry_id) or (status='published' and private.engagement_entry_owner(entry_id)));
create policy engagement_campaign_read on public.engagement_referral_campaigns for select to authenticated using(private.engagement_staff(branch_id) or (published_at is not null and private.active() and private.mfa_ready()));
create policy engagement_code_read on public.engagement_referral_codes for select to authenticated using(private.family_owner(family_id) or exists(select 1 from public.engagement_referral_campaigns c where c.id=campaign_id and private.engagement_staff(c.branch_id)));
create policy engagement_referral_read on public.engagement_referral_claims for select to authenticated using(private.engagement_referral_staff(id));
create policy engagement_review_read on public.engagement_reviews for select to authenticated using(exists(select 1 from public.engagement_completions c where c.id=completion_id and private.engagement_entry_staff(c.entry_id)) or private.engagement_referral_staff(referral_id));
create policy engagement_reward_read on public.engagement_reward_ledger for select to authenticated using((child_id is null and private.family_owner(family_id)) or private.development_parent(child_id) or exists(select 1 from public.engagement_reward_rules p where p.id=policy_id and private.engagement_staff(p.branch_id)) or exists(select 1 from public.engagement_entries e join public.engagement_completions c on c.entry_id=e.id where c.id=completion_id and private.engagement_entry_staff(e.id)));

create function private.engagement_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare reward public.engagement_reward_rules;challenge public.engagement_challenges;entry public.engagement_entries;completion public.engagement_completions;
 campaign public.engagement_referral_campaigns;code_row public.engagement_referral_codes;referral public.engagement_referral_claims;
 nomination public.recognition_nominations;original public.engagement_reward_ledger;
 rid uuid;b uuid;cid uuid;fid uuid;policy uuid;proof jsonb;metric jsonb;criteria_sport public.sport_id;
 comp_id uuid;recognition_id uuid;referral_id uuid;membership uuid;reason text;
 report public.development_reports;sess public.class_sessions;cls public.academy_classes;month_date date;evidence uuid[];summary_text text;metrics_text text;attendance_count int;
begin
 perform private.require_access(private.active() and private.mfa_ready());
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>24000 then raise exception 'Invalid engagement request' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 reason:=trim(coalesce(p_data->>'reason',''));
 case p_action
 when 'engagement.reward_rule.create' then
 b:=(p_data->>'branch_id')::uuid;perform private.require_access(private.head_office() and private.product_can('engagement.configure',b));
 insert into public.engagement_reward_rules(branch_id,code,version,title,description,source_kind,unit,quantity,created_by)
 select b,p_data->>'code',coalesce(max(version),0)+1,p_data->>'title',p_data->>'description',p_data->>'source_kind',p_data->>'unit',(p_data->>'quantity')::int,auth.uid() from public.engagement_reward_rules where branch_id=b and code=p_data->>'code' returning id into rid;
 when 'engagement.reward_rule.publish' then
 select * into reward from public.engagement_reward_rules where id=(p_data->>'id')::uuid;perform private.require_access(private.head_office() and private.product_can('engagement.configure',reward.branch_id));
 if reward.published_at is not null then return jsonb_build_object('id',reward.id);end if;
 update public.engagement_reward_rules set published_at=now() where id=reward.id returning id into rid;
 when 'engagement.challenge.create' then
 b:=(p_data->>'branch_id')::uuid;perform private.require_access(private.head_office() and private.product_can('engagement.configure',b));
 select * into reward from public.engagement_reward_rules where id=(p_data->>'reward_policy_id')::uuid;
 if reward.id is null or reward.source_kind<>'challenge' or reward.branch_id<>b or reward.published_at is null then raise exception 'Published challenge reward rule required' using errcode='22023';end if;
 if nullif(p_data->>'level_id','') is not null and not exists(select 1 from public.sport_levels l where l.id=(p_data->>'level_id')::uuid and l.sport=(p_data->>'sport')::public.sport_id and l.active) then raise exception 'Challenge level must match sport' using errcode='22023';end if;
 proof:=p_data->'rule';
 if proof->>'kind'='attendance' then
 if jsonb_typeof(proof->'count') is distinct from 'number' or (proof->>'count')::numeric<>trunc((proof->>'count')::numeric) or (proof->>'count')::numeric not between 1 and 200 then raise exception 'Positive whole attendance count required' using errcode='22023';end if;
 elsif proof->>'kind'='metric' then
 select d,v.sport into metric,criteria_sport from public.development_criteria v cross join lateral jsonb_array_elements(v.criteria) d where v.id=(proof->>'criteria_id')::uuid and d->>'key'=proof->>'metric_key';
 if metric is null or criteria_sport<>(p_data->>'sport')::public.sport_id or jsonb_typeof(proof->'target') is distinct from 'number' then raise exception 'Published sport metric required' using errcode='22023';end if;
 if (proof->>'target')::numeric not between (metric->>'min')::numeric and (metric->>'max')::numeric then raise exception 'Metric target outside configured range' using errcode='22023';end if;
 else raise exception 'Supported challenge rule required' using errcode='22023';end if;
 insert into public.engagement_challenges(branch_id,sport,level_id,title,description,starts_at,ends_at,rule,reward_policy_id,created_by) values(b,(p_data->>'sport')::public.sport_id,nullif(p_data->>'level_id','')::uuid,p_data->>'title',p_data->>'description',(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,proof,reward.id,auth.uid()) returning id into rid;
 when 'engagement.challenge.publish' then
 select * into challenge from public.engagement_challenges where id=(p_data->>'id')::uuid;perform private.require_access(private.head_office() and private.product_can('engagement.configure',challenge.branch_id));
 if challenge.published_at is not null then return jsonb_build_object('id',challenge.id);end if;
 if challenge.ends_at<=now() then raise exception 'Challenge already ended' using errcode='P0409';end if;
 update public.engagement_challenges set published_at=now() where id=challenge.id returning id into rid;
 when 'engagement.challenge.join' then
 select * into challenge from public.engagement_challenges where id=(p_data->>'challenge_id')::uuid;cid:=(p_data->>'child_id')::uuid;
 perform private.require_access(private.development_parent(cid) or private.engagement_coach(cid,challenge.branch_id,challenge.sport) or private.engagement_staff(challenge.branch_id));
 if challenge.id is null or challenge.published_at is null or challenge.ends_at<=now() or not exists(select 1 from public.enrollments n join public.academy_classes c on c.id=n.class_id where n.child_id=cid and n.status='active' and c.active and c.branch_id=challenge.branch_id and c.sport=challenge.sport) or (challenge.level_id is not null and not exists(select 1 from public.child_sports sp where sp.child_id=cid and sp.sport=challenge.sport and sp.level_id=challenge.level_id)) then raise exception 'Athlete is not eligible for this challenge' using errcode='P0409';end if;
 insert into public.engagement_entries(challenge_id,child_id,joined_by) values(challenge.id,cid,auth.uid()) on conflict(challenge_id,child_id) do nothing returning id into rid;
 if rid is null then select id into rid from public.engagement_entries where challenge_id=challenge.id and child_id=cid;end if;
 when 'engagement.completion.submit' then
 select * into entry from public.engagement_entries where id=(p_data->>'entry_id')::uuid for update;select * into challenge from public.engagement_challenges where id=entry.challenge_id;
 perform private.require_access(private.development_parent(entry.child_id) or private.engagement_coach(entry.child_id,challenge.branch_id,challenge.sport) or private.engagement_staff(challenge.branch_id));
 if now()<challenge.starts_at or now()>challenge.ends_at+interval '30 days' then raise exception 'Challenge claim window is closed' using errcode='P0409';end if;
 proof:=private.engagement_proof(entry.id);if not coalesce((proof->>'qualified')::boolean,false) then raise exception 'Published evidence does not yet meet the challenge rule' using errcode='P0409';end if;
 select * into completion from public.engagement_completions where entry_id=entry.id for update;
 if completion.id is not null and completion.status<>'rejected' then return jsonb_build_object('id',completion.id);end if;
 if completion.id is null then insert into public.engagement_completions(entry_id,evidence,submitted_by) values(entry.id,proof,auth.uid()) returning id into rid;
 else update public.engagement_completions set evidence=proof,status='submitted',submitted_by=auth.uid(),submitted_at=now(),reviewed_by=null where id=completion.id returning id into rid;end if;
 update public.engagement_entries set status='pending_review' where id=entry.id;
 when 'engagement.completion.review' then
 select * into completion from public.engagement_completions where id=(p_data->>'id')::uuid for update;select * into entry from public.engagement_entries where id=completion.entry_id;select * into challenge from public.engagement_challenges where id=entry.challenge_id;
 perform private.require_access(private.head_office() and private.product_can('engagement.review',challenge.branch_id) and auth.uid()<>completion.submitted_by);
 if completion.status<>'submitted' or coalesce(p_data->>'decision','') not in ('approved','rejected') then raise exception 'Completion is not awaiting review' using errcode='P0409';end if;
 proof:=private.engagement_proof(entry.id);if p_data->>'decision'='approved' and not (proof->>'qualified')::boolean then raise exception 'Evidence no longer qualifies' using errcode='P0409';end if;
 insert into public.engagement_reviews(completion_id,reviewer_id,decision,reason) values(completion.id,auth.uid(),p_data->>'decision',reason);
 update public.engagement_completions set status=p_data->>'decision',reviewed_by=auth.uid(),evidence=proof where id=completion.id returning id into rid;
 if p_data->>'decision'='rejected' then update public.engagement_entries set status='joined' where id=entry.id;end if;
 when 'engagement.referral_campaign.create' then
 b:=(p_data->>'branch_id')::uuid;perform private.require_access(private.head_office() and private.product_can('engagement.configure',b));
 select * into reward from public.engagement_reward_rules where id=(p_data->>'reward_policy_id')::uuid;
 if reward.id is null or reward.source_kind<>'referral' or reward.branch_id<>b or reward.published_at is null then raise exception 'Published referral reward rule required' using errcode='22023';end if;
 insert into public.engagement_referral_campaigns(branch_id,title,description,starts_at,ends_at,reward_policy_id,created_by) values(b,p_data->>'title',p_data->>'description',(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,reward.id,auth.uid()) returning id into rid;
 when 'engagement.referral_campaign.publish' then
 select * into campaign from public.engagement_referral_campaigns where id=(p_data->>'id')::uuid;perform private.require_access(private.head_office() and private.product_can('engagement.configure',campaign.branch_id));
 if campaign.published_at is not null then return jsonb_build_object('id',campaign.id);end if;
 if campaign.ends_at<=now() then raise exception 'Campaign already ended' using errcode='P0409';end if;
 update public.engagement_referral_campaigns set published_at=now() where id=campaign.id returning id into rid;
 when 'engagement.referral.code' then
 fid:=(p_data->>'family_id')::uuid;perform private.require_access(private.family_owner(fid));select * into campaign from public.engagement_referral_campaigns where id=(p_data->>'campaign_id')::uuid;
 if campaign.published_at is null or now() not between campaign.starts_at and campaign.ends_at then raise exception 'Campaign not open' using errcode='P0409';end if;
 insert into public.engagement_referral_codes(campaign_id,family_id,created_by) values(campaign.id,fid,auth.uid()) on conflict(campaign_id,family_id) do nothing returning * into code_row;
 if code_row.id is null then select * into code_row from public.engagement_referral_codes where campaign_id=campaign.id and family_id=fid;end if;
 return jsonb_build_object('id',code_row.id,'code',code_row.code);
 when 'engagement.referral.redeem' then
 fid:=(p_data->>'family_id')::uuid;perform private.require_access(private.family_owner(fid));
 select * into code_row from public.engagement_referral_codes where code=upper(trim(p_data->>'code'));select * into campaign from public.engagement_referral_campaigns where id=code_row.campaign_id;
 if code_row.id is null or campaign.published_at is null or now() not between campaign.starts_at and campaign.ends_at then raise exception 'Referral code unavailable' using errcode='P0409';end if;
 if code_row.family_id=fid or exists(select 1 from public.guardians a join public.guardians b0 on b0.user_id=a.user_id where a.family_id=fid and b0.family_id=code_row.family_id) then raise exception 'Self-referral is not eligible' using errcode='P0409';end if;
 select * into referral from public.engagement_referral_claims where referred_family_id=fid;
 if referral.id is not null then if referral.code_id=code_row.id then return jsonb_build_object('id',referral.id);end if;raise exception 'Family already has a referral' using errcode='P0409';end if;
 if exists(select 1 from public.commercial_memberships where family_id=fid) then raise exception 'Referral must precede first membership' using errcode='P0409';end if;
 insert into public.engagement_referral_claims(code_id,referred_family_id,submitted_by) values(code_row.id,fid,auth.uid()) returning id into rid;
 when 'engagement.referral.review' then
 select * into referral from public.engagement_referral_claims where id=(p_data->>'id')::uuid for update;select * into code_row from public.engagement_referral_codes where id=referral.code_id;select * into campaign from public.engagement_referral_campaigns where id=code_row.campaign_id;
 perform private.require_access(private.head_office() and private.product_can('engagement.review',campaign.branch_id) and auth.uid()<>referral.submitted_by);
 if referral.status not in ('submitted','rejected') or coalesce(p_data->>'decision','') not in ('approved','rejected') then raise exception 'Referral is not awaiting qualification' using errcode='P0409';end if;
 membership:=private.engagement_referral_evidence(referral.id);
 if p_data->>'decision'='approved' and membership is null then raise exception 'First fully paid membership required' using errcode='P0409';end if;
 insert into public.engagement_reviews(referral_id,reviewer_id,decision,reason) values(referral.id,auth.uid(),p_data->>'decision',reason);
 update public.engagement_referral_claims set status=p_data->>'decision',reviewed_by=auth.uid(),qualified_membership_id=membership where id=referral.id returning id into rid;
 when 'engagement.reward.grant' then
 if p_data->>'source_kind'='challenge' then
 select * into completion from public.engagement_completions where id=(p_data->>'source_id')::uuid for update;select * into entry from public.engagement_entries where id=completion.entry_id;select * into challenge from public.engagement_challenges where id=entry.challenge_id;
 b:=challenge.branch_id;policy:=challenge.reward_policy_id;cid:=entry.child_id;comp_id:=completion.id;
 perform private.require_access(private.head_office() and private.product_can('engagement.grant',b));
 select id into rid from public.engagement_reward_ledger where completion_id=completion.id and kind='grant';if rid is not null then return jsonb_build_object('id',rid);end if;
 if completion.status<>'approved' or completion.reviewed_by is null or not (private.engagement_proof(entry.id)->>'qualified')::boolean then raise exception 'Reviewed qualifying completion required' using errcode='P0409';end if;
 select family_id into fid from public.children where id=cid;
 elsif p_data->>'source_kind'='recognition' then
 select * into nomination from public.recognition_nominations where id=(p_data->>'source_id')::uuid;
 b:=nomination.branch_id;cid:=nomination.child_id;policy:=(p_data->>'reward_policy_id')::uuid;recognition_id:=nomination.id;
 perform private.require_access(private.head_office() and private.product_can('engagement.grant',b));
 select id into rid from public.engagement_reward_ledger where engagement_reward_ledger.recognition_id=nomination.id and kind='grant';if rid is not null then return jsonb_build_object('id',rid);end if;
 if nomination.status<>'approved' or nomination.reviewed_by is null then raise exception 'Approved recognition required' using errcode='P0409';end if;
 select family_id into fid from public.children where id=cid;
 elsif p_data->>'source_kind'='referral' then
 select * into referral from public.engagement_referral_claims where id=(p_data->>'source_id')::uuid for update;select * into code_row from public.engagement_referral_codes where id=referral.code_id;select * into campaign from public.engagement_referral_campaigns where id=code_row.campaign_id;
 b:=campaign.branch_id;policy:=campaign.reward_policy_id;fid:=code_row.family_id;referral_id:=referral.id;
 perform private.require_access(private.head_office() and private.product_can('engagement.grant',b));
 select id into rid from public.engagement_reward_ledger where engagement_reward_ledger.referral_id=referral.id and kind='grant';if rid is not null then return jsonb_build_object('id',rid);end if;
 if referral.status<>'approved' or referral.reviewed_by is null or private.engagement_referral_evidence(referral.id) is null then raise exception 'Reviewed paid referral required' using errcode='P0409';end if;
 else raise exception 'Unknown reward source' using errcode='22023';end if;
 select * into reward from public.engagement_reward_rules where id=policy;
 if reward.id is null or reward.branch_id<>b or reward.source_kind<>p_data->>'source_kind' or reward.published_at is null then raise exception 'Published matching reward rule required' using errcode='22023';end if;
 insert into public.engagement_reward_ledger(policy_id,family_id,child_id,completion_id,recognition_id,referral_id,kind,unit,delta,reason,created_by) values(reward.id,fid,cid,comp_id,recognition_id,referral_id,'grant',reward.unit,reward.quantity,reason,auth.uid()) returning id into rid;
 if comp_id is not null then update public.engagement_completions set status='published',published_at=now() where id=comp_id;update public.engagement_entries set status='completed' where id=entry.id;end if;
 if referral_id is not null then update public.engagement_referral_claims set status='published',published_at=now() where id=referral_id;end if;
 perform private.emit_product_event('engagement.reward.granted',rid,fid,b,'Academy reward granted','A reviewed non-cash reward has been added to your family journey.','/parent?section=engagement');
 when 'engagement.reward.reverse' then
 select * into original from public.engagement_reward_ledger where id=(p_data->>'id')::uuid for update;select * into reward from public.engagement_reward_rules where id=original.policy_id;
 perform private.require_access(private.head_office() and private.product_can('engagement.grant',reward.branch_id));
 if original.kind<>'grant' then raise exception 'Only a grant can be reversed' using errcode='P0409';end if;
 select id into rid from public.engagement_reward_ledger where reversal_of=original.id;if rid is not null then return jsonb_build_object('id',rid);end if;
 insert into public.engagement_reward_ledger(policy_id,family_id,child_id,completion_id,recognition_id,referral_id,kind,unit,delta,reversal_of,reason,created_by) values(original.policy_id,original.family_id,original.child_id,original.completion_id,original.recognition_id,original.referral_id,'reversal',original.unit,-original.delta,original.id,reason,auth.uid()) returning id into rid;
 perform private.emit_product_event('engagement.reward.reversed',rid,original.family_id,reward.branch_id,'Academy reward corrected',reason,'/parent?section=engagement');
 when 'engagement.report.edit' then
 select * into report from public.development_reports where id=(p_data->>'id')::uuid for update;
 perform private.require_access(report.author_id=auth.uid() and private.development_coach_session(report.session_id) and private.development_session_child(report.session_id,report.child_id));
 if report.status not in ('draft','rejected') then raise exception 'Submitted report is locked' using errcode='P0409';end if;
 update public.development_reports set summary=p_data->>'summary',status='draft',reviewed_by=null,submitted_at=null where id=report.id returning id into rid;
 when 'engagement.report.generate' then
 select * into sess from public.class_sessions where id=(p_data->>'session_id')::uuid;cid:=(p_data->>'child_id')::uuid;
 perform private.require_access(private.development_coach_session(sess.id) and private.development_session_child(sess.id,cid));select * into cls from public.academy_classes where id=sess.class_id;
 if coalesce(p_data->>'month','') !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Valid report month required' using errcode='22023';end if;month_date:=((p_data->>'month')||'-01')::date;
 select array_agg(a.id order by s.starts_at,a.id) into evidence from public.development_assessments a join public.development_criteria d on d.id=a.criteria_id join public.class_sessions s on s.id=a.session_id
 where a.child_id=cid and a.status='published' and d.sport=cls.sport and date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date=month_date and private.development_staff(a.session_id,a.child_id);
 if coalesce(cardinality(evidence),0) not between 1 and 30 then raise exception 'Between one and thirty published assessments required' using errcode='P0409';end if;
 select string_agg(x.label||': '||x.best::text||' '||x.unit||' (criteria v'||x.version||')','; ' order by x.label,x.version) into metrics_text from (
 select r.label,r.unit,c.version,case when r.direction='lower' then min(r.value) else max(r.value) end best from public.development_results r join public.development_criteria c on c.id=r.criteria_id where r.assessment_id=any(evidence) group by r.criteria_id,r.label,r.unit,r.direction,c.version) x;
 select count(distinct r.id) into attendance_count from public.session_roster r join public.enrollments e on e.id=r.enrollment_id join public.class_sessions s on s.id=r.session_id join public.academy_classes c on c.id=s.class_id where e.child_id=cid and c.sport=cls.sport and c.branch_id=cls.branch_id and r.attendance in ('present','late') and not r.cancelled and s.finalized_at is not null and s.status<>'cancelled' and private.development_coach_session(s.id) and private.development_session_child(s.id,cid) and date_trunc('month',s.starts_at at time zone 'Asia/Dubai')::date=month_date;
 summary_text:=cardinality(evidence)::text||' published assessments. '||attendance_count::text||' attended assigned sessions in this branch and sport. Best recorded measurements: '||coalesce(metrics_text,'none')||'.';
 if length(summary_text)>3000 then raise exception 'Evidence summary exceeds report limit; use a focused manual report' using errcode='22023';end if;
 insert into public.development_reports(session_id,child_id,sport,month,version,author_id,summary,evidence_ids) select sess.id,cid,cls.sport,month_date,coalesce(max(version),0)+1,auth.uid(),summary_text,evidence from public.development_reports where child_id=cid and sport=cls.sport and month=month_date returning id into rid;
 else raise exception 'Unknown engagement command' using errcode='22023';end case;
 if rid is null then raise exception 'Record not found' using errcode='P0002';end if;
 return jsonb_build_object('id',rid);
end $$;
revoke all on function private.engagement_staff(uuid),private.engagement_coach(uuid,uuid,public.sport_id),private.engagement_entry_staff(uuid),private.engagement_entry_owner(uuid),private.engagement_referral_staff(uuid),private.engagement_lock_published(),private.engagement_proof(uuid),private.engagement_referral_evidence(uuid),private.engagement_command(text,jsonb) from public,anon,authenticated;
grant execute on function private.engagement_staff(uuid),private.engagement_coach(uuid,uuid,public.sport_id),private.engagement_entry_staff(uuid),private.engagement_entry_owner(uuid),private.engagement_referral_staff(uuid) to authenticated,service_role;
