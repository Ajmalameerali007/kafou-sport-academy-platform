-- Private, synthetic rehearsal executor. No live import route or guardian grants.
-- The planner's membership_snapshot_only / opening_balance_only /
-- historical_reference_only intents are preserved, not turned into fresh sales.
create table private.migration_batches(
 id text primary key,source_account text not null,dataset text not null,mapping_version text not null,
 manifest jsonb not null,created_at timestamptz not null default now(),
 state text not null default 'staged' check(state in ('staged','applied','reversed')),
 review_reference text not null check(length(review_reference) between 8 and 500)
);
create table private.migration_rows(
 batch_id text not null references private.migration_batches,entity text not null,
 source_id text not null,target_id uuid not null,fingerprint text not null,refs jsonb not null,value jsonb not null,
 applied boolean not null default false,target_snapshot jsonb,
 primary key(batch_id,entity,source_id),unique(target_id)
);
create table private.migration_snapshots(
 id uuid primary key,batch_id text not null references private.migration_batches,entity text not null,
 family_id uuid,child_id uuid,branch_id uuid,package_id uuid,
 amount_minor bigint,remaining_sessions int,data jsonb not null
);
create table private.migration_runs(
 id uuid primary key default gen_random_uuid(),batch_id text not null references private.migration_batches,
 action text not null,affected int not null,created_at timestamptz not null default now()
);
do $$declare t text;begin foreach t in array array['migration_batches','migration_rows','migration_snapshots','migration_runs'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);end loop;end$$;
create index on private.migration_snapshots(batch_id);
create index on private.migration_runs(batch_id);
create trigger migration_runs_immutable before update or delete on private.migration_runs for each row execute function private.immutable_record();
create function private.stage_synthetic_migration(payload jsonb,review_reference text) returns text language plpgsql security definer set search_path='' as $$
declare p jsonb:=payload->'plan';r jsonb;batch private.migration_batches;bid text:=p->>'planId';begin
 if auth.uid() is not null or coalesce(p->>'status','')<>'validated_dry_run' or jsonb_array_length(p->'exceptions')<>0 or bid !~ '^[a-f0-9]{64}$' then raise exception 'Validated synthetic plan required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 for r in select * from jsonb_array_elements(payload->'rows') loop
 if r->>'fingerprint' is distinct from (select encode(extensions.digest('{'||string_agg(to_jsonb(key)::text||':'||value::text,',' order by key collate "C")||'}','sha256'),'hex') from jsonb_each(r->'value')) then raise exception 'Source row fingerprint mismatch' using errcode='22023';end if;
 end loop;
 select * into batch from private.migration_batches where id=bid;
 if batch.id is not null then
 if batch.manifest is distinct from p or batch.state='reversed' or exists(select 1 from jsonb_array_elements(payload->'rows') x where not exists(select 1 from private.migration_rows mr where mr.batch_id=bid and mr.entity=x->>'entity' and mr.source_id=x->>'sourceId' and mr.value=x->'value' and mr.refs=x->'references')) then raise exception 'Batch changed or reversed' using errcode='P0409';end if;return bid;end if;
 if exists(select 1 from private.migration_batches where source_account=p->>'sourceAccountId' and dataset=p->>'datasetId') then raise exception 'Dataset already staged; review changed source instead of overwriting' using errcode='P0409';end if;
 if jsonb_array_length(payload->'rows')<>jsonb_array_length(p->'rows') or jsonb_array_length(payload->'rows')>50000 then raise exception 'Invalid row manifest' using errcode='22023';end if;
 insert into private.migration_batches(id,source_account,dataset,mapping_version,manifest,review_reference) values(bid,p->>'sourceAccountId',p->>'datasetId',p->>'mappingVersion',p,review_reference);
 for r in select * from jsonb_array_elements(payload->'rows') loop
 if not exists(select 1 from jsonb_array_elements(p->'rows') x where x=r-'value') then raise exception 'Unplanned row' using errcode='22023';end if;
 insert into private.migration_rows(batch_id,entity,source_id,target_id,fingerprint,refs,value) values(bid,r->>'entity',r->>'sourceId',(r->>'targetId')::uuid,r->>'fingerprint',r->'references',r->'value');
 end loop;
 insert into private.migration_runs(batch_id,action,affected) values(bid,'stage',jsonb_array_length(payload->'rows'));
 return bid;
