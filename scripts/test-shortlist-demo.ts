import assert from 'node:assert/strict';
import {homes,suggestion,createDemoConversation,preferenceExample,parsePreferences,selectHomes,formatPreferences} from '../src/demo/shortlist';
assert.equal(homes.length,10);assert.equal(new Set(homes.map(h=>h.url)).size,10);
assert.equal(suggestion(0),suggestion(10));assert.notEqual(suggestion(0),suggestion(1));
assert.equal(parsePreferences('FairRoom preferences: room=own; bathroom=shared; sqft=900; amenities=parking; budget=NaN'),null);
const respond=createDemoConversation('selected',2,'https://example.com',1000);
let id=0;const event=(text:string,sender='one',chatId='selected',time=2000)=>({id:String(++id),chatId,text,sender,createdAt:new Date(time)});
assert.equal(respond(event('send new postings','one','other')),null);
assert.equal(respond(event('send new postings','one','selected',999)),null);
assert.equal(respond(event('ordinary group conversation')),null);
assert.match(respond(event('FairRoom start'))!,/Each of the 2/);
assert.match(respond(event(preferenceExample))!,/1 of 2/);
assert.match(respond(event(preferenceExample))!,/1 of 2/); // same person's update cannot complete the group
const final=respond(event(preferenceExample,'two'))!;
assert.equal((final.match(/https:\/\/www.zillow.com/g)||[]).length,5);
assert.match(final,/\/shortlist\?homes=/);
const command=event('send new postings');const reply=respond(command)!;
assert.match(reply,/Church Corner/);assert.equal(respond(command),null);
assert.equal(respond(event(reply)),null); // no outgoing-message loop
assert.match(respond(event('send new postings'))!,/Hanover Alewife/);
assert.match(respond(event('FairRoom start'))!,/Each of the 2/);
assert.match(respond(event(preferenceExample,'two'))!,/1 of 2/);
assert.equal(selectHomes([parsePreferences(preferenceExample)!]).length,5);
console.log('Shortlist demo: catalog, rotation, parsing, group isolation, replay prevention, independent roommate inputs, five-result handoff and loop prevention passed. No messages sent.');

const sample=parsePreferences(preferenceExample)!;assert.deepEqual(parsePreferences(formatPreferences(sample)),sample);
assert.equal(parsePreferences(formatPreferences({...sample,amenities:'laundry; budget=100'}))!.budget,1800);
assert.match(respond(event('FairRoom start'))!,/shortlist\?survey=1/);

const solo=createDemoConversation('selected',1,'https://example.com',1000);
assert.match(solo(event('FairRoom start'))!,/just one person needs to submit/);
const soloReply=solo(event(preferenceExample,'brother'))!;
assert.equal((soloReply.match(/https:\/\/www.zillow.com/g)||[]).length,5);
assert.equal(solo(event(preferenceExample,'sister')),'Everyone’s preferences are already in. Text “FairRoom start” to begin again.');
console.log('Single-respondent demo: one submission produces five listings without waiting for another roommate.');
