-- Additive advisor corrections. No application data, grants or protected-role semantics change.
-- The assertion consumes a Boolean and only returns/raises; it has no database side effects.
alter function private.require_access(boolean) stable;

-- Preserve the current operations implementation (including prior corrections) and all
-- function attributes while making the empty JSONB accumulator's type explicit.
do $$
declare definition text; old_initializer text := 'outcomes jsonb:=''[]'';';
begin
  definition := pg_get_functiondef('private.operations_extension_command(text,jsonb)'::regprocedure);
  if position(old_initializer in definition) = 0 then
    raise exception 'Expected operations accumulator initializer not found; review migration order';
  end if;
  execute replace(definition, old_initializer, 'outcomes jsonb:=''[]''::jsonb;');
end $$;

-- auth.uid() is constant for a statement. Initplans avoid recomputing it per policy row.
-- All role, MFA, current guardian and assigned-coach predicates remain unchanged.
alter policy permission_read on public.product_permissions using(
  private.mfa_ready() and private.active() and (user_id=(select auth.uid()) or private.super_admin()));
alter policy notification_read on public.notifications using(
  private.active() and private.mfa_ready() and recipient_id=(select auth.uid()) and
  exists(select 1 from public.product_events e where e.id=event_id and private.family_owner(e.family_id)));
alter policy outbox_read on public.delivery_outbox using(
  private.head_office() or (recipient_id=(select auth.uid()) and private.active() and private.mfa_ready() and
  exists(select 1 from public.product_events e where e.id=event_id and private.family_owner(e.family_id))));
alter policy substitution_read on public.coach_substitutions using(
  private.head_office() or (coach_id=(select auth.uid()) and private.active() and private.mfa_ready() and revoked_at is null and now() between starts_at and ends_at));
alter policy recognition_read on public.recognition_nominations using(
  private.operations_staff(branch_id) or (nominated_by=(select auth.uid()) and private.has_role(array['coach']::public.academy_role[]) and
  exists(select 1 from public.enrollments n join public.class_sessions s on s.class_id=n.class_id where n.child_id=recognition_nominations.child_id and n.status='active' and private.development_coach_session(s.id))) or
  (status='approved' and exists(select 1 from public.children c where c.id=child_id and private.family_owner(c.family_id))));
alter policy acknowledgement_read on public.operational_acknowledgements using(
  private.head_office() or (private.active() and private.mfa_ready() and user_id=(select auth.uid()) and private.coach_notice_access(session_id)));

-- PostgreSQL already ORs these two permissive SELECT policies. Preserve that exact union
-- in one policy, including the current source's operational notice restrictions.
do $$
declare general_qual text; coach_qual text; expected_roles oid[] := array[(select oid from pg_roles where rolname='authenticated')];
begin
  select pg_get_expr(polqual,polrelid) into general_qual from pg_policy
   where polrelid='public.session_changes'::regclass and polname='change_read' and polcmd='r' and polpermissive and polroles=expected_roles;
  select pg_get_expr(polqual,polrelid) into coach_qual from pg_policy
   where polrelid='public.session_changes'::regclass and polname='change_assigned_coach_read' and polcmd='r' and polpermissive and polroles=expected_roles;
  if general_qual is null or coach_qual is null then raise exception 'Expected session change policies not found; review before consolidation'; end if;
  execute format('alter policy change_read on public.session_changes using ((%s) or (%s))',general_qual,coach_qual);
  drop policy change_assigned_coach_read on public.session_changes;
end $$;

-- Cover FK lookups for all current application tables, including private command-owned
-- invitation/idempotency records. Exclude managed provider schemas. Existing valid full
-- leading-column indexes are reused regardless of their names or column order.
-- Partial uniqueness indexes are retained, but cannot cover historical/cancelled FK rows.
-- The normal migration transaction is appropriate for empty/small synthetic staging;
-- production-sized tables require a separately planned concurrent-index rollout.
do $$
declare fk record; column_list text; index_name text;
begin
  for fk in
    select c.oid,c.conrelid,c.conkey,c.conname,n.nspname,t.relname
      from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
     where c.contype='f' and n.nspname in ('public','private')
     order by n.nspname,t.relname,c.conname
  loop
    if exists(
      select 1 from pg_index ix
       where ix.indrelid=fk.conrelid and ix.indisvalid and ix.indisready
         and ix.indpred is null and ix.indnkeyatts>=cardinality(fk.conkey)
         and (select array_agg(k order by ord) from unnest(ix.indkey::smallint[]) with ordinality keys(k,ord)
               where ord<=cardinality(fk.conkey)) @> fk.conkey
    ) then continue; end if;
    select string_agg(format('%I',a.attname),',' order by k.ord) into column_list
      from unnest(fk.conkey) with ordinality k(attnum,ord)
      join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.attnum;
    index_name := 'fk_'||left(fk.relname,28)||'_'||substr(md5(fk.nspname||'.'||fk.relname||':'||fk.conname),1,16);
    execute format('create index %I on %I.%I (%s)',index_name,fk.nspname,fk.relname,column_list);
  end loop;
end $$;
