-- Audit trail reason: every product/operations command may carry an
-- optional caller-supplied reason, now captured into audit_events.
alter table public.audit_events add column reason text check(reason is null or length(reason)<=500);

create or replace function private.audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare oldj jsonb; newj jsonb; begin
-- Field values containing names/contact/health/free text never enter the audit copy.
oldj := case when TG_OP='INSERT' then null else to_jsonb(old)-array['name','name_ar','parent_name','child_name','mobile','email','dob','note','address','operating_information','lost_reason'] end;
newj := case when TG_OP='DELETE' then null else to_jsonb(new)-array['name','name_ar','parent_name','child_name','mobile','email','dob','note','address','operating_information','lost_reason'] end;
insert into public.audit_events(actor_id,action,entity,entity_id,previous_value,new_value,reason)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(newj->>'id',oldj->>'id',newj->>'user_id',oldj->>'user_id'),oldj,newj,nullif(current_setting('kafou.action_reason',true),''));
return coalesce(new,old); end $$;

create or replace function private.product_audit() returns trigger
language plpgsql security definer set search_path='' as $$
declare v jsonb; begin
 v:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_events(actor_id,action,entity,entity_id,new_value,reason)
  values(auth.uid(),tg_op,tg_table_name,v->>'id',jsonb_build_object('status',v->>'status','record_id',v->>'id'),nullif(current_setting('kafou.action_reason',true),''));
 return null;
end $$;

-- The reason (when supplied) is staged once per command and read back by
-- whichever generic audit trigger fires during that same call.
create or replace function public.product_command(p_action text,p_data jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare old private.product_requests; result jsonb; fingerprint text; access_fingerprint text; begin
 perform private.require_access(private.active() and private.mfa_ready());
 if p_key is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>24000 then raise exception 'Invalid command' using errcode='22023'; end if;
 perform set_config('kafou.action_reason',trim(both from coalesce(p_data->>'reason','')),true);
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if p_action='academy.session.move' then raise exception 'Use schedule.move with entitlement reconciliation' using errcode='P0409';end if;
 if split_part(p_action,'.',1)='coach_attendance' then perform private.require_access(private.coach_attendance_access((p_data->>'session_id')::uuid));end if;
 if p_action='communication.preview' then return private.communication_command(p_action,p_data);end if;
 if p_action='schedule.preview' then return private.operations_extension_command(p_action,p_data);end if;
 access_fingerprint:=private.product_access_revision();
 fingerprint:=md5(p_action||p_data::text);
 select * into old from private.product_requests where actor_id=auth.uid() and key=p_key;
 if found then if old.access_hash is distinct from access_fingerprint then raise exception 'Access changed; submit a newly authorized request' using errcode='42501';end if; if old.payload_hash<>fingerprint then raise exception 'Idempotency mismatch' using errcode='P0409'; end if;return old.response;end if;
 case split_part(p_action,'.',1)
 when 'commercial' then result:=private.commercial_command(p_action,p_data);
 when 'coach_attendance' then result:=private.coach_attendance_command(p_action,p_data);
 when 'coach' then result:=private.coach_profile_command(p_action,p_data);
 when 'academy' then result:=private.academy_command(p_action,p_data);
 when 'development' then result:=private.development_command(p_action,p_data);
 when 'community' then result:=private.community_command(p_action,p_data);
 when 'files' then result:=private.files_command(p_action,p_data);
 when 'communication' then result:=private.communication_command(p_action,p_data);
 when 'schedule' then result:=private.operations_extension_command(p_action,p_data);
 when 'engagement' then result:=private.engagement_command(p_action,p_data);
 when 'events' then result:=private.events_command(p_action,p_data);
 when 'permission' then
 perform private.require_access(private.super_admin());
 if p_action='permission.grant' then
 insert into public.product_permissions(user_id,permission,branch_id,granted_by) values((p_data->>'user_id')::uuid,p_data->>'permission',nullif(p_data->>'branch_id','')::uuid,auth.uid()) on conflict do nothing;
 elsif p_action='permission.revoke' then delete from public.product_permissions where id=(p_data->>'id')::uuid;
 else raise exception 'Unknown command' using errcode='22023';end if;
 result:=jsonb_build_object('saved',true);
 else raise exception 'Unknown command' using errcode='22023';end case;
 insert into private.product_requests(actor_id,key,payload_hash,access_hash,response) values(auth.uid(),p_key,fingerprint,private.product_access_revision(),result);
 return result;
end $$;
revoke all on function public.product_command(text,jsonb,uuid) from public,anon;
grant execute on function public.product_command(text,jsonb,uuid) to authenticated;

alter function public.operations_command(text,jsonb) rename to operations_command_before_reason;
alter function public.operations_command_before_reason(text,jsonb) set schema private;
create function public.operations_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform set_config('kafou.action_reason',trim(both from coalesce(p_data->>'reason','')),true);
 return private.operations_command_before_reason(p_action,p_data);
end $$;
revoke all on function public.operations_command(text,jsonb),private.operations_command_before_reason(text,jsonb) from public,anon,authenticated;
grant execute on function public.operations_command(text,jsonb) to authenticated;
