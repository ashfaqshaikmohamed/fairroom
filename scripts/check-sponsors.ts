import 'dotenv/config';
import {existsSync} from 'node:fs';
import path from 'node:path';
const configured=(key:string)=>!!process.env[key];
console.log('Factory:',JSON.stringify({key:configured('FACTORY_API_KEY'),enabled:process.env.FACTORY_ENABLED==='true',cli:existsSync(process.env.FACTORY_DROID_PATH||path.resolve('node_modules/.bin/droid'))}));
console.log('Chalk:',JSON.stringify({selected:process.env.AI_PROVIDER==='chalk',key:configured('CHALK_ROUTER_API_KEY'),environment:configured('CHALK_ENV_ID'),model:configured('CHALK_MODEL')}));
console.log('Configuration check only. No API requests, messages, or charges.');
