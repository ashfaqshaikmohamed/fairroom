import 'dotenv/config';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {ApiError} from '@photon-ai/api';
import {photonClient,projectPath,normalizeHandle,photonEnabled} from '../src/server/photon';
const receiptPath='data/native-group-test.json';
async function main(){
 const handles=[process.env.FAIRROOM_TEST_RECIPIENT,process.env.FAIRROOM_GROUP_TEST_MEMBER].map(x=>normalizeHandle(x||''));
 if(handles.some(x=>!/^\+\d{10,15}$/.test(x))||new Set(handles).size!==2)throw Error('Configure two distinct test recipients with country codes.');
 if(!photonEnabled())throw Error('Sending is disabled.');
 if(existsSync(receiptPath))throw Error('A group test was already attempted; inspect its receipt before retrying.');
 const api=photonClient();
 const agent=await api.projects.createOrGetUser({path:projectPath(),body:{platform:'imessage',handle:normalizeHandle(process.env.PHOTON_AGENT_HANDLE||'')}});
 if(agent.platform!=='imessage'||agent.kind!=='agent')throw Error('Configured number is not a project agent.');
 const people=await Promise.all(handles.map(handle=>api.projects.createOrGetUser({path:projectPath(),body:{platform:'imessage',handle}})));
 if(people.some(p=>p.platform!=='imessage'||p.kind!=='human'))throw Error('Test recipients must be human iMessage identities.');
 const state:any={creationKey:randomUUID(),messageKey:randomUUID(),at:new Date().toISOString(),status:'creating'};
 const save=()=>writeFileSync(receiptPath,JSON.stringify(state,null,2));save();
 try{
  const space=await api.projects.createOrGetSpace({path:projectPath(),headers:{'idempotency-key':state.creationKey},body:{platform:'imessage',participantIds:[agent.id,...people.map(p=>String(p.id))]}});
  state.spaceId=space.id;state.status='created';save();
  if(space.platform!=='imessage'||space.kind!=='group'||!Array.isArray(space.participantIds)||JSON.stringify([...space.participantIds].sort())!==JSON.stringify([agent.id,...people.map(p=>String(p.id))].sort()))throw Error('Returned group did not match the intended recipients. No message sent.');
  state.status='sending';save();
  const msg=await api.projects.sendMessage({path:projectPath(),headers:{'idempotency-key':state.messageKey},body:{spaceId:space.id,senderId:agent.id,content:{type:'text',format:'plain',text:'FairRoom connection test: this is the roommate group-chat test Ashfaq requested. No preferences have been collected yet.'}}});
  state.status=msg.status;state.messageId=msg.id;save();console.log(`Group test message status: ${msg.status}. Check both phones.`);
 }catch(e){
  state.status=e instanceof ApiError&&e.status<500?'rejected':'unconfirmed';
  if(e instanceof ApiError){const b=e.body as {code?:string;requestId?:string};state.httpStatus=e.status;state.code=b?.code;state.requestId=b?.requestId;}
  save();throw e;
 }
}
main().catch(e=>{if(e instanceof ApiError){const b=e.body as {code?:string};console.error(`Photon rejected or could not complete the group test: HTTP ${e.status}, code ${b?.code||'unspecified'}.`);}else console.error(e.message==='Configure two distinct test recipients with country codes.'?e.message:'Group test stopped. Inspect the local receipt; do not retry an uncertain send.');process.exitCode=1;});
