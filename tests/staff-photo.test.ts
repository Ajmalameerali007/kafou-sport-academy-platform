import test from 'node:test';
import assert from 'node:assert/strict';
import { staffPhotoSchema, verifiedStaffFace } from '../lib/platform/staff-photo';
const id='91000000-0000-4000-8000-000000000001';
test('staff verification requires exactly one matching face',()=>{
 assert.equal(verifiedStaffFace([{status:'matched',reference:id}],id),true);
 assert.equal(verifiedStaffFace([{status:'matched',reference:id},{status:'not_identified'}],id),false);
 assert.equal(verifiedStaffFace([],id),false);
 assert.equal(verifiedStaffFace([{status:'ambiguous',reference:id}],id),false);
});
test('verified clock actions cannot forge employee or time and require exact action data',()=>{
 const input={action:'process',staff:id,reference:id,key:id,content:'photo',clock:{action:'shift.in',data:{branch_id:id}}};
 assert.equal(staffPhotoSchema.safeParse(input).success,true);
 assert.equal(staffPhotoSchema.safeParse({...input,matched:true}).success,false);
 assert.equal(staffPhotoSchema.safeParse({...input,clock:{action:'shift.in',data:{branch_id:id,employee_id:id}}}).success,false);
 assert.equal(staffPhotoSchema.safeParse({...input,clock:{action:'shift.out',data:{branch_id:id}}}).success,false);
});
