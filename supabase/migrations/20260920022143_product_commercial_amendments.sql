-- Internal synthetic-policy accounting only. These transitions never move money.
create index commercial_invoice_lines_child on public.commercial_invoice_lines(child_id);
create index commercial_invoice_lines_package on public.commercial_invoice_lines(package_id);
alter table public.commercial_allocations drop constraint commercial_allocations_reversal_of_key;
create index commercial_allocation_reversals on public.commercial_allocations(reversal_of);
alter table public.commercial_memberships drop constraint commercial_memberships_status_check;
alter table public.commercial_memberships add constraint commercial_memberships_status_check check(status in ('pending','active','frozen','suspended','cancelled'));
alter table public.commercial_adjustments drop constraint commercial_adjustments_kind_check;
alter table public.commercial_adjustments add constraint commercial_adjustments_kind_check check(kind in ('discount','writeoff','reversal','cancellation'));

create table public.commercial_membership_extensions(
 id uuid primary key default gen_random_uuid(),membership_id uuid not null references public.commercial_memberships,
 freeze_id uuid not null unique references public.commercial_freezes,previous_expires_on date not null,new_expires_on date not null,
 days integer not null check(days between 1 and 366),policy_version text not null default 'synthetic-elapsed-dubai-v1' check(policy_version='synthetic-elapsed-dubai-v1'),
 reason text not null check(length(trim(reason)) between 5 and 500),created_by uuid not null references public.profiles,
 operation_txid bigint not null default txid_current(),created_at timestamptz not null default now(),check(new_expires_on=previous_expires_on+days)
);
create table public.commercial_cancellation_previews(
 id uuid primary key default gen_random_uuid(),membership_id uuid not null references public.commercial_memberships,
 policy text not null check(policy in ('none','unused_calendar_days','unused_entitlements')),
 policy_version text not null default 'synthetic-cancellation-v1' check(policy_version='synthetic-cancellation-v1'),
 snapshot jsonb not null,state_hash text not null,created_by uuid not null references public.profiles,
 expires_at timestamptz not null default now()+interval '15 minutes',created_at timestamptz not null default now()
);
create table public.commercial_membership_cancellations(
 id uuid primary key default gen_random_uuid(),membership_id uuid not null unique references public.commercial_memberships,
 preview_id uuid not null unique references public.commercial_cancellation_previews,
 adjustment_id uuid references public.commercial_adjustments,credit_minor integer not null check(credit_minor between 0 and 1000000000),
 released_payment_minor integer not null check(released_payment_minor between 0 and credit_minor),
 reason text not null check(length(trim(reason)) between 5 and 500),created_by uuid not null references public.profiles,created_at timestamptz not null default now()
);
create index commercial_extensions_membership on public.commercial_membership_extensions(membership_id);
create index commercial_extensions_creator on public.commercial_membership_extensions(created_by);
create index commercial_previews_membership on public.commercial_cancellation_previews(membership_id);
create index commercial_previews_creator on public.commercial_cancellation_previews(created_by);
create index commercial_cancellations_adjustment on public.commercial_membership_cancellations(adjustment_id);
create index commercial_cancellations_creator on public.commercial_membership_cancellations(created_by);
do $$declare t text;begin foreach t in array array['commercial_membership_extensions','commercial_cancellation_previews','commercial_membership_cancellations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy commercial_read on public.%I for select to authenticated using(private.commercial_member_read(membership_id))',t);
 execute format('create trigger immutable_history before update or delete on public.%I for each row execute function private.commercial_immutable()',t);
 execute format('create trigger audit_change after insert on public.%I for each row execute function private.commercial_audit()',t);
end loop;end $$;

