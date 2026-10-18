import crypto from 'node:crypto';
import type {Database} from 'sql.js';
import {projectPath,normalizeHandle,verifyPhotonGroup,type PhotonClient} from './photon';
import {saveDb,saveGroupConversation} from './db';

export function initEnrollment(db:Database){db.run('CREATE TABLE IF NOT EXISTS photon_enrollment (code TEXT PRIMARY KEY,group_id TEXT UNIQUE,space_id TEXT UNIQUE,expires INTEGER)');}
// Only explicit start/join requests enroll people. Private bearer invitations never enter a group chat.
export async function handleEnrollment(db:Database,api:PhotonClient,message:any):Promise<boolean>{
 const text=message.content.text.trim();const start=/^@?fairroom[, :]+start[.!]?$/i.test(text);const join=text.match(/^join\s+([a-f0-9]{12})(?:\s+(.{1,50}))?$/i);
 if(!start&&!join)return false;
 initEnrollment(db);
 const origin=(process.env.PUBLIC_APP_URL||'').replace(/\/$/,'');if(!origin.startsWith('https://'))return true;
 if(db.exec('SELECT id FROM photon_inbox WHERE id=?',[message.id])[0])return true;
 const space=await api.projects.getSpace({path:{...projectPath(),spaceId:message.space.id}});
 if(!space||space.platform!=='imessage')return true;
 const users=await Promise.all(space.participantIds.map(userId=>api.projects.getUser({path:{...projectPath(),userId}})));
 const valid=users.filter((u):u is NonNullable<typeof u>&{platform:'imessage';handle:string;kind:string;details:{type?:string}}=>!!u&&u.platform==='imessage'&&typeof u.handle==='string');
 const humans=valid.filter(u=>u.kind==='human');const agents=valid.filter(u=>u.kind==='agent');
 if(agents.length!==1||agents[0].details.type==='shared'||valid.length!==humans.length+1||!humans.some(u=>u.id===message.sentBy.id&&normalizeHandle(u.handle)===normalizeHandle(message.sentBy.handle)))return true;
 const now=new Date().toISOString();let reply='',groupId='';
 if(start){
  if(space.kind!=='group'||humans.length<2||humans.length>4)return true;
  // Do not silently take over a manually configured group.
  const binding=db.exec('SELECT group_id FROM group_conversations WHERE conversation_sid=?',[space.id])[0]?.values[0];
  let enrollment=db.exec('SELECT code,group_id FROM photon_enrollment WHERE space_id=?',[space.id])[0]?.values[0];
  if(binding&&!enrollment){reply='Your group is already connected. Open your FairRoom workspace to finish preferences.';groupId=String(binding[0]);}
  else {
   if(!enrollment){
    groupId='grp_'+crypto.randomUUID();const people=humans.map((u,i)=>({id:'mem_'+crypto.randomUUID(),handle:normalizeHandle(u.handle),name:`Roommate ${i+1}`,organizer:u.id===message.sentBy.id}));const organizer=people.find(p=>p.organizer)!;
    db.run('INSERT INTO groups VALUES (?,?,?,0,1,?)',[groupId,'Our next home',organizer.id,now]);
    for(const p of people)db.run('INSERT INTO members (id,group_id,invite_token,display_name,phone_number,is_organizer,created_at) VALUES (?,?,?,?,?,?,?)',[p.id,groupId,'inv_'+crypto.randomBytes(32).toString('hex'),p.name,p.handle,p.organizer?1:0,now]);
    const code=crypto.randomBytes(6).toString('hex');db.run('INSERT INTO photon_enrollment VALUES (?,?,?,?)',[code,groupId,space.id,Date.now()+86400000]);saveGroupConversation(db,groupId,space.id,agents[0].handle);enrollment=[code,groupId];
   }
   groupId=String(enrollment[1]);
   const roster=(db.exec('SELECT phone_number FROM members WHERE group_id=?',[groupId])[0]?.values||[]).map(r=>String(r[0]));await verifyPhotonGroup(space.id,roster,api);
   db.run('UPDATE photon_enrollment SET expires=? WHERE group_id=?',[Date.now()+86400000,groupId]);
   reply=`Hi, I’m FairRoom. I’ll find homes that work for everyone.\n\nEach roommate: message me privately “join ${enrollment[0]} Your name” for your own preference form. Your budget stays private.\n\nOnce everyone finishes and opts in, I’ll bring your best matches here.`;
  }
 }else if(join){
  if(space.kind==='group'||humans.length!==1)return true;
  const enrollment=db.exec('SELECT group_id,space_id FROM photon_enrollment WHERE code=? AND expires>?',[join[1].toLowerCase(),Date.now()])[0]?.values[0];if(!enrollment)return true;
  groupId=String(enrollment[0]);const rows=db.exec('SELECT id,phone_number,invite_token FROM members WHERE group_id=?',[groupId])[0]?.values||[];
  const member=rows.find(r=>normalizeHandle(String(r[1]))===normalizeHandle(message.sentBy.handle));if(!member)return true;
  await verifyPhotonGroup(String(enrollment[1]),rows.map(r=>String(r[1])),api);
  if(join[2])db.run('UPDATE members SET display_name=? WHERE id=?',[join[2].trim(),String(member[0])]);
  reply=`Here’s your private preference form: ${origin}/join/${member[2]}\n\nChoose your room, budget and must-haves. Only opt into group alerts if you want me to send finds to your group.`;
 }
 if(!reply)return true;
 db.run('INSERT INTO photon_inbox VALUES (?,?,?,?,?)',[message.id,groupId,reply,'prepared',now]);saveDb(db);
 try{const result=await api.projects.sendMessage({path:projectPath(),headers:{'idempotency-key':'fairroom-onboard:'+message.id},body:{spaceId:space.id,senderId:agents[0].id,parentMessageId:message.id,content:{type:'text',format:'plain',text:reply}}});db.run('UPDATE photon_inbox SET status=? WHERE id=?',[result.status,message.id]);}catch{db.run("UPDATE photon_inbox SET status='unconfirmed' WHERE id=?",[message.id]);}
 saveDb(db);return true;
}
