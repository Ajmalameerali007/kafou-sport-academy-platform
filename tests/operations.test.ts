import test from 'node:test';
import assert from 'node:assert/strict';
import { operationSchema, mayOperate } from '../lib/platform/operations';
import type { AccountContext } from '../lib/platform/contracts';
const account=(roles:AccountContext['roles']):AccountContext=>({userId:'x',name:'Test',active:true,roles,branchIds:[],aal:'aal1'});
test('Sales cannot configure classes, finalize attendance or convert members',()=>{
 for(const action of ['class.create','attendance.finalize','trial.convert']) assert.equal(mayOperate(account(['sales']),action),false);
 assert.equal(mayOperate(account(['sales']),'trial.book'),true);
});
test('parent cannot override allocation or assign levels',()=>{
 assert.equal(mayOperate(account(['parent']),'enquiry.level'),false);
 assert.equal(mayOperate(account(['parent']),'trial.book'),true);
});
test('duplicate roster identifiers and invalid recurrence are rejected',()=>{
 const id='10000000-0000-4000-8000-000000000001';
 assert.equal(operationSchema.safeParse({action:'attendance.finalize',data:{session_id:id,entries:[{id,attendance:'present'},{id,attendance:'absent'}]}}).success,false);
 assert.equal(operationSchema.safeParse({action:'class.create',data:{name:'Test',branch_id:id,venue_id:id,coach_id:id,sport:'swimming',level_id:id,age_group_id:id,capacity:10,weekdays:[8],local_time:'17:00',duration_minutes:60}}).success,false);
});
