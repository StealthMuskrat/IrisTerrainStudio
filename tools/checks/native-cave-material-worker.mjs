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

const stageResources=resources.map(resource=>({...resource})),stageDimension=JSON.parse(stageResources[0].text);stageDimension.caveLavaHeight=64;stageDimension.caveProfile={enabled:true,allowLava:false,verticalRange:{min:2,max:96}};stageResources[0].text=JSON.stringify(stageDimension);
const request={...options,field:'cave-stage',packSnapshot:{resources:stageResources}};
await sandbox.onmessage({data:{kind:'generate',id:1,options:request}});
const message=messages.findLast(row=>row.id===1&&row.kind!=='progress');assert.ok(message&&!message.error,message?.error);const result=message.result,volume=result.volume,blocks=new Uint32Array(volume.blocks),expected=JSON.parse(context.awaitedApi.paintDimensionCaveChunk(16,-16));
assert.equal(result.scope,'iris-dimension-cave-material-stage-development');assert.equal(volume.metadata.scope,'native-dimension-cave-material-stage-development');assert.equal(volume.metadata.completePipeline,false);assert.equal(volume.metadata.markerSource,'dimension-profile');assert.equal(volume.metadata.markerWindowChunks,5);assert.equal(volume.height,384);assert.deepEqual(Array.from(volume.origin),[16,-64,-16]);assert.equal(blocks.length,98304);assert.deepEqual(Array.from(blocks),expected.cells);assert.deepEqual(Array.from(volume.palette,block=>block.stateKey),expected.palette);
const air=volume.palette.find(block=>block.id==='minecraft:cave_air');assert.ok(air);assert.equal(air.air,true);
for(const block of volume.palette){const descriptor=JSON.parse(context.awaitedApi.registryRenderingState(block.stateKey));assert.equal(block.air,descriptor.air);assert.equal(block.nativeFlags,descriptor.nativeFlags);assert.deepEqual(JSON.parse(JSON.stringify(block.properties)),descriptor.properties);}
const checked=new VoxelVolume({...volume,origin:Array.from(volume.origin),palette:Array.from(volume.palette),blocks});assert.equal(checked.worldBlock(16,-64,-16).id,'minecraft:bedrock');
await sandbox.onmessage({data:{kind:'generate',id:2,options:{...request,packSnapshot:{resources}}}});assert.match(messages.findLast(row=>row.id===2).error,/disabled/);
const pending=sandbox.onmessage({data:{kind:'generate',id:3,options:request}});await sandbox.onmessage({data:{kind:'cancel',id:3}});await pending;assert.equal(messages.some(row=>row.id===3&&row.kind==='result'),false);
const savedWorker=globalThis.Worker;let client;
try{
 globalThis.Worker=class{constructor(){clientReceiver=event=>this.onmessage?.(event);}postMessage(data){sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){clientReceiver=null;}};
 client=new GenerationClient();const generated=await client.generate(request);assert.ok(generated.volume.blocks instanceof Uint32Array);assert.equal(generated.volume.blocks.length,98304);assert.equal(client.cacheBytes,393216);const count=messages.length;assert.equal(await client.generate(request),generated);assert.equal(messages.length,count);
}finally{client?.dispose();globalThis.Worker=savedWorker;}
console.log('Focused native cave material worker linkage passed: 98,304 native cells, world-Y origin, cave-air metadata, disabled-profile refusal, cancellation and actual-Wasm client transfer/cache reuse. No browser/GPU qualification is implied.');
