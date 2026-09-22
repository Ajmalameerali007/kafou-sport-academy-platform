import test from 'node:test';import assert from 'node:assert/strict';import {dailyCommandSchema} from '../lib/platform/daily-operations';
const id='91000000-0000-4000-8000-000000000001';
test('financial commands reject fractional minor units and missing revision',()=>{
 assert.equal(dailyCommandSchema.safeParse({action:'cost.pay',key:id,data:{id,revision:0,amount_minor:1.1,method:'bank',reference:'test',paid_on:'2026-09-22'}}).success,false);
 assert.equal(dailyCommandSchema.safeParse({action:'cost.review',key:id,data:{id,decision:'approved',reason:'Reviewed receipt'}}).success,false);
});
test('partial salary requires explicit optional reviewed fields accepted by the contract',()=>{
 assert.equal(dailyCommandSchema.safeParse({action:'salary.draft',key:id,data:{agreement_id:id,period_start:'2026-09-01',reviewed_amount_minor:10000,reason:'Reviewed partial amount',allocations:[{branch_id:null,amount_minor:10000}]}}).success,true);
});
test('callers cannot override clock-in actor or recorded time',()=>{
 assert.equal(dailyCommandSchema.safeParse({action:'shift.in',key:id,data:{branch_id:id,employee_id:id,clocked_in_at:'2026-09-01'}}).success,false);
});
