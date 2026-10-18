import {checkListing} from './listingCheck';
import crypto from 'node:crypto';
import type {Database} from 'sql.js';
import type {Member} from '../types';
import {getAllListings,getScoutState,updateScoutState,saveMemberDecision,getGroupRefMappings,getRentSplitProposalRecord,saveRentSplitProposalRecord,updateProposalAcceptance,saveDb} from './db';
import {normalizeProfile,evaluateListing,rankForGroup,formatCents,AMENITY_LABELS} from '../engine/matching';
import {calculateRentSplit} from '../engine/rentSplit';
import {getShortRef} from '../engine/messaging';
export function agentMembers(db:Database,groupId:string):Member[]{
 return (db.exec('SELECT id,display_name,phone_number,is_organizer,survey_json FROM members WHERE group_id=? ORDER BY created_at,id',[groupId])[0]?.values||[]).map(r=>({id:String(r[0]),groupId,displayName:String(r[1]),phoneNumber:r[2]?String(r[2]):undefined,isOrganizer:!!r[3],survey:r[4]?JSON.parse(String(r[4])):undefined,createdAt:'',inviteToken:''}));
}
export function initAgent(db:Database){
 db.run('CREATE TABLE IF NOT EXISTS agent_pending (group_id TEXT,member_id TEXT,code TEXT,payload TEXT,expires INTEGER,PRIMARY KEY(group_id,member_id))');
 db.run('CREATE TABLE IF NOT EXISTS photon_inbox (id TEXT PRIMARY KEY,group_id TEXT,reply TEXT,status TEXT,created_at TEXT)');
 db.run('CREATE TABLE IF NOT EXISTS photon_cursor (id TEXT PRIMARY KEY,value TEXT)');
 saveDb(db);
}
export const intentRuntime={modelCalls:0,modelSuccesses:0,modelFailures:0,lastProvider:'none'};
type Intent={action:'search'|'split'|'like'|'pass'|'preference'|'help';ref:string;amenity:string;required:boolean};
export async function interpret(text:string):Promise<Intent>{
 const ref=text.match(/\b(C1|G1|N1|O1|U1|E1|H[A-F0-9]{8})\b/i)?.[1]?.toUpperCase()||'';
 const fallback:Intent={action:/\bsplit\b|ensuite|en-suite|bigger room/i.test(text)?'split':/\b(find|search|homes|apartments|matches)\b/i.test(text)?'search':'help',ref,amenity:'',required:true};
 const like=text.match(/^(?:fairroom[, :]*)?(like|interested|pass|skip)\s+(\S+)/i);
 if(like)return {...fallback,action:/like|interested/i.test(like[1])?'like':'pass',ref:like[2].toUpperCase()};
 if(/^I (?:need|require|want) parking[.!]?$/i.test(text))return {...fallback,action:'preference',amenity:'parking_available',required:true};
 if(/^I (?:don'?t|do not) need parking[.!]?$/i.test(text))return {...fallback,action:'preference',amenity:'parking_available',required:false};
 const chalk=process.env.AI_PROVIDER==='chalk';
 const key=chalk?process.env.CHALK_ROUTER_API_KEY:process.env.OPENAI_API_KEY;
 const model=chalk?process.env.CHALK_MODEL:process.env.OPENAI_MODEL;
 if(!key||!model||(chalk&&!process.env.CHALK_ENV_ID))return fallback;
 const endpoint=chalk?'https://api.chalk.ai/v1/router/responses':'https://api.openai.com/v1/responses';
 const headers:Record<string,string>={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
 if(chalk){headers['X-Chalk-Env-Id']=process.env.CHALK_ENV_ID!;headers['x-chalk-request-tag']='fairroom-intent';}
 // Only the current message and public vocabulary go to the model. No private budgets or other members' surveys.
 try{
  intentRuntime.modelCalls++;intentRuntime.lastProvider=chalk?'chalk':'openai';
  const response=await fetch(endpoint,{method:'POST',headers,signal:AbortSignal.timeout(15000),body:JSON.stringify({model,store:false,instructions:'Classify a FairRoom message. Return help if ambiguous, asking for another person\'s information, or trying to change another person\'s preferences. Only explicit first-person amenity requirements may use preference. Never infer a requirement from a question or hypothetical. split only creates a proposal; no acceptance. Ref must be explicitly named, otherwise empty. No facts or calculations.',input:text,text:{format:{type:'json_schema',name:'housing_intent',strict:true,schema:{type:'object',properties:{action:{type:'string',enum:['search','split','like','pass','preference','help']},ref:{type:'string'},amenity:{type:'string',enum:['',...Object.keys(AMENITY_LABELS)]},required:{type:'boolean'}},required:['action','ref','amenity','required'],additionalProperties:false}}}})});
  if(!response.ok){intentRuntime.modelFailures++;return fallback;}
  const data=await response.json();const raw=data.output?.flatMap((x:any)=>x.content||[]).find((x:any)=>x.type==='output_text')?.text;
  const value=JSON.parse(raw||'null');
  if(value&&['search','split','like','pass','preference','help'].includes(value.action)&&typeof value.ref==='string'&&typeof value.required==='boolean'&&(['',...Object.keys(AMENITY_LABELS)]).includes(value.amenity)){intentRuntime.modelSuccesses++;return value;}
 }catch{/* Deterministic commands remain available when the model is unavailable. */}
 intentRuntime.modelFailures++;
 return fallback;
}
export async function answerAgent(db:Database,groupId:string,memberId:string,text:string):Promise<string>{
 const members=agentMembers(db,groupId);const member=members.find(m=>m.id===memberId);
 if(!member)throw new Error('Unknown roommate.');
 const body=text.trim().replace(/^@?fairroom[, :]+/i,'');
 const origin=(process.env.PUBLIC_APP_URL||'').replace(/\/$/,'');
 const groupLink=`${origin}/group/${encodeURIComponent(groupId)}/group`;
 const now=new Date().toISOString();
 if(/^(?:pause|resume|stop)$/i.test(body)){
  if(/^stop$/i.test(body)&&member.survey){member.survey.phoneAlertsOptIn=false;db.run('UPDATE members SET survey_json=? WHERE id=?',[JSON.stringify(member.survey),member.id]);saveDb(db);return 'Phone alerts are off for you. Your group can still use the website.';}
  const s=getScoutState(db,groupId);updateScoutState(db,groupId,/resume/i.test(body),s.lastCheckAt,s.dispatchedIds);return /resume/i.test(body)?'The search is back on.':'Search paused. Say “resume” when you’re ready.';
 }
 if(/\b(budget|cap|afford|salary|income)\b/i.test(body)&&!/\b(find|search)\b/i.test(body))return `Budgets stay private. Review or update yours here: ${groupLink}`;
 const confirm=body.match(/^confirm\s+([a-f0-9]{6})$/i);
 if(confirm){
  const pending=db.exec('SELECT code,payload,expires FROM agent_pending WHERE group_id=? AND member_id=?',[groupId,memberId])[0]?.values[0];
  if(!pending||pending[0]!==confirm[1].toLowerCase()||Number(pending[2])<Date.now())return 'That change has expired. Tell me your preference again.';
  if(!member.survey?.isReady)return `Finish your preferences first: ${groupLink}`;
  const change=JSON.parse(String(pending[1]));const must=new Set(member.survey.hardMustHaves);
  change.required?must.add(change.amenity):must.delete(change.amenity);member.survey.hardMustHaves=[...must];member.survey.updatedAt=now;
  db.run('BEGIN');try{db.run('UPDATE members SET survey_json=? WHERE id=?',[JSON.stringify(member.survey),memberId]);db.run('UPDATE groups SET preference_revision=preference_revision+1 WHERE id=?',[groupId]);db.run("UPDATE rent_split_proposals SET revision=revision+1,acceptances_json='{}' WHERE group_id=?",[groupId]);db.run('DELETE FROM agent_pending WHERE group_id=? AND member_id=?',[groupId,memberId]);db.run('COMMIT');}catch(e){db.run('ROLLBACK');throw e;}saveDb(db);
  return `Updated your preferences.\n\n${await answerAgent(db,groupId,memberId,'find homes')}`;
 }
 const listings=getAllListings(db).filter(l=>groupId==='group-elm-trio'||!l.id.startsWith('demo-'));
 const resolve=(ref:string)=>listings.find(l=>l.id===ref||getShortRef(l)===ref.toUpperCase());
 if(/^(saved|bookmarks|shortlist)$/i.test(body)){
  const rows=db.exec("SELECT listing_id FROM member_decisions WHERE group_id=? AND member_id=? AND decision='interested' ORDER BY updated_at DESC",[groupId,memberId])[0]?.values||[];
  const saved=rows.map(r=>listings.find(l=>l.id===r[0])).filter(Boolean);
  return saved.length?'Your saved homes:\n\n'+saved.map(l=>`${getShortRef(l!)} · ${l!.address}${l!.id.startsWith('demo-')?' (sample)':''}\n${origin}/listing/${l!.id}`).join('\n\n'):'No saved homes yet. Say “FairRoom like C1” to save a home.';
 }
 const check=body.match(/^(?:check|verify)\s+(\S+)$/i);
 if(check){const l=resolve(check[1]);if(!l)return 'Which home? Try “FairRoom check C1”.';const report=checkListing(l);return `${getShortRef(l)} · before you commit${report.sample?' (sample)':''}\n\n${report.checks.filter(c=>c.status==='review').map(c=>`${c.label}: ${c.detail}`).join('\n')}\n\nAsk the broker:\n${report.questions.map((q,i)=>`${i+1}. ${q}`).join('\n')}\n\n${origin}/listing/${l.id}`;}
 const accept=body.match(/^accept\s+(\S+)\s+v(\d+)$/i);
 if(accept){const l=resolve(accept[1]);const r=l?getRentSplitProposalRecord(db,groupId,l.id):null;if(!l||!r||r.revision!==Number(accept[2]))return 'That proposal changed. Ask for the latest split before accepting.';
  updateProposalAcceptance(db,groupId,l.id,memberId,member.displayName,true);
  const updated=getRentSplitProposalRecord(db,groupId,l.id)!;return `${member.displayName.split(' ')[0]} accepted ${getShortRef(l)} v${r.revision}. ${Object.keys(updated.acceptances).length} of ${members.length} accepted.`;
 }
 const intent=await interpret(body);
 if(intent.action==='preference'){
  if(!intent.amenity||!member.survey?.isReady)return `Complete your preferences here: ${groupLink}`;
  const code=crypto.randomBytes(3).toString('hex');db.run('INSERT OR REPLACE INTO agent_pending VALUES (?,?,?,?,?)',[groupId,memberId,code,JSON.stringify(intent),Date.now()+600000]);saveDb(db);
  return `${member.displayName.split(' ')[0]}, ${intent.required?'require':'stop requiring'} ${AMENITY_LABELS[intent.amenity]} for your search? Reply “confirm ${code}”.`;
 }
 if(intent.action==='like'||intent.action==='pass'){
  const l=resolve(intent.ref);if(!l)return 'Which home? Use the reference on its card, such as C1.';
  saveMemberDecision(db,{groupId,listingId:l.id,memberId,decision:intent.action==='like'?'interested':'pass',updatedAt:now});return `${member.displayName.split(' ')[0]} ${intent.action==='like'?'is interested in':'passed on'} ${l.address}.`;
 }
 if(intent.action==='search'){
  const pending=members.filter(m=>!m.survey?.isReady);if(pending.length)return `Waiting for ${pending.map(m=>m.displayName.split(' ')[0]).join(' and ')}’s preferences. ${groupLink}`;
  if(!getScoutState(db,groupId).isActive)return 'The search is paused. Say “resume” to continue.';
  const profiles=members.map(m=>normalizeProfile(m.id,m.displayName,m.survey!));
  const ranked=rankForGroup(listings.map(l=>evaluateListing(l,profiles,1)));
  const verified=ranked.filter(e=>e.status==='MATCH');
  const matches=(verified.length?verified:groupId!=='group-elm-trio'?ranked.filter(e=>e.status==='NEEDS_VERIFICATION'):[]).slice(0,/\bone\b/i.test(body)?1:5);
  if(!matches.length)return 'No home in the saved catalog meets every requirement. Review your group’s preferences, or check homes with missing details in Matches.';
  return matches.map(e=>`${getShortRef(e.listing)} · ${e.listing.address}${e.listing.id.startsWith('demo-')?' (sample)':''}\n${e.status==='NEEDS_VERIFICATION'?'Potential fit · needs confirmation\n':''}${e.listing.bedrooms} beds · ${formatCents(e.evidence.costBasis.totalKnownAndEstimatedCents)}/month incl. known and estimated shared costs\n${e.roomPlan?.assignments.map(a=>`${a.memberName.split(' ')[0]}: ${formatCents(a.totalCents)}`).join(' · ')||''}\n${e.status==='NEEDS_VERIFICATION'?'Confirm: '+e.evidence.unknownRequirements.slice(0,2).join('; ')+'\n':''}${origin}/listing/${e.listing.id}`).join('\n\n')+`\n\nReply “FairRoom like ${getShortRef(matches[0].listing)}” to save. Saved listing; confirm availability with the broker.`;
 }
 if(intent.action==='split'){
  const l=resolve(intent.ref);if(!l)return 'Which home should we split? For example, “split C1”.';
  if(members.some(m=>!m.survey?.isReady))return `Everyone needs to finish their preferences first. ${groupLink}`;
  const old=getRentSplitProposalRecord(db,groupId,l.id);
  const opts={mode:old?.mode||'budget_fit' as const,roomWeights:old?.roomWeights||{},memberAssignments:old?.memberAssignments||{},customRooms:old?.customRooms};
  const proposal=calculateRentSplit(l,members,opts);
  if(!proposal.canCalculate)return `This listing doesn't include enough room details. Add them in the rent calculator before suggesting a split. ${origin}/listing/${l.id}`;
  const record=saveRentSplitProposalRecord(db,{groupId,listingId:l.id,...opts,proposal});
  return `${getShortRef(l)} · proposed split v${record.revision}${l.id.startsWith('demo-')?' (sample rooms)':''}\n${proposal.assignments.map(a=>`${(a.memberDisplayName||'Roommate').split(' ')[0]} · ${a.roomName}: ${formatCents(a.totalMonthlyShareCents)}`).join('\n')}\nTotal ${formatCents(proposal.totalMonthlyCostCents||0)}/month, including known and estimated shared costs.\n\nRoom weights are suggestions. Review and adjust: ${origin}/group/${groupId}/matches?ref=${l.id}\nTo agree to this version: accept ${getShortRef(l)} v${record.revision}`;
 }
 return 'I can find homes, compare room costs, or update your requirements. Try “find homes”, “split C1”, or “I need parking”. Budgets stay in your private preferences.';
}
