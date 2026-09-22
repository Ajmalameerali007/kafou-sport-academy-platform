-- Full permitted search, independent of workspace's 200-row transport pages.
-- Only this coach metadata projection is definer: coaches deliberately cannot
-- SELECT broad class/family tables. No student names or roster data are returned.
create function private.search_coach_sessions() returns table(id uuid,title text,detail text,branch_id uuid)
language sql stable security definer set search_path='' as $$
 select s.id,c.name,s.starts_at::text,c.branch_id
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id
 where private.coach_notice_access(s.id)
 and (private.development_coach_session(s.id) or s.status='cancelled')
 and s.starts_at between now()-interval '90 days' and now()+interval '45 days'
$$;
revoke all on function private.search_coach_sessions() from public,anon;
grant execute on function private.search_coach_sessions() to authenticated;

-- Invoker execution means every ordinary table arm, join, snippet and count is
-- filtered by the same current RLS as the existing workspace. Cursor is only a
-- stable position, never an authorization capability or cached response.
create function public.workspace_search(
 p_query text,p_kinds text[] default array['family','child','lead','class','trial','session'],
 p_after text default null,p_limit integer default 20,p_branch uuid default null,p_child uuid default null
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q text:=lower(btrim(p_query)); result jsonb;
begin
 perform private.require_access(private.active() and private.mfa_ready());
 if q is null or length(q) not between 2 and 80 or p_limit is null or p_limit not between 1 and 50
 or p_kinds is null or cardinality(p_kinds) not between 1 and 6
 or array_position(p_kinds,null) is not null
 or not p_kinds <@ array['family','child','lead','class','trial','session']
 or (p_after is not null and p_after !~ '^(family|child|lead|class|trial|session):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
 raise exception 'Invalid search request' using errcode='22023';end if;
 with candidates as (
 select 'family:'||f.id key,'Family' kind,f.name title,'Family contact information' detail,'Families' section,f.id::text record
 from public.families f where 'family'=any(p_kinds)
 and (p_branch is null or exists(select 1 from public.family_branches b where b.family_id=f.id and b.branch_id=p_branch))
 and (p_child is null or exists(select 1 from public.children k where k.family_id=f.id and k.id=p_child))
 union all
 select 'child:'||k.id,'Child',k.name,concat_ws(' · ',k.reported_age::text,f.name),'Families',k.family_id::text
 from public.children k join public.families f on f.id=k.family_id where 'child'=any(p_kinds)
 and (p_branch is null or exists(select 1 from public.family_branches b where b.family_id=k.family_id and b.branch_id=p_branch))
 and (p_child is null or k.id=p_child)
 union all
 select 'lead:'||l.id,'Lead',l.parent_name,l.stage,'Enquiries',l.id::text
 from public.leads l where 'lead'=any(p_kinds) and (p_branch is null or l.branch_id=p_branch) and p_child is null
 union all
 select 'class:'||c.id,'Class',c.name,c.sport::text,'Classes / Sessions',c.id::text
 from public.academy_classes c where 'class'=any(p_kinds) and (p_branch is null or c.branch_id=p_branch) and p_child is null
 union all
 select 'trial:'||e.id,'Trial',e.child_name,e.reference||' · '||e.sport::text,'Trials',e.id::text
 from public.trial_enquiries e where 'trial'=any(p_kinds)
 and (p_branch is null or exists(select 1 from public.leads l where l.id=e.lead_id and l.branch_id=p_branch)) and p_child is null
 union all
 select 'session:'||s.id,'Session',s.title,s.detail,'Assigned sessions',s.id::text
 from private.search_coach_sessions() s where 'session'=any(p_kinds) and (p_branch is null or s.branch_id=p_branch) and p_child is null
 ), matched as materialized (
 select * from candidates where strpos(lower(title||' '||detail),q)>0
 ), page as materialized (
 select * from matched where p_after is null or key collate "C">p_after collate "C" order by key collate "C" limit p_limit+1
 ), shown as (
 select * from page order by key collate "C" limit p_limit
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',key,'kind',kind,'title',title,'detail',detail,'section',section,'record',record) order by key collate "C") from shown),'[]'::jsonb),
 'total',(select count(*) from matched),
 'next_cursor',case when (select count(*) from page)>p_limit then (select key from shown order by key collate "C" desc limit 1) else null end)
 into result;
 return result;
end $$;
revoke all on function public.workspace_search(text,text[],text,integer,uuid,uuid) from public,anon;
grant execute on function public.workspace_search(text,text[],text,integer,uuid,uuid) to authenticated;

-- Targeted equivalent of the existing coach projection, so an authorized search
-- result beyond the workspace transport limit can actually open. Same time,
-- assignment, cancelled-session and roster-child boundaries; one session only.
create function private.search_coach_session_record(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(x) from (
 select s.id,c.id class_id,c.branch_id,c.name,c.sport,c.level_id,s.starts_at,s.ends_at,s.status,s.finalized_at,s.finalized_by,s.delivered_at,s.delivered_by,s.capacity,v.name venue_name,c.coach_id,p.name coach_name,private.development_coach_session(s.id) can_coach,
 case when s.status='cancelled' or not private.development_coach_session(s.id) then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'name',k.name,'roster_id',r.id,'kind',r.kind,'attendance',r.attendance) order by k.name) from public.session_roster r left join public.enrollments n on n.id=r.enrollment_id left join public.trial_bookings tb on tb.id=r.trial_booking_id left join public.trial_enquiries q on q.id=tb.enquiry_id join public.children k on k.id=coalesce(n.child_id,q.child_id) where r.session_id=s.id and not r.cancelled and private.development_session_child(s.id,k.id)),'[]'::jsonb) end students
 from public.class_sessions s join public.academy_classes c on c.id=s.class_id join public.venues v on v.id=c.venue_id join public.profiles p on p.id=c.coach_id
 where s.id=p_id and private.coach_notice_access(s.id) and (private.development_coach_session(s.id) or s.status='cancelled')
 and s.starts_at between now()-interval '90 days' and now()+interval '45 days') x
$$;
revoke all on function private.search_coach_session_record(uuid) from public,anon;
grant execute on function private.search_coach_session_record(uuid) to authenticated;
create function public.workspace_search_session(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.search_coach_session_record(p_id)
$$;
revoke all on function public.workspace_search_session(uuid) from public,anon;
grant execute on function public.workspace_search_session(uuid) to authenticated;
