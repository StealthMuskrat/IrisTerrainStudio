// Fifty stored cells / five occupied cells. Real Node worker transfers, no generation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {MeshSession} from '../../packages/voxel-renderer/mesh-session.mjs';
import {WorldRenderer} from '../../packages/voxel-renderer/world.mjs';
import {VoxelVolume} from '../../packages/voxel-renderer/volume.mjs';
import {MeshPicker} from '../../packages/voxel-renderer/picking.mjs';
import {bakeBlock} from '../../packages/voxel-renderer/models.mjs';

const workerUrl=new URL('../../packages/voxel-renderer/mesh-worker.mjs',import.meta.url).href;
const host=`import{parentPort}from'node:worker_threads';globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};await import(${JSON.stringify(workerUrl)});parentPort.on('message',data=>self.onmessage({data}));`;
const workers=[],sessions=[];
globalThis.Worker=class {
  constructor(){this.messages=[];this.worker=new NodeWorker(new URL('data:text/javascript,'+encodeURIComponent(host)));workers.push(this);this.worker.on('message',data=>{if(!this.terminated)this.onmessage?.({data});});this.worker.on('error',error=>{if(!this.terminated)this.onerror?.({message:error.message});});}
  postMessage(data){this.messages.push(data);this.worker.postMessage(data);}
  terminate(){this.terminated=true;this.worker.terminate();}
};
const createSession=(volume,models,palette,options)=>{const session=new MeshSession(volume,models,palette,options);sessions.push(session);return session;};
const block={id:'minecraft:stone',solid:true},model={id:'check:cube',elements:[{from:[0,0,0],to:[16,16,16],faces:Object.fromEntries(['north','south','west','east','up','down'].map(name=>[name,{texture:'check:pixel',cullface:name}]))}]};
const cube=await bakeBlock(block,{blockModels:()=>[{model,x:0,y:0}],texture:()=> 'check:pixel'},{add:async()=>({uv:[0,0,1,1],transparency:'opaque'})});
const glass=cube.map(quad=>({...quad,transparency:'blend',positions:quad.positions.map(point=>point.map((value,axis)=>axis===1?value*1.5:value))}));
const blocks=new Uint32Array(50);for(const index of [16,17,32,33])blocks[index]=1;blocks[49]=2;
const palette=[{id:'minecraft:air',air:true},block,{id:'check:glass'}],models=[[],cube,glass],volume=new VoxelVolume({width:50,height:1,depth:1,origin:[-17,-1,-1],blocks,palette}),originalBlocks=blocks.slice();
const compare=(actual,expected)=>{assert.equal(actual.faces,expected.faces);assert.deepEqual(actual.ranges,expected.ranges);for(const kind of ['opaque','transparent']){assert.deepEqual(new Float32Array(actual[kind]),new Float32Array(expected[kind]));for(const field of ['quads','owners'])assert.deepEqual(new Uint8Array(actual.picking[kind][field]),new Uint8Array(expected.picking[kind][field]));}};
const evidence={date:'2026-10-23',scope:'bounded section mesh cache, persistent snapshot worker, partial CPU remeshing and appearance camera retention',fixture:{storedCells:50,occupiedCells:5,generatedTerrainCells:0,sourcePixels:0},checks:[],realBrowserVerified:false,webGpuVerified:false,performanceMeasured:false,nativeParityVerified:false,complete:false};
try{
  const session=createSession(volume,models,palette),reference=createSession(volume,models,palette,{cacheByteLimit:0});
  const full=await session.build(null,1);assert.equal(full.faces,26);assert.equal(full.stats.rebuilt,5);assert.equal(full.stats.cells,50);assert.equal(new MeshPicker(volume,full).bytes,26*88);
  const cut={min:[0,0,0],max:[33,1,1]},clipped=await session.build(cut,2);compare(clipped,await reference.build(cut,1));assert.equal(clipped.faces,16);assert.equal(clipped.stats.reused,2);assert.equal(clipped.stats.rebuilt,1);assert.equal(clipped.stats.cells,16);
  const joined=await session.build(null,3);compare(joined,full);assert.equal(joined.stats.reused,5);assert.equal(joined.stats.rebuilt,0);assert.equal(joined.stats.cells,0);
  const owner=session.worker;assert.equal(owner.messages.length,3);assert.equal(owner.messages[0].blocks,blocks);for(const message of owner.messages.slice(1)){assert.equal(message.blocks,undefined);assert.equal(message.models,undefined);assert.equal(message.palette,undefined);}
  evidence.full={faces:full.faces,...full.stats};evidence.cutaway={faces:clipped.faces,...clipped.stats};evidence.returnToFull={faces:joined.faces,...joined.stats};
  evidence.checks.push('unchanged sections reused; boundary halo rebuilt and compared byte-for-byte with uncached geometry/picking','negative/unaligned origins, opaque/blended ranges and overhangs preserved','actual transferable output leaves worker cache reusable; snapshot sent only once');
  const sliced={min:[17,0,0],max:[18,1,1]},slice=await session.build(sliced,4);compare(slice,await reference.build(sliced,2));assert.equal(slice.faces,6);
  const empty=await session.build({min:[0,0,0],max:[0,1,1]},5);assert.equal(empty.faces,0);assert.equal(empty.stats.cells,0);compare(await session.build(null,6),full);
  const capped=createSession(volume,models,palette,{cacheByteLimit:4096});const limited=await capped.build(null,1);assert(limited.stats.bytes<=4096);assert(limited.stats.entries<full.stats.entries);const repeated=await capped.build(null,2);compare(repeated,full);assert(repeated.stats.rebuilt>0);assert(repeated.stats.bytes<=4096);
  const uncached=await reference.build(null,3);assert.equal(uncached.stats.entries,0);assert.equal(uncached.stats.bytes,0);compare(uncached,full);
  const pending=session.build(cut,7),rejected=assert.rejects(pending,{name:'AbortError'});session.cancel();const latest=await session.build(sliced,8);await rejected;compare(latest,slice);assert.equal(session.worker,owner);assert.equal(owner.terminated,undefined);
  const failed=session.build({min:[0,0,0],max:[51,1,1]},9);await assert.rejects(failed,/bounds/);compare(await session.build(null,10),full);
  const fatal=session.build(cut,11),fatalRejected=assert.rejects(fatal,/Controlled worker failure/);owner.onerror({message:'Controlled worker failure'});await fatalRejected;compare(await session.build(null,12),full);assert.notEqual(session.worker,owner);assert.equal(session.worker.messages[0].blocks,blocks);
  evidence.checks.push('slices/empty views, bounded LRU eviction and oversized section bypass preserve output','cancelled jobs and invalid clips cannot commit; fatal worker errors recreate the snapshot');
  // Actual WorldRenderer methods with tiny canvas/GPU services, no rasterization.
  globalThis.OffscreenCanvas=class{getContext(){return{clearRect(){},drawImage(){},getImageData:()=>({data:new Uint8ClampedArray([255,255,255,255])})};}};
  globalThis.GPUTextureUsage={TEXTURE_BINDING:1,COPY_DST:2,RENDER_ATTACHMENT:4};
  const textures=[],device={limits:{maxTextureDimension2D:64},createTexture(){const texture={destroy(){this.destroyed=true;}};textures.push(texture);return texture;},createSampler:()=>({}),queue:{writeTexture(){}}};
  const two=new VoxelVolume({width:2,height:1,depth:1,origin:[-1,-1,-1],palette:[block],blocks:new Uint32Array(2)}),stack={blockModelGroups:()=>({multipart:false,groups:[{weighted:false,variants:[{model,x:0,y:0,z:0}]}]}),blockModels:()=>[{model,x:0,y:0}],texture:()=> 'check:pixel',bitmap:async()=>({width:1,height:1,pixels:new Uint8Array([255,255,255,255]),animation:null})};
  const renderer=Object.assign(Object.create(WorldRenderer.prototype),{gpu:{device},atlas:{dispose(){}},job:0,camera:{},bind(){},draw(){},uploadMesh(mesh){if(this.failUpload)throw new Error('Controlled upload failure');this.uploads=(this.uploads||0)+1;this.lastMesh=mesh;this.clearSelection(false);},upload(){}});
  try{
    await renderer.setVolume(two,stack);assert.deepEqual(renderer.diagnostics.filter(row=>row.block===block.id),[]);const firstSession=renderer.meshSession,firstAtlas=renderer.atlas,camera=renderer.camera={yaw:.6,pitch:.3,distance:4,target:[.1,.2,.3]};
    const raw={...two};await renderer.setVolume(raw,stack);assert.equal(renderer.camera,camera);assert(firstSession.disposed);assert(firstAtlas.disposed);assert(renderer.meshStats.rebuilt>0);
    const validated=renderer.volume;await renderer.setVolume(raw,stack);assert.equal(renderer.volume,validated);assert.equal(renderer.camera,camera);
    const sameSession=renderer.meshSession,uploads=renderer.uploads;await renderer.setClip({min:[0,0,0],max:[2,1,1]});assert.equal(renderer.uploads,uploads);assert.equal(renderer.meshSession,sameSession);
    const one={min:[0,0,0],max:[1,1,1]};await renderer.setClip(one);assert.equal(renderer.meshSession,sameSession);assert.equal(renderer.faces,6);assert.equal(renderer.camera,camera);
    await renderer.setClip(null);assert.equal(renderer.meshStats.rebuilt,0);assert.equal(renderer.meshStats.cells,0);
    const previousPicker=renderer.picker,previousAtlas=renderer.atlas;renderer.failUpload=true;await assert.rejects(renderer.setVolume(raw,stack),/Controlled upload failure/);renderer.failUpload=false;assert.equal(renderer.meshSession,sameSession);assert.equal(renderer.picker,previousPicker);assert.equal(renderer.atlas,previousAtlas);assert(!sameSession.disposed);assert.equal(renderer.pendingMesh,null);assert(textures.at(-1).destroyed);
    await renderer.setClip(one);assert.equal(renderer.faces,6);
    const hold=renderer.setClip(null),holdRejected=assert.rejects(hold,{name:'AbortError'});renderer.clear();await holdRejected;assert(sameSession.disposed);assert.equal(renderer.meshSession,null);assert.equal(renderer.volume,null);
  }finally{renderer.clear();renderer.atlas?.dispose();}
  evidence.fixture.sourcePixels=1;evidence.checks.push('renderer reuses sessions across clips, skips equivalent bounds and preserves appearance camera','same committed input reuses validated volume; new atlas gets a fresh geometry cache','failed staged upload retains committed session/picker/atlas; clear disposes pending work');
  assert.deepEqual(blocks,originalBlocks);
  evidence.limits='Focused Node worker transfers and controlled renderer canvas/device only. CPU section reuse still flattens/transfers/uploads the complete visible mesh. Cache budget covers payload bytes plus per-entry allowance, not total browser/driver memory; staged snapshots can coexist. No native build, terrain generation, registry/state sweep, broad suite or GitHub workflow. Real browser/GPU and performance qualification remain pending.';
  const paths=['packages/voxel-renderer/mesh-worker.mjs','packages/voxel-renderer/mesh-session.mjs','packages/voxel-renderer/world.mjs','tools/checks/section-cache-smoke.mjs'];evidence.workspaceSha256=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await fs.readFile(new URL('../../'+path,import.meta.url))).digest('hex')])));
  await fs.writeFile(new URL('../../.local-tools/section-cache-smoke-results.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({result:'pass',fixture:evidence.fixture,full:evidence.full,cutaway:evidence.cutaway,returnToFull:evidence.returnToFull,checks:evidence.checks},null,2));
}finally{for(const session of sessions)session.dispose();for(const worker of workers)worker.terminate();delete globalThis.Worker;delete globalThis.OffscreenCanvas;delete globalThis.GPUTextureUsage;}
