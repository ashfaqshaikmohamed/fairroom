import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parse} from 'dotenv';
// Only the public example configuration and HTTP responses are inspected.
const dir=mkdtempSync(path.join(tmpdir(),'fairroom-demo-smoke-'));
const env:NodeJS.ProcessEnv={...process.env,...parse(readFileSync('.env.example')),DOTENV_CONFIG_PATH:'/dev/null',FAIRROOM_DATA_DIR:dir,DISABLE_HMR:'true'};
const port=process.env.TEST_PORT||env.PORT||'3000';
env.PORT=port;
const child=spawn(process.execPath,['--import','tsx','server.ts'],{env,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
async function call(url:string,method='GET',body?:unknown,token=''){
 const r=await fetch(`http://127.0.0.1:${port}/api${url}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal(r.status,200,`${method} ${url}: ${r.status}`);return r.json();
}
try{
 for(let i=0;i<100&&!logs.includes('server running');i++){if(child.exitCode!==null)throw Error('Demo server failed to start: '+logs);await new Promise(r=>setTimeout(r,100));}
 assert.ok(logs.includes(`http://localhost:${port}`),'default quick-start server starts');
 const tokens:Record<string,string>={};
 for(const [id,name] of [['member-maya','Alex'],['member-sam','Sam'],['member-leo','Jordan']]){
  const session=await call('/demo/session','POST',{memberId:id});tokens[id]=session.sessionToken;
  const {member,survey}=await call('/survey','GET',undefined,tokens[id]);
  assert.equal(member.displayName,name);assert.match(member.phoneNumber,/^\+1555555010[123]$/);
  await call('/survey','PUT',{...survey,isReady:true,phoneAlertsOptIn:false},tokens[id]);
  console.log(`PASS ${name}: session, fake phone, survey read and save`);
 }
 const token=tokens['member-sam'],base='/groups/group-elm-trio';
 const matches=await call(base+'/matches','GET',undefined,token);assert.equal(matches.fitsEveryone.length,5);
 const split=await call('/listings/demo-courtyard/rent-split','POST',{groupId:'group-elm-trio'},token);
 assert.equal(split.proposal.canCalculate,true);assert.equal(split.proposal.assignments.reduce((s:number,a:any)=>s+a.totalMonthlyShareCents,0),384000);
 assert.deepEqual(split.proposal.assignments.map((a:any)=>a.memberDisplayName).sort(),['Alex','Jordan','Sam']);
 console.log('PASS five matching homes and exact $3,840 split for Alex, Sam and Jordan');
 for(const text of ['split C1','like C1','saved'])await call(base+'/messages','POST',{text},token);
 const {messages}=await call(base+'/messages','GET',undefined,token);
 assert.equal(messages.filter((m:any)=>m.listingRefId).length>=5,true);
 assert.ok(messages.some((m:any)=>m.text.includes('proposed split v')));
 assert.ok(messages.some((m:any)=>m.text.includes('Your saved homes')));
 assert.ok(messages.every((m:any)=>m.transport!=='photon'));
 console.log('PASS scout recommendations, chat split, save/retrieve and web-only delivery');
 await call('/demo/reset','POST',{});
 const next=await call('/demo/session','POST',{memberId:'member-sam'});
 assert.equal((await call('/survey','GET',undefined,next.sessionToken)).member.displayName,'Sam');
 console.log('PASS reset preserves the routable demo household');
 assert.ok(!logs.includes('Spectrum started'));
 console.log('PASS fresh demo starts on port '+port+' without a messaging bridge');
}finally{child.kill('SIGTERM');await new Promise<void>(r=>child.exitCode!==null?r():child.once('exit',()=>r()));rmSync(dir,{recursive:true,force:true});}
