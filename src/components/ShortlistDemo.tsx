import React,{useState} from 'react';
import {ArrowUpRight,Bookmark,Check,ArrowRight,SlidersHorizontal,Home} from 'lucide-react';
import {homes,selectHomes,formatPreferences,type Preferences} from '../demo/shortlist';
import './shortlist.css';
const initial:Preferences={room:'own',bathroom:'shared',sqft:900,amenities:'Laundry, natural light',budget:1800};
export function ShortlistDemo(){
 const surveyMode=new URLSearchParams(location.search).get('survey')==='1';
 const [shareText,setShareText]=useState('');
 const [sharing,setSharing]=useState(false);
 const requested=new URLSearchParams(location.search).get('homes')?.split(',')||[];
 const linked=homes.filter(h=>requested.includes(h.slug)).sort((a,b)=>requested.indexOf(a.slug)-requested.indexOf(b.slug));
 const [people,setPeople]=useState<Preferences[]>([{...initial},{...initial}]);
 const [active,setActive]=useState(0);const [editing,setEditing]=useState(linked.length!==5);
 const [selected,setSelected]=useState(linked.length===5?linked:selectHomes(people));
 const [saved,setSaved]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('fairroom-demo-shortlist')||'[]').filter((s:unknown)=>typeof s==='string');}catch{return [];}});
 const [status,setStatus]=useState('');const p=people[active];
 const update=(patch:Partial<Preferences>)=>setPeople(people.map((person,i)=>i===active?{...person,...patch}:person));
 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(!surveyMode){setSelected(selectHomes(people));setEditing(false);setStatus('Your five places are ready. Ordered by recorded rent; other preferences need verification.');return;}
  const text=formatPreferences(p);setShareText(text);setSharing(true);
  try{
   if(navigator.share){await navigator.share({text});setStatus('Return to the group in Messages. FairRoom will acknowledge your answers once you send them.');}
   else {await navigator.clipboard.writeText(text);setStatus('Answers copied. Paste and send them in FairRoom Home Search in Messages.');}
  }catch(error){setStatus((error as Error).name==='AbortError'?'Sharing cancelled. Tap Send to group when you’re ready.':'Copy your answers below and send them in your FairRoom group.');}
  finally{setSharing(false);}
 }
 const bookmark=(slug:string)=>{const next=saved.includes(slug)?saved.filter(s=>s!==slug):[...saved,slug];setSaved(next);try{localStorage.setItem('fairroom-demo-shortlist',JSON.stringify(next));}catch{setStatus('Saved for this visit. Browser storage is unavailable.');}};
 return <div className="shortlist-page"><header className="shortlist-nav"><a href="/" className="shortlist-brand"><Home size={21}/>fairroom<span> / together</span></a><span className="shortlist-demo-tag">Interactive demo</span></header>
 <main className="shortlist-main"><section className="shortlist-intro"><p className="eyebrow">Cambridge, Massachusetts · The shortlist</p><h1>{surveyMode?<>Your kind<br/>of home.</>:<>A place for<br/>all of you.</>}</h1><p>{surveyMode?"Tell us what matters. Then send your wish list back to the group.":<>Less scrolling. More imagining your life together.<br/>Five places to start the conversation.</>}</p>{!surveyMode&&<div className="shortlist-actions"><button className="primary-button" onClick={()=>setEditing(!editing)}><SlidersHorizontal size={16}/>{editing?'Hide preferences':'Your preferences'}</button><span>{saved.length} saved on this device</span></div>}</section>
 {editing&&<form className="shortlist-form" onSubmit={submit}>
 <div className="shortlist-form-heading"><div><p className="eyebrow">Make room for everyone</p><h2>What feels like home?</h2></div>{!surveyMode&&<label>Roommates<select value={people.length} onChange={e=>{const n=Number(e.target.value);setPeople(Array.from({length:n},(_,i)=>people[i]||{...initial}));setActive(0);}}>{[2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>}</div>
 {!surveyMode&&<div className="shortlist-tabs">{people.map((_,i)=><button type="button" key={i} aria-pressed={active===i} onClick={()=>setActive(i)}>Roommate {i+1}</button>)}</div>}
 <div className="shortlist-fields"><label>Monthly budget per person<input required type="number" min="100" max="20000" value={p.budget} onChange={e=>update({budget:Number(e.target.value)})}/></label><label>Minimum home size · sq ft<input type="number" min="0" max="10000" value={p.sqft} onChange={e=>update({sqft:Number(e.target.value)})}/></label><label>Your bedroom<select value={p.room} onChange={e=>update({room:e.target.value as Preferences['room']})}><option value="own">My own room</option><option value="shared">Happy to share</option></select></label><label>Your bathroom<select value={p.bathroom} onChange={e=>update({bathroom:e.target.value as Preferences['bathroom']})}><option value="own">Private bathroom</option><option value="shared">Shared is fine</option></select></label><label className="shortlist-wide">The little things that matter<input maxLength={200} value={p.amenities} onChange={e=>update({amenities:e.target.value})} placeholder="Laundry, parking, a sunny kitchen…"/></label></div>
 <div className="shortlist-form-footer"><p>{surveyMode?"Your answers will be visible to everyone in the group. Choose Messages, select your FairRoom group, then send.":"Preferences stay in this browser session. The chat collects its own replies."}</p><button className="primary-button" disabled={sharing}>{sharing?"Opening share sheet…":surveyMode?"Send to group":"Show five places"} <ArrowRight size={16}/></button></div></form>}
 {surveyMode&&<section aria-live="polite"><p className="shortlist-status">{status}</p>{shareText&&<label className="shortlist-note">Your answers — copy if needed<textarea aria-label="Your answers" readOnly value={shareText} style={{display:'block',width:'100%',minHeight:120,padding:16,marginTop:12,border:'1px solid #ded5ca',borderRadius:12}}/></label>}</section>}
 {!surveyMode&&<><div className="shortlist-results-heading"><h2>Five places. One next chapter.</h2><span>Saved Zillow catalog · 3-bedroom options</span></div>
 <p className="shortlist-note">Recorded asking prices, not live availability. Room layouts, amenities, fees and budget fit need checking. These are building pages, not reserved units.</p><p className="shortlist-status" role="status">{status}</p>
 <div className="shortlist-cards">{selected.map((h,i)=><article className="shortlist-card" key={h.slug}><div className="shortlist-card-top"><span className="shortlist-rank">0{i+1}</span><span>Cambridge · MA</span><button className="shortlist-save" aria-label={`${saved.includes(h.slug)?'Unsave':'Save'} ${h.name}`} aria-pressed={saved.includes(h.slug)} onClick={()=>bookmark(h.slug)}>{saved.includes(h.slug)?<Check size={19}/>:<Bookmark size={19}/>}</button></div><h3>{h.name}</h3><p>{h.address}</p><div className="shortlist-price"><strong>${h.rent.toLocaleString()}</strong><span> / month, advertised from</span></div><a href={h.url} target="_blank" rel="noopener noreferrer">Explore photos & floor plans <ArrowUpRight size={18}/></a></article>)}</div>
 <footer className="shortlist-footer"><div><h2>Keep the conversation going.</h2><p>In your connected iMessage chat, text <strong>send new postings</strong> for another saved option.</p></div><span>FairRoom / A home, together.</span></footer></>}</main></div>;
}
