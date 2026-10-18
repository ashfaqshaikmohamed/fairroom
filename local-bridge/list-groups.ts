import {IMessageSDK} from '@photon-ai/imessage-kit';
// Reads only matching group titles and IDs; never message bodies or sends.
const name=process.argv[2]||'FairRoom Demo';
const sdk=new IMessageSDK();
try {
 const chats=(await sdk.listChats({kind:'group',service:'iMessage'})).filter(c=>c.name===name);
 if(!chats.length)console.log(`No iMessage group named “${name}” found. Create or rename the demo group in Messages first.`);
 else for(const chat of chats)console.log(JSON.stringify({name:chat.name,id:chat.chatId}));
 if(chats.length>1)console.log('Multiple groups have this name. Give the intended group a unique name before configuring.');
} catch {console.error('Cannot read Messages. Sign into Messages and grant your terminal Full Disk Access, then reopen it.');process.exitCode=1;}
finally {await sdk.close();}
