create or replace function private.family_owner(f uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.has_role(array['parent']::public.academy_role[]) and private.mfa_ready() and exists(select 1 from public.guardians where family_id=f and user_id=auth.uid()) $$;
create or replace function public.academy_command(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f uuid; c uuid; b uuid; l public.leads; r uuid; uid uuid; roles public.academy_role[]; bid uuid; original_family uuid; inv public.staff_invitations; begin
perform private.require_access(private.active() and private.mfa_ready());
if octet_length(p_data::text)>24000 then raise exception 'Request too large' using errcode='22023'; end if;
case p_action
when 'family.create' then
 perform private.require_access(private.has_role(array['parent']::public.academy_role[]));
 if exists(select 1 from public.guardians where user_id=auth.uid()) then raise exception 'Family already exists' using errcode='23505'; end if;
 insert into public.families(name,mobile,email) values(p_data->>'name',coalesce(p_data->>'mobile',''),coalesce(p_data->>'email','')) returning id into r;
 insert into public.guardians values(r,auth.uid());
when 'family.update' then
 f:=(p_data->>'id')::uuid; perform private.require_access(private.family_access(f));
 update public.families set name=p_data->>'name',mobile=coalesce(p_data->>'mobile',''),email=coalesce(p_data->>'email','') where id=f returning id into r;
when 'child.save' then
 f:=(p_data->>'family_id')::uuid; perform private.require_access(private.family_access(f));
 c:=nullif(p_data->>'id','')::uuid;
 if nullif(p_data->>'dob','')::date > current_date then raise exception 'Invalid birth date' using errcode='22023'; end if;
 if c is null then insert into public.children(family_id,name,dob,reported_age,age_captured_on) values(f,p_data->>'name',nullif(p_data->>'dob','')::date,nullif(p_data->>'reported_age','')::int,current_date) returning id into r;
 else update public.children set name=p_data->>'name',dob=nullif(p_data->>'dob','')::date,reported_age=nullif(p_data->>'reported_age','')::int,age_captured_on=current_date where id=c and family_id=f returning id into r; end if;
when 'child.sport' then
 c:=(p_data->>'child_id')::uuid; select family_id into f from public.children where id=c; perform private.require_access(private.family_access(f));
 if nullif(p_data->>'level','') is not null then perform private.require_access(private.head_office()); end if;
 insert into public.child_sports(child_id,sport,level,status) values(c,(p_data->>'sport')::public.sport_id,nullif(p_data->>'level',''),case when nullif(p_data->>'level','') is null then 'interest' else 'reviewed' end) on conflict(child_id,sport) do update set
 level=case when private.head_office() then excluded.level else public.child_sports.level end,
 status=case when private.head_office() then excluded.status else public.child_sports.status end returning id into r;
when 'consent.record' then
 f:=(p_data->>'family_id')::uuid; perform private.require_access(private.family_owner(f));
 insert into public.consent_records(family_id,actor_id,kind,version,granted) values(f,auth.uid(),p_data->>'kind','staging-v1',(p_data->>'granted')::boolean) returning id into r;
when 'lead.update' then
 select * into l from public.leads where id=(p_data->>'id')::uuid for update; perform private.require_access(private.branch_access(l.branch_id));
 b:=nullif(p_data->>'branch_id','')::uuid; if b is distinct from l.branch_id then perform private.require_access(private.head_office() and exists(select 1 from public.branches where id=b and active)); end if;
 uid:=nullif(p_data->>'assigned_to','')::uuid;
 if uid is not null then perform private.require_access(exists(select 1 from public.branch_permissions bp join public.profiles p on p.id=bp.user_id join public.role_assignments ra on ra.user_id=p.id where p.active and bp.user_id=uid and bp.branch_id=b and ra.role in ('sales','branch'))); end if;
 if p_data->>'stage'='lost' and length(trim(coalesce(p_data->>'lost_reason','')))<2 then raise exception 'Lost reason required' using errcode='22023'; end if;
 update public.leads set branch_id=b,assigned_to=uid,stage=p_data->>'stage',lost_reason=nullif(p_data->>'lost_reason',''),follow_up_at=nullif(p_data->>'follow_up_at','')::timestamptz where id=l.id returning id into r;
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'updated', 'Enquiry status or assignment updated.');
when 'lead.note' then
 select * into l from public.leads where id=(p_data->>'id')::uuid; perform private.require_access(private.branch_access(l.branch_id));
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'note',p_data->>'note') returning id into r;
when 'lead.convert' then
 select * into l from public.leads where id=(p_data->>'id')::uuid for update;
 perform private.require_access(private.head_office() or (private.has_role(array['branch']::public.academy_role[]) and private.branch_access(l.branch_id)));
 if l.family_id is not null then raise exception 'Already linked' using errcode='23505'; end if;
 f:=nullif(p_data->>'family_id','')::uuid;
 select child_id into c from public.trial_enquiries where lead_id=l.id;
 if c is not null then
   select family_id into original_family from public.children where id=c;
   perform private.require_access(private.family_access(original_family));
   if f is not null and f<>original_family then raise exception 'Existing child belongs to another family' using errcode='23505'; end if;
   f:=original_family;
 else
   if f is not null then perform private.require_access(private.family_access(f)); else insert into public.families(name,mobile,email) values(l.parent_name,l.mobile,l.email) returning id into f; end if;
   insert into public.children(family_id,name,reported_age,age_captured_on) select f,child_name,reported_age,age_captured_on from public.trial_enquiries where lead_id=l.id returning id into c;
 end if;
 if l.branch_id is not null then insert into public.family_branches values(f,l.branch_id) on conflict do nothing; end if;
 insert into public.child_sports(child_id,sport) select c,sport from public.trial_enquiries where lead_id=l.id on conflict(child_id,sport) do nothing;
 update public.leads set family_id=f where id=l.id;
 update public.trial_enquiries set child_id=c where lead_id=l.id;
 insert into public.lead_activities(lead_id,actor_id,kind,note) values(l.id,auth.uid(),'family_linked','Family and child linked. No enrollment or sale created.'); r:=f;
