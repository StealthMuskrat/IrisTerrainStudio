import {loadMeshWorkerHost} from './mesh-worker-host.mjs';
const {source:meshWorkerSource,bindings:meshWorkerBindings}=await loadMeshWorkerHost();
import{faceParameters}from'../../packages/resource-packs/face-materials.mjs';
// Two stored cells / two emitted faces. Controlled canvas/device/input probes, no terrain or registry.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { VoxelVolume } from '../../packages/voxel-renderer/volume.mjs';
import { MeshPicker } from '../../packages/voxel-renderer/picking.mjs';
import { WorldRenderer } from '../../packages/voxel-renderer/world.mjs';
import { TextureAtlas } from '../../packages/resource-packs/atlas.mjs';
import { createSelectionPipeline } from '../../packages/voxel-renderer/selection.mjs';
import { bakeBlock } from '../../packages/voxel-renderer/models.mjs';
import { localClip,emptyClip } from '../../packages/voxel-renderer/clip.mjs';

const volume=new VoxelVolume({width:1,height:1,depth:2,origin:[-16,-32,-48],palette:[{id:'check:front',properties:{shape:'slab'}},{id:'check:back',properties:{}}],blocks:new Uint32Array([0,1]),biomes:{palette:['check:front_biome','check:back_biome'],cells:new Uint16Array([0,1])},metadata:{scope:'two-face-fixture',completePipeline:false}}),originalBlocks=volume.blocks.slice(),originalBiomes=volume.biomes.cells.slice();
let frontModel={id:'check:front',elements:[{from:[0,0,0],to:[16,8,4],faces:{north:{texture:'front'}}}]},frontKind='cutout';
const backModel={id:'check:back',elements:[{from:[0,0,0],to:[16,16,16],faces:{north:{texture:'back'}}}]};
const stack={blockModels(block){return[{model:block.id==='check:front'?frontModel:backModel,x:0,y:0}];},texture(model,ref){return ref;}};
const atlas={async add(name){return{uv:name==='front'?[0,0,.5,1]:[.5,0,1,1],transparency:name==='front'?frontKind:'opaque'};}};
const workerCode=meshWorkerSource;
async function make(clip){
  const models=await Promise.all(volume.palette.map(block=>bakeBlock(block,stack,atlas))),messages=[],context=vm.createContext({...meshWorkerBindings,self:{postMessage:data=>messages.push(data)},Float32Array,Uint32Array,setTimeout,localClip,emptyClip,faceParameters});vm.runInContext(workerCode,context);
  await context.self.onmessage({data:{id:1,width:volume.width,height:volume.height,depth:volume.depth,origin:volume.origin,blocks:volume.blocks,palette:volume.palette,models,clip}});
  const mesh=messages.at(-1);assert.equal(mesh.kind,'mesh',mesh.error);return{mesh,picker:new MeshPicker(volume,mesh),models};
}
const {mesh,picker,models:baseModels}=await make();assert.equal(mesh.faces,2);assert.equal(picker.bytes,176);
let frontAlpha=255,reads=[];const alphaAtlas={size:4,alpha:new Proxy(new Uint8Array(16),{get(target,key){if(typeof key==='string'&&/^\d+$/.test(key)){const index=Number(key),x=index%4,y=Math.floor(index/4);reads.push([x,y]);return x<2?frontAlpha:255;}return Reflect.get(target,key,target);}})},alpha=(u,v)=>TextureAtlas.prototype.sampleAlpha.call(alphaAtlas,u,v);
const ray=(x=-15.5,y=-31.75,z=-49,dir=[0,0,1],limit=4096)=>picker.raycast([x,y,z],dir,limit,{alpha});
const front=ray();assert.equal(front.block.id,'check:front');assert.equal(front.biome,'check:front_biome');assert.deepEqual(front.point,[-15.5,-31.75,-48]);assert.equal(front.distance,1);assert(front.normal.every((value,index)=>value===[0,0,-1][index]));assert.equal(front.metadata,volume.metadata);
assert.equal(ray(-15.5,-31.25).block.id,'check:back'); // Empty part of the slab's cell.
assert.equal(picker.lastWork.quadsTested,2);frontAlpha=0;const through=ray();assert.equal(through.block.id,'check:back');assert.deepEqual(through.point,[-15.5,-31.75,-47]);
frontAlpha=127;assert.equal(ray().block.id,'check:back');frontAlpha=128;assert.equal(ray().block.id,'check:front');frontAlpha=255;
assert.equal(ray(-15.5,-31.75,-46,[0,0,-1]),null);assert.equal(ray(-15.5,-31.75,-49,[0,0,4]).distance,1);assert.equal(ray(-15.5,-31.75,-49,[0,0,1],.5),null);
assert.throws(()=>picker.raycast([0,0,0],[0,0,0],1,{alpha}),/nonzero/);assert.throws(()=>picker.raycast([0,0,0],[0,0,1]),/alpha sampler/);assert.throws(()=>picker.raycast([NaN,0,0],[0,0,1],1,{alpha}),/finite/);
assert.throws(()=>new MeshPicker(volume,{...mesh,picking:{...mesh.picking,opaque:{...mesh.picking.opaque,owners:new ArrayBuffer(0)}}}),/coverage/);
assert.throws(()=>picker.raycast([-15.5,-31.75,-49],[0,0,1],4096,{alpha:()=>NaN}),/invalid alpha/);
const clipped=await make({min:[0,0,1],max:[1,1,2]});assert.equal(clipped.mesh.faces,1);assert.equal(clipped.picker.raycast([-15.5,-31.75,-49],[0,0,1],4096,{alpha}).block.id,'check:back');
frontModel={id:'check:front',elements:[{from:[-8,0,0],to:[16,8,4],faces:{north:{texture:'front'}}}]};const overhang=await make();assert.equal(overhang.picker.raycast([-16.25,-31.75,-49],[0,0,1],4096,{alpha}).x,-16);
frontKind='blend';const backCulled=await make();assert.equal(backCulled.picker.raycast([-15.5,-31.75,-47.5],[0,0,-1],4096,{alpha}),null);
frontKind='cutout';frontModel={id:'check:front',elements:[{from:[0,0,0],to:[16,8,4],rotation:{axis:'y',angle:45,origin:[8,8,8]},faces:{north:{texture:'front',rotation:90}}}]};
const rotated=await make(),quad=rotated.models[0][0],weights=[.2,.3,.5],localPoint=[0,1,2].map(axis=>weights.reduce((sum,weight,i)=>sum+weight*quad.positions[i][axis],0)),worldPoint=localPoint.map((value,axis)=>value+volume.origin[axis]),start=worldPoint.map((value,axis)=>value+quad.normal[axis]*2),hit=rotated.picker.raycast(start,quad.normal.map(value=>-value),4096,{alpha});
assert.equal(hit.block.id,'check:front');assert(Math.abs(hit.distance-2)<1e-6);for(let axis=0;axis<3;axis++)assert(Math.abs(hit.point[axis]-worldPoint[axis])<1e-6);for(let axis=0;axis<2;axis++)assert(Math.abs(hit.uv[axis]-weights.reduce((sum,weight,i)=>sum+weight*quad.uv[i][axis],0))<1e-6);
// Alpha reads use current retained pixels and clamp exactly to the configured nearest/clamp atlas.
const alphaCache=new Map(),readCount=reads.length;TextureAtlas.prototype.sampleAlpha.call(alphaAtlas,.2,.2,alphaCache);TextureAtlas.prototype.sampleAlpha.call(alphaAtlas,.21,.21,alphaCache);assert.equal(reads.length,readCount+1);frontAlpha=0;assert.equal(TextureAtlas.prototype.sampleAlpha.call(alphaAtlas,.2,.2),0);frontAlpha=255;
TextureAtlas.prototype.sampleAlpha.call(alphaAtlas,-1,2);assert.deepEqual(reads.at(-1),[0,3]);assert.throws(()=>TextureAtlas.prototype.sampleAlpha.call({...alphaAtlas,disposed:true},0,0),{name:'AbortError'});
globalThis.GPUBufferUsage={VERTEX:1,COPY_DST:2,INDEX:4,STORAGE:8};const writes=[],buffers=[],listeners=new Map(),inspections=[],errors=[];
const device={limits:{maxBufferSize:1<<20},createBuffer(options){const buffer={...options,destroy(){this.destroyed=true;}};buffers.push(buffer);return buffer;},queue:{writeBuffer(buffer,offset,data){writes.push({buffer,data:data.slice()});}}};
const renderer=Object.assign(Object.create(WorldRenderer.prototype),{gpu:{device},volume,picker,atlas:alphaAtlas,bind(){this.bindGroups={opaque:{},transparent:{}};this.bindGroup=this.bindGroups.opaque;},camera:{yaw:0,pitch:0,distance:8,target:[0,0,0]},draw(){this.draws=(this.draws||0)+1;},canvas:{focus(){},setPointerCapture(){},addEventListener(name,callback){listeners.set(name,callback);}},inspect(){return front;},onInspect:hit=>inspections.push(hit),onError:error=>errors.push(error)});
let pipeline;createSelectionPipeline({createShaderModule:()=>({}),createPipelineLayout:()=>({}),createRenderPipeline:descriptor=>{pipeline=descriptor;}},{},'rgba8unorm');assert.equal(pipeline.primitive.topology,'line-list');for(const key of ['depthBias','depthBiasSlopeScale','depthBiasClamp'])assert.equal(pipeline.depthStencil[key],0);assert.equal(pipeline.depthStencil.depthWriteEnabled,false);
renderer.select(front);assert.equal(renderer.selectionCount,8);assert.equal(writes.at(-1).data.length,24);const selectedBuffer=renderer.selectionBuffer;renderer.select(front);assert.equal(renderer.selectionBuffer,selectedBuffer);assert.equal(buffers.length,1);
renderer.picker=clipped.picker;assert.throws(()=>renderer.select(front),/mesh changed/);renderer.picker=picker;renderer.controls();
const event=extra=>({pointerId:1,button:0,clientX:10,clientY:20,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra});
listeners.get('pointerdown')(event());listeners.get('pointerup')(event());assert.equal(inspections.length,1);
const escape=event({key:'Escape'});listeners.get('keydown')(escape);assert.equal(renderer.selectionCount,0);assert(escape.prevented&&escape.stopped);
listeners.get('pointerdown')(event());for(let i=1;i<=8;i++)listeners.get('pointermove')(event({clientX:10+i*.5}));listeners.get('pointerup')(event({clientX:14}));assert.equal(inspections.length,1);
renderer.inspect=()=>null;listeners.get('pointerdown')(event());listeners.get('pointerup')(event());assert.equal(renderer.selectionCount,0);
renderer.inspect=()=>{throw Error('Controlled atlas read failure');};listeners.get('pointerdown')(event());listeners.get('pointerup')(event());assert.equal(errors.length,1);
renderer.select(front);renderer.uploadMesh(mesh);assert.equal(renderer.selectionCount,0);assert.equal(renderer.selection,null);
// Actual camera-ray routing must use the mesh picker and current atlas rather than cell occupancy.
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);let routed;
WorldRenderer.prototype.inspect.call({volume,models:baseModels,meshPalette:volume.palette,picker:{raycast(...args){routed=args;return front;}},matrices:()=>({matrix:identity}),canvas:{getBoundingClientRect:()=>({left:0,top:0,width:2,height:2})},atlas:{sampleAlpha:()=>.25}},1,1);assert.equal(routed[3].alpha(0,0),.25);assert.deepEqual(routed[0],[-15.5,-31.5,-47]);
// Inspect details preserve stored fields and reject a same-volume mesh replacement before focus.
const source=await fs.readFile(new URL('../../apps/web/main.mjs',import.meta.url),'utf8'),controls=new Map(),dialogs=[];const ui={customBiomeDetails:()=>[],tilePayloadDetails:()=>[],state:{world:{picker,focus(){throw Error('Stale mesh must not focus');}}},currentVoxelVolume:()=>volume,$:id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id);},copy:text=>({text}),element:(tag,attributes)=>({tag,...attributes}),ask:async(title,content,options)=>{dialogs.push({title,content,options});}};vm.createContext(ui);vm.runInContext(source.slice(source.indexOf('async function inspectWorldVoxel('),source.indexOf('let previewTimer;')),ui);
await ui.inspectWorldVoxel(front);assert(dialogs[0].content.some(item=>item.text?.startsWith('Surface hit:')));assert(dialogs[0].content.some(item=>item.text?.includes('check:front_biome')));ui.state.world.picker=clipped.picker;assert.throws(()=>dialogs[0].options.onSubmit([0,0,0]),/mesh changed/);await ui.inspectWorldVoxel(front);assert.equal(dialogs.length,1);
assert.deepEqual(volume.blocks,originalBlocks);assert.deepEqual(volume.biomes.cells,originalBiomes);renderer.buffers.dispose();
const paths=['packages/voxel-renderer/picking.mjs','packages/voxel-renderer/selection.mjs','packages/voxel-renderer/mesh-worker.mjs','packages/voxel-renderer/world.mjs','packages/resource-packs/atlas.mjs','packages/voxel-renderer/mesh-buffers.mjs','apps/web/main.mjs','apps/web/index.html','tools/checks/model-picking-smoke.mjs'],workspaceSha256=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await fs.readFile(new URL('../../'+path,import.meta.url))).digest('hex')])));
const evidence={date:'2026-10-21',scope:'committed model triangle picking, current atlas alpha, selected face outline and stored voxel inspection',fixture:{storedCells:2,emittedFaces:2,compactPickingBytes:picker.bytes,sourcePixels:0},checks:['slab empty-space and nearest actual triangles','current alpha pass-through and 127/255 versus 128/255 cutout','native opaque and blended backface culling','negative-world overhang owner and whole-cell clips','rotated model geometry and rotated UV interpolation','bounded compact coverage and malformed ray/alpha refusal','current one-pixel atlas reads, per-ray texel reuse and disposal','valid line-pipeline descriptor, selection buffer reuse, click miss, Escape, drag suppression and errors','remesh clears selection; stale same-volume inspection cannot focus','actual renderer camera ray and UI stored fields','unchanged block and biome buffers'],workspaceSha256,realBrowserVerified:false,webGpuVerified:false,minecraftClientParityVerified:false,complete:false,limits:'Controlled Node worker/canvas/device/input probes only. No native build, terrain generation, registry/state sweep, broad suite or GitHub workflow. GPU raster edge/texel-boundary agreement and outline rendering remain unqualified.'};
await fs.writeFile(new URL('../../.local-tools/model-picking-smoke-results.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({result:'pass',fixture:evidence.fixture,checks:evidence.checks},null,2));
