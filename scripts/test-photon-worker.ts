import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'fairroom-photon-'));
process.env.FAIRROOM_DATA_DIR=dir;process.env.PHOTON_API_KEY='test';process.env.PHOTON_PROJECT_ID='pho_prj_test';process.env.PHOTON_ENABLED='true';process.env.OPENAI_API_KEY='';process.env.DEMO_MODE='false';
const {getDb,saveDb,saveGroupConversation,updateScoutState,getChatMessages}=await import('../src/server/db');
const {startPhotonWorker,photonHealth}=await import('../src/server/photonWorker');
const db=await getDb();
const rows=db.exec('SELECT id,survey_json FROM members WHERE group_id=?',['group-elm-trio'])[0].values;
const handles:Record<string,string>={'member-maya':'+15555550101','member-leo':'+15555550102','member-sam':'+15555550103'};
for(const r of rows){const survey=JSON.parse(String(r[1]));survey.isReady=true;survey.phoneAlertsOptIn=true;db.run('UPDATE members SET phone_number=?,survey_json=? WHERE id=?',[handles[String(r[0])],JSON.stringify(survey),String(r[0])]);}
saveGroupConversation(db,'group-elm-trio','pho_space_test','+15555550100');updateScoutState(db,'group-elm-trio',true,null,[],{isDemoDeliveryArmed:true});saveDb(db);
const message={id:'pho_message_in',platform:'imessage',status:'received',createdAt:new Date(Date.now()+1000).toISOString(),sentBy:{id:'member-maya',kind:'human',handle:handles['member-maya'],platform:'imessage'},receivedBy:{id:'agent',kind:'agent',handle:'+15555550100',platform:'imessage'},space:{id:'pho_space_test',platform:'imessage',kind:'group'},content:{type:'text',format:'plain',text:'split C1'}};
let sends=0;const client={projects:{listMessages:async()=>({items:[message]}),getSpace:async()=>({id:'pho_space_test',platform:'imessage',kind:'group',participantIds:['agent',...Object.keys(handles)]}),getUser:async({path}:any)=>({id:path.userId,kind:path.userId==='agent'?'agent':'human',handle:handles[path.userId]||'+15555550100',platform:'imessage',details:{type:'dedicated'}}),sendMessage:async()=>{sends++;return{id:'pho_message_out',status:'accepted'};},getMessage:async()=>({id:'pho_message_out',status:'delivered'})}};
const stop=startPhotonWorker(db,client as any,false);
try{
 await stop.poll();assert.equal(photonHealth.error,null);assert.equal(sends,1);
 const messages=getChatMessages(db,'group-elm-trio');assert.ok(messages.some(m=>m.providerMessageId==='pho_message_out'&&m.deliveryStatus==='delivered'&&m.text.includes('$1,520')));
 await stop.poll();assert.equal(sends,1,'replayed inbound must not duplicate reply');
 message.id='pho_unknown';message.sentBy.handle='+15555550199';await stop.poll();assert.equal(sends,1,'unenrolled sender must not invoke agent');
 console.log('Photon worker passed: inbound identity, actual rent tool, outgoing reply, delivery receipt and duplicate suppression.');
}finally{stop();db.close();rmSync(dir,{recursive:true,force:true});}
