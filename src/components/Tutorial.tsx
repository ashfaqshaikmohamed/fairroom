import React,{createContext,useContext,useState} from 'react';
import {ArrowRight,ChevronDown,ChevronUp,X,Check} from 'lucide-react';
import {useRouter} from '../router';
import {useApp} from '../context/AppContext';
import {apiClient} from '../api/client';
import {useDialog} from '../hooks/useDialog';

const TutorialContext=createContext<{openTutorial:()=>void}>({openTutorial:()=>{}});
export const useTutorial=()=>useContext(TutorialContext);
const lessons=[
  {title:'Start with your people.',body:'Create a group and invite your roommates. With your FairRoom number, you can also begin by texting “FairRoom start” in iMessage.',visual:['Maya','Leo','Sam'],note:'A shared search, with a private form for each person.'},
  {title:'Tell us what feels like home.',body:'Each person chooses their budget, neighborhoods, room size, bathroom preference and must-haves. Budget limits stay private.',visual:['Your room','Your budget','Your must-haves'],note:'Everyone finishes their form before the search begins.'},
  {title:'Find a place for everyone.',body:'FairRoom checks everyone’s requirements, then ranks the homes that fit. Review up to five options and the proposed share for each room.',visual:['Maya · $1,520','Leo · $1,280','Sam · $1,040'],note:'Sample proposal · $3,840 total, including estimated shared costs.'},
  {title:'Make the decision together.',body:'Compare the split, adjust it if needed, and accept the same version. Keep the conversation going with “split C1” or “I need parking”.',visual:['Review','Agree','Share'],note:'The web demo needs no keys. Connect your number to receive homes in iMessage.'},
];
const steps=[
  {title:'Finish Sam’s preferences',body:'Select “Add my preferences”, review Sam’s $1,100 budget, and continue through the three short steps. Choose “Find our homes” to finish.',action:'See our homes'},
  {title:'Compare your five homes',body:'Select a home to see its rooms and proposed monthly shares. Try the Courtyard sample at 142 Hampshire St for the $1,520 / $1,280 / $1,040 split.',action:'Review the Courtyard split'},
  {title:'Review the proposed shares',body:'Check Sam’s private budget result, compare split modes, or accept the proposal. Sharing saves this version to your group conversation.',action:'Go to the conversation'},
  {title:'Ask FairRoom in the chat',body:'Send “split C1” for a calculated reply. Try “I need parking”, then the confirmation code, to watch the shortlist change.',action:'Finish walkthrough'},
];
export function TutorialProvider({children}:{children:React.ReactNode}) {
  const [open,setOpen]=useState(false),[lesson,setLesson]=useState(0),[step,setStep]=useState<number|null>(null),[collapsed,setCollapsed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const {navigate}=useRouter();const {loadGroup,members,matchesData,openRentSplit,closeRentSplit}=useApp();
  useDialog(()=>setOpen(false),open);
  const openTutorial=()=>{setLesson(0);setError('');setOpen(true);};
  async function start(){setBusy(true);setError('');try{await apiClient.resetDemo();await apiClient.demoSession('member-sam');await loadGroup('group-elm-trio');setOpen(false);setCollapsed(false);setStep(0);navigate('/group/group-elm-trio/group');}catch{setError('Could not start the sample group. Please try again.');}finally{setBusy(false);}}
  function advance(){
    if(step===0){navigate('/group/group-elm-trio/matches');setStep(1);}
    else if(step===1){const home=matchesData?.fitsEveryone.find(e=>e.listingId==='demo-courtyard')?.listing;if(!home){setError('Open Homes and select a matching home first. If preferences changed, restart the sample walkthrough.');return;}openRentSplit(home);setStep(2);}
    else if(step===2){closeRentSplit();navigate('/group/group-elm-trio/scout');setStep(3);}
    else setStep(null);
  }
  return <TutorialContext.Provider value={{openTutorial}}>{children}
    {open&&<div className="tutorial-backdrop"><section className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><div className="tutorial-top"><span>FairRoom / a quick tour</span><button aria-label="Close tutorial" onClick={()=>setOpen(false)}><X size={20}/></button></div><div className="tutorial-progress" aria-label={`Step ${lesson+1} of 4`}>{lessons.map((_,i)=><button key={i} aria-label={`Tutorial step ${i+1}`} aria-current={i===lesson?'step':undefined} onClick={()=>setLesson(i)}/>)}</div><div className="tutorial-visual">{lessons[lesson].visual.map((label,i)=><div key={label}><span>{lesson===0?label[0]:<Check size={16}/>}</span><strong>{label}</strong></div>)}</div><h2 id="tutorial-title">{lessons[lesson].title}</h2><p>{lessons[lesson].body}</p><small>{lessons[lesson].note}</small>{error&&<p role="alert">{error}</p>}<div className="tutorial-actions"><button className="secondary-button" disabled={lesson===0} onClick={()=>setLesson(lesson-1)}>Back</button>{lesson<3?<button className="primary-button" onClick={()=>setLesson(lesson+1)}>Next <ArrowRight size={16}/></button>:<button className="primary-button" disabled={busy} onClick={start}>{busy?'Opening…':'Start guided demo'} <ArrowRight size={16}/></button>}</div><p className="tutorial-footnote">The guided demo resets the fictional sample group. Your real groups stay unchanged.</p></section></div>}
    {step!==null&&!open&&<aside className={`walkthrough ${collapsed?'collapsed':''}`} aria-label="Demo walkthrough"><div className="walkthrough-top"><span>Demo walkthrough · {step+1} / 4</span><button aria-label={collapsed?'Expand walkthrough':'Collapse walkthrough'} onClick={()=>setCollapsed(!collapsed)}>{collapsed?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button><button aria-label="End walkthrough" onClick={()=>setStep(null)}><X size={16}/></button></div>{!collapsed&&<><h3>{steps[step].title}</h3><p>{steps[step].body}</p>{error&&<p role="alert">{error}</p>}<button className="primary-button" disabled={step===0&&(members.length<2||members.some(m=>!m.isReady))} onClick={advance}>{steps[step].action} <ArrowRight size={15}/></button>{step===0&&members.some(m=>!m.isReady)&&<small>Finish the preference form to continue.</small>}</>}</aside>}
  </TutorialContext.Provider>;
}
