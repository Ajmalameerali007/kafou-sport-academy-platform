-- Complete aggregates use one MVCC statement snapshot, never a portal page.
-- Read-only SECURITY DEFINER projection exposes aggregates only; every source has
-- an explicit current actor/branch/assignment/finance predicate.
create function public.business_report(p_from date,p_to date,p_branch uuid default null,p_sport public.sport_id default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;begin
 perform private.require_access(private.active() and private.mfa_ready() and private.has_role(array['super_admin','admin','branch','sales','coach']::public.academy_role[]));
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>3660 then raise exception 'Invalid reporting period' using errcode='22023';end if;
 with bounds as (select p_from::timestamp at time zone 'Asia/Dubai' lo,(p_to+1)::timestamp at time zone 'Asia/Dubai' hi),
 scoped_sessions as materialized (
 select s.*,c.branch_id,c.sport from public.class_sessions s join public.academy_classes c on c.id=s.class_id
 where (p_branch is null or c.branch_id=p_branch) and (p_sport is null or c.sport=p_sport)
 and (private.operations_staff(c.branch_id) or private.coach_notice_access(s.id))
 ), sessions as materialized (select s.* from scoped_sessions s,bounds b where starts_at>=b.lo and starts_at<b.hi),
 session_counts as (
 select s.id,s.branch_id,s.sport,s.starts_at,s.capacity,
 count(r.id) booked,
 count(r.id) filter(where s.finalized_at is not null and r.attendance in ('present','late','absent','excused')) marked,
 count(r.id) filter(where s.finalized_at is not null and r.attendance in ('present','late')) attended,
 count(r.id) filter(where s.finalized_at is not null and r.attendance='absent') absent,
 count(r.id) filter(where s.finalized_at is not null and r.attendance='excused') excused
 from sessions s left join public.session_roster r on r.session_id=s.id and not r.cancelled
 -- Substitute access is checked now, not copied from a previous request.
 and (private.operations_staff(s.branch_id) or private.development_coach_session(s.id))
 where s.status<>'cancelled' group by s.id,s.branch_id,s.sport,s.starts_at,s.capacity
 ), improvements as materialized (
 select h.child_id,s.branch_id,h.sport from public.development_level_history h
 join public.development_assessments a on a.id=h.assessment_id join scoped_sessions s on s.id=a.session_id,bounds b
 where h.created_at>=b.lo and h.created_at<b.hi and not exists(select 1 from public.development_level_reversals r where r.history_id=h.id)
 and private.development_staff(a.session_id,a.child_id)
 ), group_sources as (
 select 'branch' kind,branch_id::text key,id,capacity,booked,marked,attended,absent,excused from session_counts
 union all select 'sport',sport::text,id,capacity,booked,marked,attended,absent,excused from session_counts
 union all select 'day',(starts_at at time zone 'Asia/Dubai')::date::text,id,capacity,booked,marked,attended,absent,excused from session_counts
 ), group_keys as (select kind,key from group_sources union select 'branch',branch_id::text from improvements union select 'sport',sport::text from improvements),
 groups as (select k.kind,k.key,jsonb_build_object('key',k.key,'sessions',count(g.id),'booked',coalesce(sum(g.booked),0),'capacity',coalesce(sum(g.capacity),0),
 'utilization',sum(g.booked)::numeric/nullif(sum(g.capacity),0),'attendanceRate',sum(g.attended)::numeric/nullif(sum(g.marked),0),
 'absent',coalesce(sum(g.absent),0),'excused',coalesce(sum(g.excused),0),
 'progressedStudents',(select count(distinct child_id) from improvements i where (k.kind='branch' and i.branch_id::text=k.key) or (k.kind='sport' and i.sport::text=k.key))) item
 from group_keys k left join group_sources g using(kind,key) group by k.kind,k.key),
 leads as materialized (select l.stage from public.leads l,bounds b where l.created_at>=b.lo and l.created_at<b.hi
 and (p_branch is null or l.branch_id=p_branch) and private.branch_access(l.branch_id)
 and (p_sport is null or exists(select 1 from public.trial_enquiries q where q.lead_id=l.id and q.sport=p_sport))),
 assessments as materialized (select a.* from public.development_assessments a join scoped_sessions s on s.id=a.session_id where private.development_staff(a.session_id,a.child_id)),
 invoices as materialized (select i.* from public.commercial_invoices i where (p_branch is null or i.branch_id=p_branch) and private.commercial_can('finance.view',i.family_id,i.branch_id)),
 invoice_totals as materialized (select i.id,i.created_at,
 coalesce((select sum(l.quantity::bigint*l.unit_minor) from public.commercial_invoice_lines l where l.invoice_id=i.id),0) billed,
 coalesce((select sum(a.amount_minor::bigint) from public.commercial_allocations a where a.invoice_id=i.id),0) allocated,
 coalesce((select sum(a.amount_minor::bigint) from public.commercial_adjustments a where a.invoice_id=i.id),0) adjusted
 from invoices i),
 payments as materialized (select p.* from public.commercial_payments p,bounds b where p.created_at>=b.lo and p.created_at<b.hi and (p_branch is null or p.branch_id=p_branch) and private.commercial_can('finance.view',p.family_id,p.branch_id)),
 members as materialized (select m.* from public.commercial_memberships m where (p_branch is null or m.branch_id=p_branch) and private.commercial_can('finance.view',m.family_id,m.branch_id)),
 finance_allowed as (select exists(select 1 from public.branches b where (p_branch is null or b.id=p_branch) and private.product_can('finance.view',b.id)) and not private.has_role(array['parent','coach','sales']::public.academy_role[]) allowed)
 select jsonb_build_object(
 'asOf',statement_timestamp(),'snapshot','single_statement_current_state','range',jsonb_build_object('from',p_from,'to',p_to),'branchId',p_branch,'sport',p_sport,
 'sales',jsonb_build_object('total',(select count(*) from leads),'byStage',coalesce((select jsonb_object_agg(stage,n) from(select stage,count(*) n from leads group by stage)x),'{}'),
 'conversionRate',coalesce((select count(*) filter(where stage='converted')::numeric/nullif(count(*),0) from leads),0),'lostRate',coalesce((select count(*) filter(where stage='lost')::numeric/nullif(count(*),0) from leads),0)),
 'operations',jsonb_build_object('total',(select count(*) from sessions),'byStatus',coalesce((select jsonb_object_agg(status,n) from(select status,count(*) n from sessions group by status)x),'{}'),
 'sessions',(select count(*) from session_counts),'booked',(select coalesce(sum(booked),0) from session_counts),'capacity',(select coalesce(sum(capacity),0) from session_counts),
 'utilization',(select sum(booked)::numeric/nullif(sum(capacity),0) from session_counts),'attendanceRate',(select sum(attended)::numeric/nullif(sum(marked),0) from session_counts),'absent',(select coalesce(sum(absent),0) from session_counts),'excused',(select coalesce(sum(excused),0) from session_counts)),
 'financeVisible',(select allowed from finance_allowed),
 -- Family-level payments can cover several sports. Do not invent attribution.
 -- Financial cards explicitly retain the selected branch and all sports.
 'financeScope','selected_branch_all_sports',
 'finance',case when (select allowed from finance_allowed) then jsonb_build_object('invoicedMinor',(select coalesce(sum(billed),0) from invoice_totals,bounds where created_at>=lo and created_at<hi),
 'receivedMinor',(select coalesce(sum(amount_minor::bigint),0) from payments),
 'refundedMinor',(select coalesce(sum(r.amount_minor::bigint),0) from public.commercial_refunds r join public.commercial_payments p on p.id=r.payment_id,bounds b where r.created_at>=b.lo and r.created_at<b.hi and (p_branch is null or p.branch_id=p_branch) and private.commercial_can('finance.view',p.family_id,p.branch_id)),
 'outstandingMinor',(select coalesce(sum(greatest(0,billed-allocated-adjusted)),0) from invoice_totals),'activeMemberships',(select count(*) from members where status='active'),
 'expiringSoon',(select count(*) from members where status='active' and expires_on between p_from and p_to)) else null end,
 'coaching',jsonb_build_object('deliveredSessions',(select count(*) from sessions where delivered_by is not null and status<>'cancelled'),
 'byCoach',coalesce((select jsonb_object_agg(delivered_by,n) from(select delivered_by,count(*) n from sessions where delivered_by is not null and status<>'cancelled' group by delivered_by)x),'{}'),
 'assessments',(select count(*) from assessments,bounds where created_at>=lo and created_at<hi),'publishedAssessments',(select count(*) from assessments,bounds where published_at>=lo and published_at<hi)),
 'branches',coalesce((select jsonb_agg(item order by key) from groups where kind='branch'),'[]'),
 'sports',coalesce((select jsonb_agg(item order by key) from groups where kind='sport'),'[]'),
 'trend',coalesce((select jsonb_agg(item order by key) from groups where kind='day'),'[]')) into result;
 return result;
end $$;
revoke all on function public.business_report(date,date,uuid,public.sport_id) from public,anon;
grant execute on function public.business_report(date,date,uuid,public.sport_id) to authenticated;
