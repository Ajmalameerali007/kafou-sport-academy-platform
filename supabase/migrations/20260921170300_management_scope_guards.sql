-- Preserve historical family contracts while offering only packages in a family's branches.
drop policy commercial_packages_read on public.commercial_packages;
create policy commercial_packages_read on public.commercial_packages for select to authenticated using(
 private.active() and private.mfa_ready() and not private.has_role(array['coach','sales']::public.academy_role[]) and
 (private.product_can('finance.view',branch_id) or (private.has_role(array['parent']::public.academy_role[]) and
 ((active and exists(select 1 from public.family_branches fb where fb.branch_id=commercial_packages.branch_id and private.family_owner(fb.family_id)))
 or exists(select 1 from public.commercial_memberships m where m.package_id=commercial_packages.id and private.family_owner(m.family_id))))));
create or replace function public.coach_directory() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x),'[]') from (select p.id,p.name,p.active,
 case when private.head_office() then p.mobile else '' end mobile,
 jsonb_agg(bp.branch_id) branch_ids from public.profiles p join public.role_assignments r on r.user_id=p.id join public.branch_permissions bp on bp.user_id=p.id
 where private.active() and private.mfa_ready() and r.role='coach' and private.branch_access(bp.branch_id) group by p.id,p.name,p.active,p.mobile) x
$$;
create function private.guard_offer_age() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.commercial_packages;c public.children;n int;begin
 if new.package_id is null then return new;end if;
 select * into p from public.commercial_packages where id=new.package_id;
 if p.catalogue_id is null then return new;end if;
 select * into c from public.children where id=new.child_id;
 n:=case when c.dob is not null then extract(year from age((now() at time zone 'Asia/Dubai')::date,c.dob))::int else c.reported_age end;
 if n is null or n not between p.min_age and p.max_age or not p.active then raise exception 'Package age eligibility or availability failed' using errcode='P0409';end if;return new;
end $$;
create trigger guard_offer_age before insert on public.commercial_invoice_lines for each row execute function private.guard_offer_age();
revoke all on function private.guard_offer_age() from public,anon,authenticated;
