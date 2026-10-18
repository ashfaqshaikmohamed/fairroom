import {spawnSync} from 'node:child_process';
import {renameSync,writeFileSync} from 'node:fs';
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','vite.shortlist.config.ts'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
renameSync('shortlist-dist/shortlist.html','shortlist-dist/index.html');
writeFileSync('shortlist-dist/vercel.json',JSON.stringify({version:2,framework:null,rewrites:[{source:'/shortlist',destination:'/index.html'}]},null,2)+'\n');
console.log('Static demo ready in shortlist-dist/. Deploy that directory only. The Messages listener remains on your Mac.');
