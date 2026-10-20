// Focused message-path check: actual Wasm and registry, Node-hosted worker script; no browser/GPU claim.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {VoxelVolume} from '../../packages/voxel-renderer/volume.mjs';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack');
const names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'];
const resources=await Promise.all(names.map(async path=>({path,text:await fs.readFile(fixture+'/'+path,'utf8')})));
const dimension=JSON.parse(resources[0].text);dimension.dimensionHeight={min:-64,max:320};resources[0].text=JSON.stringify(dimension);
const messages=[],scripts=new Map();let context,clientReceiver=null;
const sandbox={performance,crypto:webcrypto,TextDecoder,TextEncoder,DataView,ArrayBuffer,Uint8Array,Float64Array,WebAssembly,WeakRef,FinalizationRegistry,setTimeout,clearTimeout,console,Response,
  Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){const key='runtime-'+scripts.size;scripts.set(key,new TextDecoder().decode(blob.parts[0]));return key;},revokeObjectURL(key){scripts.delete(key);}},
  fetch:async url=>{if(!url.startsWith('/app/'))throw new Error('Unexpected worker fetch');return new Response(await fs.readFile(path.join(root,'apps/web',url.slice(5))));},
  importScripts:url=>vm.runInContext(scripts.get(url),context),postMessage:data=>{messages.push(data);clientReceiver?.({data});}};
sandbox.self=sandbox;context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);
context.awaitedApi=(await vm.runInContext('engine()',context)).api;
const options={seed:'1',dimensionKey:'terrain3d',packSnapshot:{resources},width:2,height:2,x:16,y:64,z:-16,span:32,buffet:false};
for(const[id,field]of ['terrain','biomes','density'].entries()){
  await sandbox.onmessage({data:{kind:'generate',id:id+1,options:{...options,field}}});const message=messages.findLast(row=>row.id===id+1&&row.kind!=='progress');assert.ok(message&&!message.error,message?.error);const result=message.result,values=new Float64Array(result.values);assert.equal(values.length,4);assert.equal(result.terrainInfo.minHeight,-64);assert.equal(result.terrainInfo.maxHeight,320);
  for(let row=0;row<2;row++)for(let column=0;column<2;column++){
    const x=options.x-options.span/2+(column+.5)*options.span/2,z=options.z-options.span/2+(row+.5)*options.span/2;
    const expected=vm.runInContext(field==='terrain'?`decode((awaitedApi).sampleTerrainHeight(${x},${z}))-64`:field==='biomes'?`(awaitedApi).sampleTerrainBiome(${x},${z})`:`(awaitedApi).sampleTerrainOccupancy(${x},${options.y},${z})`,context);
    assert.equal(field==='biomes'?result.categories[values[row*2+column]]:values[row*2+column],expected);
  }
  if(field==='density')assert.deepEqual(Array.from(result.categories),['Unshaped column','Empty','Solid']);
}
const stageResources=resources.map(resource=>({...resource})),stageBiome=JSON.parse(stageResources[2].text);stageBiome.layers=[{palette:[{block:'minecraft:oak_log',data:{axis:'x'}}],minHeight:1,maxHeight:1}];stageResources[2].text=JSON.stringify(stageBiome);
await sandbox.onmessage({data:{kind:'generate',id:4,options:{...options,field:'terrain-stage',packSnapshot:{resources:stageResources}}}});
const stageMessage=messages.findLast(row=>row.id===4&&row.kind!=='progress');assert.ok(stageMessage&&!stageMessage.error,stageMessage?.error);const volume=stageMessage.result.volume,blocks=new Uint32Array(volume.blocks),expected=JSON.parse(context.awaitedApi.paintTerrainChunk(16,-16));assert.equal(volume.height,384);assert.deepEqual(Array.from(volume.origin),[16,-64,-16]);assert.equal(blocks.length,98304);assert.deepEqual(Array.from(blocks),expected.cells);assert.deepEqual(Array.from(volume.palette,block=>block.stateKey),expected.palette);
for(const block of volume.palette){const descriptor=JSON.parse(context.awaitedApi.registryRenderingState(block.stateKey));assert.equal(block.air,descriptor.air);assert.equal(block.nativeFlags,descriptor.nativeFlags);assert.deepEqual(JSON.parse(JSON.stringify(block.properties)),descriptor.properties);}
assert.equal(volume.palette.find(block=>block.id==='minecraft:oak_log').properties.axis,'x');const checked=new VoxelVolume({...volume,origin:Array.from(volume.origin),palette:Array.from(volume.palette),blocks});assert.equal(checked.worldBlock(16,-64,-16).id,'minecraft:bedrock');assert.equal(checked.metadata.completePipeline,false);
const savedWorker=globalThis.Worker;let client;
try{
  globalThis.Worker=class{constructor(){clientReceiver=event=>this.onmessage?.(event);}postMessage(data){sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){clientReceiver=null;}};
  client=new GenerationClient();const request={...options,field:'terrain-stage',packSnapshot:{resources:stageResources}},generated=await client.generate(request);assert.ok(generated.volume.blocks instanceof Uint32Array);assert.equal(generated.volume.blocks.length,98304);assert.equal(client.cacheBytes,393216);const count=messages.length;assert.equal(await client.generate(request),generated);assert.equal(messages.length,count);
}finally{client?.dispose();globalThis.Worker=savedWorker;}
console.log('Focused native worker messages passed: 12 scalar samples, a 98,304-cell material-stage volume, canonical properties, tall-volume inspection, and actual-Wasm client transfer/cache reuse. No browser/GPU qualification is implied.');
