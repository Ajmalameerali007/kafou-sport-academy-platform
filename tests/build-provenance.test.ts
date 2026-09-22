import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const generator=resolve('scripts/build-provenance.mjs');
test('Release identity covers security middleware and build dependencies while excluding local secrets',()=>{
 const root=mkdtempSync(join(tmpdir(),'kafou-provenance-test-'));
 try{
  const put=(path:string,value:string)=>{mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),value);};
  put('lib/platform/example.ts','export const example=true;');put('proxy.ts','initial middleware');put('build/sites-vite-plugin.ts','build plugin');put('vendor/style.css','body{}');put('hooks/use-example.ts','hook');put('.openai/hosting.json','{"project_id":"test-only"}');put('supabase/seed.sql','-- synthetic configuration');put('.env.local','PRIVATE_TEST_SECRET=do-not-fingerprint');put('.env.test.private','PRIVATE_TEST_PASSWORD=do-not-fingerprint');
  const run=()=>{const r=spawnSync(process.execPath,[generator],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(readFileSync(join(root,'lib/platform/build-provenance.json'),'utf8'));};
  const first=run();const paths=first.inputs.map((x:{path:string})=>x.path);
  for(const path of ['proxy.ts','build/sites-vite-plugin.ts','vendor/style.css','hooks/use-example.ts','.openai/hosting.json','supabase/seed.sql'])assert.ok(paths.includes(path),path);
  assert.ok(!paths.some((p:string)=>p.includes('.env')));assert.ok(!paths.includes('lib/platform/build-provenance.json'));assert.equal(run().sourceSha256,first.sourceSha256);
  put('.env.local','PRIVATE_TEST_SECRET=changed-but-still-excluded');assert.equal(run().sourceSha256,first.sourceSha256);
  put('proxy.ts','changed middleware');assert.notEqual(run().sourceSha256,first.sourceSha256);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('Container builds retain source identity when Git is unavailable',()=>{
 const root=mkdtempSync(join(tmpdir(),'kafou-provenance-container-'));
 try{
  mkdirSync(join(root,'lib/platform'),{recursive:true});
  writeFileSync(join(root,'lib/platform/example.ts'),'export const example=true;');
  const result=spawnSync(process.execPath,[generator],{cwd:root,env:{...process.env,PATH:join(root,'no-executables')},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const record=JSON.parse(readFileSync(join(root,'lib/platform/build-provenance.json'),'utf8'));
  assert.match(record.sourceSha256,/^[a-f0-9]{64}$/);
  assert.equal(record.gitHead,null);
  assert.equal(record.dirty,null);
  assert.deepEqual(record.inputs.map((x:{path:string})=>x.path),['lib/platform/example.ts']);
 }finally{rmSync(root,{recursive:true,force:true});}
});
