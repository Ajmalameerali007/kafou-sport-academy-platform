-- Optional Coach attendance. No permission grants or fixture data are seeded.
-- Front Desk operations_staff and operations_command authorization are unchanged.
create function private.coach_attendance_access(p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.development_coach_session(p_session) and exists(
  select 1 from public.class_sessions s join public.academy_classes c on c.id=s.class_id
  join public.product_permissions p on p.user_id=auth.uid() and p.permission='attendance.finalize'
   and (p.branch_id is null or p.branch_id=c.branch_id)
  where s.id=p_session and private.product_can('attendance.finalize',c.branch_id))
$$;

-- Minimal complete roster, including trial participants without a child record.
-- No guardian contacts, private notes, finances, or unrelated participants.
create function public.coach_attendance_sessions() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'roster',
  coalesce((select jsonb_agg(jsonb_build_object('id',r.id,
   'name',coalesce(k.name,q.child_name,'Trial participant'),
   'kind',r.kind,'attendance',r.attendance) order by r.id)
   from public.session_roster r
   left join public.enrollments n on n.id=r.enrollment_id
   left join public.trial_bookings b on b.id=r.trial_booking_id
   left join public.trial_enquiries q on q.id=b.enquiry_id
   left join public.children k on k.id=coalesce(n.child_id,q.child_id)
   where r.session_id=s.id and not r.cancelled),'[]'::jsonb)) order by s.starts_at),'[]'::jsonb)
 from (select cs.id,cs.starts_at from public.class_sessions cs
  where cs.starts_at between now()-interval '90 days' and now()+interval '45 days'
   and private.coach_attendance_access(cs.id)
  order by cs.starts_at desc limit 200) s
$$;

create function private.coach_attendance_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.class_sessions; r public.session_roster; item jsonb; entries jsonb;
begin
 if p_action<>'coach_attendance.finalize' or jsonb_typeof(p_data) is distinct from 'object'
  or p_data - array['session_id','entries'] <> '{}'::jsonb then
  raise exception 'Invalid coach attendance command' using errcode='22023';
 end if;
 select * into s from public.class_sessions where id=(p_data->>'session_id')::uuid for update;
 perform private.require_access(private.coach_attendance_access(s.id));
 if s.finalized_at is not null then raise exception 'Attendance is finalized' using errcode='P0409';end if;
 if s.status<>'scheduled' or s.starts_at>now() then
  raise exception 'Session has not started or is cancelled' using errcode='P0409';end if;
 entries:=p_data->'entries';
 if jsonb_typeof(entries) is distinct from 'array' then
  raise exception 'Supply each roster entry exactly once' using errcode='22023';end if;
 if jsonb_array_length(entries)>100
  or jsonb_array_length(entries)<>(select count(*) from public.session_roster where session_id=s.id and not cancelled)
  or (select count(distinct value->>'id') from jsonb_array_elements(entries))<>jsonb_array_length(entries)
  or exists(select 1 from jsonb_array_elements(entries) i where jsonb_typeof(i) is distinct from 'object'
   or i - array['id','attendance'] <> '{}'::jsonb or i->>'attendance' is null
   or i->>'attendance' not in ('present','absent','late','excused')) then
  raise exception 'Supply each roster entry exactly once with valid attendance' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(entries) loop
  update public.session_roster set attendance=item->>'attendance'
   where id=(item->>'id')::uuid and session_id=s.id and not cancelled returning * into r;
  if not found then raise exception 'Invalid roster entry' using errcode='22023';end if;
  if r.attendance in ('absent','excused') then
   insert into public.operation_events(roster_id,kind) values(r.id,'absence_recorded'),(r.id,'makeup_eligibility_pending') on conflict do nothing;
  end if;
  if r.kind='trial' then
   update public.trial_bookings set status=case when r.attendance in ('present','late') then 'attended' else 'missed' end where id=r.trial_booking_id;
   update public.leads set stage=case when r.attendance in ('present','late') then 'trial_attended' else 'contacted' end
    where id=(select q.lead_id from public.trial_enquiries q join public.trial_bookings b on b.enquiry_id=q.id where b.id=r.trial_booking_id);
   insert into public.lead_activities(lead_id,actor_id,kind,note)
    select q.lead_id,auth.uid(),case when r.attendance in ('present','late') then 'trial_attended' else 'trial_missed' end,
     case when r.attendance in ('present','late') then 'Trial attendance finalized.' else 'Trial missed; follow-up and a new trial may be arranged.' end
    from public.trial_enquiries q join public.trial_bookings b on b.enquiry_id=q.id where b.id=r.trial_booking_id;
  end if;
 end loop;
 -- Existing transactional academy trigger consumes entitlements, issues one
 -- eligible absence credit, and consumes makeup credits. Delivery stays separate.
 update public.class_sessions set finalized_at=now(),finalized_by=auth.uid(),status='completed' where id=s.id;
 return jsonb_build_object('id',s.id);
end $$;

revoke all on function private.coach_attendance_access(uuid),private.coach_attendance_command(text,jsonb) from public,anon,authenticated;
revoke all on function public.coach_attendance_sessions() from public,anon;
grant execute on function public.coach_attendance_sessions() to authenticated;
