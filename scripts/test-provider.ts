import assert from 'node:assert/strict';
import {sendPhotonMessage,verifyPhotonGroup,type PhotonClient} from '../src/server/photon';
process.env.PHOTON_API_KEY='test-only';process.env.PHOTON_PROJECT_ID='pho_prj_test';process.env.PHOTON_ENABLED='true';process.env.DEMO_MODE='false';
let calls:any[]=[];let shared=false;let extra=false;let fail=false;
const client={projects:{
 getSpace:async()=>({id:'pho_spc_test',platform:'imessage',kind:'group',participantIds:['agent','maya','leo',...(extra?['other']:[])]}),
 getUser:async({path}:any)=>({id:path.userId,platform:'imessage',kind:path.userId==='agent'?'agent':'human',handle:({agent:'+15555550100',maya:'+15555550101',leo:'+15555550102',other:'+15555550103'} as any)[path.userId],details:{type:shared?'shared':'dedicated'}}),
 sendMessage:async(options:any)=>{calls.push(options);if(fail)throw Error('timeout');return {id:'pho_msg_test',status:'accepted'};}
}} as unknown as PhotonClient;
const options={spaceId:'pho_spc_test',recipients:['+15555550101','+15555550102'],body:'A home for your group',idempotencyKey:'stable-key'};
assert.equal((await sendPhotonMessage(options,client)).deliveryStatus,'provider_accepted');
assert.equal(calls[0].body.senderId,'agent');assert.equal(calls[0].headers['idempotency-key'],'stable-key');assert.equal(calls[0].body.content.text,options.body);
extra=true;assert.equal((await sendPhotonMessage(options,client)).ok,false);assert.equal(calls.length,1);extra=false;
shared=true;await assert.rejects(()=>verifyPhotonGroup(options.spaceId,options.recipients,client),/shared lines/);shared=false;
fail=true;assert.equal((await sendPhotonMessage(options,client)).deliveryStatus,'unconfirmed');
process.env.PHOTON_ENABLED='false';calls=[];assert.equal((await sendPhotonMessage(options,client)).ok,false);assert.equal(calls.length,0);
console.log('Photon provider checks passed: roster, shared-line rejection, sender, stable key, uncertain outcome, disabled zero I/O.');
