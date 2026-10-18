import fs from 'node:fs';
const file='data/broker-snapshots.json';const listings=JSON.parse(fs.readFileSync(file,'utf8'));const results=[];
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
for(const l of listings){
 try{
  const response=await fetch(l.canonicalUrl,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('HTTP '+response.status);
  const html=await response.text();const section=html.match(/<section id="features">([\s\S]*?)<\/section>/)?.[1];
  if(!section)throw Error('No structured listing details');
  const detail=clean(section);const rent=detail.match(/Monthly Rent:\s*\$([\d,]+)/);if(!rent)throw Error('No rent');
  const stamp=new Date().toISOString();l.baseRentCents=Number(rent[1].replaceAll(',',''))*100;l.capturedAt=stamp;l.catalogRevision=3;
  const beds=detail.match(/(Studio|\d+) Bedroom/i);if(beds)l.bedrooms=/studio/i.test(beds[1])?0:Number(beds[1]);
  const baths=detail.match(/([\d.]+) Bathroom/);if(baths)l.bathrooms=Number(baths[1]);
  const date=detail.match(/Available\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(date)l.availableDate=`${date[3]}-${date[1].padStart(2,'0')}-${date[2].padStart(2,'0')}`;
  const phone=clean(html).match(/Call\s+(\d{3}[.-]\d{3}[.-]\d{4})/);if(phone)l.contact.phone='+1'+phone[1].replace(/\D/g,'');
  for(const [key,yes,no] of [['cats_allowed',/Cats Allowed/i,/No Cats Allowed/i],['dogs_allowed',/Dogs Allowed/i,/No Dogs Allowed/i],['in_unit_laundry',/(?:Washer|Laundry) in (?:Unit|Apartment)/i,null],['dishwasher',/Dishwasher/i,null],['parking_available',/Off Street Parking|Garage Parking/i,null]]){
   if(no?.test(detail))l.amenities[key]={value:false,provenance:'Broker detail page'};
   else if(yes.test(detail))l.amenities[key]={value:true,provenance:'Broker detail page; confirm terms and extra charges'};
  }
  l.rawAuditRecord.originalCapturedText=detail;l.rawAuditRecord.verifiedBy='Public broker details refreshed; availability not independently confirmed';
  results.push({id:l.id,status:'refreshed'});
 }catch(e){results.push({id:l.id,status:'retained',reason:e.message});}
 if(results.length%20===0)console.log(`${results.length}/${listings.length} checked`);
 await new Promise(r=>setTimeout(r,180));
}
fs.writeFileSync(file,JSON.stringify(listings,null,2)+'\n');fs.writeFileSync('data/catalog-refresh-report.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
console.log(JSON.stringify({total:listings.length,refreshed:results.filter(r=>r.status==='refreshed').length,retained:results.filter(r=>r.status==='retained').length}));
