import {createClient} from '@supabase/supabase-js';import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const url='http://127.0.0.1:56321';if(process.env.SUPABASE_URL!==url||!process.env.KAFOU_DEMO_PASSWORD)throw Error('Exact local configuration required');
const db=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const manifest=JSON.parse(readFileSync('outputs/member/demo.json','utf8'));
const old=JSON.parse(readFileSync('outputs/product/local-meeting-tuning-2026-09-20.json','utf8'));
const id=s=>{const h=createHash('sha256').update('native-member-v1:'+s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`};
async function get(p){const r=await p;if(r.error)throw Error('Seed failed ('+r.error.code+') '+r.error.message);return r.data;}
const enrollment=(await get(db.from('enrollments').select('id,child_id,class_id').in('child_id',manifest.children).eq('status','active')))[0];
if(!enrollment)throw Error('Active synthetic enrollment required');
const cls=await get(db.from('academy_classes').select('id,synthetic,branch_id').eq('id',enrollment.class_id).single());if(!cls.synthetic||cls.branch_id!==old.branchId)throw Error('Synthetic class scope mismatch');
const today=new Date();const past=new Date(today.getTime()-2*3600e3);const future=new Date(today.getTime()+2*86400e3+4*3600e3);
for(const [name,start,capacity]of [['source',past,12],['eligible',future,3]]){
 const found=await get(db.from('class_sessions').select('id').eq('id',id(name)));
 if(!found.length)await get(db.from('class_sessions').insert({id:id(name),class_id:cls.id,starts_at:start.toISOString(),ends_at:new Date(start.getTime()+1800e3).toISOString(),capacity}));
}
if(!(await get(db.from('session_roster').select('id').eq('id',id('roster')))).length)await get(db.from('session_roster').insert({id:id('roster'),session_id:id('source'),enrollment_id:enrollment.id,kind:'enrollment'}));
const branch=createClient(url,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await branch.auth.signInWithPassword({email:old.accounts.branch.email,password:process.env.KAFOU_DEMO_PASSWORD});if(login.error)throw Error('Branch authentication failed');
const source=await get(db.from('class_sessions').select('finalized_at').eq('id',id('source')).single());
if(!source.finalized_at)await get(branch.rpc('operations_command',{p_action:'attendance.finalize',p_data:{session_id:id('source'),entries:[{id:id('roster'),attendance:'excused'}]}}));
const credit=await get(db.from('makeup_credits').select('id,status').eq('source_roster_id',id('roster')).single());
manifest.memberFixture={creditId:credit.id,sessionId:id('eligible'),sourceSessionId:id('source'),rosterId:id('roster'),childId:enrollment.child_id};
writeFileSync('outputs/member/demo.json',JSON.stringify(manifest,null,2),{mode:0o600});console.log('Synthetic attendance finalized by branch; member credit:',credit.status);
