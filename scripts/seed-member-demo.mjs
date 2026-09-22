import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const local='http://127.0.0.1:56321';
if(process.env.SUPABASE_URL!==local||!process.env.KAFOU_DEMO_PASSWORD||process.env.KAFOU_DEMO_PASSWORD.length<8) throw Error('Exact local Auth and private demo password required');
const db=createClient(local,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
async function unwrap(p){const r=await p;if(r.error)throw Error('Local synthetic seed failed ('+(r.error.code||r.error.status||'service')+')');return r.data;}
const fixture=JSON.parse(readFileSync('outputs/product/local-meeting-tuning-2026-09-20.json','utf8'));
if(fixture.url!==local)throw Error('Fixture is not local');
const family=await unwrap(db.from('families').select('id,synthetic').eq('id',fixture.familyId).single());
if(!family.synthetic)throw Error('Synthetic family required');
const users=await unwrap(db.auth.admin.listUsers({perPage:1000}));let user=users.users.find(u=>u.email==='demo@kafou.com');
if(user){const p=await unwrap(db.from('profiles').select('synthetic').eq('id',user.id).single());if(!p.synthetic)throw Error('Existing account is not a synthetic member demo');}
else {const r=await unwrap(db.auth.admin.createUser({email:'demo@kafou.com',password:process.env.KAFOU_DEMO_PASSWORD,email_confirm:true,user_metadata:{name:'Demo member family'}}));user=r.user;await unwrap(db.from('profiles').update({synthetic:true}).eq('id',user.id));}
const roles=await unwrap(db.from('role_assignments').select('role').eq('user_id',user.id));
if(roles.length!==1||roles[0].role!=='parent')throw Error('Demo must have parent authority only');
// Explicit local synthetic fixture grant, never email/telephone matching or an end-user claim.
await unwrap(db.from('guardians').upsert({family_id:family.id,user_id:user.id}));
const children=await unwrap(db.from('children').select('id,synthetic').eq('family_id',family.id));
if(children.length<2||children.some(c=>!c.synthetic))throw Error('Expected synthetic siblings');
const signIn=createClient(local,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
await unwrap(signIn.auth.signInWithPassword({email:'demo@kafou.com',password:process.env.KAFOU_DEMO_PASSWORD}));
const checks={};
for(const resource of ['families','children','sessions','progress','memberships','notifications','documents','credits','waitlist','levels','invoices','receipts','support','consents','events','challenges','recognition','trials']) {
 const r=await signIn.rpc('member_v1_read',{p_resource:resource,p_child:null,p_offset:0,p_limit:50});
 if(r.error)throw Error('Member projection '+resource+' failed ('+r.error.code+'): '+r.error.message);
 checks[resource]=r.data.items.length;
}
mkdirSync('outputs/member',{recursive:true});writeFileSync('outputs/member/demo.json',JSON.stringify({url:local,userId:user.id,familyId:family.id,children:children.map(c=>c.id),checks},null,2),{mode:0o600});
console.log('Local synthetic member account verified. Resource counts:',checks);
