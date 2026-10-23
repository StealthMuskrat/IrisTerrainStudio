// Four authored, two-block-high destinations; no native generation or registry scan.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {Worker} from 'node:worker_threads';
import {chunkAreaPlan,admitChunkAreaHeight,generateChunkArea,chunkAreaTransfers,chunkAreaMetadataCharge,CHUNK_AREA_FIELDS} from '../../packages/iris-engine/chunk-area.mjs';
import {regionBufferBytes,regionColumnCharge} from '../../packages/shared/region-columns.mjs';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
import {VoxelVolume} from '../../packages/voxel-renderer/volume.mjs';
import {prepareCellView} from '../../packages/voxel-renderer/cell-view.mjs';
import {MeshPicker} from '../../packages/voxel-renderer/picking.mjs';
import {previewSetup} from '../../apps/web/lib/view-library.mjs';
const info={minHeight:64,maxHeight:66},originals=[],progress=[],plan=chunkAreaPlan({field:'terrain-mode',x:0,z:0,chunkArea:{width:2,depth:2}});
assert.deepEqual(plan,{x:-16,z:-16,width:2,depth:2,count:4});
function destination(x,z,i){
  const palette=[{id:'authored:stone',properties:{axis:'x'}},{id:'authored:moss',properties:{}}];if(i&1)palette.reverse();
  const blocks=Uint32Array.from({length:512},(_,at)=>(at%16<8?0:1)^(i&1)),biomes={palette:i&1?['authored:wet','authored:dry']:['authored:dry','authored:wet'],cells:Uint16Array.from({length:512},(_,at)=>(at%16<8?0:1)^(i&1))};
  originals.push({blocks,before:blocks.slice()});
  let regions={scope:'native-engine-region-columns',dimension:'authored:dimension',palette:['authored:region-'+i],cells:new Uint16Array(256)};
  if(i===1)regions={scope:'native-engine-region-spans',dimension:'authored:dimension',height:2,palette:['authored:region-1','authored:upper'],offsets:Uint32Array.from({length:257},(_,at)=>at*2),starts:Uint16Array.from({length:512},(_,at)=>at%2),cells:Uint16Array.from({length:512},(_,at)=>at%2)};
  return {field:'terrain-mode',seed:'1',sourceCommit:'authored-source',scope:'authored-area-fixture',volume:{width:16,height:2,depth:16,origin:[x,64,z],palette,blocks:blocks.buffer,biomes:{palette:biomes.palette,cells:biomes.cells.buffer},regions,metadata:{scope:'authored-destination',mode:'SUPERFLAT',terrainInfo:info,hydrology:{wetSources:i},tilePayloads:[{position:[x,64,z],propertiesJson:'{"exact":9007199254740993}'}]}}};
}
const result=await generateChunkArea(plan,destination,{onProgress:value=>progress.push(value)}),typed={...result.volume,blocks:new Uint32Array(result.volume.blocks),biomes:{...result.volume.biomes,cells:new Uint16Array(result.volume.biomes.cells)}},volume=new VoxelVolume(typed);
assert.deepEqual(progress,[.25,.5,.75,1]);assert.deepEqual(volume.origin,[-16,64,-16]);assert.equal(volume.width,32);assert.equal(volume.depth,32);assert.equal(volume.palette.length,2);assert.deepEqual(volume.biomes.palette,['authored:dry','authored:wet']);
for(const [x,z]of [[0,0],[15,0],[16,0],[31,31],[0,31]]){
  assert.equal(volume.block(x,0,z).id,(x&15)<8?'authored:stone':'authored:moss');assert.equal(volume.biome(x,0,z),(x&15)<8?'authored:dry':'authored:wet');
  const owner=Math.floor(x/16)+2*Math.floor(z/16);assert.equal(volume.metadataAt(x,0,z).hydrology.wetSources,owner);assert.equal(volume.region(x,0,z),'authored:region-'+owner);
}
assert.equal(volume.region(16,1,0),'authored:upper');assert.equal(volume.region(0,1,0),'authored:region-0');
assert.equal(volume.raycast([1.5,70,1.5],[0,-1,0],16).metadata.hydrology.wetSources,3);
assert.equal(chunkAreaTransfers(result).length,5);for(const row of originals)assert.deepEqual(row.blocks,row.before);
const moduleUrl=new URL('../../packages/voxel-renderer/mesh-worker.mjs',import.meta.url).href,host=`import{parentPort}from'node:worker_threads';globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};await import(${JSON.stringify(moduleUrl)});parentPort.on('message',data=>self.onmessage({data}));`,worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(host)));
try{
 const cells=prepareCellView(volume,'blocks'),mesh=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',message=>{if(message.id!==1||message.kind==='progress')return;message.error?reject(Error(message.error)):resolve(message);});worker.postMessage({id:1,width:32,height:2,depth:32,origin:volume.origin,blocks:volume.blocks,biomes:volume.biomes,regions:volume.regions,models:cells.models,palette:cells.palette,cellColors:cells.cellColors});});
 const hit=new MeshPicker(volume,mesh).raycast([1.5,70,1.5],[0,-1,0],16,{alpha:()=>1});assert(hit);assert.equal(hit.metadata.hydrology.wetSources,3);assert.deepEqual(hit.metadata.tilePayloads[0].position,[0,64,0]);assert.equal(hit.region,'authored:region-3');
}finally{await worker.terminate();}
assert.throws(()=>chunkAreaPlan({field:'terrain',x:0,z:0,chunkArea:{width:2,depth:2}}),/registered terrain/);
assert.throws(()=>chunkAreaPlan({field:'terrain-mode',x:30_000_000,z:0}),/coordinate/);
assert.throws(()=>admitChunkAreaHeight({count:16},4096),/cell budget/);
await assert.rejects(generateChunkArea(plan,(x,z,i)=>({...destination(x,z,i),volume:{...destination(x,z,i).volume,origin:[x+1,64,z]}})),/incomplete destination/);
await assert.rejects(generateChunkArea(plan,(x,z,i)=>{const value=destination(x,z,i);if(i===1)delete value.volume.biomes;return value;}),/physical biomes/);
let current=true,calls=0;await assert.rejects(generateChunkArea(plan,(x,z,i)=>{calls++;current=false;return destination(x,z,i);},{isCurrent:()=>current}),{name:'AbortError'});assert.equal(calls,1);
const changed=structuredClone(typed);changed.metadata.chunkArea.chunks[1].origin[0]++;assert.throws(()=>new VoxelVolume(changed),/destination metadata/);
const previous=globalThis.Worker;let dispatched=0,terminated=0,client;
try{
 globalThis.Worker=class{postMessage(data){dispatched++;queueMicrotask(()=>this.onmessage?.({data:{id:data.id,kind:'result',result:structuredClone(result)}}));}terminate(){terminated++;}};
 client=new GenerationClient();const request={field:'terrain-mode',seed:'1',x:0,y:64,z:0,width:16,height:16,span:16,chunkArea:{width:2,depth:2},dimensionKey:'authored',packSnapshot:{resources:[]}};
 const value=await client.generate(request);assert.equal(await client.generate(request),value);assert.equal(dispatched,1);assert.equal(client.cacheBytes,value.volume.blocks.byteLength+value.volume.biomes.cells.byteLength+regionBufferBytes(value.volume.regions)+regionColumnCharge(value.volume.regions)+chunkAreaMetadataCharge(value.volume));
 await assert.rejects(client.generate({...request,chunkArea:{width:5,depth:1}}),/chunk area/);assert.equal(dispatched,1);
}finally{client?.dispose();globalThis.Worker=previous;}
const source=await fs.readFile('apps/web/main.mjs','utf8'),controls=new Map(),get=id=>{if(!controls.has(id))controls.set(id,{value:'',getBoundingClientRect:()=>({width:100,height:100})});return controls.get(id);};
for(const [id,value]of Object.entries({'field-mode':'terrain-mode',seed:'1','coordinate-x':'0','coordinate-z':'0','slice-y':'64','preview-span':'256',resolution:'256','chunk-area':'2','dimension-select':'dimensions/authored.json'}))get(id).value=value;
const context=vm.createContext({$:get,state:{},CHUNK_AREA_FIELDS,resourceId:name=>name.slice(11,-5)});vm.runInContext(source.slice(source.indexOf('function previewOptions(){'),source.indexOf('\nlet gpuOpenSequence')),context);const options=context.previewOptions();assert.deepEqual({...options.chunkArea},{width:2,depth:2});assert.equal(options.width,16);assert.equal(options.span,16);
const setup={field:'terrain-mode',seed:'1',x:0,z:0,y:64,span:256,resolution:256,chunks:4,dimension:'dimensions/authored.json',resource:null,style:null,grid:false,studioLayout:false,palette:'terrain',view:'world'};assert.equal(previewSetup(setup).chunks,4);const old={...setup};delete old.chunks;assert.equal(previewSetup(old).chunks,undefined);assert.throws(()=>previewSetup({...setup,chunks:3}),/chunk edge/);
const report={date:'2026-10-23',result:'pass',authoredDestinations:4,storedCells:2048,negativeOriginAndSeams:true,blockAndBiomePaletteRemapping:true,compressedMixedRegionMetadata:true,perDestinationInspectionAndTiles:true,actualNodeMeshPicker:true,sourceBuffersRetained:true,cellAdmissionBeforeAllocation:true,partialBiomeRefusal:true,cancelledAreaNotPublished:true,clientCacheAndMetadataCharge:true,controlsAndSavedSetups:true,legacySetupsRemainSingleChunk:true,browserVerified:false,webGpuVerified:false,nativeParityVerified:false};await fs.writeFile('.local-tools/chunk-area-smoke-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
