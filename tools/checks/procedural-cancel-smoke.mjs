// Check immediate cancellation without executing or sampling native geometry.
import assert from 'node:assert/strict';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
const previousWorker=globalThis.Worker;let ready,created=0,terminated=0;
globalThis.Worker=class{constructor(){created++;}postMessage(data){if(data.kind==='generate')ready();}terminate(){terminated++;}};
const client=new GenerationClient(),options={field:'procedural-object',seed:'0',width:1,height:1,x:0,y:0,z:0,span:1,packSnapshot:{resources:[]},procedural:{folder:'biomes',key:'ledges',family:'trees',index:0,variant:0}};
try{
  await assert.rejects(client.generate({...options,procedural:{...options.procedural,index:2**32}}),/Choose a native procedural/);
  for(let i=0;i<3;i++){
    const started=new Promise(resolve=>{ready=resolve;}),generation=client.generate({...options,field:['procedural-object','procedural-placement','procedural-source'][i],dimensionKey:'terrain3d'});generation.catch(()=>{});await started;client.cancel();await assert.rejects(generation,{name:'AbortError'});assert.equal(terminated,i+1);assert.equal(client.workers.size,0);
  }
  assert.equal(created,3);console.log('Procedural variant/placement/source cancellation terminates the busy worker and creates a fresh worker next time; invalid indices refuse. No geometry executed.');
}finally{client.dispose();globalThis.Worker=previousWorker;}
