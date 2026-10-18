import React, {useState} from 'react';
import {Check, ArrowUpRight} from 'lucide-react';

const homes = [
  {name:'Cambridge Courtyard',place:'Inman Square',total:'3,840',photo:'courtyard',shares:['1,520','1,280','1,040']},
  {name:'The Bay Window',place:'Inman Square',total:'3,720',photo:'courtyard',shares:['1,472','1,240','1,008']},
];
export function ProductPreview({onExplore}:{onExplore:()=>void}) {
  const [index,setIndex]=useState(0);
  const home=homes[index];
  return <section className="product-preview" aria-label="Interactive sample of FairRoom">
    <div className="preview-toolbar"><span className="preview-brand">fairroom<span>.</span></span><span>Your group’s shortlist</span><small>Sample preview</small></div>
    <div className="preview-body"><div className="preview-people"><p>three people. one good fit.</p><div className="preview-person"><span className="avatar">M</span><div><strong>Maya</strong><span>A little more room.</span></div><Check size={16}/></div><div className="preview-person"><span className="avatar">L</span><div><strong>Leo</strong><span>A place near everything.</span></div><Check size={16}/></div><div className="preview-person"><span className="avatar">S</span><div><strong>Sam</strong><span>A smaller share of the rent.</span></div><Check size={16}/></div><div className="preview-agreement"><span className="preview-check"><Check size={15}/></span>Within everyone’s budget</div><div className="preview-switch" aria-label="Choose a sample home">{homes.map((h,i)=><button key={h.name} aria-pressed={i===index} aria-label={`Preview ${h.name}`} onClick={()=>setIndex(i)}>{String(i+1).padStart(2,'0')}</button>)}<span>Explore a match</span></div></div>
    <div className="preview-home"><img src={`/images/${home.photo}.webp`} alt="Illustrative sample apartment interior"/><div className="preview-home-info"><div><h2>{home.name}</h2><p>{home.place} · 3 beds · 2 baths</p></div><strong>${home.total}<small> / month</small></strong></div><div className="preview-shares">{['Maya','Leo','Sam'].map((name,i)=><div key={name}><span>{name}</span><strong>${home.shares[i]}</strong><small>{['Sunny ensuite','Corner bedroom','Garden bedroom'][i]}</small></div>)}</div></div></div>
    <div className="preview-bottom"><span>Illustrative homes · estimated shared costs included</span><button onClick={onExplore}>Try it together <ArrowUpRight size={15}/></button></div>
  </section>;
}
