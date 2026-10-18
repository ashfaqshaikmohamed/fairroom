import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'fairroom-agent-demo-'));
process.env.FAIRROOM_DATA_DIR=dir;
process.env.PUBLIC_APP_URL='https://example.test';
process.env.OPENAI_API_KEY='';
const {getDb,updateScoutState}=await import('../src/server/db');
const {answerAgent,interpret,initAgent}=await import('../src/server/agent');
const db=await getDb();initAgent(db);
const originalFetch=globalThis.fetch;
try {
 for(const r of db.exec('SELECT id,survey_json FROM members WHERE group_id=?',['group-elm-trio'])[0].values){
  const survey=JSON.parse(String(r[1]));survey.isReady=true;
  db.run('UPDATE members SET survey_json=? WHERE id=?',[JSON.stringify(survey),r[0]]);
 }
 updateScoutState(db,'group-elm-trio',true,null,[]);
 db.run('INSERT INTO groups VALUES (?,?,?,0,1,?)',['test-real','Actual roommates','real-a',new Date().toISOString()]);
 const survey=JSON.parse(String(db.exec('SELECT survey_json FROM members WHERE id=?',['member-sam'])[0].values[0][0]));
 survey.isReady=true;survey.hardMustHaves=[];survey.optionalNiceToHaves=[];
 for(const id of ['real-a','real-b'])db.run('INSERT INTO members (id,group_id,invite_token,display_name,is_organizer,survey_json,created_at) VALUES (?,?,?,?,?,?,?)',[id,'test-real',id,id,id==='real-a'?1:0,JSON.stringify(survey),new Date().toISOString()]);
 updateScoutState(db,'test-real',true,null,[]);
 const realReply=await answerAgent(db,'test-real','real-a','find one home');
 assert.ok(!realReply.includes('/listing/demo-'),'real household must never receive fictional homes');
 assert.ok(realReply.includes('confirm')||realReply.includes('No home'),'real recommendations preserve uncertainty');
 const ask=(text:string)=>answerAgent(db,'group-elm-trio','member-sam',text);
 const homes=await ask('FairRoom find homes');
 assert.equal((homes.match(/https:\/\/example.test\/listing\//g)||[]).length,5);
 assert.match(await ask('FairRoom split C1'),/proposed split/);
 await ask('FairRoom like C1');
 assert.match(await ask('FairRoom saved'),/C1/);
 await ask('FairRoom pass C1');
 assert.match(await ask('FairRoom saved'),/No saved homes/);
 process.env.AI_PROVIDER='chalk';process.env.CHALK_ROUTER_API_KEY='test-only';process.env.CHALK_ENV_ID='test-env';process.env.CHALK_MODEL='test-model';
 globalThis.fetch=async (url,options)=>{
  assert.equal(url,'https://api.chalk.ai/v1/router/responses');
  assert.equal((options!.headers as Record<string,string>)['X-Chalk-Env-Id'],'test-env');
  assert.equal(JSON.parse(String(options!.body)).model,'test-model');
  return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({action:'search',ref:'',amenity:'',required:true})}]}]}));
 };
 assert.equal((await interpret('Can you show me somewhere we can live?')).action,'search');
 globalThis.fetch=async()=>new Response('',{status:503});
 assert.equal((await interpret('find homes')).action,'search');
 console.log('PASS: top five, split, save/retrieve/pass, Chalk request routing, outage fallback. No live messages or paid API calls.');
}finally{globalThis.fetch=originalFetch;db.close();rmSync(dir,{recursive:true,force:true});}
