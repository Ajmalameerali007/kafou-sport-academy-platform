-- Trusted local worker rechecks the submitting actor before reading templates.
-- No user-facing role can call this delegation boundary. Original AAL is carried
-- by the authenticated application; permissions and consent are queried afresh.
create function public.attendance_worker_authorize(p_actor uuid,p_aal text,p_session uuid,p_references jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare original_claims text;scope jsonb;expected jsonb;actual jsonb;allowed boolean;begin
 if p_actor is null or p_aal is null or p_aal not in ('aal1','aal2') or jsonb_typeof(p_references) is distinct from 'array' or jsonb_array_length(p_references) not between 1 and 100 then return false;end if;
 original_claims:=current_setting('request.jwt.claims',true);
 begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aal',p_aal)::text,true);
  scope:=public.attendance_photo_scope(p_session);
  select coalesce(jsonb_agg(x->>'reference' order by x->>'reference'),'[]'::jsonb) into expected from jsonb_array_elements(scope) x where x->>'status'='ready';
  select jsonb_agg(x order by x) into actual from jsonb_array_elements_text(p_references) x;
  allowed:=actual=expected and exists(select 1 from public.class_sessions where id=p_session and status='scheduled' and finalized_at is null);
  perform set_config('request.jwt.claims',coalesce(original_claims,''),true);
  return allowed;
 exception when insufficient_privilege then
  perform set_config('request.jwt.claims',coalesce(original_claims,''),true);return false;
 end;
end $$;
revoke all on function public.attendance_worker_authorize(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.attendance_worker_authorize(uuid,text,uuid,jsonb) to service_role;
alter function public.attendance_worker_authorize(uuid,text,uuid,jsonb) owner to postgres;
