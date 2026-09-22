-- Commercial policy is synthetic until the academy approves its prices and terms.
-- All money is AED integer minor units; external settlement is never inferred.
create table public.commercial_packages (
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches,
 sport public.sport_id not null, level_id uuid references public.sport_levels,
 name text not null check(length(trim(name)) between 2 and 100), name_ar text not null default '',
 price_minor integer not null check(price_minor between 0 and 1000000000), currency text not null default 'AED' check(currency='AED'),
 session_allowance integer not null check(session_allowance between 1 and 100),
 terms text not null check(length(trim(terms)) between 5 and 2000), terms_ar text not null default '',
 active boolean not null default true, policy_status text not null default 'synthetic' check(policy_status='synthetic'),
 created_by uuid not null references public.profiles, created_at timestamptz not null default now()
);
create table public.commercial_memberships (
 id uuid primary key default gen_random_uuid(), package_id uuid not null references public.commercial_packages,
 child_id uuid not null references public.children, family_id uuid not null references public.families,
 branch_id uuid not null references public.branches, sport public.sport_id not null,
 starts_on date not null, expires_on date not null check(expires_on>starts_on),
 status text not null default 'pending' check(status in ('pending','active','frozen','suspended')),
 accepted_by uuid not null references public.profiles, accepted_at timestamptz not null default now(),
 renewed_from uuid unique references public.commercial_memberships, created_at timestamptz not null default now()
);
create index commercial_membership_child on public.commercial_memberships(child_id,branch_id,sport,starts_on,expires_on);
create table public.commercial_invoices (
 id uuid primary key default gen_random_uuid(), membership_id uuid not null unique references public.commercial_memberships,
 family_id uuid not null references public.families, branch_id uuid not null references public.branches,
 reference text not null unique default ('INV-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 currency text not null default 'AED' check(currency='AED'), issued_by uuid not null references public.profiles,
 created_at timestamptz not null default now()
);
create table public.commercial_invoice_lines (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.commercial_invoices,
 description text not null, quantity integer not null check(quantity between 1 and 100),
 unit_minor integer not null check(unit_minor between 0 and 1000000000), created_at timestamptz not null default now()
);
create table public.commercial_payments (
 id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families,
 branch_id uuid not null references public.branches, amount_minor integer not null check(amount_minor between 1 and 1000000000),
 currency text not null default 'AED' check(currency='AED'), method text not null check(method in ('cash','bank_transfer','external_terminal')),
 reference text not null check(length(trim(reference)) between 3 and 100), recorded_by uuid not null references public.profiles,
 created_at timestamptz not null default now(), unique(branch_id,method,reference)
);
create table public.commercial_allocations (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.commercial_payments,
 invoice_id uuid not null references public.commercial_invoices, amount_minor integer not null check(amount_minor<>0 and abs(amount_minor)<=1000000000),
 reversal_of uuid unique references public.commercial_allocations, reason text,
 created_by uuid not null references public.profiles, created_at timestamptz not null default now(),
 check((amount_minor>0 and reversal_of is null) or (amount_minor<0 and reversal_of is not null and length(trim(reason)) between 5 and 500))
);
create table public.commercial_receipts (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null unique references public.commercial_payments,
 reference text not null unique default ('RCT-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 created_at timestamptz not null default now()
);
create table public.commercial_adjustments (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.commercial_invoices,
 kind text not null check(kind in ('discount','writeoff','reversal')), amount_minor integer not null check(amount_minor<>0 and abs(amount_minor)<=1000000000),
 reversal_of uuid unique references public.commercial_adjustments, reason text not null check(length(trim(reason)) between 5 and 500),
 created_by uuid not null references public.profiles, created_at timestamptz not null default now(),
 check((kind<>'reversal' and amount_minor>0 and reversal_of is null) or (kind='reversal' and amount_minor<0 and reversal_of is not null))
);
create table public.commercial_credit_approvals (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.commercial_invoices,
 amount_minor integer not null check(amount_minor>0), expires_on date not null,
 reason text not null check(length(trim(reason)) between 5 and 500), approved_by uuid not null references public.profiles,
 revoked_at timestamptz, revoked_by uuid references public.profiles, revocation_reason text,
 created_at timestamptz not null default now()
);
create unique index commercial_one_credit on public.commercial_credit_approvals(invoice_id) where revoked_at is null;
create table public.commercial_refunds (
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.commercial_payments,
 amount_minor integer not null check(amount_minor between 1 and 1000000000), reason text not null check(length(trim(reason)) between 5 and 500),
 reference text not null check(length(trim(reference)) between 3 and 100), recorded_by uuid not null references public.profiles,
 created_at timestamptz not null default now(),unique(payment_id,reference)
);
create table public.commercial_freezes (
 id uuid primary key default gen_random_uuid(), membership_id uuid not null references public.commercial_memberships,
 frozen boolean not null, reason text not null check(length(trim(reason)) between 5 and 500),
 created_by uuid not null references public.profiles, created_at timestamptz not null default now()
);
create table public.commercial_renewal_reminders (
 id uuid primary key default gen_random_uuid(), membership_id uuid not null unique references public.commercial_memberships,
 due_on date not null, created_at timestamptz not null default now()
);
create table public.entitlement_ledger (
 id uuid primary key default gen_random_uuid(), membership_id uuid not null references public.commercial_memberships,
 roster_id uuid references public.session_roster, kind text not null check(kind in ('grant','reserve','consume','release','reverse')),
 available_delta integer not null, reserved_delta integer not null, consumed_delta integer not null,
 source_key text not null unique, reason text not null, actor_id uuid references public.profiles, created_at timestamptz not null default now(),
 check((kind='grant' and roster_id is null and available_delta>0 and reserved_delta=0 and consumed_delta=0)
 or (kind='reserve' and roster_id is not null and available_delta=-1 and reserved_delta=1 and consumed_delta=0)
 or (kind='consume' and roster_id is not null and available_delta=0 and reserved_delta=-1 and consumed_delta=1)
 or (kind='release' and roster_id is not null and available_delta=1 and reserved_delta=-1 and consumed_delta=0)
 or (kind='reverse' and roster_id is not null and available_delta=1 and reserved_delta=0 and consumed_delta=-1))
);
create index commercial_ledger_membership on public.entitlement_ledger(membership_id);
create index commercial_ledger_roster on public.entitlement_ledger(roster_id);
create table public.commercial_compensation_rates (
 id uuid primary key default gen_random_uuid(), coach_id uuid not null references public.profiles,
 branch_id uuid not null references public.branches, amount_minor integer not null check(amount_minor between 1 and 1000000000),
 currency text not null default 'AED' check(currency='AED'), effective_from date not null, effective_to date not null check(effective_to>effective_from),
 created_by uuid not null references public.profiles, created_at timestamptz not null default now()
);
create table public.commercial_compensation_accruals (
 id uuid primary key default gen_random_uuid(), session_id uuid not null unique references public.class_sessions,
 coach_id uuid not null references public.profiles, branch_id uuid not null references public.branches,
 rate_id uuid not null references public.commercial_compensation_rates, amount_minor integer not null check(amount_minor>0),
 status text not null default 'pending' check(status in ('pending','approved','rejected')), review_reason text,
 reviewed_by uuid references public.profiles, reviewed_at timestamptz, created_at timestamptz not null default now()
);

-- Capability and family scope are independent. Scoped finance staff need the
-- family's explicit link to this exact branch; Head Office still needs its grant.
create or replace function private.commercial_can(p_permission text,f uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select f is not null and b is not null and private.product_can(p_permission,b)
  and not private.has_role(array['coach','sales']::public.academy_role[])
  and (private.head_office() or exists(select 1 from public.family_branches fb where fb.family_id=f and fb.branch_id=b))
$$;
revoke all on function private.commercial_can(text,uuid,uuid) from public,anon,authenticated;

-- Row visibility is explicitly financial or own family. Operational roles cannot infer amounts through audit.
create function private.commercial_family_read(f uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active() and private.mfa_ready() and not private.has_role(array['coach','sales']::public.academy_role[]) and (private.commercial_can('finance.view',f,b) or (private.has_role(array['parent']::public.academy_role[]) and private.family_owner(f)))
$$;
create function private.commercial_invoice_read(i uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.commercial_invoices x where x.id=i and private.commercial_family_read(x.family_id,x.branch_id)) $$;
create function private.commercial_payment_read(p uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.commercial_payments x where x.id=p and private.commercial_family_read(x.family_id,x.branch_id)) $$;
create function private.commercial_member_read(m uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.commercial_memberships x where x.id=m and private.commercial_family_read(x.family_id,x.branch_id)) $$;
create function private.commercial_immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Commercial history is append-only' using errcode='42501'; end $$;
create function private.commercial_audit() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.audit_events(actor_id,action,entity,entity_id,previous_value,new_value) values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id)::text,null,null);return coalesce(new,old);end $$;
revoke all on function private.commercial_family_read(uuid,uuid),private.commercial_invoice_read(uuid),private.commercial_payment_read(uuid),private.commercial_member_read(uuid),private.commercial_immutable(),private.commercial_audit() from public,anon,authenticated;
grant execute on function private.commercial_family_read(uuid,uuid),private.commercial_invoice_read(uuid),private.commercial_payment_read(uuid),private.commercial_member_read(uuid) to authenticated,service_role;
do $$ declare t text;begin foreach t in array array['commercial_packages','commercial_memberships','commercial_invoices','commercial_invoice_lines','commercial_payments','commercial_allocations','commercial_receipts','commercial_adjustments','commercial_credit_approvals','commercial_refunds','commercial_freezes','commercial_renewal_reminders','entitlement_ledger','commercial_compensation_rates','commercial_compensation_accruals'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);
 execute format('create trigger commercial_audit after insert or update or delete on public.%I for each row execute function private.commercial_audit()',t);
 end loop;
 foreach t in array array['commercial_invoices','commercial_invoice_lines','commercial_payments','commercial_allocations','commercial_receipts','commercial_adjustments','commercial_refunds','commercial_freezes','commercial_renewal_reminders','entitlement_ledger','commercial_compensation_rates'] loop
 execute format('create trigger commercial_immutable before update or delete on public.%I for each row execute function private.commercial_immutable()',t);
 end loop;end $$;
create policy commercial_packages_read on public.commercial_packages for select to authenticated using(private.active() and private.mfa_ready() and not private.has_role(array['coach','sales']::public.academy_role[]) and (private.product_can('finance.view',branch_id) or (private.has_role(array['parent']::public.academy_role[]) and (active or exists(select 1 from public.commercial_memberships m where m.package_id=commercial_packages.id and private.family_owner(m.family_id))))));
create policy commercial_memberships_read on public.commercial_memberships for select to authenticated using(private.commercial_family_read(family_id,branch_id));
create policy commercial_invoices_read on public.commercial_invoices for select to authenticated using(private.commercial_family_read(family_id,branch_id));
create policy commercial_invoice_lines_read on public.commercial_invoice_lines for select to authenticated using(private.commercial_invoice_read(invoice_id));
create policy commercial_payments_read on public.commercial_payments for select to authenticated using(private.commercial_family_read(family_id,branch_id));
create policy commercial_allocations_read on public.commercial_allocations for select to authenticated using(private.commercial_invoice_read(invoice_id));
create policy commercial_receipts_read on public.commercial_receipts for select to authenticated using(private.commercial_payment_read(payment_id));
create policy commercial_adjustments_read on public.commercial_adjustments for select to authenticated using(private.commercial_invoice_read(invoice_id));
create policy commercial_credit_approvals_read on public.commercial_credit_approvals for select to authenticated using(private.commercial_invoice_read(invoice_id));
create policy commercial_refunds_read on public.commercial_refunds for select to authenticated using(private.commercial_payment_read(payment_id));
create policy commercial_freezes_read on public.commercial_freezes for select to authenticated using(private.commercial_member_read(membership_id));
create policy commercial_renewal_reminders_read on public.commercial_renewal_reminders for select to authenticated using(private.commercial_member_read(membership_id));
create policy entitlement_ledger_read on public.entitlement_ledger for select to authenticated using(private.commercial_member_read(membership_id));
create policy commercial_compensation_rates_read on public.commercial_compensation_rates for select to authenticated using(private.product_can('finance.compensation',branch_id) and not private.has_role(array['coach','sales']::public.academy_role[]));
create policy commercial_compensation_accruals_read on public.commercial_compensation_accruals for select to authenticated using(private.product_can('finance.compensation',branch_id) and not private.has_role(array['coach','sales']::public.academy_role[]));

create function private.commercial_due(i uuid) returns bigint language sql stable security definer set search_path='' as $$
 select coalesce((select sum(quantity::bigint*unit_minor) from public.commercial_invoice_lines where invoice_id=i),0)-coalesce((select sum(amount_minor) from public.commercial_adjustments where invoice_id=i),0)-coalesce((select sum(amount_minor) from public.commercial_allocations where invoice_id=i),0)
$$;
create function private.commercial_unallocated(p uuid) returns bigint language sql stable security definer set search_path='' as $$
 select amount_minor-coalesce((select sum(amount_minor) from public.commercial_allocations where payment_id=p),0)-coalesce((select sum(amount_minor) from public.commercial_refunds where payment_id=p),0) from public.commercial_payments where id=p
$$;
create or replace function private.commercial_sync_membership(i uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.commercial_memberships; due bigint; inserted integer; rr record; begin
 select x.* into m from public.commercial_memberships x join public.commercial_invoices v on v.membership_id=x.id where v.id=i for update of x;
 due:=private.commercial_due(i);
 if m.status='frozen' then return;end if;
 if due<=0 or exists(select 1 from public.commercial_credit_approvals where invoice_id=i and revoked_at is null and expires_on>=(now() at time zone 'Asia/Dubai')::date and amount_minor>=due) then
 update public.commercial_memberships set status='active' where id=m.id;
 insert into public.entitlement_ledger(membership_id,kind,available_delta,reserved_delta,consumed_delta,source_key,reason,actor_id)
 select m.id,'grant',session_allowance,0,0,'grant:'||m.id,'Package accepted and invoice covered or credit approved',auth.uid() from public.commercial_packages where id=m.package_id on conflict(source_key) do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
 -- Activation commits only if every existing upcoming enrollment can be reserved.
 -- Re-entry from reserve sees the existing grant and cannot recurse into this loop.
 for rr in select r.id from public.session_roster r join public.enrollments n on n.id=r.enrollment_id join public.class_sessions s on s.id=r.session_id join public.academy_classes c on c.id=s.class_id
 where n.child_id=m.child_id and r.kind='enrollment' and not r.cancelled and n.status='active' and s.status='scheduled' and s.starts_at>now() and c.branch_id=m.branch_id and c.sport=m.sport
 and (s.starts_at at time zone 'Asia/Dubai')::date>=m.starts_on and (s.starts_at at time zone 'Asia/Dubai')::date<m.expires_on order by s.starts_at,r.id
 loop perform private.commercial_roster_event(rr.id,'reserve','Membership activation reserved an existing scheduled session');end loop;
 end if;
 elsif exists(select 1 from public.entitlement_ledger where membership_id=m.id and kind='grant') then update public.commercial_memberships set status='suspended' where id=m.id;
 else update public.commercial_memberships set status='pending' where id=m.id;end if;
end $$;

-- Internal operational hooks. Call only after caller authorization and under the academy transaction lock.
create or replace function private.commercial_roster_event(p_roster uuid,p_kind text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare rr public.session_roster; ss public.class_sessions; cc public.academy_classes; mm public.commercial_memberships; child uuid; day date; reserved integer; consumed integer; available integer; generation integer; iid uuid; key text;begin
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into rr from public.session_roster where id=p_roster; if not found then raise exception 'Roster entry not found' using errcode='P0002';end if;
 if rr.kind<>'enrollment' then return jsonb_build_object('configured',false);end if;
 select * into ss from public.class_sessions where id=rr.session_id;select * into cc from public.academy_classes where id=ss.class_id;select child_id into child from public.enrollments where id=rr.enrollment_id;day:=(ss.starts_at at time zone 'Asia/Dubai')::date;
 if p_kind in ('reverse','release') then select m.* into mm from public.commercial_memberships m where m.id in (select l.membership_id from public.entitlement_ledger l where l.roster_id=p_roster group by l.membership_id having case when p_kind='release' then sum(l.reserved_delta)>0 else sum(l.consumed_delta)>0 end) limit 1;
 else select * into mm from public.commercial_memberships where child_id=child and branch_id=cc.branch_id and sport=cc.sport and starts_on<=day and expires_on>day order by starts_on desc limit 1;end if;
 if mm.id is null then
 if p_kind in ('reserve','consume') and exists(select 1 from public.commercial_memberships where child_id=child and branch_id=cc.branch_id and sport=cc.sport) then raise exception 'No membership covers this session date' using errcode='P0409';end if;
 return jsonb_build_object('configured',false);end if;
 select id into iid from public.commercial_invoices where membership_id=mm.id;perform private.commercial_sync_membership(iid);
 select * into mm from public.commercial_memberships where id=mm.id for update;
 select coalesce(sum(reserved_delta),0),coalesce(sum(consumed_delta),0),count(*) into reserved,consumed,generation from public.entitlement_ledger where roster_id=p_roster and membership_id=mm.id;
 select coalesce(sum(available_delta),0) into available from public.entitlement_ledger where membership_id=mm.id;
 if p_kind in ('reserve','consume') and (mm.status<>'active' or rr.cancelled or ss.status='cancelled') then raise exception 'Membership is not eligible for session use' using errcode='P0409';end if;
 if p_kind='reserve' then
 if reserved=1 or consumed=1 then return jsonb_build_object('configured',true,'unchanged',true);end if;
 if available<1 then raise exception 'No remaining session entitlement' using errcode='P0409';end if;
 insert into public.entitlement_ledger(membership_id,roster_id,kind,available_delta,reserved_delta,consumed_delta,source_key,reason,actor_id) values(mm.id,p_roster,'reserve',-1,1,0,mm.id||':'||p_roster||':reserve:'||generation,p_reason,auth.uid());
 elsif p_kind='consume' then
 if consumed=1 then return jsonb_build_object('configured',true,'unchanged',true);end if;
 if reserved=0 then perform private.commercial_roster_event(p_roster,'reserve',p_reason);end if;
 insert into public.entitlement_ledger(membership_id,roster_id,kind,available_delta,reserved_delta,consumed_delta,source_key,reason,actor_id) values(mm.id,p_roster,'consume',0,-1,1,mm.id||':'||p_roster||':consume:'||generation,p_reason,auth.uid());
 elsif p_kind='release' then
 if reserved=0 then return jsonb_build_object('configured',true,'unchanged',true);end if;
 insert into public.entitlement_ledger(membership_id,roster_id,kind,available_delta,reserved_delta,consumed_delta,source_key,reason,actor_id) values(mm.id,p_roster,'release',1,-1,0,mm.id||':'||p_roster||':release:'||generation,p_reason,auth.uid());
 elsif p_kind='reverse' then
 if consumed=0 then return jsonb_build_object('configured',true,'unchanged',true);end if;
 insert into public.entitlement_ledger(membership_id,roster_id,kind,available_delta,reserved_delta,consumed_delta,source_key,reason,actor_id) values(mm.id,p_roster,'reverse',1,0,-1,mm.id||':'||p_roster||':reverse:'||generation,p_reason,auth.uid());
 else raise exception 'Invalid entitlement event' using errcode='22023';end if;
 return jsonb_build_object('configured',true,'membership_id',mm.id);
end $$;
create function private.commercial_session_entitlements(p_session uuid,p_kind text,p_reason text) returns void language plpgsql security definer set search_path='' as $$ declare rr record;begin
 for rr in select id from public.session_roster where session_id=p_session and kind='enrollment' loop perform private.commercial_roster_event(rr.id,p_kind,p_reason);end loop;end $$;

create function private.commercial_allocate(p uuid,i uuid,a integer) returns uuid language plpgsql security definer set search_path='' as $$
declare pay public.commercial_payments; inv public.commercial_invoices; r uuid;begin
 select * into pay from public.commercial_payments where id=p for update;select * into inv from public.commercial_invoices where id=i for update;
 perform private.require_access(pay.id is not null and inv.id is not null and pay.family_id=inv.family_id and pay.branch_id=inv.branch_id);
 if a is null or a<=0 or a>private.commercial_unallocated(p) or a>private.commercial_due(i) then raise exception 'Amount exceeds available payment or invoice balance' using errcode='P0409';end if;
 insert into public.commercial_allocations(payment_id,invoice_id,amount_minor,created_by) values(p,i,a,auth.uid()) returning id into r;perform private.commercial_sync_membership(i);return r;
end $$;

create or replace function private.commercial_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare pkg public.commercial_packages; member public.commercial_memberships; previous public.commercial_memberships; inv public.commercial_invoices;pay public.commercial_payments;allocation public.commercial_allocations;adj public.commercial_adjustments;credit public.commercial_credit_approvals;rate public.commercial_compensation_rates; accrual public.commercial_compensation_accruals;
 r uuid;f uuid;b uuid;i uuid;p uuid;child uuid;start_day date;end_day date;amount integer;kind text;reason text;due bigint;row record;result jsonb;sessionj jsonb;coach uuid;counted integer:=0;
begin
 perform private.require_access(private.active() and private.mfa_ready() and not private.has_role(array['coach','sales']::public.academy_role[]));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 b:=nullif(p_data->>'branch_id','')::uuid; reason:=trim(p_data->>'reason');
 case p_action
 when 'commercial.package.create' then
 perform private.require_access(private.product_can('finance.packages',b));
 perform private.require_access(exists(select 1 from public.branches where id=b and active) and exists(select 1 from public.branch_sports where branch_id=b and sport=(p_data->>'sport')::public.sport_id));
 if nullif(p_data->>'level_id','') is not null then perform private.require_access(exists(select 1 from public.sport_levels where id=(p_data->>'level_id')::uuid and sport=(p_data->>'sport')::public.sport_id and active));end if;
 insert into public.commercial_packages(branch_id,sport,level_id,name,name_ar,price_minor,session_allowance,terms,terms_ar,created_by) values(b,(p_data->>'sport')::public.sport_id,nullif(p_data->>'level_id','')::uuid,trim(p_data->>'name'),coalesce(p_data->>'name_ar',''),(p_data->>'price_minor')::integer,(p_data->>'session_allowance')::integer,trim(p_data->>'terms'),coalesce(p_data->>'terms_ar',''),auth.uid()) returning id into r;
 when 'commercial.package.status' then
 select * into pkg from public.commercial_packages where id=(p_data->>'id')::uuid;perform private.require_access(private.product_can('finance.packages',pkg.branch_id));
 update public.commercial_packages set active=(p_data->>'active')::boolean where id=pkg.id returning id into r;
 when 'commercial.membership.start','commercial.membership.renew' then
 if p_action='commercial.membership.renew' then
 select * into previous from public.commercial_memberships where id=(p_data->>'id')::uuid for update;
 perform private.require_access(private.commercial_can('finance.memberships',previous.family_id,previous.branch_id) or private.family_owner(previous.family_id));
 select * into member from public.commercial_memberships where renewed_from=previous.id;
 if member.id is not null then return jsonb_build_object('id',member.id,'unchanged',true);end if;
 child:=previous.child_id;start_day:=previous.expires_on;select * into pkg from public.commercial_packages where id=previous.package_id;
 else child:=(p_data->>'child_id')::uuid;start_day:=(p_data->>'starts_on')::date;select * into pkg from public.commercial_packages where id=(p_data->>'package_id')::uuid;end if;
 select family_id into f from public.children where id=child;
 perform private.require_access(f is not null and pkg.id is not null and (private.commercial_can('finance.memberships',f,pkg.branch_id) or private.family_owner(f)));
 if coalesce((p_data->>'accepted')::boolean,false) is not true or not pkg.active then raise exception 'Active package and explicit terms acceptance required' using errcode='22023';end if;
 if not exists(select 1 from public.branches br join public.branch_sports bs on bs.branch_id=br.id
  where br.id=pkg.branch_id and br.active and not br.provisional and bs.sport=pkg.sport)
  or (pkg.level_id is not null and not exists(select 1 from public.sport_levels sl where sl.id=pkg.level_id and sl.active and sl.sport=pkg.sport)) then
  raise exception 'Package branch, sport or level is no longer available' using errcode='P0409';end if;
 if start_day is null or start_day<(now() at time zone 'Asia/Dubai')::date or start_day>(now() at time zone 'Asia/Dubai')::date+366 then raise exception 'Membership must start within the next year' using errcode='22023';end if;
 if not exists(select 1 from public.child_sports where child_id=child and sport=pkg.sport and (pkg.level_id is null or level_id=pkg.level_id)) then raise exception 'Child sport or level does not match package' using errcode='P0409';end if;
 end_day:=(start_day+interval '1 month')::date;
 if exists(select 1 from public.commercial_memberships where child_id=child and branch_id=pkg.branch_id and sport=pkg.sport and daterange(starts_on,expires_on,'[)') && daterange(start_day,end_day,'[)')) then raise exception 'Membership dates overlap' using errcode='P0409';end if;
 insert into public.commercial_memberships(package_id,child_id,family_id,branch_id,sport,starts_on,expires_on,accepted_by,renewed_from) values(pkg.id,child,f,pkg.branch_id,pkg.sport,start_day,end_day,auth.uid(),previous.id) returning id into r;
 insert into public.commercial_invoices(membership_id,family_id,branch_id,issued_by) values(r,f,pkg.branch_id,auth.uid()) returning id into i;
 insert into public.commercial_invoice_lines(invoice_id,description,quantity,unit_minor) values(i,pkg.name||' / '||start_day||' – '||end_day,1,pkg.price_minor);
 perform private.commercial_sync_membership(i);
 perform private.emit_product_event('membership.created',r,f,pkg.branch_id,'Membership created','Your membership and invoice are available. Activation requires payment or approved credit.','/parent?view=Memberships');
 return jsonb_build_object('id',r,'invoice_id',i);
 when 'commercial.membership.freeze' then
 select * into member from public.commercial_memberships where id=(p_data->>'id')::uuid for update;perform private.require_access(private.commercial_can('finance.freeze',member.family_id,member.branch_id));
 if length(reason) not between 5 and 500 or reason is null or p_data->>'frozen' is null then raise exception 'Freeze state and reason required' using errcode='22023';end if;
 if ((p_data->>'frozen')::boolean)=(member.status='frozen') then return jsonb_build_object('id',member.id,'unchanged',true);end if;
 insert into public.commercial_freezes(membership_id,frozen,reason,created_by) values(member.id,(p_data->>'frozen')::boolean,reason,auth.uid());
 update public.commercial_memberships set status=case when (p_data->>'frozen')::boolean then 'frozen' else 'pending' end where id=member.id;
 select id into i from public.commercial_invoices where membership_id=member.id;perform private.commercial_sync_membership(i);r:=member.id;
 when 'commercial.payment.record' then
 f:=(p_data->>'family_id')::uuid;perform private.require_access(private.commercial_can('finance.payment',f,b));
 perform private.require_access(exists(select 1 from public.commercial_invoices where family_id=f and branch_id=b));
 if p_data->>'amount_minor' !~ '^[0-9]+$' then raise exception 'Use integer minor units' using errcode='22023';end if;
 amount:=(p_data->>'amount_minor')::integer;
 insert into public.commercial_payments(family_id,branch_id,amount_minor,method,reference,recorded_by) values(f,b,amount,p_data->>'method',trim(p_data->>'reference'),auth.uid()) returning id into r;
 insert into public.commercial_receipts(payment_id) values(r);
 if nullif(p_data->>'invoice_id','') is not null then perform private.commercial_allocate(r,(p_data->>'invoice_id')::uuid,amount);end if;
 perform private.emit_product_event('payment.recorded',r,f,b,'Payment receipt available','An offline payment was recorded. View the receipt and invoice allocations.','/parent?view=Finance');
 when 'commercial.payment.allocate' then
 select * into pay from public.commercial_payments where id=(p_data->>'payment_id')::uuid;perform private.require_access(private.commercial_can('finance.payment',pay.family_id,pay.branch_id));
 if p_data->>'amount_minor' !~ '^[0-9]+$' then raise exception 'Use integer minor units' using errcode='22023';end if;
 r:=private.commercial_allocate(pay.id,(p_data->>'invoice_id')::uuid,(p_data->>'amount_minor')::integer);
 when 'commercial.payment.unallocate' then
 select * into allocation from public.commercial_allocations where id=(p_data->>'allocation_id')::uuid;select * into pay from public.commercial_payments where id=allocation.payment_id;
 perform private.require_access(private.commercial_can('finance.refund',pay.family_id,pay.branch_id));
 if allocation.amount_minor<0 or allocation.id is null then raise exception 'Choose an original allocation' using errcode='22023';end if;
 select id into r from public.commercial_allocations where reversal_of=allocation.id;if r is not null then return jsonb_build_object('id',r,'unchanged',true);end if;
 insert into public.commercial_allocations(payment_id,invoice_id,amount_minor,reversal_of,reason,created_by) values(pay.id,allocation.invoice_id,-allocation.amount_minor,allocation.id,reason,auth.uid()) returning id into r;
 perform private.commercial_sync_membership(allocation.invoice_id);
 when 'commercial.payment.refund' then
 select * into pay from public.commercial_payments where id=(p_data->>'payment_id')::uuid for update;perform private.require_access(private.commercial_can('finance.refund',pay.family_id,pay.branch_id));
 if p_data->>'amount_minor' !~ '^[0-9]+$' then raise exception 'Use integer minor units' using errcode='22023';end if;amount:=(p_data->>'amount_minor')::integer;
 if amount is null or amount<=0 or amount>private.commercial_unallocated(pay.id) then raise exception 'Refund exceeds unallocated payment' using errcode='P0409';end if;
 insert into public.commercial_refunds(payment_id,amount_minor,reason,reference,recorded_by) values(pay.id,amount,reason,trim(p_data->>'reference'),auth.uid()) returning id into r;
 perform private.emit_product_event('refund.recorded',r,pay.family_id,pay.branch_id,'Refund recorded','An offline refund was recorded for your payment.','/parent?view=Finance');
 when 'commercial.invoice.adjust' then
 select * into inv from public.commercial_invoices where id=(p_data->>'invoice_id')::uuid;kind:=p_data->>'kind';
 if kind not in ('discount','writeoff') or kind is null then raise exception 'Invalid adjustment' using errcode='22023';end if;
 perform private.require_access(private.commercial_can('finance.'||kind,inv.family_id,inv.branch_id));
 if p_data->>'amount_minor' !~ '^[0-9]+$' then raise exception 'Use integer minor units' using errcode='22023';end if;amount:=(p_data->>'amount_minor')::integer;
 if amount is null or amount<=0 or amount>private.commercial_due(inv.id) then raise exception 'Adjustment exceeds open balance' using errcode='P0409';end if;
 insert into public.commercial_adjustments(invoice_id,kind,amount_minor,reason,created_by) values(inv.id,kind,amount,reason,auth.uid()) returning id into r;perform private.commercial_sync_membership(inv.id);
 when 'commercial.invoice.reverse-adjustment' then
 select * into adj from public.commercial_adjustments where id=(p_data->>'id')::uuid;select * into inv from public.commercial_invoices where id=adj.invoice_id;
 perform private.require_access(adj.kind in ('discount','writeoff') and private.commercial_can('finance.'||adj.kind,inv.family_id,inv.branch_id));
 select id into r from public.commercial_adjustments where reversal_of=adj.id;if r is not null then return jsonb_build_object('id',r,'unchanged',true);end if;
 insert into public.commercial_adjustments(invoice_id,kind,amount_minor,reversal_of,reason,created_by) values(inv.id,'reversal',-adj.amount_minor,adj.id,reason,auth.uid()) returning id into r;perform private.commercial_sync_membership(inv.id);
 when 'commercial.credit.approve' then
 select * into inv from public.commercial_invoices where id=(p_data->>'invoice_id')::uuid;perform private.require_access(private.commercial_can('finance.credit',inv.family_id,inv.branch_id));due:=private.commercial_due(inv.id);
 if due<=0 or (p_data->>'expires_on')::date<(now() at time zone 'Asia/Dubai')::date then raise exception 'Credit needs an open balance and future expiry' using errcode='P0409';end if;
 insert into public.commercial_credit_approvals(invoice_id,amount_minor,expires_on,reason,approved_by) values(inv.id,due,(p_data->>'expires_on')::date,reason,auth.uid()) returning id into r;perform private.commercial_sync_membership(inv.id);
 when 'commercial.credit.revoke' then
 select * into credit from public.commercial_credit_approvals where id=(p_data->>'id')::uuid;select * into inv from public.commercial_invoices where id=credit.invoice_id;perform private.require_access(private.commercial_can('finance.credit',inv.family_id,inv.branch_id));
 if length(reason) not between 5 and 500 or reason is null then raise exception 'Reason required' using errcode='22023';end if;
 update public.commercial_credit_approvals set revoked_at=now(),revoked_by=auth.uid(),revocation_reason=trim(p_data->>'reason') where id=credit.id and revoked_at is null;r:=credit.id;perform private.commercial_sync_membership(inv.id);
 when 'commercial.renewals.queue' then
 perform private.require_access(private.product_can('finance.memberships',b));
 for row in select m.* from public.commercial_memberships m where m.branch_id=b and private.commercial_can('finance.memberships',m.family_id,m.branch_id) and m.expires_on between (now() at time zone 'Asia/Dubai')::date and (now() at time zone 'Asia/Dubai')::date+7 and not exists(select 1 from public.commercial_memberships next where next.renewed_from=m.id) loop
 insert into public.commercial_renewal_reminders(membership_id,due_on) values(row.id,row.expires_on-7) on conflict(membership_id) do nothing returning id into r;
 if r is not null then counted:=counted+1;perform private.emit_product_event('membership.renewal_due',r,row.family_id,b,'Membership renewal due','Your membership ends within seven days. Review the next month and explicitly accept its package.','/parent?view=Memberships');end if;end loop;
 return jsonb_build_object('queued',counted,'external_delivery','not_configured');
 when 'commercial.compensation.rate' then
 perform private.require_access(private.product_can('finance.compensation',b));coach:=(p_data->>'coach_id')::uuid;
 perform private.require_access(exists(select 1 from public.profiles p join public.role_assignments a on a.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id where p.id=coach and p.active and a.role='coach' and bp.branch_id=b));
 start_day:=(p_data->>'effective_from')::date;end_day:=(p_data->>'effective_to')::date;
 if exists(select 1 from public.commercial_compensation_rates where coach_id=coach and branch_id=b and daterange(effective_from,effective_to,'[)')&&daterange(start_day,end_day,'[)')) then raise exception 'Compensation rate dates overlap' using errcode='P0409';end if;
 insert into public.commercial_compensation_rates(coach_id,branch_id,amount_minor,effective_from,effective_to,created_by) values(coach,b,(p_data->>'amount_minor')::integer,start_day,end_day,auth.uid()) returning id into r;
 when 'commercial.compensation.accrue' then
 -- JSON projection permits this migration to precede academy's explicit delivered_at/by columns.
 select to_jsonb(s),c.branch_id into sessionj,b from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=(p_data->>'session_id')::uuid;
 perform private.require_access(private.product_can('finance.compensation',b));coach:=(sessionj->>'delivered_by')::uuid;
 if sessionj->>'delivered_at' is null or coach is null or sessionj->>'status'='cancelled' or (sessionj->>'ends_at')::timestamptz>now() then raise exception 'Compensation requires explicit completed delivery' using errcode='P0409';end if;
 start_day:=((sessionj->>'starts_at')::timestamptz at time zone 'Asia/Dubai')::date;
 select * into rate from public.commercial_compensation_rates where coach_id=coach and branch_id=b and effective_from<=start_day and effective_to>start_day;
 if rate.id is null then raise exception 'No approved rate covers delivered session' using errcode='P0409';end if;
 insert into public.commercial_compensation_accruals(session_id,coach_id,branch_id,rate_id,amount_minor) values((sessionj->>'id')::uuid,coach,b,rate.id,rate.amount_minor) on conflict(session_id) do nothing returning id into r;
 if r is null then select id into r from public.commercial_compensation_accruals where session_id=(sessionj->>'id')::uuid;end if;
 when 'commercial.compensation.review' then
 select * into accrual from public.commercial_compensation_accruals where id=(p_data->>'id')::uuid for update;perform private.require_access(private.product_can('finance.compensation',accrual.branch_id));
 if accrual.status<>'pending' then raise exception 'Compensation review is final' using errcode='P0409';end if;
 if p_data->>'decision' not in ('approved','rejected') or length(reason) not between 5 and 500 or reason is null then raise exception 'Decision and reason required' using errcode='22023';end if;
 select to_jsonb(s) into sessionj from public.class_sessions s where s.id=accrual.session_id;
 if p_data->>'decision'='approved' and (sessionj->>'delivered_at' is null or sessionj->>'status'='cancelled' or (sessionj->>'delivered_by')::uuid<>accrual.coach_id) then raise exception 'Session delivery no longer eligible' using errcode='P0409';end if;
 update public.commercial_compensation_accruals set status=p_data->>'decision',review_reason=reason,reviewed_by=auth.uid(),reviewed_at=now() where id=accrual.id returning id into r;
 else raise exception 'Unknown commercial command' using errcode='22023';end case;
 if r is null then raise exception 'Record not found' using errcode='P0002';end if;
 return jsonb_build_object('id',r);
end $$;
revoke all on function private.commercial_due(uuid),private.commercial_unallocated(uuid),private.commercial_sync_membership(uuid),private.commercial_roster_event(uuid,text,text),private.commercial_session_entitlements(uuid,text,text),private.commercial_allocate(uuid,uuid,integer),private.commercial_command(text,jsonb) from public,anon,authenticated;
-- FK lookup indexes support scoped reads and reconciliation without full scans.
create index commercial_invoice_family on public.commercial_invoices(family_id,branch_id);
create index commercial_lines_invoice on public.commercial_invoice_lines(invoice_id);
create index commercial_allocations_payment on public.commercial_allocations(payment_id);
create index commercial_allocations_invoice on public.commercial_allocations(invoice_id);
create index commercial_adjustments_invoice on public.commercial_adjustments(invoice_id);
create index commercial_refunds_payment on public.commercial_refunds(payment_id);
create index commercial_payments_family on public.commercial_payments(family_id,branch_id);

-- Keep accepted contracts and reviewed financial decisions immutable outside their named transitions.
create function private.commercial_protect_contract() returns trigger language plpgsql set search_path='' as $$
declare oldj jsonb:=to_jsonb(old);newj jsonb;allowed text[];begin
 if TG_OP='DELETE' then raise exception 'Commercial contract history cannot be deleted' using errcode='42501';end if;
 newj:=to_jsonb(new);
 case TG_TABLE_NAME
 when 'commercial_packages' then allowed:=array['active'];
 when 'commercial_memberships' then allowed:=array['status'];
 when 'commercial_credit_approvals' then
 allowed:=array['revoked_at','revoked_by','revocation_reason'];
 if old.revoked_at is not null or new.revoked_at is null or new.revoked_by is null or new.revocation_reason is null or length(trim(new.revocation_reason)) not between 5 and 500 then raise exception 'Credit approval permits only an explicit revocation' using errcode='42501';end if;
 when 'commercial_compensation_accruals' then
 allowed:=array['status','review_reason','reviewed_by','reviewed_at'];
 if old.status<>'pending' or new.status not in ('approved','rejected') or new.reviewed_by is null or new.reviewed_at is null or new.review_reason is null or length(trim(new.review_reason)) not between 5 and 500 then raise exception 'Compensation review permits only one final decision' using errcode='42501';end if;
 else raise exception 'Unsupported commercial transition' using errcode='42501';end case;
 if (oldj-allowed) is distinct from (newj-allowed) then raise exception 'Commercial contract values are immutable' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.commercial_protect_contract() from public,anon,authenticated;
create trigger commercial_contract before update or delete on public.commercial_packages for each row execute function private.commercial_protect_contract();
create trigger commercial_contract before update or delete on public.commercial_memberships for each row execute function private.commercial_protect_contract();
create trigger commercial_contract before update or delete on public.commercial_credit_approvals for each row execute function private.commercial_protect_contract();
create trigger commercial_contract before update or delete on public.commercial_compensation_accruals for each row execute function private.commercial_protect_contract();
