create function public.management_invoice(p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare i public.commercial_invoices; l jsonb; a jsonb; d jsonb; paid bigint; due bigint;begin
 select * into i from public.commercial_invoices where id=p_id;
 if i.id is null then raise exception 'Invoice access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(x),'[]'),coalesce(sum(quantity::bigint*unit_minor),0) into l,due from public.commercial_invoice_lines x where invoice_id=p_id;
 select coalesce(jsonb_agg(x),'[]'),coalesce(sum(amount_minor),0) into a,paid from public.commercial_allocations x where invoice_id=p_id;
 select coalesce(jsonb_agg(x),'[]'),due-paid-coalesce(sum(amount_minor),0) into d,due from public.commercial_adjustments x where invoice_id=p_id;
 return jsonb_build_object('invoice',to_jsonb(i),'lines',l,'allocations',a,'adjustments',d,'balance',greatest(0,due));
end $$;
revoke all on function public.management_invoice(uuid) from public,anon;
grant execute on function public.management_invoice(uuid) to authenticated;
