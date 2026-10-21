// Two adjacent blocks across one negative-world section boundary, plus controlled GPU calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { bakeBlock } from '../../packages/voxel-renderer/models.mjs';
import { localClip,emptyClip } from '../../packages/voxel-renderer/clip.mjs';
import { frustumPlanes,boundsVisible,visibleMeshRanges } from '../../packages/voxel-renderer/frustum.mjs';
import { MeshBufferStore } from '../../packages/voxel-renderer/mesh-buffers.mjs';
import { WorldRenderer } from '../../packages/voxel-renderer/world.mjs';
import { TextureAtlas } from '../../packages/resource-packs/atlas.mjs';
import { multiply,perspective,lookAt } from '../../packages/voxel-renderer/math.mjs';

const block={id:'check:cube',solid:true},model={id:'check:cube',elements:[{from:[0,0,0],to:[16,16,16],faces:Object.fromEntries(['north','south','east','west','up','down'].map(name=>[name,{texture:'check:pixel',cullface:name}]))}]};
const cube=await bakeBlock(block,{blockModels:()=>[{model,x:0,y:0}],texture:()=> 'check:pixel'},{add:async()=>({uv:[0,0,1,1],transparency:'opaque'})});
const blocks=new Uint32Array(34);blocks[16]=1;blocks[17]=1;const before=blocks.slice(),input={id:1,width:34,height:1,depth:1,origin:[-17,-1,-1],blocks,palette:[{id:'minecraft:air'},block],models:[[],cube]};
const workerCode=(await fs.readFile(new URL('../../packages/voxel-renderer/mesh-worker.mjs',import.meta.url),'utf8')).replace(/^import.*\n/,'');
async function mesh(extra={}){const messages=[],context=vm.createContext({self:{postMessage:data=>messages.push(data)},Float32Array,setTimeout,localClip,emptyClip});vm.runInContext(workerCode,context);await context.self.onmessage({data:{...input,...extra}});return messages.at(-1);}
const full=await mesh();assert.equal(full.faces,10);assert.equal(full.ranges.length,2);
assert.deepEqual(Array.from(full.ranges[0].section),[-1,-1,-1]);assert.deepEqual(Array.from(full.ranges[1].section),[0,-1,-1]);
assert.equal(full.ranges[0].opaque.first,0);assert.equal(full.ranges[0].opaque.count,30);assert.equal(full.ranges[1].opaque.first,30);assert.equal(full.ranges[1].opaque.count,30);
const vertices=new Float32Array(full.opaque);for(const range of full.ranges)for(let i=range.opaque.first;i<range.opaque.first+range.opaque.count;i++)for(let axis=0;axis<3;axis++)assert(vertices[i*12+axis]>=range.opaque.min[axis]&&vertices[i*12+axis]<=range.opaque.max[axis]);
const clipped=await mesh({clip:{min:[16,0,0],max:[17,1,1]}});assert.equal(clipped.faces,6);assert.equal(clipped.ranges.length,1);assert.equal((await mesh({clip:{min:[0,0,0],max:[0,1,1]}})).ranges.length,0);
const extended=cube.map(quad=>({...quad,positions:quad.positions.map(point=>point.map((value,axis)=>axis===0?value*3-1:value))}));
const overhang=await mesh({models:[[],extended],clip:{min:[16,0,0],max:[17,1,1]}});assert.equal(overhang.ranges[0].opaque.min[0],-2);assert.equal(overhang.ranges[0].opaque.max[0],1);assert.deepEqual(blocks,before);
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),planes=frustumPlanes(identity),box=(x,y,z)=>({min:[x-.1,y-.1,z-.1],max:[x+.1,y+.1,z+.1]});
assert(boundsVisible(box(0,0,.5),planes));for(const p of [[2,0,.5],[-2,0,.5],[0,2,.5],[0,-2,.5],[0,0,-.5],[0,0,1.5]])assert.equal(boundsVisible(box(...p),planes),false);
assert(boundsVisible({min:[-1,-1,0],max:[1,1,1]},planes));assert.throws(()=>frustumPlanes(new Float32Array(16).fill(NaN)),/finite/);
const camera=multiply(perspective(Math.PI/3,1,.1,10),lookAt([0,0,5],[0,0,0]));assert(boundsVisible(box(0,0,0),frustumPlanes(camera)));assert.equal(boundsVisible(box(0,0,6),frustumPlanes(camera)),false);
const allocated=[],writes=[],draws=[],passes=[],device={limits:{maxBufferSize:262144},createBuffer(options){const buffer={...options,destroyed:0,destroy(){this.destroyed++;}};allocated.push(buffer);return buffer;},queue:{writeBuffer(buffer,offset,data){assert(!buffer.destroyed);writes.push({buffer,offset,data:data.slice()});},submit(){}},createCommandEncoder(){return{beginRenderPass(){const pass={setBindGroup(){},setPipeline(){},setVertexBuffer(){},setIndexBuffer(){},draw(...args){draws.push(['opaque',...args]);},drawIndexed(...args){draws.push(['transparent',...args]);},end(){}};passes.push(pass);return pass;},finish(){return{};}};}};
const buffers=new MeshBufferStore(device,{byteLimit:196608}),first=buffers.write('opaque',new Float32Array(4),1);buffers.write('opaque',new Float32Array(2),1);assert.equal(allocated.length,1);assert.equal(buffers.reserve('opaque',0,1),first);
const grown=buffers.reserve('opaque',70000,1);assert.notEqual(grown,first);assert.equal(first.destroyed,1);buffers.reserve('indices',4,2);assert.equal(buffers.bytes,196608);assert.throws(()=>buffers.reserve('other',4,1),/budget/);assert.throws(()=>buffers.reserve('opaque',300000,1),/device/);assert.equal(buffers.slots.get('opaque').buffer,grown);buffers.dispose();buffers.dispose();assert.equal(grown.destroyed,1);assert.equal(buffers.bytes,0);assert.throws(()=>buffers.reserve('opaque',4,1),{name:'AbortError'});
globalThis.GPUBufferUsage={VERTEX:1,COPY_DST:2,INDEX:4};globalThis.GPUTextureUsage={RENDER_ATTACHMENT:1};globalThis.devicePixelRatio=1;
const data=new Float32Array(144);for(let i=0;i<12;i++){data[i*12]=(i<6?0:3);data[i*12+2]=.5;}
const inside={first:0,count:6,...box(0,0,.5)},outside={first:6,count:6,...box(3,0,.5)},ranges=[{opaque:inside,transparent:inside},{opaque:outside,transparent:outside}];
assert.equal(visibleMeshRanges(ranges,identity).opaque.length,1);
const renderer=Object.assign(Object.create(WorldRenderer.prototype),{gpu:{device},canvas:{width:2,height:2,getBoundingClientRect:()=>({width:2,height:2})},depth:{createView:()=>({})},context:{getCurrentTexture:()=>({createView:()=>({})})},uniform:{},matrices:()=>({eye:[0,0,2],matrix:identity}),ranges});
renderer.uploadMesh({opaque:data.buffer,transparent:data.buffer,ranges});const vertexBuffer=renderer.opaque,indexBuffer=renderer.transparentIndices,afterUpload=allocated.length;
renderer.draw();assert.deepEqual(draws,[['opaque',6,1,0],['transparent',6]]);assert.equal(renderer.transparentDrawCount,6);assert.deepEqual(Array.from(writes.findLast(write=>write.buffer===indexBuffer).data),[0,1,2,3,4,5]);
const sortedWrites=writes.filter(write=>write.buffer===indexBuffer).length;renderer.draw();assert.equal(writes.filter(write=>write.buffer===indexBuffer).length,sortedWrites);
// A projection-only change at the same eye must rebuild the visible blend index subset.
const shifted=identity.slice();shifted[12]=-3;renderer.matrices=()=>({eye:[0,0,2],matrix:shifted});renderer.draw();assert.deepEqual(Array.from(writes.findLast(write=>write.buffer===indexBuffer).data),[6,7,8,9,10,11]);
renderer.upload('opaque',data.subarray(0,72));renderer.upload('transparent',data.subarray(0,72));assert.equal(renderer.opaque,vertexBuffer);assert.equal(renderer.transparentIndices,indexBuffer);assert.equal(allocated.length,afterUpload);
renderer.upload('opaque',new Float32Array());renderer.upload('transparent',new Float32Array());draws.length=0;renderer.draw();assert.deepEqual(draws,[]);renderer.buffers.dispose();
const transactional=new MeshBufferStore(device);const live=transactional.reserve('opaque',4,1),originalCreate=device.createBuffer;let attempt=0;device.createBuffer=options=>{if(++attempt===2)throw new Error('Controlled GPU allocation failure');return originalCreate(options);};assert.throws(()=>transactional.reserveMany([{name:'opaque',bytes:70000,usage:1},{name:'transparent',bytes:4,usage:1}]),/Controlled GPU/);assert.equal(transactional.slots.get('opaque').buffer,live);assert.equal(live.destroyed,0);assert.equal(allocated.at(-1).destroyed,1);assert.equal(transactional.bytes,65536);device.createBuffer=originalCreate;transactional.dispose();
let uploads=0;const animation={entries:new Map([['one',{frames:[{index:0,duration:1,end:1},{index:1,duration:1,end:2},{index:1,duration:1,end:3}],cycle:3,frame:0}]]),upload(){uploads++;}};
// Use the real validated plan so this probe follows the actual animationFrame time convention.
const {textureAnimation}=await import('../../packages/resource-packs/texture-animation.mjs');Object.assign(animation.entries.get('one'),textureAnimation(1,2,{frames:[0,1,1],frametime:1}));
assert.equal(TextureAtlas.prototype.update.call(animation,0),false);assert.equal(TextureAtlas.prototype.update.call(animation,50),true);assert.equal(TextureAtlas.prototype.update.call(animation,100),false);assert.equal(uploads,1);animation.paused=true;assert.equal(TextureAtlas.prototype.update.call(animation,150),false);
const paths=['packages/voxel-renderer/world.mjs','packages/voxel-renderer/mesh-worker.mjs','packages/voxel-renderer/frustum.mjs','packages/voxel-renderer/mesh-buffers.mjs','packages/resource-packs/atlas.mjs','tools/checks/mesh-visibility-smoke.mjs'],hashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await fs.readFile(new URL('../../'+path,import.meta.url))).digest('hex')])));
const evidence={date:'2026-10-21',scope:'world-aligned mesh sections, frustum visibility, retained GPU buffers and animation redraw signals',fixture:{storedCells:34,occupiedCells:2,sections:2,fullFaces:10,clippedFaces:6,sourcePixels:0},checks:['negative world section alignment and cross-section neighbor culling','contiguous draw ranges bound actual float32 geometry including overhangs','clipping retains exposed model faces without modifying blocks','WebGPU zero-to-one near/far and side-plane visibility','opaque range draws and visible transparent face indices','projection-only blend subset refresh and unchanged-view sort reuse','buffer capacity reuse, atomic allocation failure, bounded growth, empty uploads and idempotent disposal','animation signals only changed referenced images'],workspaceSha256:hashes,browserVerified:false,webGpuVerified:false,performanceMeasured:false,minecraftClientParityVerified:false,complete:false,limits:'Controlled Node worker/device/animation probes only; no native build, terrain generation, registry/state sweep, broad suite or GitHub workflow.'};
await fs.writeFile(new URL('../../docs/evidence/mesh-visibility-batch-2026-10-21.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({result:'pass',fixture:evidence.fixture,checks:evidence.checks},null,2));