-- The original expiry is retained in the first immutable amendment. Only a
-- matching amendment written by this actor in this transaction can project a new expiry.
create function private.commercial_membership_amendment_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='DELETE' then raise exception 'Commercial contract history cannot be deleted' using errcode='42501';end if;
 if old.status='cancelled' and new.status<>'cancelled' then raise exception 'Cancelled membership is terminal' using errcode='P0409';end if;
 if (to_jsonb(old)-array['status','expires_on']) is distinct from (to_jsonb(new)-array['status','expires_on']) then raise exception 'Commercial contract values are immutable' using errcode='42501';end if;
 if old.expires_on is distinct from new.expires_on and not exists(select 1 from public.commercial_membership_extensions x where x.membership_id=old.id and x.previous_expires_on=old.expires_on and x.new_expires_on=new.expires_on and x.created_by=auth.uid() and x.operation_txid=txid_current()) then raise exception 'Expiry change requires an immutable extension' using errcode='42501';end if;
 return new;
end $$;
drop trigger commercial_contract on public.commercial_memberships;
create trigger commercial_contract before update or delete on public.commercial_memberships for each row execute function private.commercial_membership_amendment_guard();
alter function private.commercial_sync_membership(uuid) rename to commercial_sync_membership_before_amendments;
create function private.commercial_sync_membership(i uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.commercial_memberships m join public.commercial_invoices v on v.membership_id=m.id where v.id=i and m.status='cancelled') then return;end if;
 perform private.commercial_sync_membership_before_amendments(i);
end $$;

create function private.commercial_reverse_allocation(a uuid,requested integer,why text) returns jsonb language plpgsql security definer set search_path='' as $$
declare original public.commercial_allocations;p public.commercial_payments;inv public.commercial_invoices;remaining integer;amount integer;r uuid;begin
 select * into original from public.commercial_allocations where id=a for update;
 select * into p from public.commercial_payments where id=original.payment_id for update;
 select * into inv from public.commercial_invoices where id=original.invoice_id;
 perform private.require_access(original.id is not null and private.commercial_can('finance.refund',p.family_id,p.branch_id) and inv.family_id=p.family_id and inv.branch_id=p.branch_id);
 if original.amount_minor<=0 or why is null or length(trim(why)) not between 5 and 500 then raise exception 'Choose an original allocation and a reason' using errcode='22023';end if;
 remaining:=original.amount_minor+coalesce((select sum(amount_minor) from public.commercial_allocations where reversal_of=original.id),0);
 if remaining=0 and requested is null then select id into r from public.commercial_allocations where reversal_of=original.id order by created_at desc,id desc limit 1;return jsonb_build_object('id',r,'remaining_minor',0,'unchanged',true);end if;
 amount:=coalesce(requested,remaining);
 if amount<=0 or amount>remaining then raise exception 'Reversal exceeds remaining allocation' using errcode='P0409';end if;
 insert into public.commercial_allocations(payment_id,invoice_id,amount_minor,reversal_of,reason,created_by) values(p.id,inv.id,-amount,original.id,trim(why),auth.uid()) returning id into r;
 perform private.commercial_sync_membership(inv.id);
 return jsonb_build_object('id',r,'remaining_minor',remaining-amount,'reversed_minor',amount);
end $$;

create function private.commercial_cancel_snapshot(mid uuid,rule text) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.commercial_memberships;inv public.commercial_invoices;today date:=(now() at time zone 'Asia/Dubai')::date;
 eids uuid[];active_eids uuid[];rids uuid[];gross bigint;net bigint;due bigint;credit bigint;used integer;allowance integer;unused integer;period integer;state jsonb;
