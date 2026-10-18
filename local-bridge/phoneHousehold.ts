import crypto from 'node:crypto';
import fs from 'node:fs';
import type {Database} from 'sql.js';
import {saveDb} from '../src/server/db';
import {normalizeHandle} from '../src/server/photon';
export function preparePhoneHousehold(db:Database){
 const own=normalizeHandle(process.env.FAIRROOM_TEST_RECIPIENT||'');
 const brother=normalizeHandle(process.env.FAIRROOM_GROUP_TEST_MEMBER||'');
 if(!own||!brother||own===brother)throw Error('Two distinct configured phone participants are required.');
 const sister=normalizeHandle(process.env.FAIRROOM_SISTER_PHONE||'');
 if(sister&&[own,brother].includes(sister))throw Error('Sister must have a distinct phone number.');
 const groupId=sister?'group-phone-three':'group-phone-roommates';const now=new Date().toISOString();
 if(!db.exec('SELECT id FROM groups WHERE id=?',[groupId])[0]){
  db.run('INSERT INTO groups VALUES (?,?,?,0,1,?)',[groupId,'Our next home',sister?'phone-owner-3':'phone-owner',now]);
  for(const [id,name,phone,organizer] of [['phone-owner'+(sister?'-3':''),'Ashfaq',own,1],['phone-brother'+(sister?'-3':''),'Brother',brother,0],...(sister?[['phone-sister-3','Sister',sister,0]]:[])])
   db.run('INSERT INTO members (id,group_id,invite_token,display_name,phone_number,is_organizer,created_at) VALUES (?,?,?,?,?,?,?)',[id,groupId,'inv_'+crypto.randomBytes(32).toString('hex'),name,phone,organizer,now]);
  saveDb(db);
 }
 const rows=db.exec('SELECT id,phone_number,invite_token FROM members WHERE group_id=?',[groupId])[0].values;
 if(rows.length!==(sister?3:2)||!rows.every(r=>[own,brother,sister].includes(normalizeHandle(String(r[1])))))throw Error('Phone household participants changed. Review the household before reconnecting.');
 const origin=(process.env.PUBLIC_APP_URL||'').replace(/\/$/,'');
 const links=Object.fromEntries(rows.map(r=>[String(r[0]),`${origin}/join/${r[2]}`]));
 const ownerId=sister?'phone-owner-3':'phone-owner';
 const brotherId=sister?'phone-brother-3':'phone-brother';
 fs.writeFileSync('data/phone-survey-links.txt',`PRIVATE — open only your own link on your phone. Do not record these invitation tokens.\n\nAshfaq: ${links[ownerId]}\n\nBrother: ${links[brotherId]}\n${sister?'\nSister: '+links['phone-sister-3']+'\n':''}`,{mode:0o600});
 const mapping:Record<string,string>={[own]:ownerId,[brother]:brotherId};
 const email=process.env.FAIRROOM_BROTHER_IMESSAGE_EMAIL?.trim().toLowerCase();
 if(email)mapping[normalizeHandle(email)]=brotherId;
 if(sister)mapping[sister]='phone-sister-3';
 return {groupId,own,ownerId,links,mapping};
}
