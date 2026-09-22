/** Populated LOCAL reconstruction of verified hosted migration history; never connects to hosted data. */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const container='supabase_db_kafou-local';
const target=`kafou_upgrade_${Date.now()}_${process.pid}`;
const recovery=target+'_recovery';
const output=`outputs/release-recovery/${new Date().toISOString().replace(/[:.]/g,'-')}`;
mkdirSync(output,{recursive:true,mode:0o700});
const hash=s=>createHash('sha256').update(s).digest('hex');
const mapBytes=readFileSync('docs/product/evidence/hosted-migration-map.json');const map=JSON.parse(mapBytes);
assert.equal(map.project,'cwdazidovxqeevmpicng');assert.equal(map.mode,'read_only');
assert.ok(map.migrations.every(m=>m.status==='equivalent_already_applied'&&m.localExactMatches.length===1));
assert.ok(map.pending.every(m=>m.status==='genuinely_missing'));
const baseline=map.migrations.map(m=>({file:m.localExactMatches[0],content:readFileSync(m.localExactMatches[0],'utf8'),normalizedHash:m.sha256,remoteVersion:m.remoteVersion}));
for(const m of baseline)assert.equal(hash(m.content.trim()),m.normalizedHash);
const pending=map.pending.map(m=>({file:m.file,content:readFileSync(m.file,'utf8'),sha256:m.sha256}));for(const m of pending)assert.equal(hash(m.content),m.sha256);
const files=readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql'));assert.equal(new Set([...baseline,...pending].map(m=>m.file)).size,files.length);
const fixture=readFileSync('tests/fixtures/mapped-upgrade.sql','utf8');
const evidence={startedAt:new Date().toISOString(),target,container,mode:'local_populated_mapped_schema_reconstruction',mapSha256:hash(mapBytes),fixtureSha256:hash(fixture),baseline:baseline.map(({file,remoteVersion,normalizedHash})=>({file,remoteVersion,normalizedHash})),pending:pending.map(({file,sha256})=>({file,sha256})),checks:[],result:'incomplete',limitations:['Not a hosted data backup, PITR or hosted restore rehearsal.','Auth/storage schema bootstrap is from the local Supabase infrastructure; hosted drift outside stored migration statements is not covered.','SQL permission fixtures use explicit transaction claims; no actual restored Auth/HTTP/Storage service is started.','Private file bytes, provider configuration, cluster globals and deployed previous Worker compatibility are not covered.']};
const created=[];
function run(args,input){const r=spawnSync('docker',['exec',...(input===undefined?[]:['-i']),container,...args],{input,encoding:'utf8',maxBuffer:100*1024*1024,timeout:120000});if(r.error||r.status!==0)throw Error(`Isolated command ${args[0]} failed: ${String(r.stderr).slice(-2000)}`);return r.stdout;}
function sql(db,s,user='postgres'){assert.ok([target,recovery].includes(db));return run(['psql','-X','-U',user,'-d',db,'-v','ON_ERROR_STOP=1','-At'],s);}
function create(db){assert.ok([target,recovery].includes(db));run(['createdb','-U','postgres',db]);created.push(db);}
function check(name,value){assert.ok(value,name);evidence.checks.push({name,result:'pass'});}
function projections(db){return JSON.parse(sql(db,`select coalesce(json_agg(json_build_object('schema',n.nspname,'table',c.relname,'columns',a.cols) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral(select string_agg(quote_ident(attname),',' order by attnum) cols from pg_attribute where attrelid=c.oid and attnum>0 and not attisdropped)a where n.nspname in ('public','private','auth','storage') and c.relkind='r';`));}
function fingerprint(db,items){return items.map(t=>{const ident=n=>'"'+n.replaceAll('"','""')+'"';return JSON.parse(sql(db,`select json_build_object('table','${t.schema}.${t.table}','rows',count(*),'sha256',encode(extensions.digest(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),''),'sha256'),'hex')) from(select ${t.columns} from ${ident(t.schema)}.${ident(t.table)})t;`));});}
try{
 const infrastructure=run(['pg_dump','-U','postgres','-d','postgres','--schema-only','--no-owner']);create(target);sql(target,infrastructure,'supabase_admin');sql(target,'drop schema if exists private cascade;drop schema public cascade;create schema public authorization pg_database_owner;grant usage on schema public to public,postgres,anon,authenticated,service_role;grant create on schema public to postgres;','supabase_admin');
 check('Reconstruction begins with zero Auth users and storage objects',sql(target,'select (select count(*) from auth.users)+(select count(*) from storage.objects);').trim()==='0');
 for(const m of baseline)sql(target,'begin;\n'+m.content+'\ncommit;');
 const seed=readFileSync('supabase/seed.sql','utf8');evidence.seedSha256=hash(seed);sql(target,seed);sql(target,fixture);const columns=projections(target);const before=fingerprint(target,columns);evidence.before=before;
 check('Populated legacy membership is active after exact offline payment',sql(target,"select count(*) from public.commercial_memberships where status='active';").trim()==='1');
 check('Legacy financial fixture contains exact money',sql(target,'select sum(amount_minor) from public.commercial_payments;').trim()==='25010');
 const backup=run(['pg_dump','-U','postgres','-d',target,'--no-owner']);evidence.backupSha256=hash(backup);evidence.backupBytes=Buffer.byteLength(backup);
 create(recovery);sql(recovery,backup,'supabase_admin');check('Isolated pre-upgrade backup restores original records exactly',JSON.stringify(fingerprint(recovery,columns))===JSON.stringify(before));
 for(const m of pending){sql(target,'begin;\n'+m.content+'\ncommit;');evidence.checks.push({name:'Applied '+m.file,result:'pass'});}
 const after=fingerprint(target,columns);check('Upgrade preserves every original table row and column value',JSON.stringify(before)===JSON.stringify(after));evidence.originalTablesCompared=before.length;evidence.originalRowsCompared=before.reduce((n,r)=>n+r.rows,0);
 check('All activation controls remain empty',sql(target,"select (select count(*) from private.scheduled_job_controls where enabled)+(select count(*) from public.development_automation_policies where enabled)+(select count(*) from public.coach_message_policies where enabled)+(select count(*) from public.delivery_outbox where status<>'not_configured');").trim()==='0');
 const claims=(id,aal)=>`set local role authenticated;select set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated","aal":"${aal}"}',true);`;
 const owner='71000000-0000-4000-8000-000000000001';
 const report=JSON.parse(sql(target,`begin;${claims(owner,'aal2')} select public.business_report((now() at time zone 'Asia/Dubai')::date,(now() at time zone 'Asia/Dubai')::date);rollback;`).split('\n').find(s=>s.startsWith('{"asOf"')||s.startsWith('{"sales"')||s.includes('"financeVisible"')||s.includes('"receivedMinor"')));
 check('Complete report reconciles preserved legacy payment',report.finance.receivedMinor===25010);
 check('Current guardian sees original family',sql(target,`begin;${claims('71000000-0000-4000-8000-000000000002','aal1')} select 'count='||count(*) from public.children;rollback;`).includes('count=2'));
 check('Unrelated parent denied original children',sql(target,`begin;${claims('71000000-0000-4000-8000-000000000005','aal1')} select 'count='||count(*) from public.children;rollback;`).includes('count=0'));
 sql(target,`begin;${claims(owner,'aal1')} do $$begin perform public.business_report(current_date,current_date);raise exception 'Unexpected AAL1 report access';exception when insufficient_privilege then null;end$$;rollback;`);check('Normal owner MFA denied at AAL1 without demo exemption',true);
 check('Preserved old recovery copy still matches before upgrade',JSON.stringify(fingerprint(recovery,columns))===JSON.stringify(before));
 for(const m of [...baseline,...pending])check('Source unchanged: '+m.file,hash(readFileSync(m.file))===hash(m.content));
 evidence.result='populated_mapped_upgrade_and_isolated_database_recovery_passed';
}catch(error){evidence.result='failed';evidence.error=error.message;process.exitCode=1;console.error(error.message);}finally{
 evidence.cleanup=[];for(const db of created.reverse()){try{run(['dropdb','-U','postgres',db]);evidence.cleanup.push({database:db,result:'dropped'});}catch{evidence.cleanup.push({database:db,result:'drop_failed'});process.exitCode=1;}}
 evidence.finishedAt=new Date().toISOString();writeFileSync(output+'/mapped-upgrade.json',JSON.stringify(evidence,null,2)+'\n',{mode:0o600});console.log(evidence.result+'; evidence '+output+'/mapped-upgrade.json');
}