begin
 select * into m from public.commercial_memberships where id=mid;
 if m.id is null or m.status='cancelled' or m.expires_on<=today then raise exception 'Choose a current uncancelled membership' using errcode='P0409';end if;
 if rule is null or rule not in ('none','unused_calendar_days','unused_entitlements') then raise exception 'Choose an explicit synthetic cancellation policy' using errcode='22023';end if;
 if exists(select 1 from public.commercial_memberships where child_id=m.child_id and branch_id=m.branch_id and sport=m.sport and id<>m.id and status<>'cancelled' and starts_on>m.starts_on) then raise exception 'Resolve later memberships before cancellation' using errcode='P0409';end if;
 select coalesce(array_agg(n.id order by n.id),'{}'::uuid[]) into eids from public.enrollments n join public.academy_classes c on c.id=n.class_id where n.child_id=m.child_id and c.branch_id=m.branch_id and c.sport=m.sport and (n.status='active' or exists(select 1 from public.session_roster r join public.class_sessions s on s.id=r.session_id where r.enrollment_id=n.id and r.kind='enrollment' and not r.cancelled and ((s.starts_at at time zone 'Asia/Dubai')::date>=m.starts_on and (s.starts_at at time zone 'Asia/Dubai')::date<m.expires_on or exists(select 1 from public.entitlement_ledger l where l.roster_id=r.id and l.membership_id=m.id))));
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into active_eids from public.enrollments where id=any(eids) and status='active';
 if m.starts_on>today and cardinality(active_eids)>0 and exists(select 1 from public.commercial_memberships where id<>m.id and child_id=m.child_id and branch_id=m.branch_id and sport=m.sport and status<>'cancelled' and starts_on<m.starts_on) then raise exception 'Future membership shares an active enrollment with an earlier contract; resolve the placement first' using errcode='P0409';end if;
 if exists(select 1 from public.session_roster r join public.class_sessions s on s.id=r.session_id where r.enrollment_id=any(eids) and r.kind='enrollment' and not r.cancelled and s.status<>'cancelled' and s.starts_at<=now() and s.finalized_at is null and (s.starts_at at time zone 'Asia/Dubai')::date>=m.starts_on and (s.starts_at at time zone 'Asia/Dubai')::date<m.expires_on) then raise exception 'Finalize started attendance before cancellation' using errcode='P0409';end if;
 if exists(select 1 from public.makeup_bookings b join public.makeup_credits c on c.id=b.credit_id join public.class_sessions s on s.id=b.session_id where c.enrollment_id=any(eids) and b.status='reserved' and s.status<>'cancelled') then raise exception 'Cancel or finalize reserved makeup bookings first' using errcode='P0409';end if;
 if exists(select 1 from public.session_roster r join public.class_sessions s on s.id=r.session_id where r.enrollment_id=any(eids) and r.kind='enrollment' and not r.cancelled and s.status<>'cancelled' and s.starts_at>now() and ((s.starts_at at time zone 'Asia/Dubai')::date<m.starts_on or (s.starts_at at time zone 'Asia/Dubai')::date>=m.expires_on or exists(select 1 from public.entitlement_ledger l where l.roster_id=r.id and l.membership_id<>m.id group by l.membership_id having sum(l.reserved_delta)>0))) then raise exception 'Shared enrollment has future sessions outside this membership; resolve them first' using errcode='P0409';end if;
 select coalesce(array_agg(r.id order by r.id),'{}'::uuid[]) into rids from public.session_roster r join public.class_sessions s on s.id=r.session_id where r.enrollment_id=any(eids) and r.kind='enrollment' and not r.cancelled and s.status<>'cancelled' and s.starts_at>now();
 select * into inv from public.commercial_invoices where membership_id=m.id;
 select coalesce(sum(quantity::bigint*unit_minor),0) into gross from public.commercial_invoice_lines where invoice_id=inv.id;
 net:=gross-coalesce((select sum(amount_minor) from public.commercial_adjustments where invoice_id=inv.id),0);
 due:=private.commercial_due(inv.id);
 select session_allowance into allowance from public.commercial_packages where id=m.package_id;
 select coalesce(sum(consumed_delta),0) into used from public.entitlement_ledger where membership_id=m.id;
 if net<0 or due<0 or used<0 or used>allowance then raise exception 'Membership accounting needs review before cancellation' using errcode='P0409';end if;
 if rule='none' then credit:=0;unused:=0;period:=1;
 elsif rule='unused_calendar_days' then period:=m.expires_on-m.starts_on;unused:=greatest(0,m.expires_on-greatest(m.starts_on,today+1));credit:=net*unused/period;
 else period:=allowance;unused:=allowance-used;credit:=net*unused/period;end if;
 state:=jsonb_build_object('policy',rule,'policy_version','synthetic-cancellation-v1','membership_id',m.id,'invoice_id',inv.id,'as_of_day',today,'net_minor',net,'open_minor',due,'credit_minor',credit,'released_payment_minor',greatest(0,credit-due),'unused_units',unused,'total_units',period,'rounding','floor_to_minor_unit','enrollment_ids',to_jsonb(active_eids),'scope_enrollment_ids',to_jsonb(eids),'roster_ids',to_jsonb(rids),'membership_state',to_jsonb(m),'allocation_state',(select coalesce(jsonb_agg(jsonb_build_array(id,amount_minor) order by id),'[]') from public.commercial_allocations where invoice_id=inv.id),'adjustment_state',(select coalesce(jsonb_agg(jsonb_build_array(id,amount_minor) order by id),'[]') from public.commercial_adjustments where invoice_id=inv.id),'entitlement_state',(select coalesce(jsonb_agg(jsonb_build_array(id,available_delta,reserved_delta,consumed_delta) order by id),'[]') from public.entitlement_ledger where membership_id=m.id));
 return state;
