import 'dotenv/config';
import {photonClient,projectPath,normalizeHandle} from '../src/server/photon';
async function check(){
 const api=photonClient();let pageToken:string|undefined;let count=0;let found=false;
 do{
  const page=await api.projects.listSpaces({path:projectPath(),query:{platform:'imessage',pageSize:100,...(pageToken?{pageToken}:{})}});
  for(const space of page.items){
   if(space.platform!=='imessage'||!Array.isArray(space.participantIds))continue;
   const users=await Promise.all(space.participantIds.map(userId=>api.projects.getUser({path:{...projectPath(),userId}})));
   const agent=users.find(u=>u?.kind==='agent'&&u.platform==='imessage'&&normalizeHandle(u.handle)===normalizeHandle(process.env.PHOTON_AGENT_HANDLE||''));
   if(!agent)continue;
   if(!found){console.log(`Configured line type: ${(agent.details as {type?:string}|undefined)?.type||'unknown'}`);found=true;}
   if(space.kind==='group'){count++;console.log(`Group detected: ${space.id} (${users.filter(u=>u?.kind==='human').length} people + agent)`);}
  }
  pageToken=page.nextPageToken;
 }while(pageToken);
 if(!count)console.log('No group visible for this agent. Create an iMessage group with two people and the agent, send FairRoom start, then run this check again.');
 console.log('Read-only check. No messages sent. Shared lines require provider confirmation of group support; the installed API defines SHARED_LINE_GROUP_UNSUPPORTED.');
}
check().catch(e=>{console.error(`Could not check project (HTTP ${e.status||'unavailable'}). Check credentials and project:read permission.`);process.exitCode=1;});
