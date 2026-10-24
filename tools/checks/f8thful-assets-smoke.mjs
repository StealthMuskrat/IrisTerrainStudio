// Authorized local archive, four selected block models and two fluid sprites.
// Does not enumerate registry states or claim browser/GPU appearance parity.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {MinecraftResourcePack,ResourcePackStack} from '../../packages/resource-packs/pack.mjs';
import {assetDigest} from '../../packages/resource-packs/bundle.mjs';
import {blockDefinitionPaths,inspectRenderingDependencies} from '../../packages/resource-packs/dependencies.mjs';
import {TextureAtlas} from '../../packages/resource-packs/atlas.mjs';
import {blockRenderProfile} from '../../packages/resource-packs/render-inputs.mjs';
import {bakeBlockPlan} from '../../packages/voxel-renderer/models.mjs';
import {selectedModelParts} from '../../packages/resource-packs/model-selection.mjs';
import {VoxelVolume} from '../../packages/voxel-renderer/volume.mjs';
import {MeshPicker} from '../../packages/voxel-renderer/picking.mjs';
import {inspectDefaultAssets} from '../../apps/server/default-assets.mjs';
import {TextureLibrary} from '../../apps/web/lib/texture-library.mjs';
const source=process.argv[2];if(!source)throw Error('Supply the authorized original F8thful ZIP path.');
const original=await MinecraftResourcePack.open(new Uint8Array(await fs.readFile(source)),'Supplied F8thful');
assert.equal(original.digest,'2b07f25eba57e340f421a8ee3e927d0c7239244d19cabe5ef89c32ea2ea48977');
const directory=process.argv[3]??'.local-assets/rendering-defaults',installed=await inspectDefaultAssets(directory),manifest=JSON.parse(installed.manifestBytes);
assert(installed.status.configured);assert.equal(manifest.packs[1].sourceSha256,original.digest);
const packs=await Promise.all(installed.status.packs.map(row=>MinecraftResourcePack.open(installed.archives.get(row.role),row.name))),stack=new ResourcePackStack(packs);
assert.equal(packs[1].target.compatible,false);assert.equal(original.target.overlays.length,5);assert(original.target.overlays.every(row=>!row.applicable));assert.equal(packs[1].overlayDirectories.length,0);
assert.deepEqual(new Uint8Array(packs[1].entries.get('pack.mcmeta')),original.entries.get('pack.mcmeta'));
assert(![...packs[1].entries.keys()].some(name=>/^69(?:[-/])/.test(name)));
assert(!packs.some(pack=>[...pack.entries.keys()].some(name=>/\/textures\/gui\//.test(name))));
assert(packs.every(pack=>!pack.entries.has('assets/minecraft/textures/item/diamond_sword.png')));
assert(packs[0].entries.has('studio-vanilla-source.json'));
// Count retained original paths rather than evaluating block-state combinations.
const definitions=blockDefinitionPaths([original]);assert.equal(definitions.length,211);
for(const name of definitions)assert(packs[1].entries.has(name),'Missing original block definition '+name);
for(const name of ['assets/minecraft/models/block/air.json','assets/minecraft/models/block/cube_all.json'])assert(packs[0].entries.has(name),'Missing unused native template '+name);
const selected=[{id:'minecraft:stone'},{id:'minecraft:oak_log',properties:{axis:'y'}},{id:'minecraft:grass_block',properties:{snowy:'false'}},{id:'minecraft:heavy_core',properties:{waterlogged:'false'}}];
const capture=await inspectRenderingDependencies(stack,selected);assert.deepEqual(capture.report.errors,[]);
const originalUsage=globalThis.GPUTextureUsage,uploads=[];globalThis.GPUTextureUsage={TEXTURE_BINDING:1,COPY_DST:2};
const device={limits:{maxTextureDimension2D:512},createTexture(){return{destroy(){}};},createSampler(){return{};},queue:{writeTexture(target,pixels,layout,size){assert.equal(pixels.byteLength,layout.bytesPerRow*size[1]);uploads.push({level:target.mipLevel,bytes:pixels.byteLength});}}};
const atlas=new TextureAtlas(device,512,{mipLevels:3});let worker,models,mesh;
try{
  models=await Promise.all(selected.map(block=>bakeBlockPlan(block,stack,atlas)));
  assert(models.every((model,index)=>(Array.isArray(model)?model:selectedModelParts(model,selected[index],[-16,64,0]).flat()).length>0));
  const stone=await stack.bitmap('minecraft:block/stone');assert.equal(stone.width,8);assert.equal(stone.height,8);
  for(const name of ['water_still','water_flow']){const sprite=await atlas.add('minecraft:block/'+name,stack);assert.equal(sprite.width,name==='water_still'?8:16);assert(sprite.frames.length>1);}
  const before=uploads.length;atlas.update(0);atlas.update(1000);assert(uploads.length>before);
  const missing=await stack.bitmap('minecraft:missingno');assert.deepEqual([...missing.pixels.subarray(0,4)],[0,0,0,255]);assert.deepEqual([...missing.pixels.subarray(8*4,9*4)],[248,0,248,255]);
  await assert.rejects(stack.bitmap('minecraft:block/absent_asset'),/Missing texture/);
  const workerUrl=new URL('../../packages/voxel-renderer/mesh-worker.mjs',import.meta.url).href;
  const host=`import{parentPort}from'node:worker_threads';globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};await import(${JSON.stringify(workerUrl)});parentPort.on('message',data=>self.onmessage({data}));`;
  worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(host)));
  const request=data=>new Promise((resolve,reject)=>{const receive=result=>{if(result.id!==data.id||result.kind==='progress')return;worker.off('message',receive);worker.off('error',reject);result.error?reject(Error(result.error)):resolve(result);};worker.on('message',receive);worker.once('error',reject);worker.postMessage(data);});
  const volume=new VoxelVolume({width:1,height:1,depth:1,origin:[-16,64,0],blocks:new Uint32Array([0]),palette:[selected[0]]});
  mesh=await request({id:1,width:1,height:1,depth:1,origin:volume.origin,blocks:volume.blocks,palette:[{...selected[0],renderProfile:blockRenderProfile(selected[0])}],models:[models[0]]});assert.deepEqual(mesh.diagnostics,[]);assert.equal(mesh.faces,6);
  const picker=new MeshPicker(volume,mesh),hit=picker.raycast([-15.5,68,.5],[0,-1,0],8,{alpha:(u,v)=>atlas.sampleAlpha(u,v)});assert(hit);assert.equal(hit.block.id,'minecraft:stone');assert.equal(hit.x,-16);
  const cached=await request({id:2});assert(cached.stats.reused>0);assert.deepEqual(new Float32Array(cached.opaque),new Float32Array(mesh.opaque));
}finally{await worker?.terminate();atlas.dispose();await stack.dispose();globalThis.GPUTextureUsage=originalUsage;}
assert.equal(await assetDigest(new Uint8Array(await fs.readFile(source))),original.digest);
let standalone=null;
if(process.argv[4]){
  const distribution=path.resolve(process.argv[4]),build=JSON.parse(await fs.readFile(path.join(distribution,'BUILD.json')));
  assert(build.engine.available&&build.engine.registry.available&&build.defaultAssets.configured);
  const {createStudioServer}=await import(pathToFileURL(path.join(distribution,'apps/server/index.mjs')));
  const root=await fs.mkdtemp(path.resolve('.local-tools/f8thful-http-')),token='authored-f8thful-defaults-token-32-characters';
  const {server}=await createStudioServer({root,host:'0.0.0.0',token});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const origin='http://127.0.0.1:'+server.address().port;
    assert.equal((await fetch(origin+'/api/rendering-defaults')).status,401);
    const api={request:async(endpoint,{query={},raw=false}={})=>{const url=new URL('/api/'+endpoint,origin);for(const [k,v]of Object.entries(query))url.searchParams.set(k,v);const response=await fetch(url,{headers:{Authorization:'Bearer '+token}});assert(response.ok);return raw?response:response.json();}};
    const moduleSource=(await fs.readFile('apps/web/lib/default-assets.mjs','utf8')).replace("'/packages/resource-packs/bundle.mjs'",JSON.stringify(pathToFileURL(path.resolve('packages/resource-packs/bundle.mjs')).href));
    const {loadDefaultAssets}=await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
    const defaults=await loadDefaultAssets(api);assert.equal(defaults.length,2);assert.match(defaults[1].name,/F8thful/);
    const library=new TextureLibrary({open:(bytes,name)=>MinecraftResourcePack.open(bytes,name),defaults:async()=>defaults,read:async()=>({config:undefined,records:[]}),write:async()=>{throw Error('Automatic defaults must not write duplicate archives.');}});
    await library.restore();assert.equal(library.activePacks().length,2);assert(library.entries.every(e=>e.provisioned&&e.enabled));
    for(const name of ['/packages/resource-packs/builtin-textures.mjs','/app/main.mjs'])assert.equal((await fetch(origin+name)).status,200,name);
    assert.equal((await fetch(origin+'/.local-assets/rendering-defaults/default.zip')).status,404);
    standalone={engineAndRegistryPresent:true,authenticatedCatalogAndHashVerifiedDownloads:true,automaticLibraryStartup:true,noDuplicateArchiveWrites:true,staticModulesDelivered:true,privateAssetPathRefused:true};
  }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
}
const result={date:'2026-10-23',result:'pass',source:{sha256:original.digest,bytes:(await fs.stat(source)).size,declaredRange:original.target.declaredRange,compatible:false,inactiveOverlays:5},packs:manifest.packs,dependencyWork:manifest.dependencies,originalBlockDefinitionsRetained:definitions.length,unusedVanillaTemplatesRetained:true,metadataUnchanged:true,sourceProvenanceRetained:true,unrelatedAssetsOmitted:true,selectedBlockModels:4,selectedDependencyFiles:capture.files.size,eightPixelStone:true,animatedFluidSprites:2,controlledRawMipUploads:uploads.length,namedNativeMissingSprite:true,otherMissingTexturesRefuse:true,actualNodeMeshWorker:{storedCells:1,faces:mesh.faces,cacheAndPicking:true},originalArchiveUnchanged:true,browserVerified:false,webGpuVerified:false,clientRenderingParity:false,redistributionPermissionEstablished:false,projectFinished:false};
result.standalone=standalone;
await fs.writeFile('.local-tools/f8thful-assets-smoke-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
