import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRooms,cappedAllocation} from './groupPlan';
import {normalizeProfile} from './matching';
import {calculateRentSplit} from './rentSplit';
const fixture=JSON.parse(readFileSync('data/demo-fixtures.json','utf8'));
const people=fixture.members.map((m:any)=>({...m,survey:{...m.survey,isReady:true}}));
const profiles=people.map((m:any)=>normalizeProfile(m));const home=fixture.sampleHomes[0];
const plan=planRooms(home,profiles);assert.equal(plan.status,'feasible');assert.equal(plan.assignments.reduce((s,a)=>s+a.totalCents,0),384000);
for(const a of plan.assignments)assert.ok(a.totalCents<=profiles.find((p:any)=>p.memberId===a.memberId).privateCapCents);
assert.deepEqual(plan,planRooms(home,[...profiles].reverse()),'input ordering must not alter assignments');
assert.equal(planRooms(home,profiles.map((p:any)=>({...p,privateCapCents:100000}))).status,'infeasible');
assert.equal(planRooms(home,profiles.map((p:any)=>({...p,privateBathroom:'required'}))).status,'infeasible');
assert.equal(planRooms(home,profiles.map((p:any)=>({...p,minimumBedroomSqFt:1000}))).status,'infeasible');
assert.equal(planRooms(home,profiles.map((p:any)=>({...p,minimumHomeSqFt:1500}))).status,'infeasible');
const unknown={...home,rooms:undefined};assert.equal(planRooms(unknown,profiles).status,'unknown');
const split=calculateRentSplit(home,people,{mode:'budget_fit'});assert.equal(split.isFeasibleForGroup,true);
assert.deepEqual(split.assignments.map(a=>a.totalMonthlyShareCents).sort(),plan.assignments.map(a=>a.totalCents).sort());
for(let n=2;n<=6;n++)for(let total=1;total<200;total++){
 const caps=Array.from({length:n},(_,i)=>Math.ceil(total/n)+i);const allocation=cappedAllocation(total,Array.from({length:n},(_,i)=>total*(i+1)/(n*(n+1)/2)),caps)!;
 assert.ok(allocation);assert.equal(allocation.reduce((a,b)=>a+b,0),total);assert.ok(allocation.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=caps[i]));
}
console.log('Room planner passed: individual budgets, size/bath constraints, missing data, deterministic assignments, rent integration and 995 cent-conservation cases.');
