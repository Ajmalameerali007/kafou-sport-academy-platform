-- Records an already completed offline compensation payment, never transfers money.
create table public.commercial_compensation_settlements (
 id uuid primary key default gen_random_uuid(), accrual_id uuid not null references public.commercial_compensation_accruals,
 branch_id uuid not null references public.branches, amount_minor integer not null check(amount_minor<>0),
 currency text not null default 'AED' check(currency='AED'), reference text not null check(length(trim(reference)) between 3 and 100),
 reason text not null check(length(trim(reason)) between 5 and 500),
 reversal_of uuid unique references public.commercial_compensation_settlements,
 recorded_by uuid not null references public.profiles, created_at timestamptz not null default now(),
 unique(branch_id,reference), check((reversal_of is null and amount_minor>0) or (reversal_of is not null and amount_minor<0))
);
create index compensation_settlement_accrual on public.commercial_compensation_settlements(accrual_id);
create index compensation_settlement_actor on public.commercial_compensation_settlements(recorded_by);
alter table public.commercial_compensation_settlements enable row level security;
revoke all on public.commercial_compensation_settlements from anon,authenticated;
grant select on public.commercial_compensation_settlements to authenticated;
grant all on public.commercial_compensation_settlements to service_role;
create policy compensation_settlement_read on public.commercial_compensation_settlements for select to authenticated using(private.product_can('finance.compensation',branch_id) and not private.has_role(array['coach','sales']::public.academy_role[]));
create trigger compensation_settlement_immutable before update or delete on public.commercial_compensation_settlements for each row execute function private.commercial_immutable();
create trigger compensation_settlement_audit after insert on public.commercial_compensation_settlements for each row execute function private.commercial_audit();

alter function private.commercial_command(text,jsonb) rename to commercial_command_before_settlement;
create function private.commercial_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.commercial_compensation_accruals; original public.commercial_compensation_settlements; sid uuid; reason text:=trim(p_data->>'reason'); ref text:=trim(p_data->>'reference'); amount integer; begin
 if p_action not in ('commercial.compensation.settle','commercial.compensation.reverse') then return private.commercial_command_before_settlement(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready() and not private.has_role(array['coach','sales']::public.academy_role[]));
 if p_action='commercial.compensation.settle' then
  select * into a from public.commercial_compensation_accruals where id=(p_data->>'id')::uuid for update;
 else
  select * into original from public.commercial_compensation_settlements where id=(p_data->>'id')::uuid;
  select * into a from public.commercial_compensation_accruals where id=original.accrual_id for update;
 end if;
 perform private.require_access(a.id is not null and private.product_can('finance.compensation',a.branch_id) and private.product_can('finance.compensation_payment',a.branch_id));
 if reason is null or length(reason) not between 5 and 500 or ref is null or length(ref) not between 3 and 100 then raise exception 'Reference and reason required' using errcode='22023';end if;
 if p_action='commercial.compensation.settle' then
  if a.status<>'approved' or not exists(select 1 from public.class_sessions s where s.id=a.session_id and s.delivered_at is not null and s.delivered_by=a.coach_id and s.status<>'cancelled' and s.ends_at<=now()) then raise exception 'Only reviewed delivered compensation can be recorded paid' using errcode='P0409';end if;
  if coalesce((select sum(amount_minor) from public.commercial_compensation_settlements where accrual_id=a.id),0)<>0 then raise exception 'Compensation already recorded paid' using errcode='P0409';end if;
  amount:=a.amount_minor;
 else
  if original.amount_minor<=0 or exists(select 1 from public.commercial_compensation_settlements where reversal_of=original.id) then raise exception 'Payment already corrected or not reversible' using errcode='P0409';end if;
  amount:=-original.amount_minor;
 end if;
 if exists(select 1 from public.commercial_compensation_settlements where branch_id=a.branch_id and reference=ref) then raise exception 'Payment reference already recorded' using errcode='P0409';end if;
 insert into public.commercial_compensation_settlements(accrual_id,branch_id,amount_minor,reference,reason,reversal_of,recorded_by) values(a.id,a.branch_id,amount,ref,reason,case when p_action='commercial.compensation.reverse' then original.id end,auth.uid()) returning id into sid;
 return jsonb_build_object('id',sid);
end $$;
revoke all on function private.commercial_command(text,jsonb),private.commercial_command_before_settlement(text,jsonb) from public,anon,authenticated;
