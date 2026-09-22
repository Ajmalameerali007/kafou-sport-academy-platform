begin;
select plan(7);
select is((select provolatile::text from pg_proc where oid='private.require_access(boolean)'::regprocedure),'s','Pure access assertion has a stable volatility contract');
select lives_ok($$select private.require_access(true)$$,'Stable assertion still permits true');
select throws_ok($$select private.require_access(false)$$,'42501',null,'Stable assertion still denies false');
select throws_ok($$select private.require_access(null)$$,'42501',null,'Stable assertion still denies null');
select is((select count(*)::int from pg_constraint fk join pg_class tbl on tbl.oid=fk.conrelid join pg_namespace ns on ns.oid=tbl.relnamespace
 where fk.contype='f' and ns.nspname in ('public','private') and not exists(
 select 1 from pg_index ix where ix.indrelid=fk.conrelid and ix.indisvalid and ix.indisready and ix.indpred is null and ix.indnkeyatts>=cardinality(fk.conkey)
 and (select array_agg(k order by ord) from unnest(ix.indkey::smallint[]) with ordinality keys(k,ord) where ord<=cardinality(fk.conkey)) @> fk.conkey)),0,'Every application foreign key has valid full leading-column index coverage');
select is((select count(*)::int from pg_policy where polrelid='public.session_changes'::regclass and polcmd='r'),1,'Session change SELECT uses one combined policy with its existing authorization union');
select is((select count(*)::int from pg_policy p join pg_class t on t.oid=p.polrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and (t.relname,p.polname) in(
 ('product_permissions','permission_read'),('notifications','notification_read'),('delivery_outbox','outbox_read'),('coach_substitutions','substitution_read'),('recognition_nominations','recognition_read'),('operational_acknowledgements','acknowledgement_read'))
 and pg_get_expr(p.polqual,p.polrelid) like '%SELECT auth.uid()%'),6,'Flagged policies evaluate current user through statement initplans');
select * from finish();
rollback;
