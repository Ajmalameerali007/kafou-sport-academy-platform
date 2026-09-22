create function public.management_invoices(p_branch uuid,p_from date,p_to date,p_offset integer default 0,p_outstanding boolean default false,p_query text default '') returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 if not private.branch_access(p_branch) then raise exception 'Branch access denied' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_offset<0 then raise exception 'Invalid range' using errcode='22023';end if;
 with items as (select i.*,f.name family_name,
 greatest(0,coalesce((select sum(quantity::bigint*unit_minor) from public.commercial_invoice_lines where invoice_id=i.id),0)-coalesce((select sum(amount_minor) from public.commercial_allocations where invoice_id=i.id),0)-coalesce((select sum(amount_minor) from public.commercial_adjustments where invoice_id=i.id),0)) balance
 from public.commercial_invoices i join public.families f on f.id=i.family_id where i.branch_id=p_branch and (p_outstanding or (i.created_at at time zone 'Asia/Dubai')::date between p_from and p_to) and (i.reference ilike '%'||p_query||'%' or f.name ilike '%'||p_query||'%')),
 filtered as (select * from items where not p_outstanding or balance>0), page as(select * from filtered order by created_at desc,id offset p_offset limit 50)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(page) from page),'[]'),'total',(select count(*) from filtered),'offset',p_offset) into result;return result;
end $$;
revoke all on function public.management_invoices(uuid,date,date,integer,boolean,text) from public,anon;
grant execute on function public.management_invoices(uuid,date,date,integer,boolean,text) to authenticated;
