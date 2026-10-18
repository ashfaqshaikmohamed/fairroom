import 'dotenv/config';
import fs from 'node:fs';
import {IMessageSDK} from '@photon-ai/imessage-kit';
const recipient=process.env.FAIRROOM_GROUP_TEST_MEMBER?.trim();
if(!recipient||!/^\+[1-9]\d{7,14}$/.test(recipient))throw Error('Set the consenting test recipient in FAIRROOM_GROUP_TEST_MEMBER first.');
const sdk=new IMessageSDK();
try {
 const normalize=(s:string)=>s.replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');
 const chats=(await sdk.listChats({kind:'dm',service:'iMessage'})).filter(c=>normalize(c.chatId.split(';').at(-1)||'')===normalize(recipient));
 if(chats.length!==1)throw Error('No unique existing iMessage conversation found for the configured test recipient. Send your brother an iMessage first.');
 const updates:Record<string,string>={FAIRROOM_LOCAL_IMESSAGE_ENABLED:'true',FAIRROOM_LOCAL_CHAT_ID:chats[0].chatId,FAIRROOM_LOCAL_GROUP_ID:'group-elm-trio',FAIRROOM_LOCAL_MEMBER_MAP:JSON.stringify({[recipient]:'member-sam',[chats[0].chatId.split(';').at(-1)!]:'member-sam'})};
 let env=fs.readFileSync('.env','utf8');
 for(const [key,value] of Object.entries(updates)){
  const line=`${key}=${value}`;const pattern=new RegExp(`^${key}=.*$`,'m');
  env=pattern.test(env)?env.replace(pattern,()=>line):env.trimEnd()+'\n'+line+'\n';
 }
 fs.writeFileSync('.env',env,{mode:0o600});
 console.log('Configured the existing iMessage conversation with your test recipient. No message sent. Restart FairRoom, then have your brother send “FairRoom start”.');
} finally {await sdk.close();}
