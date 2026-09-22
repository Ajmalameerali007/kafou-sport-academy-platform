-- Preserve global permission grants and dependent progress records in a branch workspace.
create or replace function public.branch_records(p_table text,p_branch uuid,p_offset integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
declare predicate text; result jsonb; cols text[]; begin
 if not private.active() or not private.branch_access(p_branch) then raise exception 'Branch access denied' using errcode='42501';end if;
 if p_offset<0 or p_offset>100000 or p_table !~ '^[a-z][a-z_]+$' or not exists(select 1 from information_schema.tables where table_schema='public' and table_name=p_table) then raise exception 'Invalid record request' using errcode='22023';end if;
 select array_agg(column_name::text) into cols from information_schema.columns where table_schema='public' and table_name=p_table;
 if p_table='product_permissions' then predicate:='t.branch_id=$1 or t.branch_id is null';
 elsif 'branch_id'=any(cols) then predicate:='t.branch_id=$1';
 elsif p_table='branches' then predicate:='t.id=$1';
 elsif p_table='families' then predicate:='exists(select 1 from public.family_branches fb where fb.family_id=t.id and fb.branch_id=$1)';
 elsif p_table='development_safety_children' then predicate:='exists(select 1 from public.children c join public.family_branches fb on fb.family_id=c.family_id where c.id=t.id and fb.branch_id=$1)';
 elsif p_table='profiles' then predicate:='exists(select 1 from public.branch_permissions bp where bp.user_id=t.id and bp.branch_id=$1)';
 elsif p_table in ('role_assignments','coach_availability') then predicate:=case when p_table='role_assignments' then 'exists(select 1 from public.branch_permissions bp where bp.user_id=t.user_id and bp.branch_id=$1)' else 'exists(select 1 from public.branch_permissions bp where bp.user_id=t.coach_id and bp.branch_id=$1)' end;
 elsif 'family_id'=any(cols) then predicate:='exists(select 1 from public.family_branches fb where fb.family_id=t.family_id and fb.branch_id=$1)';
 elsif 'invoice_id'=any(cols) then predicate:='exists(select 1 from public.commercial_invoices i where i.id=t.invoice_id and i.branch_id=$1)';
 elsif 'payment_id'=any(cols) then predicate:='exists(select 1 from public.commercial_payments p where p.id=t.payment_id and p.branch_id=$1)';
 elsif 'membership_id'=any(cols) then predicate:='exists(select 1 from public.commercial_memberships m where m.id=t.membership_id and m.branch_id=$1)';
 elsif 'class_id'=any(cols) then predicate:='exists(select 1 from public.academy_classes c where c.id=t.class_id and c.branch_id=$1)';
 elsif 'session_id'=any(cols) then predicate:='exists(select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id where s.id=t.session_id and c.branch_id=$1)';
 elsif 'lead_id'=any(cols) then predicate:='exists(select 1 from public.leads l where l.id=t.lead_id and l.branch_id=$1)';
 elsif 'conversation_id'=any(cols) then predicate:='exists(select 1 from public.coach_conversations c where c.id=t.conversation_id and c.branch_id=$1)';
 elsif 'target_id'=any(cols) then predicate:='exists(select 1 from public.development_targets d join public.class_sessions s on s.id=d.session_id join public.academy_classes c on c.id=s.class_id where d.id=t.target_id and c.branch_id=$1)';
 elsif 'assessment_id'=any(cols) then predicate:='exists(select 1 from public.development_assessments a join public.class_sessions s on s.id=a.session_id join public.academy_classes c on c.id=s.class_id where a.id=t.assessment_id and c.branch_id=$1)';
 elsif 'certificate_id'=any(cols) then predicate:='exists(select 1 from public.development_certificates c join public.development_assessments a on a.id=c.assessment_id join public.class_sessions s on s.id=a.session_id join public.academy_classes cl on cl.id=s.class_id where c.id=t.certificate_id and cl.branch_id=$1)';
 elsif 'child_id'=any(cols) then predicate:='exists(select 1 from public.children c join public.family_branches fb on fb.family_id=c.family_id where c.id=t.child_id and fb.branch_id=$1)';
 elsif p_table in ('sport_levels','age_groups','development_criteria','package_catalogue') then predicate:='true';
 else return '[]'::jsonb;end if;
 execute format('select coalesce(jsonb_agg(x),''[]''::jsonb) from (select t.* from public.%I t where %s order by to_jsonb(t)::text offset $2 limit 200)x',p_table,predicate) into result using p_branch,p_offset;
 return result;
end $$;

