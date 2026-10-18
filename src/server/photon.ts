import { Photon, ApiError } from '@photon-ai/api';
import type { DeliveryStatus } from '../types';
export const photonConfigured = () => !!process.env.PHOTON_API_KEY && /^pho_prj_/.test(process.env.PHOTON_PROJECT_ID || '');
export const photonEnabled = () => photonConfigured() && process.env.PHOTON_ENABLED === 'true';
export function photonClient() {
  if (!photonConfigured()) throw new Error('Add your Photon project ID and API key to .env.');
  return new Photon({headers:{Authorization:`Bearer ${process.env.PHOTON_API_KEY}`},timeoutMs:12000,retry:false});
}
export const projectPath = () => ({id:process.env.PHOTON_PROJECT_ID!});
export type PhotonClient = ReturnType<typeof photonClient>;
export function normalizeHandle(handle:string) { return handle.includes('@') ? handle.trim().toLowerCase() : handle.replace(/[^+\d]/g,'').replace(/^(\d{10})$/,'+1$1'); }
// Check the live roster on every send. A saved space ID is not authorization.
export async function verifyPhotonGroup(spaceId:string, recipients:string[], client=photonClient()) {
  if (recipients.length<2 || new Set(recipients.map(normalizeHandle)).size!==recipients.length) throw new Error('At least two roommates need distinct, opted-in phone numbers.');
  const space=await client.projects.getSpace({path:{...projectPath(),spaceId}});
  if(!space||space.platform!=='imessage'||space.kind!=='group'||!Array.isArray(space.participantIds))throw new Error('Choose an iMessage group conversation.');
  const resolved=await Promise.all(space.participantIds.map(userId=>client.projects.getUser({path:{...projectPath(),userId}})));
  const users=resolved.filter((u):u is NonNullable<typeof u> & {platform:'imessage';id:string;kind:string;handle:string;details:{type?:string}}=>!!u&&u.platform==='imessage'&&typeof u.id==='string'&&typeof u.handle==='string');
  const agents=users.filter(u=>u.kind==='agent');
  const humans=users.filter(u=>u.kind==='human');
  if(agents.length!==1||humans.length!==recipients.length||users.length!==humans.length+1)throw new Error('The chat must contain exactly your opted-in roommates and FairRoom.');
  const agent=agents[0];
  if(agent.platform!=='imessage'||agent.details?.type==='shared')throw new Error('Photon shared lines cannot join groups. Use a group-capable dedicated line.');
  const actual=humans.map(u=>normalizeHandle(u.handle)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(recipients.map(normalizeHandle).sort()))throw new Error('Chat participants do not match your opted-in roommates.');
  return {space,senderId:agent.id,agentHandle:agent.handle};
}
export async function sendPhotonMessage(options:{spaceId:string;recipients:string[];body:string;idempotencyKey:string;parentMessageId?:string},client?:PhotonClient):Promise<{ok:boolean;deliveryStatus:DeliveryStatus;providerMessageId?:string;error?:string}> {
  if(!photonEnabled())return {ok:false,deliveryStatus:'failed',error:'Photon sending is off.'};
  const api=client||photonClient();
  let senderId:string;
  try{({senderId}=await verifyPhotonGroup(options.spaceId,options.recipients,api));}
  catch(e){return {ok:false,deliveryStatus:'failed',error:e instanceof ApiError?`Photon connection check failed (${e.status}).`:e instanceof Error?e.message:'Connection check failed.'};}
  try{
    const result=await api.projects.sendMessage({path:projectPath(),headers:{'idempotency-key':options.idempotencyKey},body:{spaceId:options.spaceId,senderId,...(options.parentMessageId?{parentMessageId:options.parentMessageId}:{}),content:{type:'text',format:'plain',text:options.body}}});
    return {ok:result.status!=='failed',deliveryStatus:result.status==='delivered'?'delivered':result.status==='failed'?'failed':'provider_accepted',providerMessageId:typeof result.id==='string'?result.id:undefined};
  }catch(e){return {ok:false,deliveryStatus:e instanceof ApiError&&e.status<500?'failed':'unconfirmed',error:e instanceof ApiError?`Photon request failed (${e.status}).`:'Photon response unavailable. Check the message history before retrying.'};}
}
