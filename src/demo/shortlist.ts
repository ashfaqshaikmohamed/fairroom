// Recorded Zillow catalog for the walkthrough; not a live feed or verified unit inventory.
// Source: https://www.zillow.com/cambridge-ma/apartments/ and linked building pages.
// Checked 2026-10-17. Prices are advertised 3-bedroom starting prices from that snapshot.
export const homes = [
  ['church-corner','Church Corner','10 Magazine St','5Xj7Vg',4515],
  ['hanover-alewife','Hanover Alewife','130 Cambridgepark Dr','CkBhFQ',5470],
  ['luxe-at-alewife','Luxe at Alewife','80 Cambridgepark Dr','CjhRT8',5631],
  ['parkside-place','Parkside Place','700 Huron Ave','5Xj9hH',4325],
  ['the-cantabrigia','The Cantabrigia','1010 Massachusetts Ave','CgJ6Mb',5105],
  ['park-151','Park 151','151 N 1st St','CkCMDn',7481],
  ['flats-on-first','Flats on First','21 Charles St','CjbLNq',6399],
  ['kbl','KBL','129 Franklin St','5Xj7W2',5350],
  ['park87-apartments','Park87 Apartments','87 New St','5XjGR4',5100],
  ['park77-apartments','Park77 Apartments','77 New St','Ctr6Nv',5250],
].map(([slug,name,address,id,rent])=>({slug:String(slug),name:String(name),address:String(address),rent:Number(rent),url:`https://www.zillow.com/apartments/cambridge-ma/${slug}/${id}/`}));
export type Preferences={room:'own'|'shared';bathroom:'own'|'shared';sqft:number;amenities:string;budget:number};
export function parsePreferences(text:string):Preferences|null {
 const match=text.match(/^fairroom preferences:\s*(.*)$/is);if(!match)return null;
 const fields=Object.fromEntries(match[1].split(';').map(s=>s.split('=').map(v=>v.trim())));
 const {room,bathroom}=fields;const sqft=Number(fields.sqft),budget=Number(fields.budget);
 if(!['own','shared'].includes(room)||!['own','shared'].includes(bathroom)||!Number.isFinite(sqft)||sqft<0||sqft>10000||!Number.isFinite(budget)||budget<100||budget>20000||!fields.amenities||fields.amenities.length>200)return null;
 return {room:room as Preferences['room'],bathroom:bathroom as Preferences['bathroom'],sqft,budget,amenities:fields.amenities};
}
export function formatPreferences(p:Preferences){
 const amenities=p.amenities.replace(/[;=\r\n]/g,',').trim()||'none';
 return `FairRoom preferences: room=${p.room}; bathroom=${p.bathroom}; sqft=${p.sqft}; amenities=${amenities}; budget=${p.budget}`;
}
export const preferenceExample='FairRoom preferences: room=own; bathroom=shared; sqft=900; amenities=laundry, parking; budget=1800';
export function selectHomes(preferences:Preferences[]){
 const total=preferences.reduce((s,p)=>s+p.budget,0);
 // Only advertised price is known. Other preferences are captured, not asserted as satisfied.
 return [...homes].sort((a,b)=>Math.max(0,a.rent-total)-Math.max(0,b.rent-total)||a.rent-b.rent).slice(0,5);
}
export function suggestion(index:number){const h=homes[((index%homes.length)+homes.length)%homes.length];return [
 index%homes.length===0?'Hey everyone, I’m FairRoom, your home-search assistant. Let’s find somewhere you’ll love coming home to.':'Here’s another place for your shortlist.',
 `${h.name}\n${h.address}, Cambridge`,
 'Take a look at the photos and floor plans. This is from our saved Cambridge shortlist; check Zillow for current prices and available units.',
 h.url,'Want another option? Text “send new postings”.'
].join('\n\n');}
export type DemoEvent={id:string;chatId:string|null;text:string|null;createdAt:Date;sender:string};
export function createDemoConversation(chatId:string,roommates:number,baseUrl:string,started=Date.now()){
 const people=new Map<string,Preferences>();const seen=new Set<string>();let cursor=0;let active=false;
 return (event:DemoEvent):string|null=>{
  if(event.chatId!==chatId||!Number.isFinite(event.createdAt.getTime())||event.createdAt.getTime()<started||seen.has(event.id))return null;
  const text=(event.text||'').trim();
  if(!/^(?:fairroom start[.!]?|(?:fairroom[,: ]+)?(?:send new postings|send new listings|next listing)[.!]?|fairroom preferences:.*)$/is.test(text))return null;
  seen.add(event.id);
  if(/^fairroom start[.!]?$/i.test(text)){
   active=true;people.clear();return `Hey everyone, I’m FairRoom, your home-search assistant. Let’s find your next place together.\n\n${roommates===1?"For this demo, just one person needs to submit.":`Each of the ${roommates} roommates should submit.`} Open this short form, then tap “Send to group” and choose this conversation in Messages.\n\n${baseUrl}/shortlist?survey=1\n\nOnce everyone sends their answers, I’ll prepare five places from our saved Cambridge shortlist. Your answers will be visible to the group.`;
  }
  if(/^(?:fairroom[,: ]+)?(?:send new postings|send new listings|next listing)[.!]?$/i.test(text))return suggestion(cursor++);
  if(!active)return 'Text “FairRoom start” first so we can collect everyone’s preferences.';
  const prefs=parsePreferences(text);if(!prefs)return `I couldn’t read that preference line. Use own/shared for room and bathroom, numbers for sqft and budget, and separate fields with semicolons.\n\n${preferenceExample}`;
  if(!people.has(event.sender)&&people.size>=roommates)return 'Everyone’s preferences are already in. Text “FairRoom start” to begin again.';
  people.set(event.sender,prefs);
  if(people.size<roommates)return `Got it — ${people.size} of ${roommates} wish lists received. Waiting for the others.`;
  const selected=selectHomes([...people.values()]);
  return ['Everyone’s in. Here are five Cambridge places to explore together.',
   'Ordered by advertised rent in our saved shortlist. Room layouts, amenities and availability still need checking.',
   ...selected.map((h,i)=>`${i+1}. ${h.name} · ${h.address}\n${h.url}`),
   `View your five places: ${baseUrl}/shortlist?homes=${selected.map(h=>h.slug).join(',')}`,
   'For another saved option, text “send new postings”.'].join('\n\n');
 };
}
