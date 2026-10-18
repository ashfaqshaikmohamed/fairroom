import 'dotenv/config';
import fs from 'node:fs';
import {IMessageSDK} from '@photon-ai/imessage-kit';
const name=process.argv[2]||'FairRoom Home Search';
if(!/^\+[1-9]\d{7,14}$/.test(process.env.FAIRROOM_SISTER_PHONE||''))throw Error('First set FAIRROOM_SISTER_PHONE in .env with country code.');
let sdk:IMessageSDK|undefined;
try{
 sdk=new IMessageSDK();
 const chats=(await sdk.listChats({kind:'group',service:'iMessage'})).filter(c=>c.name===name);
 if(chats.length!==1)throw Error('Create exactly one iMessage group with you, your brother and sister named '+name+', send a message, and retry.');
 let env=fs.readFileSync('.env','utf8');
 for(const [key,value] of Object.entries({FAIRROOM_LOCAL_CHAT_ID:chats[0].chatId,FAIRROOM_LOCAL_REAL_HOUSEHOLD:'true',FAIRROOM_LOCAL_IMESSAGE_ENABLED:'true'})){
  const re=new RegExp('^'+key+'=.*$','m');env=re.test(env)?env.replace(re,()=>key+'='+value):env+'\n'+key+'='+value+'\n';
 }
 fs.writeFileSync('.env',env,{mode:0o600});
 console.log('Selected the named iMessage group. No message sent. Restart FairRoom; send each roommate their own invitation from data/phone-survey-links.txt privately.');
}catch(error){
 const code=(error as {code?:string}).code;
 console.error(code==='DATABASE'?'Messages access is unavailable in this terminal. Enable Full Disk Access for Terminal (or Visual Studio Code if using its terminal), quit and reopen that app, then retry. Keep Messages signed in on this Mac.':error instanceof Error?error.message:'Could not configure the group.');
 process.exitCode=1;
}finally{await sdk?.close();}

