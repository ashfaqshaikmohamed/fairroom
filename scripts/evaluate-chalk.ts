import 'dotenv/config';
import fs from 'node:fs';
import {interpret,intentRuntime} from '../src/server/agent';
if(process.env.AI_PROVIDER!=='chalk'||!process.env.CHALK_ROUTER_API_KEY||!process.env.CHALK_ENV_ID||!process.env.CHALK_MODEL){console.error('Configure AI_PROVIDER=chalk, CHALK_ROUTER_API_KEY, CHALK_ENV_ID, CHALK_MODEL first. No evaluation ran.');process.exit(1);}
const cases=JSON.parse(fs.readFileSync('evals/intent-cases.json','utf8'));
const results=[];
for(const c of cases){const before=intentRuntime.modelSuccesses;const started=Date.now();const actual=await interpret(c.message);
 const live=intentRuntime.modelSuccesses>before;const passed=live&&actual.action===c.action&&(!('ref'in c)||actual.ref===c.ref)&&(!('amenity'in c)||actual.amenity===c.amenity);
 results.push({id:c.id,passed,liveModel:live,actual,latencyMs:Date.now()-started});
 console.log(`${passed?'PASS':'FAIL'} ${c.id}${live?'':' (gateway did not return a validated model result)'}`);
}
const report={provider:'chalk-model-gateway',model:process.env.CHALK_MODEL,at:new Date().toISOString(),passed:results.filter(r=>r.passed).length,total:results.length,results};
fs.mkdirSync('data/evals',{recursive:true});fs.writeFileSync('data/evals/chalk-latest.json',JSON.stringify(report,null,2));
console.log(`${report.passed}/${report.total} passed. These are local evaluations of live Chalk gateway responses, not Chalk-hosted Agent Evals.`);
if(report.passed!==report.total)process.exitCode=1;
