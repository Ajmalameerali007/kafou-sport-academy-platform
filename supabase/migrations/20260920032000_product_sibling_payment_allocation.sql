-- A single family payment may need to be split across several siblings'
-- invoices in one atomic action instead of one allocate call per invoice.
alter function private.commercial_command(text,jsonb) rename to commercial_command_before_split_allocation;
create function private.commercial_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare pay public.commercial_payments; item jsonb; inv_id uuid; amt integer; ids uuid[]:=array[]::uuid[]; aid uuid; begin
 if p_action<>'commercial.payment.allocate-split' then return private.commercial_command_before_split_allocation(p_action,p_data);end if;
 perform private.require_access(private.active() and private.mfa_ready() and not private.has_role(array['coach','sales']::public.academy_role[]));
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into pay from public.commercial_payments where id=(p_data->>'payment_id')::uuid for update;
 perform private.require_access(pay.id is not null and private.commercial_can('finance.payment',pay.family_id,pay.branch_id));
 if jsonb_typeof(p_data->'allocations')<>'array' or jsonb_array_length(p_data->'allocations')<2 then raise exception 'Provide at least two allocations to split a payment' using errcode='22023';end if;
 for item in select * from jsonb_array_elements(p_data->'allocations') loop
  inv_id:=(item->>'invoice_id')::uuid;
  if item->>'amount_minor' !~ '^[0-9]+$' then raise exception 'Use integer minor units' using errcode='22023';end if;
  amt:=(item->>'amount_minor')::integer;
  if not exists(select 1 from public.commercial_invoices where id=inv_id and family_id=pay.family_id) then raise exception 'Every invoice must belong to the payment family' using errcode='22023';end if;
  aid:=private.commercial_allocate(pay.id,inv_id,amt);
  ids:=ids||aid;
 end loop;
 return jsonb_build_object('ids',to_jsonb(ids));
end $$;
revoke all on function private.commercial_command(text,jsonb),private.commercial_command_before_split_allocation(text,jsonb) from public,anon,authenticated;
