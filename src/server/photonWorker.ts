import {handleEnrollment} from './photonEnrollment';
import type {Database} from 'sql.js';
import {photonEnabled,photonClient,projectPath,normalizeHandle,verifyPhotonGroup,sendPhotonMessage,type PhotonClient} from './photon';
import {agentMembers,answerAgent,initAgent} from './agent';
import {addChatMessage,saveDb,getScoutState} from './db';
export const photonHealth:{lastPoll:string|null;error:string|null}={lastPoll:null,error:null};
export function startPhotonWorker(db:Database,client?:PhotonClient,startImmediately=true){
 initAgent(db);let busy=false;let lastReceiptCheck=0;
 const tick=async()=>{if(busy||!photonEnabled())return;busy=true;
 try{
  const api=client||photonClient();const since=String(db.exec("SELECT value FROM photon_cursor WHERE id='received'")[0]?.values[0]?.[0]||new Date(Date.now()-60000).toISOString());const checkpoint=new Date(Date.now()-5000).toISOString();let pageToken:string|undefined;
  do{
   const page=await api.projects.listMessages({path:projectPath(),query:{direction:'received',platform:'imessage',createdSince:since,order:'asc',pageSize:100,...(pageToken?{pageToken}:{})}});
   for(const m of page.items){
    if(m.platform!=='imessage'||m.status!=='received'||m.space.platform!=='imessage'||m.sentBy.platform!=='imessage'||m.receivedBy?.platform!=='imessage'||m.sentBy.kind!=='human'||m.receivedBy?.kind!=='agent'||m.content.type!=='text'||m.content.format!=='plain')continue;
    if(await handleEnrollment(db,api,m))continue;
    const row=db.exec('SELECT group_id,created_at FROM group_conversations WHERE conversation_sid=?',[m.space.id])[0]?.values[0];if(!row||Date.parse(m.createdAt)<Date.parse(String(row[1])))continue;
    const groupId=String(row[0]);if(groupId==='group-elm-trio'&&!getScoutState(db,groupId).isDemoDeliveryArmed)continue;
    const senderHandle=m.sentBy.handle;const members=agentMembers(db,groupId);const member=members.find(x=>x.phoneNumber&&normalizeHandle(x.phoneNumber)===normalizeHandle(senderHandle));
    if(!member||!member.survey?.phoneAlertsOptIn)continue;
    const recipients=members.filter(x=>x.phoneNumber&&x.survey?.phoneAlertsOptIn).map(x=>x.phoneNumber!);
    await verifyPhotonGroup(m.space.id,recipients,api);
    const old=db.exec('SELECT status FROM photon_inbox WHERE id=?',[m.id])[0]?.values[0];if(old)continue;
    db.run('INSERT INTO photon_inbox VALUES (?,?,?,?,?)',[m.id,groupId,null,'processing',new Date().toISOString()]);saveDb(db);
    addChatMessage(db,{id:'photon_'+m.id,groupId,senderType:'member',senderName:member.displayName,senderMemberId:member.id,text:m.content.text,transport:'photon',deliveryStatus:'delivered',providerMessageId:m.id,createdAt:m.createdAt});
    // Address FairRoom explicitly, or use a supported short command. Ignore unrelated conversation.
    if(!/^@?fairroom\b|^(?:find|search|split|like|pass|interested|pause|resume|stop|help|status|confirm|accept)\b|^I (?:need|require|want|don't|do not)\b/i.test(m.content.text)){db.run("UPDATE photon_inbox SET status='ignored' WHERE id=?",[m.id]);saveDb(db);continue;}
    let reply:string;try{reply=await answerAgent(db,groupId,member.id,m.content.text);}catch{reply='I couldn’t finish that request. Please try again.';}
    db.run("UPDATE photon_inbox SET reply=?,status='prepared' WHERE id=?",[reply,m.id]);saveDb(db);
    // STOP never sends to the group after removing its sender's consent.
    if(/^stop$/i.test(m.content.text.trim().replace(/^@?fairroom[, :]+/i,''))){db.run("UPDATE photon_inbox SET status='stopped' WHERE id=?",[m.id]);saveDb(db);continue;}
    const sent=await sendPhotonMessage({spaceId:m.space.id,recipients,body:reply,idempotencyKey:'fairroom-reply:'+m.id,parentMessageId:m.id},api);
    db.run('UPDATE photon_inbox SET status=? WHERE id=?',[sent.deliveryStatus,m.id]);saveDb(db);
    addChatMessage(db,{id:'photon_reply_'+m.id,groupId,senderType:'scout',senderName:'FairRoom',text:reply,transport:'photon',deliveryStatus:sent.deliveryStatus,providerMessageId:sent.providerMessageId,createdAt:new Date().toISOString()});
   }
   pageToken=page.nextPageToken;
  }while(pageToken);
  if(Date.now()-lastReceiptCheck>30000){
    lastReceiptCheck=Date.now();
    const pending=db.exec("SELECT provider_message_id FROM chat_messages WHERE transport='photon' AND delivery_status='provider_accepted' UNION SELECT provider_id FROM outbound_queue WHERE transport='photon_imessage' AND status='provider_accepted' LIMIT 10")[0]?.values||[];
    for(const row of pending){
      if(!row[0])continue;
      const receipt=await api.projects.getMessage({path:{...projectPath(),messageId:String(row[0])}});
      if(receipt&&(receipt.status==='delivered'||receipt.status==='failed')){
        db.run('UPDATE chat_messages SET delivery_status=? WHERE provider_message_id=?',[receipt.status,String(row[0])]);
        db.run('UPDATE outbound_queue SET status=? WHERE provider_id=?',[receipt.status,String(row[0])]);
        db.run('UPDATE recommendation_events SET delivery_status=? WHERE provider_message_id=?',[receipt.status,String(row[0])]);
      }
    }
  }
  db.run("INSERT OR REPLACE INTO photon_cursor VALUES ('received',?)",[checkpoint]);saveDb(db);photonHealth.lastPoll=new Date().toISOString();photonHealth.error=null;
 }catch{photonHealth.error='Photon connection unavailable. Check your project, key and line.';}finally{busy=false;}};
 if(startImmediately)void tick();const timer=setInterval(tick,4000);timer.unref();return Object.assign(()=>clearInterval(timer),{poll:tick});
}
