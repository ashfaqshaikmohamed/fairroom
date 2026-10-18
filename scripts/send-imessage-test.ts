import 'dotenv/config';
import {ApiError} from '@photon-ai/api';
class SetupError extends Error {}
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {photonClient,projectPath,normalizeHandle,photonEnabled} from '../src/server/photon';
import {planRooms} from '../src/engine/groupPlan';
import {normalizeProfile} from '../src/engine/matching';

async function main(){
 const recipient=normalizeHandle(process.env.FAIRROOM_TEST_RECIPIENT||'');
 if(!/^\+\d{10,15}$/.test(recipient))throw new SetupError('Set FAIRROOM_TEST_RECIPIENT to your own number, including country code.');
 if(!photonEnabled())throw new SetupError('Configure PHOTON_API_KEY, PHOTON_PROJECT_ID and PHOTON_ENABLED=true in .env.');
 const api=photonClient();
 let pageToken:string|undefined;
 let chosen:{spaceId:string;senderId:string}|undefined;
 do{
  const page=await api.projects.listSpaces({path:projectPath(),query:{platform:'imessage',pageSize:100,...(pageToken?{pageToken}:{})}});
  for(const space of page.items){
   if(space.platform!=='imessage'||!Array.isArray(space.participantIds)||space.participantIds.length!==2||space.kind==='group')continue;
   const users=await Promise.all(space.participantIds.map(userId=>api.projects.getUser({path:{...projectPath(),userId}})));
   const human=users.find(u=>u?.kind==='human'),agent=users.find(u=>u?.kind==='agent');
   if(!human||!agent||human.platform!=='imessage'||agent.platform!=='imessage'||normalizeHandle(human.handle)!==recipient)continue;
   if(process.env.PHOTON_AGENT_HANDLE&&normalizeHandle(agent.handle)!==normalizeHandle(process.env.PHOTON_AGENT_HANDLE))continue;
   chosen={spaceId:space.id,senderId:agent.id};break;
  }
  pageToken=page.nextPageToken;
 }while(!chosen&&pageToken);
 if(!chosen)throw new SetupError('First send “hello” from your own iMessage number to your FairRoom agent number, then run this again. No matching private conversation found.');
 const fixture=JSON.parse(readFileSync('data/demo-fixtures.json','utf8'));
 const home=fixture.sampleHomes[0];
 const plan=planRooms(home,fixture.members.map((m:any)=>normalizeProfile({...m,survey:{...m.survey,isReady:true}})));
 if(plan.status!=='feasible')throw new SetupError('Sample rent plan is not feasible.');
 const money=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(c/100);
 const body=`FairRoom · sample home\n${home.address}\n${home.neighborhood} · ${home.bedrooms} bedrooms\n\nProposed monthly shares, including estimated costs:\n${plan.assignments.map(a=>`${a.memberName}: ${money(a.totalCents)}`).join('\n')}\n\nFictional home and roommates for this demo. Room details are illustrative.`;
 const receiptPath='data/imessage-test-receipt.json';
 if(existsSync(receiptPath))throw new SetupError('A test was already attempted. Check data/imessage-test-receipt.json and Messages before sending another.');
 if(!process.argv.includes('--send')){console.log(`Recipient verified: •••${recipient.slice(-4)}\n${body}\n\nPreview only. Add --send to send this one message.`);return;}
 const idempotencyKey=randomUUID();
 writeFileSync(receiptPath,JSON.stringify({idempotencyKey,status:'attempting',at:new Date().toISOString()},null,2));
 const result=await api.projects.sendMessage({path:projectPath(),headers:{'idempotency-key':idempotencyKey},body:{...chosen,content:{type:'text',format:'plain',text:body}}});
 writeFileSync(receiptPath,JSON.stringify({idempotencyKey,status:result.status,messageId:result.id,at:new Date().toISOString()},null,2));
 console.log(`Message status: ${result.status}. Check Messages on your phone. Receipt saved locally.`);
}
main().catch(error=>{
 if(error instanceof SetupError) console.error(error.message);
 else if(error instanceof ApiError) console.error(`Messaging API returned HTTP ${error.status}. ${error.status===401?'Check that the API key belongs to this project.':error.status===403?'Check project:read and project:write permissions.':'Check your project connection in the dashboard.'}`);
 else console.error('Could not complete the test. Check your internet connection and local project files.');
 if(existsSync('data/imessage-test-receipt.json')) console.error('A send was previously attempted. Check the receipt and your phone before retrying.');
 process.exitCode=1;
});
