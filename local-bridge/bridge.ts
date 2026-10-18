import {preparePhoneHousehold} from './phoneHousehold';
import {Spectrum} from '@spectrum-ts/core';
import {localIMessage} from '@spectrum-ts/imessage-local';
import type {Database} from 'sql.js';
import {answerAgent,agentMembers,initAgent} from '../src/server/agent';
import {saveDb} from '../src/server/db';
import {normalizeHandle} from '../src/server/photon';

// Optional Mac-only transport. Never initialized unless explicitly enabled.
export async function startLocalBridge(db:Database){
 if(process.platform!=='darwin')throw Error('Local iMessage requires macOS.');
 const chatId=process.env.FAIRROOM_LOCAL_CHAT_ID;
 const phone=process.env.FAIRROOM_LOCAL_REAL_HOUSEHOLD==='true'?preparePhoneHousehold(db):null;
 const groupId=phone?.groupId||process.env.FAIRROOM_LOCAL_GROUP_ID||'group-elm-trio';
 if(!chatId||!/^iMessage;[+-];.+$/.test(chatId))throw Error('Set FAIRROOM_LOCAL_CHAT_ID to the selected existing iMessage conversation.');
 // The local SDK has no membership-change stream. Keep this recording-only,
 // with fictional preferences; live private groups still use roster-verified Beta.
 if(!phone&&groupId!=='group-elm-trio')throw Error('Local bridge currently supports only the explicitly labeled sample group.');
 const mapping=phone?.mapping||JSON.parse(process.env.FAIRROOM_LOCAL_MEMBER_MAP||'{}') as Record<string,string>;
 const members=agentMembers(db,groupId);
 if(!Object.keys(mapping).length||Object.values(mapping).some(id=>!members.some(m=>m.id===id)))throw Error('Map each test sender to a valid sample member in FAIRROOM_LOCAL_MEMBER_MAP.');
 const allowed=new Map(Object.entries(mapping).map(([handle,id])=>[normalizeHandle(handle),id]));
 initAgent(db);db.run('CREATE TABLE IF NOT EXISTS local_imessage_inbox (id TEXT PRIMARY KEY,status TEXT,created_at TEXT)');saveDb(db);
 let activeSpace:any;let pushing=false;
 db.run('CREATE TABLE IF NOT EXISTS local_phone_roundups (group_id TEXT, revision INTEGER, status TEXT, PRIMARY KEY(group_id,revision))');
 const started=Date.now();
 const app=await Spectrum({providers:[localIMessage.config()],telemetry:false});
 console.log('Local iMessage demo bridge enabled for one selected conversation. Replies use this Mac’s Messages identity.');
 if(phone)setInterval(async()=>{
  if(!activeSpace||pushing)return;
  const people=agentMembers(db,groupId);
  if(people.length<2||people.length>4||!people.every(p=>p.survey?.isReady&&p.survey.phoneAlertsOptIn))return;
  const revision=Number(db.exec('SELECT preference_revision FROM groups WHERE id=?',[groupId])[0].values[0][0]);
  if(db.exec('SELECT status FROM local_phone_roundups WHERE group_id=? AND revision=?',[groupId,revision])[0])return;
  pushing=true;db.run('INSERT INTO local_phone_roundups VALUES (?,?,?)',[groupId,revision,'sending']);saveDb(db);
  try{await activeSpace.send('FairRoom · '+await answerAgent(db,groupId,phone.ownerId,'find one home'));db.run('UPDATE local_phone_roundups SET status=? WHERE group_id=? AND revision=?',['submitted',groupId,revision]);}
  catch{db.run('UPDATE local_phone_roundups SET status=? WHERE group_id=? AND revision=?',['unconfirmed',groupId,revision]);console.error('Phone recommendation unconfirmed; check Messages before retrying.');}
  finally{saveDb(db);pushing=false;}
 },4000).unref();
 void (async()=>{for await(const [space,message] of app.messages){
  if(message.platform!=='local_imessage'||space.id!==chatId||(!phone&&message.direction==='outbound')||message.content.type!=='text'||new Date(message.timestamp).getTime()<started)continue;
  const memberId=phone&&message.direction==='outbound'?phone.ownerId:allowed.get(normalizeHandle(message.sender?.id||''));if(!memberId)continue;
  const text=message.content.text.trim();if(!/^@?fairroom[, :]+(?:start|find|search|split|like|pass|saved|check|verify|confirm|accept|pause|resume|stop|I)\b/i.test(text))continue;
  activeSpace=space;
  if(db.exec('SELECT id FROM local_imessage_inbox WHERE id=?',[message.id])[0])continue;
  db.run('INSERT INTO local_imessage_inbox VALUES (?,?,?)',[message.id,'processing',new Date().toISOString()]);saveDb(db);
  try{
   const reply=/^@?fairroom[, :]+start[.!]?$/i.test(text)?phone?chatId.startsWith('iMessage;+;')?'Let’s find your next home. Each roommate should open their own private invitation from the organizer and enable phone alerts. Once everyone finishes, I’ll send a listing here.':`Let’s find your next home. Fill out your private preferences, then enable phone alerts. Once everyone’s survey is ready, I’ll send a real listing here.\n\n${phone.links[memberId]}`:'FairRoom is connected to this demo conversation. Homes and roommate profiles are sample data. Say “FairRoom find homes”, “FairRoom split C1”, or “FairRoom like C1”.':await answerAgent(db,groupId,memberId,text);
   await space.send('FairRoom · '+reply);
   db.run('UPDATE local_imessage_inbox SET status=? WHERE id=?',['submitted',message.id]);
  }catch{db.run('UPDATE local_imessage_inbox SET status=? WHERE id=?',['unconfirmed',message.id]);console.error('Local reply failed or is unconfirmed. Check Messages before retrying.');}
  saveDb(db);
 }} )().catch((error)=>{const detail=String(error?.message||error).replace(/(?:\+?\d[\d ()-]{7,}\d)/g,'[redacted number]');console.error('Local Messages connection stopped:',detail);});
}
