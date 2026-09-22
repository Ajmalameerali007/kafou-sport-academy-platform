/** Real local HTTP/MFA rehearsal. No provider calls, fake JWTs or existing credential changes. */
import {createClient} from '@supabase/supabase-js';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const keys=JSON.parse(readFileSync('outputs/foundation/local-keys.json','utf8'));
assert.equal(keys.API_URL,'http://127.0.0.1:56321');
const service=createClient(keys.API_URL,keys.SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const fixture=JSON.parse(readFileSync('outputs/product/local-meeting-tuning-2026-09-20.json','utf8'));
assert.equal(fixture.url,keys.API_URL);
const origin='http://127.0.0.1:3101';const jars={};const checks=[];const check=(n,ok)=>{assert.ok(ok,n);checks.push({name:n,result:'pass'});};
async function api(actor,path,data){const response=await fetch(origin+'/api/'+path,{method:data?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(jars[actor]?{Cookie:jars[actor]}:{})},...(data?{body:JSON.stringify(data)}:{})});const cookies=response.headers.getSetCookie();if(cookies.length)jars[actor]=cookies.map(c=>c.split(';')[0]).join('; ');return {status:response.status,...await response.json()};}
async function db(result){const r=await result;if(r.error)throw Error('Synthetic fixture operation failed: '+r.error.code);return r.data;}
const password=randomBytes(32).toString('hex');
const created=await service.auth.admin.createUser({email:`verification-owner-${randomUUID()}@example.test`,password,email_confirm:true,user_metadata:{name:'DEMO · Temporary verification owner'}});
if(created.error)throw Error('Could not create isolated synthetic verification actor');
const ownerId=created.data.user.id;
await db(service.from('profiles').update({synthetic:true}).eq('id',ownerId));
await db(service.from('role_assignments').delete().eq('user_id',ownerId));
await db(service.from('role_assignments').insert({user_id:ownerId,role:'super_admin'}));
const email=created.data.user.email;
let enabled=false;
const command=(actor,action,data,key=randomUUID())=>api(actor,'coach-conversations',{key,command:{action,data}});
try{
 check('New synthetic owner authenticates normally',(await api('owner','auth/login',{identifier:email,password,remember:false})).ok);
 check('Policy activation denied at AAL1',(await command('owner','policy',{branch_id:fixture.branchId,enabled:true,review_required:true})).status===403);
 const enrolled=await api('owner','auth/mfa/enroll',{});check('Real Auth TOTP enrollment',enrolled.ok);
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of enrolled.data.totp.secret.replace(/=+$/,''))bits+=alphabet.indexOf(c.toUpperCase()).toString(2).padStart(5,'0');const secret=Buffer.from((bits.match(/.{8}/g)||[]).map(b=>parseInt(b,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',secret).update(counter).digest();const offset=h[19]&15;const code=String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
 check('Auth verifies actual TOTP',(await api('owner','auth/mfa/verify',{factorId:enrolled.data.id,code})).ok);
 const session=await api('owner','auth/session');check('Owner has genuine AAL2 without demo exemption',session.data.aal==='aal2');
 check('Owner enables synthetic reviewed policy',(await command('owner','policy',{branch_id:fixture.branchId,enabled:true,review_required:true})).ok);enabled=true;
 for(const role of ['parent','coach'])check(role+' separate authenticated session',(await api(role,'auth/login',{identifier:fixture.accounts[role].email,password:process.env.KAFOU_DEMO_PASSWORD,remember:false})).ok);
 const options=await api('parent','coach-conversations');check('Parent sees eligible own-child option',options.ok&&options.data.length>0);
 const coachOptions=await api('coach','coach-conversations');const shared=options.data.find(o=>coachOptions.data.some(c=>c.id===o.id));check('Selected enrollment assigned to this coach',Boolean(shared));const enrollment=shared.id;const opened=await command('parent','open',{enrollment_id:enrollment});check('Parent opens persisted enrollment conversation',opened.ok);const conversation=opened.data.id;
 const parentMessage=await command('parent','reply',{conversation_id:conversation,body:'SYNTHETIC ACCEPTANCE: Can you confirm the reviewed home practice?'});check('Parent message persisted',parentMessage.ok);
 const requestKey=randomUUID();const body='SYNTHETIC ACCEPTANCE: Follow the reviewed coaching guidance.';
 const reply=await command('coach','reply',{conversation_id:conversation,body},requestKey);check('Assigned coach drafts reply',reply.ok);
 const repeat=await command('coach','reply',{conversation_id:conversation,body},requestKey);check('Repeated reply produces one message',repeat.ok&&reply.data.id===repeat.data.id);
 let parentData=await api('parent','product');check('Parent cannot see draft',!parentData.data.coach_messages.some(m=>m.id===reply.data.id));
 check('Authorized oversight publishes reply',(await command('owner','publish',{conversation_id:conversation,id:reply.data.id})).ok);
 await api('parent','auth/logout',{});await api('parent','auth/login',{identifier:fixture.accounts.parent.email,password:process.env.KAFOU_DEMO_PASSWORD,remember:false});
 parentData=await api('parent','product');check('Published reply persists across logout/login',parentData.data.coach_messages.some(m=>m.id===reply.data.id&&m.status==='published'));
 check('Parent explicitly marks displayed reply read',(await command('parent','read',{conversation_id:conversation,message_ids:[reply.data.id]})).ok);
 const receipts=await api('coach','coach-conversations/receipts?conversation='+conversation);check('Coach sees actual parent read receipt',receipts.data.some(r=>r.id===reply.data.id&&r.read_count===1));
 check('Parent escalation is persisted',(await command('parent','escalate',{conversation_id:conversation})).ok);
}finally{
 if(enabled)check('Synthetic chat policy disabled after rehearsal',(await command('owner','policy',{branch_id:fixture.branchId,enabled:false,review_required:true})).ok);
 await db(service.from('profiles').update({active:false}).eq('id',ownerId));
}
writeFileSync('docs/product/evidence/coach-chat-http.json',JSON.stringify({at:new Date().toISOString(),environment:origin,synthetic:true,ownerAssurance:'actual_auth_totp_aal2',policyAfterTest:'disabled',verificationActorAfterTest:'inactive',checks},null,2)+'\n',{mode:0o600});
console.log(checks.length+' local HTTP/MFA/conversation checks passed. Synthetic policy disabled and temporary actor inactive.');
