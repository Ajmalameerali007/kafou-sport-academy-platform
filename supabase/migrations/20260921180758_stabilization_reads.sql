-- Read-only, authenticated projections. RLS remains active for every joined relation.
-- Complete aggregates precede bounded detail pagination; no historic rows are rewritten.
create function public.portal_memberships(p_child uuid default null,p_history boolean default false,p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if not private.active() or not private.mfa_ready() or not private.has_role(array['parent']::public.academy_role[]) then raise exception 'Parent access required' using errcode='42501';end if;
 if p_child is not null and not exists(select 1 from public.children c where c.id=p_child and private.family_owner(c.family_id)) then raise exception 'Child access revoked' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 then raise exception 'Invalid page' using errcode='22023';end if;
 with eligible as (select m.*,c.name child_name,b.name branch_name,p.name package_name,p.name_ar package_name_ar,p.terms,p.terms_ar,p.session_allowance,p.price_minor,p.duration_months,p.active offer_enabled,
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

create function public.portal_packages(p_query text default '',p_branch uuid default null,p_offset integer default 0,p_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if not private.active() or not private.mfa_ready() then raise exception 'Access denied' using errcode='42501';end if;
 if p_branch is not null and not private.branch_access(p_branch) then raise exception 'Branch access denied' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 or length(p_query)>100 then raise exception 'Invalid page' using errcode='22023';end if;
 with latest as (select p.*,b.name branch_name from public.commercial_packages p left join public.branches b on b.id=p.branch_id where (p_branch is null or p.branch_id=p_branch)
 and not exists(select 1 from public.package_offer_versions v join public.package_offer_versions n on n.catalogue_id=v.catalogue_id and n.branch_id=v.branch_id and n.revision>v.revision where v.package_id=p.id)),
 catalogues as (select c.id,c.name,c.name_ar,c.sport,false legacy from public.package_catalogue c union all select p.id,p.name,p.name_ar,p.sport,true from latest p where p.catalogue_id is null),
 eligible as (select c.*,a.assigned_count,a.enabled_count,a.min_price,a.max_price,a.min_sessions,a.max_sessions,a.min_months,a.max_months
 from catalogues c cross join lateral (select count(*) assigned_count,count(*) filter(where p.active) enabled_count,min(price_minor) min_price,max(price_minor) max_price,min(session_allowance) min_sessions,max(session_allowance) max_sessions,min(duration_months) min_months,max(duration_months) max_months from latest p where p.catalogue_id=c.id or (c.legacy and p.id=c.id)) a
 where (p_id is null or c.id=p_id) and (p_branch is null or a.assigned_count>0) and (private.head_office() or a.enabled_count>0)
 and (p_query='' or c.name ilike '%'||p_query||'%' or c.name_ar ilike '%'||p_query||'%')),
 page as(select * from eligible order by name,id offset p_offset limit 20)
 select jsonb_build_object('total',(select count(*) from eligible),'items',coalesce((select jsonb_agg(p) from page p),'[]')) into result;
 return result;
end $$;
revoke all on function public.portal_packages(text,uuid,integer,uuid) from public,anon;
grant execute on function public.portal_packages(text,uuid,integer,uuid) to authenticated;

-- Branch matrix is independently paginated; only submitted branches are changed by existing commands.
create function public.portal_package_branches(p_id uuid,p_sport public.sport_id,p_query text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if not private.head_office() or not private.active() or not private.mfa_ready() then raise exception 'Configuration access required' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 or length(p_query)>100 then raise exception 'Invalid page' using errcode='22023';end if;
 with eligible as(select b.id,b.name,b.active,to_jsonb(p) offer from public.branches b
 join public.branch_sports bs on bs.branch_id=b.id and bs.sport=p_sport
 left join lateral(select p.* from public.commercial_packages p left join public.package_offer_versions v on v.package_id=p.id where p.branch_id=b.id and (p.catalogue_id=p_id or p.id=p_id) order by v.revision desc nulls last,p.created_at desc,p.id limit 1) p on true
 where p_query='' or b.name ilike '%'||p_query||'%'), page as(select * from eligible order by name,id offset p_offset limit 20)
 select jsonb_build_object('total',(select count(*) from eligible),'items',coalesce((select jsonb_agg(p) from page p),'[]'),
 'base',(select to_jsonb(p) from public.commercial_packages p left join public.package_offer_versions v on v.package_id=p.id where p.catalogue_id=p_id or p.id=p_id order by v.created_at desc nulls last,p.created_at desc,p.id limit 1)) into result;
 return result;
end $$;
revoke all on function public.portal_package_branches(uuid,public.sport_id,text,integer) from public,anon;
grant execute on function public.portal_package_branches(uuid,public.sport_id,text,integer) to authenticated;

create function public.portal_calendar(p_from date,p_to date,p_branch uuid default null,p_query text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if not private.active() or not private.mfa_ready() then raise exception 'Access denied' using errcode='42501';end if;
 if p_branch is not null and not private.branch_access(p_branch) then raise exception 'Branch access denied' using errcode='42501';end if;
 if p_to<p_from or p_to-p_from>31 or p_offset<0 or p_offset>100000 or length(p_query)>100 then raise exception 'Invalid date range or page' using errcode='22023';end if;
 with eligible as(select s.*,c.branch_id,c.name class_name,v.name venue_name,p.name coach_name,
 (select count(*) from public.session_roster r where r.session_id=s.id and not r.cancelled) booked
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id left join public.venues v on v.id=c.venue_id left join public.profiles p on p.id=c.coach_id
 where s.starts_at>=p_from::timestamp at time zone 'Asia/Dubai' and s.starts_at<(p_to+1)::timestamp at time zone 'Asia/Dubai'
 and (p_branch is null or c.branch_id=p_branch) and (p_query='' or concat_ws(' ',c.name,v.name,p.name) ilike '%'||p_query||'%')),
 page as(select * from eligible order by starts_at,id offset p_offset limit 100)
 select jsonb_build_object('total',(select count(*) from eligible),'items',coalesce((select jsonb_agg(p) from page p),'[]')) into result;return result;
end $$;
revoke all on function public.portal_calendar(date,date,uuid,text,integer) from public,anon;
grant execute on function public.portal_calendar(date,date,uuid,text,integer) to authenticated;
create function public.portal_children(p_child uuid default null,p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 result:=public.member_v1_read('children',p_child,p_offset,20);
 return jsonb_set(result,'{items}',coalesce((select jsonb_agg(e.value||jsonb_build_object(
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'status',m.status,'sport',m.sport,'expires_on',m.expires_on)) from public.commercial_memberships m where m.child_id=(e.value->>'id')::uuid and m.status<>'cancelled' and m.expires_on>(now() at time zone 'Asia/Dubai')::date),'[]'),
 'age',case when nullif(e.value->>'date','') is not null then extract(year from age((now() at time zone 'Asia/Dubai')::date,(e.value->>'date')::date))::integer else (e.value->>'age')::integer end
 )) from jsonb_array_elements(result->'items') e),'[]'));
end $$;
revoke all on function public.portal_children(uuid,integer) from public,anon;
grant execute on function public.portal_children(uuid,integer) to authenticated;
-- Opaque revision of RLS-visible records, not an event stream or unscoped subscription.
-- No data values leave this read; authorization/grants are re-evaluated on every request.
create function public.portal_revision(p_branch uuid default null) returns text
language plpgsql stable security invoker set search_path='' as $$
declare t text; signature text; fragment text; predicate text;begin
 if not private.active() or not private.mfa_ready() then raise exception 'Access denied' using errcode='42501';end if;
 if p_branch is not null and not private.branch_access(p_branch) then raise exception 'Branch access denied' using errcode='42501';end if;
 signature:=public.account_context()::text;
 foreach t in array array['families','children','child_sports','guardians','branch_permissions','product_permissions','leads','trial_enquiries','trial_bookings','academy_classes','class_sessions','session_roster','enrollments','commercial_packages','package_catalogue','commercial_memberships','commercial_invoices','commercial_allocations','commercial_adjustments','commercial_payments','entitlement_ledger','commercial_compensation_accruals','commercial_compensation_settlements','development_assessments','development_reports','development_certificates','makeup_credits','notifications','coach_messages'] loop
  predicate:='';
  if p_branch is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='branch_id') then predicate:=' where branch_id=$1';end if;
  execute format('select count(*)::text||'':''||coalesce(max(xmin::text::bigint),0)::text from public.%I%s',t,predicate) into fragment using p_branch;
  signature:=signature||t||fragment;
 end loop;
 return md5(signature);
end $$;
revoke all on function public.portal_revision(uuid) from public,anon;
grant execute on function public.portal_revision(uuid) to authenticated;
-- Optional review preconditions preserve backward compatibility for existing callers.
alter function private.commercial_command(text,jsonb) rename to commercial_command_before_stabilization;
create function private.commercial_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.commercial_memberships;begin
 if p_action='commercial.membership.renew' and p_data ? 'expected_expires_on' then
  select * into m from public.commercial_memberships where id=(p_data->>'id')::uuid for update;
  perform private.require_access(private.active() and private.mfa_ready() and (private.family_owner(m.family_id) or private.commercial_can('finance.memberships',m.family_id,m.branch_id)));
  if m.expires_on<>(p_data->>'expected_expires_on')::date or m.package_id<>(p_data->>'expected_package_id')::uuid then raise exception 'Membership changed. Close this panel and review the renewal again.' using errcode='P0409';end if;
 end if;
 return private.commercial_command_before_stabilization(p_action,p_data);
end $$;
revoke all on function private.commercial_command(text,jsonb),private.commercial_command_before_stabilization(text,jsonb) from public,anon,authenticated;
