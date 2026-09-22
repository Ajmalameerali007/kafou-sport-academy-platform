create or replace function private.family_access(f uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.mfa_ready() and (private.family_owner(f) or private.head_office() or (private.has_role(array['branch']::public.academy_role[]) and exists(select 1 from public.family_branches fb join public.branch_permissions bp using(branch_id) where fb.family_id=f and bp.user_id=auth.uid()))) $$;
create or replace function public.submit_enquiry(p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid; lid uuid; eid uuid; ref text; existing private.request_keys; result jsonb; actor text:=coalesce(auth.uid()::text,'guest'); h text:=md5(p_data::text); cid uuid; hits int; begin
perform private.require_access(auth.role()='service_role' or private.active());
if octet_length(p_data::text)>24000 then raise exception 'Request too large' using errcode='22023'; end if;
perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
select * into existing from private.request_keys where key=p_key;
if found then if existing.actor<>actor or existing.payload_hash<>h then raise exception 'Submission key conflict' using errcode='23505'; end if; return existing.response; end if;
if auth.uid() is not null then
 insert into private.rate_limits values('enquiry-user:'||auth.uid()::text,now(),1)
 on conflict(key) do update set hits=case when private.rate_limits.window_start<now()-interval '15 minutes' then 1 else private.rate_limits.hits+1 end, window_start=case when private.rate_limits.window_start<now()-interval '15 minutes' then now() else private.rate_limits.window_start end returning private.rate_limits.hits into hits;
 if hits>15 then raise exception 'Too many requests' using errcode='P0429'; end if;
end if;
if length(trim(p_data->>'parentName')) not between 2 and 100 or length(trim(p_data->>'childName')) not between 2 and 100 or coalesce(p_data->>'mobile','') !~ '^\+?[0-9 ()-]{9,25}$' or coalesce(p_data->>'age','') !~ '^[0-9]{1,2}$' then raise exception 'Invalid enquiry' using errcode='22023'; end if;
if nullif(p_data->>'preferredBranch','') is not null then select id into b from public.branches where slug=p_data->>'preferredBranch' and active; if b is null then raise exception 'Invalid branch' using errcode='22023'; end if; end if;
cid:=nullif(p_data->>'childId','')::uuid;
if cid is not null then perform private.require_access(exists(select 1 from public.children where id=cid and private.family_owner(family_id))); end if;
insert into public.leads(branch_id,parent_name,mobile,email,duplicate_review) values(b,trim(p_data->>'parentName'),trim(p_data->>'mobile'),left(coalesce(p_data->>'email',''),254),exists(select 1 from public.leads where mobile=trim(p_data->>'mobile'))) returning id into lid;
insert into public.trial_enquiries(lead_id,submitted_by,child_id,child_name,reported_age,sport,experience) values(lid,auth.uid(),cid,trim(p_data->>'childName'),(p_data->>'age')::int,(p_data->>'sport')::public.sport_id,coalesce(nullif(p_data->>'experience',''),'unsure')) returning id,reference into eid,ref;
insert into public.lead_activities(lead_id,actor_id,kind,note) values(lid,auth.uid(),'enquiry_received','Trial enquiry received; no session reserved.');
result:=jsonb_build_object('requestId',eid,'reference',ref,'status','requested');
insert into private.request_keys values(p_key,actor,h,result); return result; end $$;

