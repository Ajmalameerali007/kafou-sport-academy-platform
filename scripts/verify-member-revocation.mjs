import {createClient} from '@supabase/supabase-js';import{readFileSync,writeFileSync}from'node:fs';import{createHash,randomUUID}from'node:crypto';import assert from'node:assert/strict';
const url='http://127.0.0.1:56321',origin='http://127.0.0.1:3102';if(process.env.SUPABASE_URL!==url||!process.env.KAFOU_DEMO_PASSWORD)throw Error('Local private configuration required');
const fixture=JSON.parse(readFileSync('outputs/member/demo.json','utf8')),old=JSON.parse(readFileSync('outputs/product/local-meeting-tuning-2026-09-20.json','utf8'));
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),member=createClient(url,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const sid=s=>{const h=createHash('sha256').update('member-cross-role-v2:'+s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const checks=[],cookies={};function check(name,value){assert.ok(value,name);checks.push({name,result:'pass'});console.log('PASS '+name);}
async function get(p){const r=await p;if(r.error)throw Error('Fixture query failed ('+(r.error.code||'service')+')');return r.data;}
async function web(role,path,body){const r=await fetch(origin+'/api/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(cookies[role]?{Cookie:cookies[role]}:{})},...(body?{body:JSON.stringify(body)}:{})});const c=r.headers.getSetCookie();if(c.length)cookies[role]=c.map(x=>x.split(';')[0]).join('; ');return {status:r.status,...await r.json()};}
const login=await member.auth.signInWithPassword({email:'demo@kafou.com',password:process.env.KAFOU_DEMO_PASSWORD});check('Native member authenticated separately',!login.error);const token=login.data.session.access_token;
async function read(resource){const r=await fetch(origin+'/api/member/v1/'+resource,{headers:{Authorization:'Bearer '+token}});return {status:r.status,...await r.json()};}
for(const role of ['branch','coach','admin']){const r=await web(role,'auth/login',{identifier:old.accounts[role].email,password:process.env.KAFOU_DEMO_PASSWORD,remember:false});check('Separate '+role+' web session',r.ok);}

const assessment=await get(admin.from('development_assessments').select('id').eq('session_id',sid('session')).single());
const issued=await web('admin','product',{action:'development.certificate.issue',data:{assessment_id:assessment.id,title:'Synthetic native revocation verification'},key:sid('certificate')});check('Head Office issues certificate from published evidence',issued.ok);
const id=issued.data.id;
const before=await fetch(origin+'/api/member/v1/documents/certificate/'+id,{headers:{Authorization:'Bearer '+token}});check('Issued certificate PDF is initially authorized',before.status===200);
const revoked=await web('admin','product',{action:'development.certificate.revoke',data:{id,reason:'Synthetic local native access-revocation verification'},key:sid('certificate-revoke')});check('Head Office revokes certificate',revoked.ok);
check('Revoked certificate disappears from native listing',!(await read('documents')).data.items.some(x=>x.id===id));
const after=await fetch(origin+'/api/member/v1/documents/certificate/'+id,{headers:{Authorization:'Bearer '+token}});check('Revoked certificate direct PDF is denied',after.status===404);
const credit=await get(admin.from('makeup_credits').select('expires_at').eq('id',fixture.memberFixture.creditId).single());
try{
 await get(admin.from('makeup_credits').update({expires_at:new Date(Date.now()-86400e3).toISOString()}).eq('id',fixture.memberFixture.creditId));
 const options=await read('makeup-options?id='+fixture.memberFixture.creditId);check('Expired credit provides no eligible sessions',options.status===409||(options.status===200&&options.data.length===0));
 const r=await fetch(origin+'/api/member/v1/commands',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'academy.makeup.book',data:{credit_id:fixture.memberFixture.creditId,session_id:fixture.memberFixture.sessionId},key:randomUUID()})});check('Expired credit cannot book through native adapter',r.status===409);
}finally{await get(admin.from('makeup_credits').update({expires_at:credit.expires_at}).eq('id',fixture.memberFixture.creditId));}
writeFileSync('outputs/member/revocation-verification.json',JSON.stringify({at:new Date().toISOString(),environment:'local',checks},null,2));console.log(checks.length+' access-expiry checks passed.');