end $$;
create function private.apply_synthetic_migration(bid text,p_limit int default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare batch private.migration_batches;r private.migration_rows;snapshot jsonb;fid uuid;cid uuid;branch uuid;pkg uuid;n int:=0;begin
 if auth.uid() is not null or p_limit not between 1 and 500 then raise exception 'Bounded private worker required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 select * into batch from private.migration_batches where id=bid for update;
 if batch.id is null or batch.state='reversed' then raise exception 'Batch unavailable' using errcode='P0409';end if;
 for r in select * from private.migration_rows where batch_id=bid and not applied order by case entity when 'families' then 1 when 'children' then 2 when 'memberships' then 3 else 4 end,source_id limit p_limit for update loop
 snapshot:=null;
 if r.entity='families' then
 insert into public.families(id,name,email,mobile,synthetic) values(r.target_id,r.value->>'name',coalesce(r.value->>'email',''),coalesce(r.value->>'mobile',''),true);
 select to_jsonb(f) into snapshot from public.families f where id=r.target_id;
 elsif r.entity='children' then
 fid:=(r.refs->>'family')::uuid;
 if not exists(select 1 from private.migration_rows where batch_id=bid and entity='families' and target_id=fid and applied) then raise exception 'Family checkpoint required' using errcode='P0409';end if;
 insert into public.children(id,family_id,name,dob,synthetic) values(r.target_id,fid,r.value->>'name',(r.value->>'dob')::date,true);
 select to_jsonb(k) into snapshot from public.children k where id=r.target_id;
 elsif r.entity in ('memberships','opening_balances','payment_history') then
 fid:=null;cid:=null;branch:=null;pkg:=null;
 if r.entity='memberships' then
 cid:=(r.refs->>'child')::uuid;branch:=(r.refs->>'branch')::uuid;pkg:=(r.refs->>'package')::uuid;
 if not exists(select 1 from private.migration_rows where batch_id=bid and entity='children' and target_id=cid and applied) then raise exception 'Child checkpoint required' using errcode='P0409';end if;
 if not exists(select 1 from public.branches where id=branch and synthetic) or not exists(select 1 from public.commercial_packages where id=pkg and branch_id=branch and policy_status='synthetic') then raise exception 'Reviewed synthetic package mapping required' using errcode='P0409';end if;
 select family_id into fid from public.children where id=cid;
 else fid:=(r.refs->>'family')::uuid;
 if not exists(select 1 from private.migration_rows where batch_id=bid and entity='families' and target_id=fid and applied) then raise exception 'Family checkpoint required' using errcode='P0409';end if;
 end if;
 insert into private.migration_snapshots(id,batch_id,entity,family_id,child_id,branch_id,package_id,amount_minor,remaining_sessions,data)
 values(r.target_id,bid,r.entity,fid,cid,branch,pkg,
 case when r.value ? 'amount' then ((r.value->>'amount')::numeric*100)::bigint * case when r.value->>'kind'='refund' then -1 else 1 end end,
 case when r.entity='memberships' then (r.value->>'remaining_sessions')::int end,r.value);
 select to_jsonb(x) into snapshot from private.migration_snapshots x where id=r.target_id;
 else raise exception 'Unsupported entity' using errcode='22023';end if;
 update private.migration_rows set applied=true,target_snapshot=snapshot where batch_id=bid and entity=r.entity and source_id=r.source_id;n:=n+1;
 end loop;
 if not exists(select 1 from private.migration_rows where batch_id=bid and not applied) then update private.migration_batches set state='applied' where id=bid;end if;
 insert into private.migration_runs(batch_id,action,affected) values(bid,'apply',n);
 return jsonb_build_object('applied',n,'remaining',(select count(*) from private.migration_rows where batch_id=bid and not applied));
end $$;
create function private.reconcile_synthetic_migration(bid text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('state',b.state,'expected',b.manifest->'reconciliation','entities',coalesce((select jsonb_object_agg(entity,stats) from(select entity,jsonb_build_object('staged',count(*),'applied',count(*) filter(where applied)) stats from private.migration_rows where batch_id=bid group by entity)x),'{}'),
 'openingMinor',(select coalesce(sum(amount_minor),0) from private.migration_snapshots where batch_id=bid and entity='opening_balances'),
 'historicalNetMinor',(select coalesce(sum(amount_minor),0) from private.migration_snapshots where batch_id=bid and entity='payment_history'),
 'remainingSessions',(select coalesce(sum(remaining_sessions),0) from private.migration_snapshots where batch_id=bid and entity='memberships'),
 'liveCollectionsCreated',0,'guardiansCreated',0,'membershipsActivated',0)
 from private.migration_batches b where b.id=bid
$$;
create function private.reverse_synthetic_migration(bid text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.migration_rows;actual jsonb;n int:=0;begin
 if auth.uid() is not null then raise exception 'Private rehearsal only' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('kafou-operational-writes',0));
 if not exists(select 1 from private.migration_batches where id=bid) then raise exception 'Unknown batch' using errcode='22023';end if;
 if exists(select 1 from private.migration_batches where id=bid and state='reversed') then return jsonb_build_object('reversed',0);end if;
 -- Preflight every owned record; later edits or dependent records block the whole undo.
 for r in select * from private.migration_rows where batch_id=bid and applied loop
 if r.entity='families' then
 select to_jsonb(f) into actual from public.families f where id=r.target_id;
 if exists(select 1 from public.guardians where family_id=r.target_id) or exists(select 1 from public.family_branches where family_id=r.target_id) or exists(select 1 from public.children k where family_id=r.target_id and not exists(select 1 from private.migration_rows m where m.batch_id=bid and m.target_id=k.id)) then raise exception 'Downstream family activity blocks reversal' using errcode='P0409';end if;
 elsif r.entity='children' then select to_jsonb(k) into actual from public.children k where id=r.target_id;
 if exists(select 1 from public.child_sports where child_id=r.target_id) then raise exception 'Downstream child activity blocks reversal' using errcode='P0409';end if;
 else select to_jsonb(x) into actual from private.migration_snapshots x where id=r.target_id;end if;
 if actual is distinct from r.target_snapshot then raise exception 'Imported record changed; review compensating correction' using errcode='P0409';end if;
 end loop;
 delete from private.migration_snapshots where batch_id=bid;
 -- Foreign keys reject any other downstream application activity. Transaction is atomic.
 delete from public.children where id in(select target_id from private.migration_rows where batch_id=bid and entity='children' and applied);
 delete from public.families where id in(select target_id from private.migration_rows where batch_id=bid and entity='families' and applied);
 select count(*) into n from private.migration_rows where batch_id=bid and applied;
 update private.migration_batches set state='reversed' where id=bid;
 insert into private.migration_runs(batch_id,action,affected) values(bid,'reverse',n);
 return jsonb_build_object('reversed',n);
end $$;
revoke all on function private.stage_synthetic_migration(jsonb,text),private.apply_synthetic_migration(text,integer),private.reconcile_synthetic_migration(text),private.reverse_synthetic_migration(text) from public,anon,authenticated,service_role;
