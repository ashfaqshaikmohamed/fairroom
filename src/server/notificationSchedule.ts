import type {Database} from 'sql.js';
import {getAllListings,getScoutState,getRecommendationEvents,saveDb} from './db';
import {agentMembers} from './agent';
import {evaluateListing,normalizeProfile,rankForGroup} from '../engine/matching';
import {runGroupMatchingAndDelivery} from './deliveryService';
export interface NotificationSettings {enabled:boolean;time:string;timeZone:string;urgent:boolean;}
const defaults:NotificationSettings={enabled:true,time:'09:00',timeZone:'America/New_York',urgent:false};
function init(db:Database){db.run('CREATE TABLE IF NOT EXISTS notification_schedule (group_id TEXT PRIMARY KEY,settings TEXT,last_day TEXT,last_urgent TEXT,baseline_at TEXT NOT NULL)');}
export function getNotificationSettings(db:Database,groupId:string){init(db);const row=db.exec('SELECT settings FROM notification_schedule WHERE group_id=?',[groupId])[0]?.values[0];return row?JSON.parse(String(row[0])) as NotificationSettings:{...defaults};}
export function saveNotificationSettings(db:Database,groupId:string,value:NotificationSettings){
 if(!value||typeof value.timeZone!=='string'||typeof value.time!=='string'||typeof value.enabled!=='boolean'||typeof value.urgent!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))throw new Error('Choose a valid daily time.');
 try{new Intl.DateTimeFormat('en',{timeZone:value.timeZone}).format();}catch{throw new Error('Choose a valid time zone.');}
 init(db);db.run('INSERT INTO notification_schedule (group_id,settings,baseline_at) VALUES (?,?,?) ON CONFLICT(group_id) DO UPDATE SET settings=excluded.settings',[groupId,JSON.stringify(value),new Date().toISOString()]);saveDb(db);return value;
}
export function localClock(now:Date,timeZone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);const get=(key:string)=>parts.find(p=>p.type===key)!.value;return {day:`${get('year')}-${get('month')}-${get('day')}`,minutes:Number(get('hour'))*60+Number(get('minute'))};}
export function digestDue(now:Date,settings:NotificationSettings,lastDay:string|null){const local=localClock(now,settings.timeZone);const [h,m]=settings.time.split(':').map(Number);return settings.enabled&&local.day!==lastDay&&local.minutes>=h*60+m&&local.minutes<h*60+m+15;}
export async function scheduledCheck(db:Database,now=new Date()){
 init(db);const groups=db.exec('SELECT id FROM groups WHERE is_fixture=0')[0]?.values||[];
 for(const [id] of groups){const groupId=String(id),settings=getNotificationSettings(db,groupId);if(!settings.enabled||!getScoutState(db,groupId).isActive)continue;
  let row=db.exec('SELECT last_day,last_urgent,baseline_at FROM notification_schedule WHERE group_id=?',[groupId])[0]?.values[0];
  if(!row){saveNotificationSettings(db,groupId,settings);row=[null,null,now.toISOString()];}
  if(digestDue(now,settings,row[0]?String(row[0]):null)){
   const result=await runGroupMatchingAndDelivery(db,groupId,{isManual:true});
   if(result.success){db.run('UPDATE notification_schedule SET last_day=? WHERE group_id=?',[localClock(now,settings.timeZone).day,groupId]);saveDb(db);}
   continue;
  }
  const local=localClock(now,settings.timeZone);
  if(!settings.urgent||local.minutes<540||local.minutes>=1260||(row[1]&&now.getTime()-Date.parse(String(row[1]))<21600000))continue;
  const members=agentMembers(db,groupId);if(members.length<2||members.some(m=>!m.survey?.isReady))continue;
  const listings=getAllListings(db).filter(l=>!l.id.startsWith('demo-'));const profiles=members.map(m=>normalizeProfile(m));const previous=getRecommendationEvents(db,groupId);
  const picks=rankForGroup(listings.map(l=>evaluateListing(l,profiles))).filter(e=>{
   const age=now.getTime()-Date.parse(e.listing.capturedAt);
   if(e.status!=='MATCH'||e.evidence.worstMemberScore<.67||age<0||age>86400000||Date.parse(e.listing.capturedAt)<=Date.parse(String(row![2]))||previous.some(p=>p.listingId===e.listingId&&p.catalogRevision===e.listing.catalogRevision))return false;
   const comparable=listings.filter(l=>l.id!==e.listingId&&l.city===e.listing.city&&l.bedrooms===e.listing.bedrooms&&l.baseRentCents>0&&now.getTime()-Date.parse(l.capturedAt)<30*86400000).map(l=>l.baseRentCents).sort((a,b)=>a-b);
   return comparable.length>=5&&e.listing.baseRentCents<=comparable[Math.floor(comparable.length/2)]*.85;
  }).slice(0,1);
  if(picks.length){const result=await runGroupMatchingAndDelivery(db,groupId,{isManual:true,listingIds:picks.map(p=>p.listingId)});if(result.eventsCreated||result.phoneDispatchedCount){db.run('UPDATE notification_schedule SET last_urgent=? WHERE group_id=?',[now.toISOString(),groupId]);saveDb(db);}}
 }
}
