import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enquirySchema,commandSchema,canEnter,workspaceFor} from '../lib/platform/contracts';
const child={parentName:'Synthetic Parent',mobile:'+971501234567',childName:'Synthetic Child',age:'9',sport:'swimming'};
test('enquiry does not invent DOB or require email; rejects invalid ages and sports',()=>{assert.equal(enquirySchema.parse(child).email,'');for(const v of [{...child,age:'0'},{...child,age:'18'},{...child,sport:'tennis'},{...child,childId:'forged'}])assert.equal(enquirySchema.safeParse(v).success,false);});
test('unsupported workflow actions and invalid stages are rejected',()=>{assert.equal(commandSchema.safeParse({action:'payment.take',data:{}}).success,false);assert.equal(commandSchema.safeParse({action:'lead.update',data:{id:crypto.randomUUID(),stage:'paid',branch_id:'',assigned_to:'',lost_reason:'',follow_up_at:''}}).success,false);});
test('workspace switching only selects granted roles and honors suspension',()=>{const c={userId:'1',name:'Test',roles:['branch'] as const,branchIds:[],active:true,aal:'aal1' as const};assert.equal(canEnter({...c,roles:[...c.roles]},'admin'),false);assert.equal(canEnter({...c,roles:[...c.roles]},'branch'),true);assert.equal(canEnter({...c,roles:[...c.roles],active:false},'branch'),false);assert.equal(workspaceFor(['parent','coach']),'/account');});
