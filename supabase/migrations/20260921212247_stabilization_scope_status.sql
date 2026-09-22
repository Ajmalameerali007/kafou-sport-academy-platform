-- Read effective eligibility without rewriting immutable contract or financial history.
create function public.portal_membership_status(p_id uuid) returns text
language sql stable security invoker set search_path='' as $$
 select case when m.status='cancelled' then 'cancelled'
 when m.expires_on<=(now() at time zone 'Asia/Dubai')::date then 'expired'
 when i.id is null then 'unavailable'
 when m.status='active' and d.due>0 and not exists(select 1 from public.commercial_credit_approvals c where c.invoice_id=i.id and c.revoked_at is null and c.expires_on>=(now() at time zone 'Asia/Dubai')::date and c.amount_minor>=d.due) then 'suspended' else m.status end
 from public.commercial_memberships m left join public.commercial_invoices i on i.membership_id=m.id
 cross join lateral(select coalesce((select sum(l.quantity::bigint*l.unit_minor) from public.commercial_invoice_lines l where l.invoice_id=i.id),0)-coalesce((select sum(a.amount_minor) from public.commercial_allocations a where a.invoice_id=i.id),0)-coalesce((select sum(a.amount_minor) from public.commercial_adjustments a where a.invoice_id=i.id),0) due) d
 where m.id=p_id;
$$;
revoke all on function public.portal_membership_status(uuid) from public,anon;
grant execute on function public.portal_membership_status(uuid) to authenticated;

create function public.portal_authority() returns text language sql stable security invoker set search_path='' as $$
 select md5(public.account_context()::text||
 coalesce((select string_agg(to_jsonb(g)::text,',' order by family_id) from public.guardians g where user_id=auth.uid()),'')||
 coalesce((select string_agg(to_jsonb(p)::text,',' order by id) from public.product_permissions p where user_id=auth.uid()),'')||
 coalesce((select string_agg(to_jsonb(a)::text,',' order by id) from public.coach_assignments a where coach_id=auth.uid()),'')||
 coalesce((select string_agg(id::text,',' order by id) from public.academy_classes where coach_id=auth.uid()),''));
$$;
revoke all on function public.portal_authority() from public,anon;
grant execute on function public.portal_authority() to authenticated;

create or replace function public.portal_memberships(p_child uuid default null,p_history boolean default false,p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if not private.active() or not private.mfa_ready() or not private.has_role(array['parent']::public.academy_role[]) then raise exception 'Parent access required' using errcode='42501';end if;
 if p_child is not null and not exists(select 1 from public.children c where c.id=p_child and private.family_owner(c.family_id)) then raise exception 'Child access revoked' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 then raise exception 'Invalid page' using errcode='22023';end if;
 with eligible as (select m.*,public.portal_membership_status(m.id) effective_status,c.name child_name,b.name branch_name,p.name package_name,p.name_ar package_name_ar,p.terms,p.terms_ar,p.session_allowance,p.price_minor,p.duration_months,p.active offer_enabled,
 i.id invoice_id,i.reference invoice_reference,
 case when i.id is null then null else
 coalesce((select sum(l.quantity::bigint*l.unit_minor) from public.commercial_invoice_lines l where l.invoice_id=i.id),0)
 -coalesce((select sum(a.amount_minor) from public.commercial_allocations a where a.invoice_id=i.id),0)
 -coalesce((select sum(a.amount_minor) from public.commercial_adjustments a where a.invoice_id=i.id),0) end due_minor,
 coalesce((select sum(available_delta) from public.entitlement_ledger e where e.membership_id=m.id),0) available,
 coalesce((select sum(reserved_delta) from public.entitlement_ledger e where e.membership_id=m.id),0) reserved,
 coalesce((select sum(consumed_delta) from public.entitlement_ledger e where e.membership_id=m.id),0) consumed,
 (select n.id from public.commercial_memberships n where n.renewed_from=m.id) renewal_id,
 (m.expires_on+make_interval(months=>p.duration_months))::date renewal_expires_on,
 (select v.revision from public.package_offer_versions v where v.package_id=p.id) offer_revision
 from public.commercial_memberships m join public.children c on c.id=m.child_id
 join public.commercial_packages p on p.id=m.package_id left join public.branches b on b.id=m.branch_id
 left join public.commercial_invoices i on i.membership_id=m.id
 where private.family_owner(m.family_id) and (p_child is null or m.child_id=p_child)
 and ((m.expires_on<=(now() at time zone 'Asia/Dubai')::date or m.status='cancelled')=p_history)),
 page as (select * from eligible order by starts_on desc,id offset p_offset limit 20)
 select jsonb_build_object('total',(select count(*) from eligible),'items',coalesce((select jsonb_agg(p) from page p),'[]')) into result;
 return result;
end $$;
revoke all on function public.portal_memberships(uuid,boolean,integer) from public,anon;
grant execute on function public.portal_memberships(uuid,boolean,integer) to authenticated;

create or replace function public.portal_children(p_child uuid default null,p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 result:=public.member_v1_read('children',p_child,p_offset,20);
 return jsonb_set(result,'{items}',coalesce((select jsonb_agg(e.value||jsonb_build_object(
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'status',public.portal_membership_status(m.id),'sport',m.sport,'expires_on',m.expires_on)) from public.commercial_memberships m where m.child_id=(e.value->>'id')::uuid and m.status<>'cancelled' and m.expires_on>(now() at time zone 'Asia/Dubai')::date),'[]'),
 'age',case when nullif(e.value->>'date','') is not null then extract(year from age((now() at time zone 'Asia/Dubai')::date,(e.value->>'date')::date))::integer else (e.value->>'age')::integer end
 )) from jsonb_array_elements(result->'items') e),'[]'));
end $$;
revoke all on function public.portal_children(uuid,integer) from public,anon;
grant execute on function public.portal_children(uuid,integer) to authenticated;

create or replace function public.portal_revision(p_branch uuid default null) returns text
language plpgsql stable security invoker set search_path='' as $$
declare t text; signature text; fragment text; predicate text;begin
 if not private.active() or not private.mfa_ready() then raise exception 'Access denied' using errcode='42501';end if;
 if p_branch is not null and not private.branch_access(p_branch) then raise exception 'Branch access denied' using errcode='42501';end if;
 signature:=public.account_context()::text;
 foreach t in array array['profiles','branches','venues','branch_sports','coach_assignments','commercial_compensation_rates','commercial_credit_approvals','families','children','child_sports','guardians','branch_permissions','product_permissions','leads','trial_enquiries','trial_bookings','academy_classes','class_sessions','session_roster','enrollments','commercial_packages','package_catalogue','commercial_memberships','commercial_invoices','commercial_allocations','commercial_adjustments','commercial_payments','entitlement_ledger','commercial_compensation_accruals','commercial_compensation_settlements','development_assessments','development_reports','development_certificates','makeup_credits','notifications','coach_messages'] loop
  predicate:='';
  if p_branch is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='branch_id') then predicate:=' where branch_id=$1';end if;
  execute format('select count(*)::text||'':''||coalesce(max(xmin::text::bigint),0)::text from public.%I%s',t,predicate) into fragment using p_branch;
  signature:=signature||t||fragment;
 end loop;
 return md5(signature);
end $$;
revoke all on function public.portal_revision(uuid) from public,anon;
grant execute on function public.portal_revision(uuid) to authenticated;
