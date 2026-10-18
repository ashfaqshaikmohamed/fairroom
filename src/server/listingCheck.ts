import type {Listing} from '../types';
export interface ListingCheck {
 listingId:string; checkedAt:string; sample:boolean; source:string; sourceUrl:string; capturedAt:string;
 checks:Array<{id:string;label:string;status:'recorded'|'review';detail:string}>;
 questions:string[];
 sampleReview?:{provider:'sample';summary:string;questions:string[]};
 review?:{provider:'factory';sessionId:string;completedAt:string;summary:string;questions:string[];toolCalls:number};
}
export function checkListing(l:Listing,now=new Date()):ListingCheck {
 const costs=l.sharedCostComponents;
 const unknown=costs.filter(c=>c.status==='unknown');
 const estimated=costs.filter(c=>c.status==='estimated');
 const rooms=!!l.rooms?.length&&l.rooms.length===l.bedrooms&&l.rooms.every(r=>Number.isFinite(r.estimatedSqFt)&&r.estimatedSqFt!>0);
 const age=now.getTime()-Date.parse(l.capturedAt);
 const recent=Number.isFinite(age)&&age>=0&&age<7*86400000;
 const sample=l.id.startsWith('demo-');
 const checks:ListingCheck['checks']=[
  {id:'source',label:'Source & availability',status:'review',detail:sample?'Illustrative home for the demo.':`${l.sourceName} snapshot. ${recent?'Recently captured;':'Saved more than a week ago or capture date is uncertain;'} confirm current availability.`},
  {id:'costs',label:'Monthly costs',status:unknown.length||estimated.length||!costs.length?'review':'recorded',detail:unknown.length?`Not supplied: ${unknown.map(c=>c.name).join(', ')}.`:estimated.length?`Estimates to confirm: ${estimated.map(c=>c.name).join(', ')}.`:costs.length?'Recorded costs are included in the proposal.':'Shared costs have not been itemized.'},
  {id:'rooms',label:'Room dimensions',status:rooms?'recorded':'review',detail:rooms?'Room dimensions are recorded; confirm them before agreeing.':'Complete room dimensions are missing. A precise room split needs more evidence.'},
  {id:'movein',label:'Move-in costs',status:l.securityDepositCents!=null&&l.brokerFeeCents!=null?'recorded':'review',detail:l.securityDepositCents!=null&&l.brokerFeeCents!=null?'Deposit and broker fee recorded. Ask about any other upfront charges.':'Deposit or broker fee is unspecified. Do not treat a missing fee as zero.'}
 ];
 return {listingId:l.id,checkedAt:now.toISOString(),sample,source:l.sourceName,sourceUrl:l.canonicalUrl,capturedAt:l.capturedAt,checks,questions:[
  'Is this home still available for our move-in date?',
  ...(unknown.length||estimated.length||!costs.length?['Which utilities and recurring fees are included, and what should we budget for the rest?']:[]),
  ...(!rooms?['Can you share a floor plan with bedroom dimensions and which bathroom belongs to each room?']:[]),
  'What is the complete amount due before move-in, with each charge itemized?'
 ]};
}

// Keyless sample output, separate from real Factory receipts and cache.
export function sampleListingReview(listing:Listing):NonNullable<ListingCheck['sampleReview']>{
 if(!listing.id.startsWith('demo-'))throw new Error('Sample reviews are only available for demo homes.');
 const report=checkListing(listing);
 const gaps=report.checks.filter(c=>c.status==='review'&&c.id!=='source');
 return {provider:'sample',summary:gaps.length
  ? `Before choosing this home, clarify ${gaps.map(c=>c.label.toLowerCase()).join(', ')}. The proposed split uses the saved details; update it if the broker confirms different costs or room sizes.`
  : 'The saved room details and itemized costs support a proposed split. Confirm availability, dimensions and the complete move-in bill before everyone agrees.',
 questions:report.questions};
}