end $$;

alter function private.commercial_command(text,jsonb) rename to commercial_command_before_amendments;
create function private.commercial_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.commercial_memberships;freeze_row public.commercial_freezes;preview public.commercial_cancellation_previews;cancel public.commercial_membership_cancellations;
 why text:=trim(p_data->>'reason');days integer;elapsed integer;new_end date;r uuid;i uuid;aid uuid;rr uuid;state jsonb;rule text;remaining integer;part integer;item record;result jsonb;
begin
 if p_action not in ('commercial.payment.unallocate','commercial.membership.freeze','commercial.membership.renew','commercial.membership.cancel.preview','commercial.membership.cancel') then return private.commercial_command_before_amendments(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready() and not private.has_role(array['coach','sales']::public.academy_role[]));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if p_action='commercial.payment.unallocate' then
  if p_data ? 'amount_minor' and (jsonb_typeof(p_data->'amount_minor') is distinct from 'number' or (p_data->>'amount_minor') !~ '^[0-9]+$' or (p_data->>'amount_minor')::numeric not between 1 and 1000000000) then raise exception 'Use positive integer minor units' using errcode='22023';end if;
  return private.commercial_reverse_allocation((p_data->>'allocation_id')::uuid,(p_data->>'amount_minor')::integer,why);
 end if;
 if p_action='commercial.membership.cancel' then
  select * into preview from public.commercial_cancellation_previews where id=(p_data->>'preview_id')::uuid;
  select * into m from public.commercial_memberships where id=preview.membership_id for update;
  perform private.require_access(preview.created_by=auth.uid() and private.commercial_can('finance.memberships',m.family_id,m.branch_id) and private.commercial_can('finance.view',m.family_id,m.branch_id));
  if (preview.snapshot->>'credit_minor')::integer>0 then perform private.require_access(private.commercial_can('finance.refund',m.family_id,m.branch_id));end if;
  if why is null or length(why) not between 5 and 500 then raise exception 'Cancellation reason required' using errcode='22023';end if;
  select * into cancel from public.commercial_membership_cancellations where membership_id=m.id;
  if found then if cancel.preview_id=preview.id and cancel.reason=why then return jsonb_build_object('id',cancel.id,'unchanged',true);end if;raise exception 'Membership already cancelled' using errcode='P0409';end if;
  if preview.expires_at<now() then raise exception 'Cancellation preview expired; calculate again' using errcode='P0409';end if;
  state:=private.commercial_cancel_snapshot(m.id,preview.policy);
  if md5(state::text)<>preview.state_hash then raise exception 'Membership changed; calculate cancellation again' using errcode='P0409';end if;
  if (state->>'credit_minor')::integer>0 then perform private.require_access(private.commercial_can('finance.refund',m.family_id,m.branch_id));end if;
  update public.commercial_memberships set status='cancelled' where id=m.id;
  for rr in select value::uuid from jsonb_array_elements_text(state->'roster_ids') loop
   perform private.commercial_roster_event(rr,'release',why);
   update public.session_roster set cancelled=true where id=rr;
  end loop;
  update public.enrollments set status='ended' where id in (select value::uuid from jsonb_array_elements_text(state->'enrollment_ids'));
  update public.waitlist_entries set status='cancelled' where enrollment_id in (select value::uuid from jsonb_array_elements_text(state->'enrollment_ids')) and status in ('waiting','offered');
  i:=(state->>'invoice_id')::uuid;remaining:=(state->>'released_payment_minor')::integer;
  for item in select a.id,a.amount_minor+coalesce((select sum(x.amount_minor) from public.commercial_allocations x where x.reversal_of=a.id),0) balance from public.commercial_allocations a where a.invoice_id=i and a.amount_minor>0 order by a.created_at,a.id loop
   exit when remaining=0;part:=least(remaining,item.balance);
   if part>0 then perform private.commercial_reverse_allocation(item.id,part,why);remaining:=remaining-part;end if;
  end loop;
  if remaining<>0 then raise exception 'Payment allocation changed; retry cancellation preview' using errcode='P0409';end if;
  if (state->>'credit_minor')::integer>0 then insert into public.commercial_adjustments(invoice_id,kind,amount_minor,reason,created_by) values(i,'cancellation',(state->>'credit_minor')::integer,why,auth.uid()) returning id into aid;end if;
  insert into public.commercial_membership_cancellations(membership_id,preview_id,adjustment_id,credit_minor,released_payment_minor,reason,created_by) values(m.id,preview.id,aid,(state->>'credit_minor')::integer,(state->>'released_payment_minor')::integer,why,auth.uid()) returning id into r;
  perform private.emit_product_event('membership.cancelled',r,m.family_id,m.branch_id,'Membership cancelled','The cancellation record and invoice credit are available. Any offline refund is recorded separately.','/parent?view=Memberships');
  return jsonb_build_object('id',r,'credit_minor',state->'credit_minor','released_payment_minor',state->'released_payment_minor');
 end if;
 select * into m from public.commercial_memberships where id=(p_data->>'id')::uuid for update;
 if p_action='commercial.membership.cancel.preview' then
  perform private.require_access(private.commercial_can('finance.memberships',m.family_id,m.branch_id) and private.commercial_can('finance.view',m.family_id,m.branch_id));
  rule:=p_data->>'policy';state:=private.commercial_cancel_snapshot(m.id,rule);
  if (state->>'credit_minor')::integer>0 then perform private.require_access(private.commercial_can('finance.refund',m.family_id,m.branch_id));end if;
  insert into public.commercial_cancellation_previews(membership_id,policy,snapshot,state_hash,created_by) values(m.id,rule,state,md5(state::text),auth.uid()) returning id into r;
  return jsonb_build_object('id',r,'snapshot',state,'expires_in_minutes',15);
 end if;
 if p_action='commercial.membership.renew' then
  perform private.require_access(private.commercial_can('finance.memberships',m.family_id,m.branch_id) or private.family_owner(m.family_id));
  if m.status='cancelled' then raise exception 'Cancelled membership cannot renew' using errcode='P0409';end if;
  return private.commercial_command_before_amendments(p_action,p_data);
 end if;
 perform private.require_access(private.commercial_can('finance.freeze',m.family_id,m.branch_id));
 if m.status='cancelled' then raise exception 'Cancelled membership cannot resume' using errcode='P0409';end if;
 if p_data ? 'extend_days' and (jsonb_typeof(p_data->'extend_days') is distinct from 'number' or (p_data->>'extend_days') !~ '^[0-9]+$' or (p_data->>'extend_days')::numeric not between 0 and 366) then raise exception 'Extension must be whole days from 0 to 366' using errcode='22023';end if;
 days:=coalesce((p_data->>'extend_days')::integer,0);
 if days>0 then
  if (p_data->>'frozen')::boolean is distinct from false or m.status<>'frozen' then raise exception 'Only resuming a frozen membership can extend its expiry' using errcode='P0409';end if;
  select * into freeze_row from public.commercial_freezes where membership_id=m.id and frozen order by created_at desc,id desc limit 1;
  elapsed:=greatest(0,(now() at time zone 'Asia/Dubai')::date-greatest((freeze_row.created_at at time zone 'Asia/Dubai')::date,m.starts_on));
  if freeze_row.id is null or days>elapsed then raise exception 'Extension exceeds elapsed Dubai freeze days' using errcode='P0409';end if;
  new_end:=m.expires_on+days;
  if exists(select 1 from public.commercial_memberships where id<>m.id and child_id=m.child_id and branch_id=m.branch_id and sport=m.sport and daterange(starts_on,expires_on,'[)') && daterange(m.starts_on,new_end,'[)')) then raise exception 'Extension overlaps another membership' using errcode='P0409';end if;
  insert into public.commercial_membership_extensions(membership_id,freeze_id,previous_expires_on,new_expires_on,days,reason,created_by) values(m.id,freeze_row.id,m.expires_on,new_end,days,why,auth.uid());
  update public.commercial_memberships set expires_on=new_end where id=m.id;
 end if;
 return private.commercial_command_before_amendments(p_action,p_data);
