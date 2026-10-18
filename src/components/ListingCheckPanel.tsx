import React,{useEffect,useState} from 'react';
import {ShieldCheck,ChevronDown,ArrowUpRight,LoaderCircle} from 'lucide-react';
import {apiClient as api} from '../api/client';
import type {ListingCheck} from '../server/listingCheck';
import {useApp} from '../context/AppContext';
export function ListingCheckPanel({groupId,listingId}:{groupId:string;listingId:string}){
 const [open,setOpen]=useState(false);const [data,setData]=useState<(ListingCheck&{reviewAvailable:boolean;sampleReviewAvailable?:boolean})|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [copied,setCopied]=useState(false);
 const {currentMember}=useApp();
 useEffect(()=>{let active=true;setData(null);setError('');setCopied(false);
 if(open)api.listingCheck(groupId,listingId).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);});
 return()=>{active=false;};},[groupId,listingId,open]);
 async function review(mode:true|'sample'=true){setBusy(true);setError('');try{setData(await api.listingCheck(groupId,listingId,mode));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const questions=data?.review?.questions||data?.sampleReview?.questions||data?.questions||[];
 return <section className="listing-check"><button className="check-toggle" onClick={()=>setOpen(!open)} aria-expanded={open}><ShieldCheck size={18}/><span>Before you commit<small>Costs, evidence & questions to ask</small></span><ChevronDown size={16} className={open?'check-chevron open':'check-chevron'}/></button>
 {open&&<div className="check-content">{error&&<p role="alert" className="notice">{error}</p>}{!data&&!error?<p role="status">Checking the saved details…</p>:data&&<>
 <div className="check-source"><span>{data.sample?'Sample evidence':data.source}</span><span>Availability unconfirmed</span></div>
 <ul className="check-list">{data.checks.map(c=><li key={c.id}><span className={`check-dot ${c.status}`}/><div><strong>{c.label}</strong><p>{c.detail}</p></div><small>{c.status==='recorded'?'Recorded':'Ask about'}</small></li>)}</ul>
 {data.review&&<div className="independent-review"><p className="eyebrow">Independent review</p><p>{data.review.summary}</p><small>AI-assisted review of saved evidence · not a property inspection</small></div>}
 {data.sampleReview&&!data.review&&<div className="independent-review"><p className="eyebrow">Sample review</p><p>{data.sampleReview.summary}</p><small>Prepared from demo evidence · no model call</small></div>}
 <h4>Ask the broker</h4><ol className="broker-questions">{questions.map(q=><li key={q}>{q}</li>)}</ol>
 <div className="check-actions"><button className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(questions.join('\n'));setCopied(true);}catch{setError('Copy was unavailable. Select the questions above.');}}}>{copied?'Copied':'Copy questions'}</button>{data.sampleReviewAvailable&&!data.review&&!data.sampleReview&&<button className="secondary-button" disabled={busy} onClick={()=>review('sample')}>{busy?'Preparing…':'Preview sample review'}</button>}{data.reviewAvailable&&currentMember?.isOrganizer&&<button className="secondary-button" disabled={busy} onClick={()=>review()}>{busy?<LoaderCircle size={14} className="animate-spin"/>:null}{busy?'Reviewing…':data.review?'Review saved':'Get independent review'}</button>}{!data.sample&&/^https?:\/\//.test(data.sourceUrl)&&<a href={data.sourceUrl} target="_blank" rel="noreferrer">Source <ArrowUpRight size={13}/></a>}</div>
 </>}</div>}</section>;
}
