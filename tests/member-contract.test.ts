import test from 'node:test';
import assert from 'node:assert/strict';
import { memberCommand, memberQuery, memberActions } from '../lib/member/contracts';
import { readFileSync } from 'node:fs';
test('native mutation allowlist excludes academy authority and provider actions',()=>{
  for(const action of ['attendance.finalize','development.assessment.publish','commercial.payment.record','permission.grant','staff.access','academy.policy','communication.dispatch','family.claim']) assert.equal(memberCommand.safeParse({action,data:{},key:'10000000-0000-4000-a000-000000000001'}).success,false);
  assert.equal(memberActions.includes('academy.makeup.book'),true);
});
test('member pages are bounded and scoped to UUID children',()=>{
  assert.equal(memberQuery.safeParse({resource:'sessions',child:'not-an-id'}).success,false);
  assert.equal(memberQuery.safeParse({resource:'sessions',child:null,limit:101}).success,false);
  assert.equal(memberQuery.safeParse({resource:'sessions',child:null,cursor:-1}).success,false);
  assert.equal(memberQuery.parse({resource:'sessions',child:null}).limit,50);
});
test('SQL allowlist matches the transport allowlist',()=>{
 const sql=readFileSync('supabase/migrations/20260921160000_member_v1.sql','utf8');
 const match=sql.match(/if p_action not in \(([^)]+)\)/);assert.ok(match);
 const actions=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);assert.deepEqual(actions.sort(),[...memberActions].sort());
 assert.match(sql,/stable security invoker/);
});
