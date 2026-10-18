import type {Listing} from '../types';
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function injectListingPreview(html:string,listing:Listing,origin:string){
 const base=new URL(origin);if(!['http:','https:'].includes(base.protocol))throw new Error('Invalid public URL');
 const sample=listing.id.startsWith('demo-');
 const title=`${sample?'Sample · ':''}${listing.address} | FairRoom`;
 const rent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(listing.baseRentCents/100);
 const description=`${rent}/month base rent · ${listing.bedrooms} bedrooms · ${listing.neighborhood}, ${listing.city}. ${sample?'Fictional demo home; illustrative imagery.':'Saved listing; confirm availability with the broker.'}`;
 const candidate=listing.photos?.[0];
 let image=sample?new URL('/images/courtyard.webp',base).href:'';
 if(candidate&&!candidate.split('?')[0].endsWith('.svg')){try{const parsed=new URL(candidate,base);if(['http:','https:'].includes(parsed.protocol))image=parsed.href;}catch{}}
 const url=new URL(`/listing/${encodeURIComponent(listing.id)}`,base).href;
 const tags=[['og:type','website'],['og:site_name','FairRoom'],['og:title',title],['og:description',description],['og:image',image],['og:url',url]].filter(([,value])=>!!value).map(([key,value])=>`<meta property="${key}" content="${escape(value)}" />`).join('\n');
 return html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${escape(title)}</title>`).replace(/<meta\b[^>]*(?:property|name)=["'](?:og:[^"']+|description)["'][^>]*>/gi,'').replace('</head>',`${tags}\n<meta name="description" content="${escape(description)}" />\n<link rel="canonical" href="${escape(url)}" />\n</head>`);
}
