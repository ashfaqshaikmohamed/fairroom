import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// imessage-kit 3.0.0 unconditionally selects a field absent on some macOS
// versions. The joined chat GUID remains the primary routing identity.
// This changes SDK query code only, never Apple's Messages database.
const root=path.dirname(fileURLToPath(import.meta.url));
for(const file of ['index.js','index.cjs']){
 const target=path.join(root,'node_modules/@photon-ai/imessage-kit/dist',file);
 const source=fs.readFileSync(target,'utf8');
 const before='"message.ck_chat_id as ck_chat_id"';
 const after='"NULL as ck_chat_id"';
 if(!source.includes(before)&&!source.includes(after))throw Error('SDK changed: review compatibility patch before continuing.');
 if(source.includes(before))fs.writeFileSync(target,source.replace(before,after));
}
console.log('Applied local Messages schema compatibility patch.');