when 'branch.save' then
 perform private.require_access(private.head_office());
 b:=nullif(p_data->>'id','')::uuid;
 if b is null then insert into public.branches(slug,name,name_ar,area,provisional) values(p_data->>'slug',p_data->>'name',coalesce(p_data->>'name_ar',''),coalesce(p_data->>'area',''),true) returning id into r;
 else update public.branches set name=p_data->>'name',name_ar=coalesce(p_data->>'name_ar',''),area=coalesce(p_data->>'area',''),provisional=(p_data->>'provisional')::boolean,active=(p_data->>'active')::boolean where id=b returning id into r; end if;
when 'venue.save' then
 perform private.require_access(private.head_office());
 insert into public.venues(branch_id,name,address,operating_information) values((p_data->>'branch_id')::uuid,p_data->>'name',p_data->>'address',coalesce(p_data->>'operating_information','')) returning id into r;
when 'branch.sports' then
 perform private.require_access(private.head_office()); b:=(p_data->>'branch_id')::uuid;
 delete from public.branch_sports where branch_id=b;
 insert into public.branch_sports select b,value::public.sport_id from jsonb_array_elements_text(p_data->'sports'); r:=b;
when 'staff.access' then
 perform private.require_access(private.super_admin()); uid:=(p_data->>'user_id')::uuid;
 perform private.require_access(uid<>auth.uid());
 roles:=array(select value::public.academy_role from jsonb_array_elements_text(p_data->'roles'));
 if cardinality(roles)=0 then raise exception 'At least one role required' using errcode='22023'; end if;
 update public.profiles set active=(p_data->>'active')::boolean where id=uid returning id into r;
 delete from public.role_assignments where user_id=uid;
 insert into public.role_assignments select uid,unnest(roles);
 delete from public.branch_permissions where user_id=uid;
 insert into public.branch_permissions select uid,value::uuid from jsonb_array_elements_text(p_data->'branch_ids');
when 'invitation.create' then
 perform private.require_access(private.super_admin());
 insert into public.staff_invitations(email,role,branch_ids,invited_by) values(lower(p_data->>'email'),(p_data->>'role')::public.academy_role,array(select value::uuid from jsonb_array_elements_text(p_data->'branch_ids')),auth.uid()) returning id into r;
when 'invitation.accept' then
 select * into inv from public.staff_invitations where id=(p_data->>'id')::uuid for update;
 perform private.require_access(inv.auth_user_id=auth.uid() and inv.revoked_at is null and inv.expires_at>now() and inv.accepted_at is null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null));
 insert into public.role_assignments values(auth.uid(),inv.role) on conflict do nothing;
 insert into public.branch_permissions select auth.uid(),unnest(inv.branch_ids) on conflict do nothing;
 update public.staff_invitations set accepted_at=now() where id=inv.id returning id into r;
else raise exception 'Unknown action' using errcode='22023'; end case;
if r is null then raise exception 'Record not found or unchanged' using errcode='P0002'; end if;
return jsonb_build_object('id',r); end $$;
