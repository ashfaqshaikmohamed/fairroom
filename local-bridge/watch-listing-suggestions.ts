import {IMessageSDK,type Message} from '@photon-ai/imessage-kit';
import {createDemoConversation,suggestion} from '../src/demo/shortlist';
// Standalone opt-in local transport. Does not load .env, app data, or sponsor credentials.
const args=process.argv.slice(2);
if(args.includes('--preview')){console.log(suggestion(0));process.exit(0);}
const name=args[0];const option=(key:string,fallback:string)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const count=Number(option('--roommates','2'));
const base=new URL(option('--site','http://localhost:3000'));
if(!name||name.startsWith('--')||!Number.isInteger(count)||count<1||count>4||base.username||base.password||(!['http:','https:'].includes(base.protocol)))throw Error('Usage: node --import tsx local-bridge/watch-listing-suggestions.ts "FairRoom Home Search" --roommates 2 --site https://your-public-site.example');
const sdk=new IMessageSDK();let queue=Promise.resolve();let failed=false;
try{
 const groups=(await sdk.listChats({kind:'group',service:'iMessage'})).filter(c=>c.name?.trim()===name);
 if(groups.length!==1)throw Error('Expected exactly one iMessage group with that name. Name it in Messages, send an ordinary message, then retry.');
 const respond=createDemoConversation(groups[0].chatId,count,base.origin);
 const handle=(m:Message)=>{
  if(failed||m.kind!=='text'||m.isSystem||m.isAutoReply)return;
  // Process local-user commands too; generated replies never match the command grammar.
  queue=queue.then(async()=>{
   if(failed)return;
   const reply=respond({id:m.id,chatId:m.chatId,text:m.text,createdAt:m.createdAt,sender:m.isFromMe?'local-owner':m.participant||''});
   if(!reply||(!m.isFromMe&&!m.participant))return;
   if(reply.startsWith('Everyone’s in.')){
    await sdk.send({to:groups[0].chatId,text:'Everyone’s preferences are in. Preparing your shortlist from our saved Cambridge listings…'});
    await new Promise(resolve=>setTimeout(resolve,1500));
    if(failed)return;
   }
   await sdk.send({to:groups[0].chatId,text:reply});
   console.log('FairRoom reply dispatched. Check recipient Messages for delivery.');
  }).catch(()=>{failed=true;console.error('Delivery is unconfirmed. Listener paused. Check Messages before restarting; do not retry blindly.');});
 };
 await sdk.startWatching({onIncomingMessage:handle,onFromMeMessage:handle,onError:()=>{failed=true;console.error('Messages watcher failed. Restart after checking permissions.');}});
 console.log(`Listening in “${name}” for new commands. Text “FairRoom start” or “send new postings”.\nUses this Mac’s Messages identity. Saved-listing demo; no live search or hosted Photon transport. Ctrl+C stops it. Run only one listener.`);
 const stop=async()=>{failed=true;await sdk.stopWatching();await queue;await sdk.close();process.exit(0);};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
}catch(error){await sdk.close();console.error(error instanceof Error?error.message:'Could not start listener.');process.exitCode=1;}
