import crypto from 'node:crypto';
import type {Database} from 'sql.js';
import {getAllListings,getScoutState,updateScoutState,saveRecommendationEvent,getRecommendationEvents,addChatMessage,enqueueOutbound,updateQueueItem,updateRecommendationEventStatus,getGroupConversation} from './db';
import {evaluateListing,rankForGroup,normalizeProfile} from '../engine/matching';
import {createRecommendationEvent} from '../engine/messaging';
import {sendPhotonMessage,photonEnabled} from './photon';
export interface DeliveryRunOptions {isManual?:boolean;listingIds?:string[];forceAll?:boolean;callerMemberId?:string;}
export interface DeliveryRunResult {success:boolean;groupId:string;totalListingsEvaluated:number;matchesCount:number;needsVerificationCount:number;eventsCreated:number;webDeliveredCount:number;phoneDispatchedCount:number;dispatchedListingIds:string[];skippedReason?:string;recipients:Array<{id:string;displayName:string;phone:string|null;optIn:boolean}>;notes:string[];}
const running = new Map<string,Promise<DeliveryRunResult>>();
export function runGroupMatchingAndDelivery(db:Database,groupId:string,options:DeliveryRunOptions={}):Promise<DeliveryRunResult> {
  const pending=running.get(groupId); if(pending)return pending;
  const job=run(db,groupId,options).finally(()=>running.delete(groupId));running.set(groupId,job);return job;
}
async function run(db:Database,groupId:string,options:DeliveryRunOptions):Promise<DeliveryRunResult> {
 const result:DeliveryRunResult={success:true,groupId,totalListingsEvaluated:0,matchesCount:0,needsVerificationCount:0,eventsCreated:0,webDeliveredCount:0,phoneDispatchedCount:0,dispatchedListingIds:[],recipients:[],notes:[]};
 const stop=(why:string)=>({...result,success:false,skippedReason:why,notes:[why]});
 const group=db.exec('SELECT preference_revision FROM groups WHERE id=?',[groupId])[0]?.values[0];
 if(!group)return stop('Group not found');
 const members=(db.exec('SELECT id,display_name,phone_number,survey_json FROM members WHERE group_id=? ORDER BY created_at,id',[groupId])[0]?.values||[]).map(r=>({id:r[0] as string,displayName:r[1] as string,phone:r[2] as string|null,survey:r[3]?JSON.parse(r[3] as string):null}));
 result.recipients=members.map(m=>({id:m.id,displayName:m.displayName,phone:m.phone ? '•••'+m.phone.slice(-4):null,optIn:!!m.survey?.phoneAlertsOptIn}));
 if(members.length<2 || members.some(m=>!m.survey?.isReady))return stop('Every roommate must complete their survey first.');
 const state=getScoutState(db,groupId);
 if(!state.isActive)return stop('Scout is paused. Resume before sending.');
 const profiles=members.map(m=>normalizeProfile(m.id,m.displayName,m.survey));
 const listings=getAllListings(db).filter(l=>groupId==='group-elm-trio'||!l.id.startsWith('demo-'));
 const evaluations=rankForGroup(listings.map(l=>evaluateListing(l,profiles,Number(group[0]))));
 result.totalListingsEvaluated=listings.length;
 result.matchesCount=evaluations.filter(e=>e.status==='MATCH').length;
 result.needsVerificationCount=evaluations.filter(e=>e.status==='NEEDS_VERIFICATION').length;
 const candidates=evaluations.filter(e=>(!options.listingIds||options.listingIds.includes(e.listingId))&&(e.status==='MATCH'||(state.includeNeedsVerification&&e.status==='NEEDS_VERIFICATION')));
 const previous=getRecommendationEvents(db,groupId);
 const now=new Date().toISOString();
 const origin=(process.env.PUBLIC_APP_URL||'').replace(/\/$/,'');
 const dailyLimited=!options.isManual && !!state.lastDigestAt && Date.now()-Date.parse(state.lastDigestAt)<86400000;
 const unsent=candidates.filter(e=>!previous.some(p=>p.listingId===e.listingId&&p.catalogRevision===e.listing.catalogRevision)).slice(0,5);
 if(!dailyLimited) for(const candidate of unsent){
  const event=createRecommendationEvent({groupId,listing:candidate.listing,evaluation:candidate,preferenceRevision:Number(group[0]),catalogRevision:candidate.listing.catalogRevision,publicAppUrl:origin,transport:'web'});
  if(candidate.roomPlan?.status==='feasible') event.summaryText+='\nProposed split: '+candidate.roomPlan.assignments.map(a=>`${a.memberName.split(' ')[0]} $${(a.totalCents/100).toFixed(2)}`).join(' · ');
  if(!saveRecommendationEvent(db,event))continue;
  addChatMessage(db,{id:'msg_'+crypto.randomUUID(),groupId,senderType:'scout',senderName:'FairRoom Scout',text:event.summaryText,listingRefId:event.listingId,shortRef:event.shortRef,recommendationEventId:event.id,deliveryStatus:'delivered',transport:'web',createdAt:now});
  updateRecommendationEventStatus(db,event.id,'delivered');
  result.eventsCreated++;result.webDeliveredCount++;result.dispatchedListingIds.push(event.listingId);
 }
 const binding=getGroupConversation(db,groupId);
 const opted=members.filter(m=>m.survey?.phoneAlertsOptIn&&m.phone).map(m=>m.phone!);
 const live=photonEnabled()&&origin.startsWith('https://')&&!!binding?.conversationSid&&(groupId!=='group-elm-trio'||state.isDemoDeliveryArmed);
 if(live&&!dailyLimited){
  const events=getRecommendationEvents(db,groupId).filter(e=>candidates.some(c=>c.listingId===e.listingId)&&!db.exec('SELECT id FROM outbound_queue WHERE idempotency_key=?',[e.idempotencyKey])[0]).slice(0,5);
  for(const event of events){
   const id='queue_'+crypto.randomUUID();
   enqueueOutbound(db,{id,idempotencyKey:event.idempotencyKey,groupId,recommendationEventId:event.id,transport:'photon_imessage',payload:{conversationSid:binding!.conversationSid,body:event.summaryText},status:'queued'});
   // Persist uncertain before network I/O: a process interruption can never trigger a blind retry.
   updateQueueItem(db,id,'unconfirmed',undefined,'Dispatch in progress; reconcile if interrupted.');
   const sent=await sendPhotonMessage({spaceId:binding!.conversationSid,recipients:opted,body:event.summaryText,idempotencyKey:event.idempotencyKey});
   updateQueueItem(db,id,sent.deliveryStatus,sent.providerMessageId,sent.error);
   updateRecommendationEventStatus(db,event.id,sent.deliveryStatus,sent.providerMessageId,sent.error);
   if(sent.ok)result.phoneDispatchedCount++;
   else result.notes.push(sent.error || 'Phone delivery not confirmed');
  }
 } else if(!live) result.notes.push('Web thread active. Live phone delivery is disabled or not configured.');
 updateScoutState(db,groupId,true,now,[...new Set([...state.dispatchedIds,...result.dispatchedListingIds])],{lastDigestAt:result.eventsCreated||result.phoneDispatchedCount?now:state.lastDigestAt,dailyDigestCount:state.dailyDigestCount+(result.eventsCreated?1:0)});
 if(!result.eventsCreated&&!result.phoneDispatchedCount)result.skippedReason=dailyLimited?'Automatic digest already sent today.':'No new matches to send.';
 return result;
}