end $$;
revoke all on function private.commercial_membership_amendment_guard(),private.commercial_reverse_allocation(uuid,integer,text),private.commercial_cancel_snapshot(uuid,text),private.commercial_sync_membership(uuid),private.commercial_sync_membership_before_amendments(uuid),private.commercial_command(text,jsonb),private.commercial_command_before_amendments(text,jsonb) from public,anon,authenticated;

-- Attendance-only corrections to a closed contract retain its exact settled consumption.
-- The generic reserve/consume/reverse hooks are deliberately unchanged.
create trigger attendance_correction_immutable before update or delete on public.attendance_corrections for each row execute function private.immutable_record();
alter function private.academy_command(text,jsonb) rename to academy_command_before_commercial_amendments;
create function private.academy_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.session_roster;s public.class_sessions;c public.academy_classes;m public.commercial_memberships;k public.makeup_credits;why text;rid uuid;used bigint;held bigint;begin
 if p_action<>'academy.attendance.correct' then return private.academy_command_before_commercial_amendments(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready());
 select * into r from public.session_roster where id=(p_data->>'roster_id')::uuid for update;
 select * into s from public.class_sessions where id=r.session_id;
 select * into c from public.academy_classes where id=s.class_id;
 perform private.require_access(private.product_can('attendance.correct',c.branch_id));
 perform private.require_access(private.academy_child_access((select child_id from public.enrollments where id=r.enrollment_id),c.branch_id));
 select x.* into m from public.commercial_memberships x where x.status='cancelled' and r.kind='enrollment' and exists(select 1 from public.entitlement_ledger l where l.roster_id=r.id and l.membership_id=x.id) order by x.id limit 1 for update;
 if m.id is null then return private.academy_command_before_commercial_amendments(p_action,p_data);end if;
 why:=trim(coalesce(p_data->>'reason',''));
 if s.finalized_at is null or s.status='cancelled' or r.cancelled or length(why) not between 5 and 500 or not coalesce(p_data->>'attendance' in ('present','late','absent','excused'),false) then raise exception 'Invalid correction' using errcode='22023';end if;
 select coalesce(sum(consumed_delta),0),coalesce(sum(reserved_delta),0) into used,held from public.entitlement_ledger where roster_id=r.id and membership_id=m.id;
 if used<>1 or held<>0 or exists(select 1 from public.entitlement_ledger where roster_id=r.id and membership_id<>m.id group by membership_id having sum(consumed_delta)<>0 or sum(reserved_delta)<>0) then raise exception 'Closed attendance requires exactly one settled entitlement' using errcode='P0409';end if;
 if r.attendance=p_data->>'attendance' then return jsonb_build_object('id',r.id);end if;
 select * into k from public.makeup_credits where source_roster_id=r.id for update;
 if k.status in ('reserved','consumed') then raise exception 'Resolve replacement before correcting source attendance' using errcode='P0409';end if;
 insert into public.attendance_corrections(roster_id,previous_status,new_status,reason,actor_id) values(r.id,r.attendance,p_data->>'attendance',why,auth.uid()) returning id into rid;
 update public.makeup_credits set status='revoked' where id=k.id;
 update public.session_roster set attendance=p_data->>'attendance' where id=r.id;
 perform private.makeup_credit_for(r.id);
 return jsonb_build_object('id',rid);
end $$;
revoke all on function private.academy_command(text,jsonb),private.academy_command_before_commercial_amendments(text,jsonb) from public,anon,authenticated;
