import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'fairroom-enroll-'));process.env.FAIRROOM_DATA_DIR=dir;process.env.PUBLIC_APP_URL='https://fairroom.example';process.env.PHOTON_PROJECT_ID='pho_prj_test';process.env.DEMO_MODE='false';
const {getDb}=await import('../src/server/db');const {initAgent}=await import('../src/server/agent');const {handleEnrollment}=await import('../src/server/photonEnrollment');const db=await getDb();initAgent(db);
const users:any={a:{id:'a',platform:'imessage',kind:'agent',handle:'+15555550100',details:{type:'dedicated'}},m:{id:'m',platform:'imessage',kind:'human',handle:'+15555550101',details:{}},s:{id:'s',platform:'imessage',kind:'human',handle:'+15555550102',details:{}},x:{id:'x',platform:'imessage',kind:'human',handle:'+15555550199',details:{}}};
const sent:any[]=[];const api:any={projects:{getSpace:async({path:p}:any)=>({id:p.spaceId,platform:'imessage',kind:p.spaceId==='group'?'group':'direct',participantIds:p.spaceId==='group'?['a','m','s']:['a',p.spaceId]}),getUser:async({path:p}:any)=>users[p.userId],sendMessage:async(o:any)=>{sent.push(o);return {id:'out'+sent.length,status:'delivered'};}}};
function msg(id:string,space:string,who:string,text:string){return {id,space:{id:space},sentBy:users[who],content:{text}};}
try{
 await handleEnrollment(db,api,msg('1','group','m','FairRoom start'));assert.equal(sent.length,1);assert.ok(!sent[0].body.content.text.includes('/join/'),'no private token in group');
 const row=db.exec('SELECT code,group_id FROM photon_enrollment')[0].values[0];
 await handleEnrollment(db,api,msg('1','group','m','FairRoom start'));assert.equal(sent.length,1,'deduplicate repeated inbound');
 await handleEnrollment(db,api,msg('2','x','x',`join ${row[0]} Outsider`));assert.equal(sent.length,1,'group code alone cannot grant access');
 await handleEnrollment(db,api,msg('3','m','m',`join ${row[0]} Maya`));assert.equal(sent.length,2);assert.ok(sent[1].body.content.text.includes('/join/inv_'));
 const member=db.exec('SELECT display_name,survey_json FROM members WHERE group_id=? AND phone_number=?',[row[1],users.m.handle])[0].values[0];assert.equal(member[0],'Maya');assert.equal(member[1],null,'onboarding does not fabricate preferences or consent');
 users.s.handle='+15555550104';await assert.rejects(()=>handleEnrollment(db,api,msg('4','m','m',`join ${row[0]}`)));assert.equal(sent.length,2,'roster changes block private invites');
 console.log('Photon enrollment passed: start, private forms, deduplication, outsider rejection, opt-in and roster verification.');
}finally{db.close();rmSync(dir,{recursive:true,force:true});}
