-- One transaction owns capacity across trials, enrollments, makeups and waitlist offers.
create function private.product_roster_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare cap int;occupied int;offers int;kid uuid;begin
 if new.cancelled then return new;end if;
 if tg_op='UPDATE' and not old.cancelled and new.session_id=old.session_id then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select capacity into cap from public.class_sessions where id=new.session_id for update;
 select child_id into kid from public.enrollments where id=new.enrollment_id;
 select count(*) into occupied from public.session_roster r where r.session_id=new.session_id and not r.cancelled and r.id<>new.id;
 select count(*) into offers from public.waitlist_entries w where w.session_id=new.session_id and w.status='offered' and w.offered_until>now() and (kid is null or w.child_id<>kid);
 if occupied+offers>=cap then raise exception 'Capacity reserved or full' using errcode='P0409';end if;return new;
end $$;
revoke all on function private.product_roster_capacity() from public,anon,authenticated;
create trigger product_roster_capacity before insert or update on public.session_roster for each row execute function private.product_roster_capacity();
create table public.transfer_decisions(id uuid primary key default gen_random_uuid(),request_id uuid not null unique references public.transfer_requests,new_enrollment_id uuid references public.enrollments,approved_by uuid not null references public.profiles,reason text not null check(length(reason) between 5 and 500),created_at timestamptz not null default now());
alter table public.transfer_decisions enable row level security;
revoke all on public.transfer_decisions from anon,authenticated;grant select on public.transfer_decisions to authenticated;grant all on public.transfer_decisions to service_role;
create policy transfer_decision_read on public.transfer_decisions for select to authenticated using(exists(select 1 from public.transfer_requests t where t.id=request_id));
create trigger transfer_decision_audit after insert on public.transfer_decisions for each row execute function private.product_audit();
create table public.operational_acknowledgements(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.class_sessions,change_id uuid not null references public.session_changes,user_id uuid not null references public.profiles,created_at timestamptz not null default now(),unique(change_id,user_id));
alter table public.operational_acknowledgements enable row level security;revoke all on public.operational_acknowledgements from anon,authenticated;grant select on public.operational_acknowledgements to authenticated;grant all on public.operational_acknowledgements to service_role;
create policy acknowledgement_read on public.operational_acknowledgements for select to authenticated using(private.head_office() or (private.active() and private.mfa_ready() and user_id=auth.uid() and private.development_coach_session(session_id)));
-- Coaches receive only changes for their current assigned sessions, without broader class/family access.
create policy change_assigned_coach_read on public.session_changes for select to authenticated using(private.development_coach_session(session_id));
create function private.operations_extension_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req public.transfer_requests;n public.enrollments;src public.academy_classes;target public.academy_classes;s public.class_sessions;anchor public.class_sessions;r public.session_roster;k public.children;mem public.commercial_memberships;rid uuid;newid uuid;v_reason text;delta int;outcomes jsonb:='[]';change public.session_changes;scope text;begin
 perform private.require_access(private.active() and private.mfa_ready());
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));v_reason:=trim(coalesce(p_data->>'reason',''));
 case p_action
 when 'schedule.transfer.review' then
 select * into req from public.transfer_requests where id=(p_data->>'id')::uuid for update;select * into n from public.enrollments where id=req.enrollment_id;select * into src from public.academy_classes where id=n.class_id;select * into target from public.academy_classes where id=req.target_class_id;
 perform private.require_access(private.product_can('operations.transfer',src.branch_id) and private.product_can('operations.transfer',target.branch_id));
 if req.id is null then raise exception 'Transfer request not found' using errcode='P0002';end if;
 if req.status<>'requested' then select id,new_enrollment_id into rid,newid from public.transfer_decisions where request_id=req.id;return jsonb_build_object('id',rid,'enrollment_id',newid);end if;
 if length(v_reason) not between 5 and 500 or coalesce(p_data->>'decision','') not in ('approved','declined') then raise exception 'Review reason required' using errcode='22023';end if;
 if p_data->>'decision'='declined' then update public.transfer_requests set status='declined',resolved_by=auth.uid(),resolution=v_reason where id=req.id;insert into public.transfer_decisions(request_id,approved_by,reason) values(req.id,auth.uid(),v_reason) returning id into rid;return jsonb_build_object('id',rid);end if;
 select * into k from public.children where id=n.child_id;
 if n.status<>'active' or target.id=src.id or not private.class_available(target) or not exists(select 1 from public.child_sports cs where cs.child_id=k.id and cs.sport=target.sport and cs.level_id=target.level_id) then raise exception 'Reviewed compatible sport and level required' using errcode='P0409';end if;
 if (select count(*) from public.enrollments where class_id=target.id and status='active')>=target.capacity then raise exception 'Target class full' using errcode='P0409';end if;
 if exists(select 1 from public.makeup_credits where enrollment_id=n.id and status='reserved') then raise exception 'Resolve reserved makeup before transfer' using errcode='P0409';end if;
 select * into mem from public.commercial_memberships where child_id=k.id and branch_id=target.branch_id and sport=target.sport and status='active' and starts_on<=current_date and expires_on>current_date order by starts_on desc limit 1;
 if mem.id is null then raise exception 'Target membership/payment or approved credit required first' using errcode='P0409';end if;
 -- Release only future ordinary seats. Completed history and original enrollment remain intact.
 for r in select rr.* from public.session_roster rr join public.class_sessions ss on ss.id=rr.session_id where rr.enrollment_id=n.id and rr.kind='enrollment' and not rr.cancelled and ss.starts_at>now() and ss.finalized_at is null loop
 perform private.commercial_roster_event(r.id,'release','Approved transfer');update public.session_roster set cancelled=true where id=r.id;end loop;
 update public.waitlist_entries w set status='cancelled' from public.class_sessions ss where w.session_id=ss.id and w.enrollment_id=n.id and w.status in ('waiting','offered') and ss.starts_at>now();
 update public.enrollments set status='ended' where id=n.id;insert into public.enrollments(child_id,class_id) values(k.id,target.id) returning id into newid;
 for s in select * from public.class_sessions where class_id=target.id and status='scheduled' and starts_at>now() and (starts_at at time zone 'Asia/Dubai')::date<mem.expires_on order by starts_at loop
 if not private.academy_eligible(k.id,s.id,target.branch_id,target.sport,target.level_id) then raise exception 'Target occurrence is ineligible or conflicts' using errcode='P0409';end if;
 insert into public.session_roster(session_id,enrollment_id,kind) values(s.id,newid,'enrollment') returning id into rid;perform private.commercial_roster_event(rid,'reserve','Approved transfer');end loop;
 insert into public.family_branches(family_id,branch_id) values(k.family_id,target.branch_id) on conflict do nothing;
 update public.transfer_requests set status='approved',resolved_by=auth.uid(),resolution=v_reason where id=req.id;insert into public.transfer_decisions(request_id,new_enrollment_id,approved_by,reason) values(req.id,newid,auth.uid(),v_reason) returning id into rid;
 perform private.emit_product_event('transfer.approved',rid,k.family_id,target.branch_id,'Class transfer approved','Review your new class and future sessions. Previous attendance and financial history are retained.','/parent?view=Schedule');
 when 'schedule.preview','schedule.move','schedule.cancel' then
 perform private.require_access(private.head_office());select * into anchor from public.class_sessions where id=(p_data->>'session_id')::uuid;scope:=coalesce(p_data->>'scope','occurrence');
 if anchor.id is null or scope not in ('occurrence','future','series') then raise exception 'Select a supported scope' using errcode='22023';end if;
 if p_action='schedule.preview' then select coalesce(jsonb_agg(jsonb_build_object('id',ss.id,'starts_at',ss.starts_at,'ends_at',ss.ends_at,'bookings',(select count(*) from public.session_roster rr where rr.session_id=ss.id and not rr.cancelled)) order by ss.starts_at),'[]') into outcomes from public.class_sessions ss where ss.class_id=anchor.class_id and ss.starts_at>now() and ss.finalized_at is null and ss.delivered_at is null and ss.status='scheduled' and (scope='series' or (scope='future' and ss.starts_at>=anchor.starts_at) or (scope='occurrence' and ss.id=anchor.id));return jsonb_build_object('sessions',outcomes,'completedHistoryRetained',true);end if;
 if length(v_reason) not between 5 and 500 then raise exception 'Reason required' using errcode='22023';end if;
 delta:=(p_data->>'minutes_delta')::int;
 if p_action='schedule.move' and (delta is null or delta not between -180 and 180 or delta=0) then raise exception 'Use a nonzero change within three hours' using errcode='22023';end if;
 for s in select * from public.class_sessions ss where ss.class_id=anchor.class_id and ss.starts_at>now() and ss.finalized_at is null and ss.delivered_at is null and ss.status='scheduled' and (scope='series' or (scope='future' and ss.starts_at>=anchor.starts_at) or (scope='occurrence' and ss.id=anchor.id)) order by case when p_action='schedule.move' and delta>0 then ss.starts_at end desc,ss.starts_at loop
 if p_action='schedule.move' then
 -- Reconcile paid seats if moving across a Dubai date boundary. Any failed re-reservation undoes the entire scope.
 if (s.starts_at at time zone 'Asia/Dubai')::date<>((s.starts_at+make_interval(mins=>delta)) at time zone 'Asia/Dubai')::date then
 for r in select rr.* from public.session_roster rr where rr.session_id=s.id and rr.kind='enrollment' and not rr.cancelled loop perform private.commercial_roster_event(r.id,'release','Schedule date changed');end loop;end if;
 perform private.academy_command('academy.session.move',jsonb_build_object('session_id',s.id,'starts_at',s.starts_at+make_interval(mins=>delta),'ends_at',s.ends_at+make_interval(mins=>delta),'reason',v_reason));
 if (s.starts_at at time zone 'Asia/Dubai')::date<>((s.starts_at+make_interval(mins=>delta)) at time zone 'Asia/Dubai')::date then
 for r in select rr.* from public.session_roster rr where rr.session_id=s.id and rr.kind='enrollment' and not rr.cancelled loop perform private.commercial_roster_event(r.id,'reserve','Schedule date changed');end loop;end if;
 else
 perform private.academy_command('academy.session.cancel',jsonb_build_object('session_id',s.id,'reason',v_reason));
 end if;outcomes:=outcomes||jsonb_build_array(s.id);end loop;
 return jsonb_build_object('sessions',outcomes,'completedHistoryRetained',true);
 when 'schedule.acknowledge' then
 select * into change from public.session_changes where id=(p_data->>'id')::uuid;perform private.require_access(private.coach_notice_access(change.session_id));insert into public.operational_acknowledgements(session_id,change_id,user_id) values(change.session_id,change.id,auth.uid()) on conflict(change_id,user_id) do update set user_id=excluded.user_id returning id into rid;
 else raise exception 'Unknown schedule command' using errcode='22023';end case;return jsonb_build_object('id',rid,'enrollment_id',newid);
end $$;
revoke all on function private.operations_extension_command(text,jsonb) from public,anon,authenticated;
