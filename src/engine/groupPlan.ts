import type {Listing} from '../types';

export interface RoomPreferences { minimumBedroomSqFt?:number; minimumHomeSqFt?:number; privateBathroom?:'any'|'preferred'|'required'; }
export interface PlannerMember extends RoomPreferences {memberId:string;displayName:string;privateCapCents:number;isReady:boolean;}
export interface GroupPlan {preferenceScore?:number;status:'feasible'|'infeasible'|'unknown';reason:string;assignments:Array<{memberId:string;memberName:string;roomId:string;roomName:string;baseRentCents:number;sharedCostsCents:number;totalCents:number}>;}

// Projection onto a capped simplex: closest prices to the feature-weighted baseline.
// Caps constrain feasibility; they do not determine the baseline price of a room.
export function cappedAllocation(total:number,targets:number[],caps:number[]):number[]|null {
 if(!Number.isSafeInteger(total)||total<0||!targets.length||targets.length!==caps.length||caps.some(c=>!Number.isSafeInteger(c)||c<0)||caps.reduce((a,b)=>a+b,0)<total)return null;
 let lo=-Math.max(total,...targets),hi=total+Math.max(...caps);
 for(let k=0;k<80;k++){const mid=(lo+hi)/2;const sum=targets.reduce((s,t,i)=>s+Math.min(caps[i],Math.max(0,t+mid)),0);if(sum<total)lo=mid;else hi=mid;}
 const exact=targets.map((t,i)=>Math.min(caps[i],Math.max(0,t+(lo+hi)/2)));
 const result=exact.map(Math.floor);let remainder=total-result.reduce((a,b)=>a+b,0);
 const order=exact.map((v,i)=>({i,f:v-Math.floor(v)})).sort((a,b)=>b.f-a.f||a.i-b.i);
 for(const {i} of order){if(remainder>0&&result[i]<caps[i]){result[i]++;remainder--;}}
 return remainder===0?result:null;
}
export function planRooms(listing:Listing,people:PlannerMember[]):GroupPlan {
 const fail=(status:GroupPlan['status'],reason:string):GroupPlan=>({status,reason,assignments:[]});
 const members=[...people].sort((a,b)=>a.memberId.localeCompare(b.memberId));
 if(members.length<2||members.some(m=>!m.isReady))return fail('unknown','Waiting for every roommate’s preferences');
 if(members.length>6)return fail('unknown','Room planning supports two to six roommates');
 if(listing.sharedCostComponents.some(c=>c.status==='unknown'))return fail('unknown','Confirm shared costs before proposing a split');
 const minHome=Math.max(...members.map(m=>m.minimumHomeSqFt||0));
 if(minHome && !listing.rawAuditRecord.floorAreaSqFt)return fail('unknown','Confirm the home’s floor area');
 if(minHome>(listing.rawAuditRecord.floorAreaSqFt||Infinity))return fail('infeasible','The home is smaller than a roommate’s minimum');
 const rooms=[...(listing.rooms||[])].sort((a,b)=>a.id.localeCompare(b.id));
 if(rooms.length!==members.length)return fail('unknown','Confirm one bedroom per roommate and the room details');
 if(members.some(m=>m.minimumBedroomSqFt)&&rooms.some(r=>!r.estimatedSqFt))return fail('unknown','Confirm bedroom sizes');
 const shared=listing.sharedCostComponents.reduce((s,c)=>s+c.amountCents,0);
 const costs=rooms.map((_,i)=>Math.floor(shared/rooms.length)+(i<shared%rooms.length?1:0));
 const weights=rooms.map(r=>r.suggestedWeight||Math.max(.5,(r.estimatedSqFt||140)/150+(r.bathType==='private'?.2:0)));
 const totalWeight=weights.reduce((a,b)=>a+b,0),targets=weights.map(w=>listing.baseRentCents*w/totalWeight);
 let best:GroupPlan|null=null,bestScore=-Infinity;
 function visit(indices:number[]){
  if(indices.length<members.length){for(let i=0;i<members.length;i++)if(!indices.includes(i))visit([...indices,i]);return;}
  const assigned=indices.map(i=>members[i]);
  if(assigned.some((m,i)=>(m.privateBathroom==='required'&&rooms[i].bathType!=='private')||(m.minimumBedroomSqFt||0)>(rooms[i].estimatedSqFt||Infinity)))return;
  const prices=cappedAllocation(listing.baseRentCents,targets,assigned.map((m,i)=>m.privateCapCents-costs[i]));if(!prices)return;
  const satisfaction:number[]=assigned.map((m,i)=>m.privateBathroom==='preferred'&&rooms[i].bathType!=='private'?0:1);
  const distortion=prices.reduce((s,p,i)=>s+(p-targets[i])**2,0)/Math.max(1,listing.baseRentCents**2);
  const score=Math.min(...satisfaction)*10+satisfaction.reduce((a,b)=>a+b,0)/members.length-distortion;
  if(score>bestScore){bestScore=score;best={preferenceScore:Math.min(...satisfaction),status:'feasible',reason:'Room-weighted rent adjusted to fit every budget; shared costs divided equally. A proposal for everyone to review.',assignments:assigned.map((m,i)=>({memberId:m.memberId,memberName:m.displayName,roomId:rooms[i].id,roomName:rooms[i].name,baseRentCents:prices[i],sharedCostsCents:costs[i],totalCents:prices[i]+costs[i]}))};}
 }
 visit([]);return best||fail('infeasible','No room assignment and split meets everyone’s requirements and budget');
}
