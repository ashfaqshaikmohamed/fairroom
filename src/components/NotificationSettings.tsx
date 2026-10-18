import {useEffect,useState} from 'react';
import {apiClient} from '../api/client';

export function NotificationSettings({groupId}:{groupId:string}) {
 const [settings,setSettings]=useState({enabled:true,time:'09:00',timeZone:'America/New_York',urgent:false});
 const [ready,setReady]=useState(false),[running,setRunning]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let alive=true;setReady(false);apiClient.notificationSchedule(groupId).then(data=>{if(alive){setSettings(data.settings);setRunning(data.running);setReady(true);}}).catch(()=>{if(alive)setNotice('Unable to load updates.');});return()=>{alive=false;};},[groupId]);
 return <form className="quiet-panel space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const data=await apiClient.notificationSchedule(groupId,settings);setRunning(data.running);setNotice('Saved.');}catch{setNotice('Couldn’t save. Try again.');}finally{setBusy(false);}}}>
  <p className="eyebrow">Home updates</p>
  <label className="flex items-center justify-between text-sm gap-2">Daily roundup<input type="checkbox" checked={settings.enabled} disabled={!ready} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/></label>
  <label className="block text-xs text-[#88796C]">Eastern time<input aria-label="Daily roundup time" type="time" value={settings.time} disabled={!ready} onChange={e=>setSettings({...settings,time:e.target.value})} className="block w-full rounded-lg border border-[#DED5CA] bg-transparent p-2 mt-2 text-[#45372D]"/></label>
  <label className="flex items-center justify-between text-sm gap-2">Standout finds<input type="checkbox" checked={settings.urgent} disabled={!ready} onChange={e=>setSettings({...settings,urgent:e.target.checked})}/></label>
  <p className="text-xs text-[#88796C] leading-relaxed">An earlier heads-up for a new match priced well below comparable homes. Between 9 AM and 9 PM.</p>
  {ready&&!running&&<p className="text-xs text-[#88796C]">Scheduled delivery isn’t connected yet.</p>}
  <button disabled={!ready||busy} className="secondary-button w-full">{busy?'Saving…':'Save updates'}</button>
  {notice&&<p role="status" className="text-xs">{notice}</p>}
 </form>;
}
