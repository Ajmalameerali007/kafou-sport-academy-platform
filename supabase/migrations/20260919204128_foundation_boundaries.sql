create function public.bootstrap_admin(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_access(auth.role()='service_role');
 perform pg_advisory_xact_lock(hashtextextended('kafou-bootstrap',0));
 if exists(select 1 from public.role_assignments where role='super_admin') then raise exception 'Administrator already configured' using errcode='23505'; end if;
 perform private.require_access(exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_user_id and u.email_confirmed_at is not null and p.active));
 insert into public.role_assignments(user_id,role) values(p_user_id,'super_admin');
end $$;
create function public.staff_directory() returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(x),'[]') from (select distinct p.id,p.name,bp.branch_id from public.profiles p join public.branch_permissions bp on bp.user_id=p.id join public.role_assignments ra on ra.user_id=p.id where p.active and ra.role in ('sales','branch') and private.branch_access(bp.branch_id)) x $$;
create function public.confirmed_locations() returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'area',b.area,'sports',coalesce((select jsonb_agg(bs.sport) from public.branch_sports bs where bs.branch_id=b.id),'[]'))),'[]') from public.branches b where b.active and not b.provisional and exists(select 1 from public.venues v where v.branch_id=b.id) $$;
revoke all on function public.bootstrap_admin(uuid),public.staff_directory(),public.confirmed_locations() from public,anon,authenticated;
grant execute on function public.bootstrap_admin(uuid) to service_role;
grant execute on function public.staff_directory() to authenticated;
grant execute on function public.confirmed_locations() to anon,authenticated,service_role;
-- Never let an ordinary SQL table grant weaken these append-only records.
create function private.immutable_record() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Append-only record' using errcode='42501'; end $$;
create trigger audit_append_only before update or delete on public.audit_events for each row execute function private.immutable_record();
create trigger consent_append_only before update or delete on public.consent_records for each row execute function private.immutable_record();
revoke all on function private.immutable_record() from public,anon,authenticated;
