// Local-only Auth configuration. Does not call any hosted management API.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const p='supabase/config.toml'; let config=readFileSync(p,'utf8');
if(!/^project_id = "kafou-local"$/m.test(config)||!/^port = 56321$/m.test(config)||!/^port = 56322$/m.test(config)) throw Error('Exact local KAFOU configuration required');
if(process.argv.some(a=>a.includes('hosted')||a.includes('linked'))) throw Error('Hosted targets are forbidden');
config=config.replace(/^minimum_password_length = \d+$/m,'minimum_password_length = 8');
config=config.replace(/(\[auth\.email\]\n)([\s\S]*?)(?=\n\[|$)/,(_,header,body)=>header+body.replace(/^enable_confirmations = (true|false)$/m,'enable_confirmations = false'));
config=config.replace(/^(additional_redirect_urls = \[)([^\n]*)(\])$/m,(s,a,b,c)=>b.includes('kafou-members://auth/recovery')?s:a+b+', "kafou-members://auth/recovery"'+c);
writeFileSync(p,config);
if(process.argv.includes('--restart')) {
 for(const args of [['stop'],['start']]) {const r=spawnSync('supabase',args,{stdio:'pipe'}); if(r.status!==0) throw Error('Local Supabase restart failed; inspect local CLI status privately.');}
}
console.log('Local Auth config: immediate signup, minimum 8 characters. Web signup schema unchanged. Restart local Supabase to apply unless --restart was used.');
