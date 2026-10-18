import {suggestion} from '../src/demo/shortlist';
import {IMessageSDK} from '@photon-ai/imessage-kit';

// Explicit one-off transport demo. No dotenv, app database, survey or model access.
// The local SDK needs macOS Messages access to find the exact named conversation.
const name=process.argv[2]?.trim();
const send=process.argv.includes('--send');
if(!name||name.startsWith('--'))throw Error('Provide the exact group name in quotes. Add --send only after checking its participants in Messages.');
const args=process.argv.slice(3);
const urlIndex=args.indexOf('--url');
const random=args.includes('--random');
const preview=args.includes('--preview');
let text=suggestion(0);
let sdk:IMessageSDK|undefined;
let dispatched=false;
try{
 if(urlIndex>=0&&random)throw Error('Choose --url or --random, not both.');
 if(preview&&send)throw Error('Choose --preview or --send, not both.');
 const validUrl=(value:string)=>{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Use a public HTTPS listing URL.');
  if(!['zillow.com','www.zillow.com','apartmentrentalexperts.com','www.apartmentrentalexperts.com'].includes(url.hostname))throw Error('Use a Zillow or Apartment Rental Experts listing link.');
  return url.href;
 };
 if(urlIndex>=0){
  const url=validUrl(args[urlIndex+1]||'');
  text=['Hey everyone, I’m FairRoom, your home-search assistant. Here’s a place to explore together.','Take a look at the photos and floor plans, and tell each other what you think. Check the listing for current prices and availability.',url].join('\n\n');
 }else if(random){
  // Use the public app API, never private configuration or database files.
  const response=await fetch('http://127.0.0.1:3000/api/public/catalog',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Could not load the catalog. Start FairRoom on port 3000.');
  const data=await response.json();
  const homes=(data.listings||[]).filter((l:any)=>typeof l.id==='string'&&!l.id.startsWith('demo-')&&l.bedrooms>=3&&l.city==='Cambridge'&&Number.isFinite(l.baseRentCents)&&l.baseRentCents>0&&typeof l.canonicalUrl==='string');
  if(!homes.length)throw Error('No saved Cambridge listings with at least three bedrooms were found.');
  const home=homes[Math.floor(Math.random()*homes.length)];
  const url=validUrl(home.canonicalUrl);
  text=['FairRoom · A home to consider',`${home.address} · ${home.bedrooms} bedrooms · ${home.bathrooms} bathrooms`,
   `Saved price: $${(home.baseRentCents/100).toLocaleString('en-US')}/month base rent. Confirm fees and availability with the broker.`,
   'From the saved catalog; not matched to your surveys.',url].join('\n\n');
 }
 if(preview){console.log(text+'\n\nPreview only. No message sent.');}
 else {
 sdk=new IMessageSDK();
 const groups=(await sdk.listChats({kind:'group',service:'iMessage'})).filter(c=>c.name?.trim()===name);
 if(groups.length!==1)throw Error(`Expected one iMessage group named “${name}”; found ${groups.length}. Confirm its name on this Mac and send an ordinary message first.`);
 if(!send){console.log(`Found “${name}”. Check it contains only the intended participants. Run the same command with --send to dispatch this suggestion:\n\n${text}`);}
 else{
  dispatched=true;
  await sdk.send({to:groups[0].chatId,text});
  console.log('Suggestion dispatched from this Mac’s Messages identity. Check your brother’s or sister’s phone for receipt. This does not verify survey matching or a separate agent number.');
 }
}
}catch(error){
 if(dispatched)console.error('Send failed or is unconfirmed. Check Messages before running again to avoid a duplicate.');
 else console.error((error as {code?:string}).code==='DATABASE'?'Messages access unavailable. Enable Full Disk Access for your terminal, reopen it and retry.':error instanceof Error?error.message:'Could not find the group.');
 process.exitCode=1;
}finally{await sdk?.close();}
