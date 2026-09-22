import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile,lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const digest=b=>createHash('sha256').update(b).digest('hex');
const entries=[];
async function scan(path){if(path.split('/').includes('__pycache__')||path.endsWith('.pyc'))return;const stat=await lstat(path);if(stat.isSymbolicLink())throw Error('Build inputs must not be symlinks');if(stat.isDirectory()){for(const n of (await readdir(path)).sort())await scan(path+'/'+n);}else if(path!=='lib/platform/build-provenance.json'){entries.push({path,sha256:digest(await readFile(path))});}}
for(const path of ['app','components','lib','hooks','public','build','vendor','db','drizzle','supabase/migrations','supabase/seed.sql','scripts','package.json','package-lock.json','vite.config.ts','tsconfig.json','proxy.ts','next.config.ts','postcss.config.mjs','asset-types.d.ts','cloudflare-env.d.ts','.openai/hosting.json']){try{await scan(path);}catch(e){if(e.code!=='ENOENT')throw e;}}
entries.sort((a,b)=>a.path.localeCompare(b.path));
const git=(args)=>{const result=spawnSync('git',args,{encoding:'utf8'});return result.status===0?result.stdout.trim():null;};
const gitStatus=git(['status','--porcelain']);
const record={version:1,createdAt:new Date().toISOString(),gitHead:git(['rev-parse','HEAD']),dirty:gitStatus===null?null:Boolean(gitStatus),sourceSha256:digest(JSON.stringify(entries)),expectedMigrations:entries.filter(e=>e.path.startsWith('supabase/migrations/')),inputs:entries};
await writeFile('lib/platform/build-provenance.json',JSON.stringify(record,null,2)+'\n');
console.log('Source fingerprint: '+record.sourceSha256);
