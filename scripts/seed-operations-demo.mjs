// Explicit synthetic seed. Never usable against a production project.
import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const hosted=process.argv.includes('--hosted');
if(hosted&&!process.argv.includes('--confirm-synthetic-staging'))throw Error('Explicit staging acknowledgement required');
const url=hosted?'https://cwdazidovxqeevmpicng.supabase.co':'http://127.0.0.1:56321';
const keys=JSON.parse(readFileSync(hosted?'outputs/foundation/keys.json':'outputs/foundation/local-keys.json','utf8'));
const secret=hosted?(Array.isArray(keys)?keys:keys.keys||keys.api_keys).find(k=>k.type==='secret')?.api_key:keys.SECRET_KEY;
if(!secret||!process.env.KAFOU_DEMO_PASSWORD)throw Error('Private key and KAFOU_DEMO_PASSWORD required');
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const unwrap=async q=>{const r=await q;if(r.error)throw r.error;return r.data;};
const ensure=async(table,field,value,record)=>{const found=await unwrap(db.from(table).select('*').eq(field,value));if(found.length)return found[0];return unwrap(db.from(table).insert(record).select().single());};
const users=(await db.auth.admin.listUsers({perPage:1000})).data.users;
const accounts={};
for(const [label,role]of [['admin','super_admin'],['headoffice','admin'],['branch','branch'],['sales','sales'],['coach','coach'],['parent','parent']]){
 const email=`${label}.kafou@example.com`;let user=users.find(u=>u.email===email);
 if(user){const profile=await unwrap(db.from('profiles').select('synthetic').eq('id',user.id).single());if(!profile.synthetic)throw Error('Refusing to overwrite an unmarked account');}
 else {const r=await db.auth.admin.createUser({email,password:process.env.KAFOU_DEMO_PASSWORD,email_confirm:true,user_metadata:{name:`DEMO · ${label}`}});if(r.error)throw r.error;user=r.data.user;}
 await unwrap(db.from('profiles').update({synthetic:true,active:true,name:`DEMO · ${label}`}).eq('id',user.id));
 await unwrap(db.from('role_assignments').delete().eq('user_id',user.id));
 await unwrap(db.from('role_assignments').insert({user_id:user.id,role}));
 accounts[role]={id:user.id,email};
}
const dubai=await ensure('branches','slug','demo-dubai',{slug:'demo-dubai',name:'DEMO · Dubai',name_ar:'تجريبي · دبي',area:'Synthetic staging branch',provisional:false,active:true,synthetic:true});
const sharjah=await ensure('branches','slug','demo-sharjah',{slug:'demo-sharjah',name:'DEMO · Sharjah',name_ar:'تجريبي · الشارقة',area:'Synthetic staging branch',provisional:false,active:true,synthetic:true});
for(const role of ['branch','sales','coach']){await unwrap(db.from('branch_permissions').delete().eq('user_id',accounts[role].id));await unwrap(db.from('branch_permissions').insert({user_id:accounts[role].id,branch_id:dubai.id}));}
const levels={};
for(const sport of ['swimming','football','karate','badminton']){
 await unwrap(db.from('branch_sports').upsert({branch_id:dubai.id,sport}));
 levels[sport]=await ensure('sport_levels','name',`DEMO · ${sport} beginner`,{sport,name:`DEMO · ${sport} beginner`,name_ar:`تجريبي · مبتدئ`,rank:0,entry_level:true});
}
const advanced=await ensure('sport_levels','name','DEMO · Football developing',{sport:'football',name:'DEMO · Football developing',name_ar:'تجريبي · تطوير',rank:1,entry_level:false});
const age=await ensure('age_groups','name','DEMO · Ages 5–9',{name:'DEMO · Ages 5–9',min_age:5,max_age:9});
const family=await ensure('families','name','DEMO · Family',{name:'DEMO · Family',email:'parent.kafou@example.com',mobile:'+971500000000',synthetic:true});
await unwrap(db.from('guardians').upsert({family_id:family.id,user_id:accounts.parent.id}));await unwrap(db.from('family_branches').upsert({family_id:family.id,branch_id:dubai.id}));
const children=[];
for(const [name,years,sport,level] of [['DEMO · Child One',6,'swimming',levels.swimming],['DEMO · Child Two',8,'football',advanced]]){
 const child=await ensure('children','name',name,{name,family_id:family.id,reported_age:years,age_captured_on:new Date().toISOString().slice(0,10),synthetic:true});
 await unwrap(db.from('child_sports').upsert({child_id:child.id,sport,level:level.name,level_id:level.id,status:'reviewed'},{onConflict:'child_id,sport'}));children.push(child);
}
const definitions=[];
for(const sport of ['swimming','football','karate','badminton']){
 const venue=await ensure('venues','name',`DEMO · ${sport} venue`,{branch_id:dubai.id,name:`DEMO · ${sport} venue`,address:'Synthetic venue — not a KAFOU facility',operating_information:'Staging only'});
 const cls=await ensure('academy_classes','name',`DEMO · ${sport} beginners`,{name:`DEMO · ${sport} beginners`,branch_id:dubai.id,venue_id:venue.id,coach_id:accounts.coach.id,sport,level_id:levels[sport].id,age_group_id:age.id,capacity:12,weekdays:[0,2,4],local_time:`${14+definitions.length}:00`,duration_minutes:45,synthetic:true});definitions.push(cls);
 for(let day=1;day<=14;day++){
 const date=new Date();date.setUTCDate(date.getUTCDate()+day);date.setUTCHours(10+definitions.length-1,0,0,0);
 if(!cls.weekdays.includes(date.getUTCDay()))continue;
 const session=await ensure('class_sessions','starts_at',date.toISOString(),{class_id:cls.id,starts_at:date.toISOString(),ends_at:new Date(date.getTime()+45*60000).toISOString(),capacity:12});
 if(session.class_id!==cls.id)throw Error('Synthetic schedule collides with another class');
 }
}
// One explicit synthetic enrollment makes assigned coach rosters demonstrable immediately.
let enrolled=await unwrap(db.from('enrollments').select('*').eq('child_id',children[0].id).eq('class_id',definitions[0].id).eq('status','active'));
if(!enrolled.length)enrolled=[await unwrap(db.from('enrollments').insert({child_id:children[0].id,class_id:definitions[0].id}).select().single())];
// Cancelled roster history uses a partial unique index. PostgREST upsert cannot
// infer that predicate; retain history and insert only a missing live fixture.
for(const session of await unwrap(db.from('class_sessions').select('id').eq('class_id',definitions[0].id).eq('status','scheduled').gt('starts_at',new Date().toISOString()))){
 const live=await unwrap(db.from('session_roster').select('id').eq('session_id',session.id).eq('enrollment_id',enrolled[0].id).eq('cancelled',false));
 if(!live.length)await unwrap(db.from('session_roster').insert({session_id:session.id,enrollment_id:enrolled[0].id,kind:'enrollment'}));
}
// An explicitly seeded current trial allows attendance/conversion demonstrations immediately.
const lead=await ensure('leads','parent_name','DEMO · Trial Family',{branch_id:dubai.id,assigned_to:accounts.sales.id,parent_name:'DEMO · Trial Family',mobile:'+971500000000',email:'parent.kafou@example.com',source:'walk_in',stage:'trial_booked',synthetic:true});
const enquiry=await ensure('trial_enquiries','lead_id',lead.id,{lead_id:lead.id,submitted_by:accounts.parent.id,child_name:'DEMO · Trial Child',reported_age:6,sport:'swimming',experience:'beginner'});
const previous=await unwrap(db.from('trial_bookings').select('id').eq('enquiry_id',enquiry.id));
if(!previous.length){
 const begins=new Date(Date.now()-5*60000),ends=new Date(Date.now()+40*60000);
 const session=await unwrap(db.from('class_sessions').insert({class_id:definitions[0].id,starts_at:begins.toISOString(),ends_at:ends.toISOString(),capacity:12}).select().single());
 const booked=await unwrap(db.from('trial_bookings').insert({enquiry_id:enquiry.id,session_id:session.id,level_id:levels.swimming.id,booked_by:accounts.branch.id}).select().single());
 await unwrap(db.from('session_roster').insert({session_id:session.id,trial_booking_id:booked.id,kind:'trial'}));
 await unwrap(db.from('lead_activities').insert({lead_id:lead.id,actor_id:accounts.sales.id,kind:'synthetic_fixture',note:'Explicit synthetic trial fixture for staging demonstration.'}));
}
mkdirSync('outputs/phase2' ,{recursive:true});writeFileSync('outputs/phase2/demo-records.json',JSON.stringify({url,accounts,dubai,sharjah,family,children,classes:definitions},null,2),{mode:0o600});
console.log('Six synthetic staging accounts and academy fixtures prepared. No emails sent. Super Admin requires MFA.');
