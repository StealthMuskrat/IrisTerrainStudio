// One small pool fixture, two native mode paths, six selected cells each. No volume comparison.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
import {VoxelVolume} from '../../packages/voxel-renderer/volume.mjs';
import {hydrologyFixture} from './hydrology-fixture.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'hydrology-matter-'));
const previousWorker=globalThis.Worker;let client;
await fs.rm(path.join(local,'native-hydrology-matter-smoke-results.json'),{force:true});
try{
  const flat=JSON.parse(await fs.readFile(path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack/generators/flat.json'),'utf8')),source=hydrologyFixture(flat),resources=Object.entries(source).map(([path,value])=>({path,text:JSON.stringify(value)})),pack=path.join(temporary,'pack');
  for(const resource of resources){const name=path.join(pack,resource.path);await fs.mkdir(path.dirname(name),{recursive:true});await fs.writeFile(name,resource.text);}
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),java=path.join(local,'jdk-25.0.4.1+1');
  const classpath=[path.join(local,'layer-kernel-classes'),path.join(local,'browser-engine/target/classes'),path.join(local,'rotation-classes'),classes,...new Set(captures.flatMap(c=>c.classpath.map(e=>e.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args,log){const handle=await fs.open(path.join(local,log),'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',handle.fd,handle.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${binary} exited ${code}; see .local-tools/${log}`)));});}finally{await handle.close();}}
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java'],'hydrology-matter-reference-compile.log');
  const controls=[[10,62,9],[10,63,9],[10,64,9],[10,65,9],[9,64,9],[0,64,0]],checks=[false,true].map(generate=>({generate,x:0,z:-16,controls,hydrologyPublication:true}));
  const request=path.join(temporary,'request.json'),reference=path.join(temporary,'reference.json'),referenceKey=createHash('sha256').update(JSON.stringify(resources)).update(JSON.stringify(checks)).update(await fs.readFile(path.join(classes,'art/arcane/iris/probe/NativeTerrainLinkCheck.class'))).update(await fs.readFile(path.join(local,'browser-engine/target/classes/studio/engine/hydrology/HydrologyMatterSnapshot.class'))).update(JSON.stringify(captures)).digest('hex');
  let expected;const cache=path.join(local,'hydrology-matter-reference.json');
  if(process.argv.includes('--reuse-reference')){const record=JSON.parse(await fs.readFile(cache,'utf8'));assert.equal(record.referenceKey,referenceKey);expected=record.results.slice(0,checks.length);}
  else{await fs.writeFile(request,JSON.stringify({packs:[pack],seeds:['1'],points:[],registeredOverworldChecks:checks}));await run('java',['-Xmx512m','-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',request,reference],'hydrology-matter-reference.log');expected=JSON.parse(await fs.readFile(reference,'utf8'))[0].slice(0,checks.length);await fs.writeFile(cache,JSON.stringify({referenceKey,results:expected},null,2)+'\n');}
  if(process.argv.includes('--reference-only')){console.log('Captured native hydrology matter selected probes and publication counts.');}
  else{
    const base=path.join(root,'apps/web/engine/iris-generated'),manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));await import(pathToFileURL(path.join(base,'iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(base,'iris.wasm')));api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'));
    let receiver,generations=0;const sandbox={navigator:{userAgent:'Node controlled worker host'},performance,crypto:webcrypto,TextEncoder,TextDecoder,DataView,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Float64Array,setTimeout,clearTimeout,console,stubApi:api,stubManifest:manifest,postMessage:message=>receiver?.({data:structuredClone(message)})};sandbox.self=sandbox;const context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);vm.runInContext('runtime=Promise.resolve({api:stubApi,manifest:stubManifest});registryRuntime=Promise.resolve({installed:true});',context);
    globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){if(data.kind==='generate')generations++;sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){receiver=null;}};client=new GenerationClient();
    const options={seed:'1',dimensionKey:'terrain3d',packSnapshot:{resources},width:16,height:16,x:8,y:0,z:-8,span:16},results=[];
    for(let index=0;index<2;index++){
      const field=index?'overworld-mode':'overworld-terrain',result=await client.generate({...options,field}),volume=new VoxelVolume(result.volume),metadata=volume.metadata,native=expected[index];
      for(const[x,y,z,block,biome]of native.probes){assert.equal(volume.block(x,y,z).stateKey,block);assert.equal(volume.biome(x,y,z),biome);}
      assert.deepEqual(metadata.hydrology,native.hydrology);assert.equal(metadata.hydrology.nativeComponentFlag,true);assert.ok(metadata.hydrology.sealGuards>0);assert.equal(metadata.executedContentStages,index?9:0);assert.equal(metadata.completePipeline,false);assert.equal(metadata.activeLeasesAfter,0);const session=JSON.parse(api.generationSessionStatistics());assert.equal(session.activeLeases,0);assert.equal(session.scopeBound,false);
      results.push({field,probes:native.probes,hydrology:metadata.hydrology,admission:metadata.hydrologyAdmission});
    }
    assert.equal(results[1].probes.find(row=>row[0]===10&&row[1]===64)[3],'minecraft:lava[level=0]');
    // Cached native context and client result remain separate ownership layers.
    const before=generations;await client.generate({...options,field:'overworld-mode'});assert.equal(generations,before);
    client.invalidate();manifest.hydrologyPlatform.registeredOverworldMatter=false;await assert.rejects(client.generate({...options,field:'overworld-terrain'}),/Rebuild the local Iris engine/);assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);manifest.hydrologyPlatform.registeredOverworldMatter=true;
    const invalid=resources.map(row=>({...row})),bad=JSON.parse(invalid.find(row=>row.path==='biomes/floor.json').text);bad.decorators=[{palette:[{block:'minecraft:snow'}],chance:1,forcePlace:true,style:{expression:'bad'}}];invalid.find(row=>row.path==='biomes/floor.json').text=JSON.stringify(bad);invalid.push({path:'expressions/bad.json',text:'{"expression":"x +"}'});
    api.clear();for(const resource of invalid)api.registerPackResource(resource.path,resource.text);api.openPack();api.prepareTerrain('terrain3d','1');assert.throws(()=>api.generateOverworldChunk(0,-16));const failure=JSON.parse(api.generationSessionStatistics());assert.equal(failure.activeLeases,0);assert.equal(failure.scopeBound,false);api.releaseTerrain();
    await assert.rejects(client.generate({...options,field:'terrain'}),/Complete hydrology terrain previews are not connected/);assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);
    client.invalidate();const recovery=await client.generate({...options,field:'overworld-terrain'});assert.deepEqual(recovery.volume.metadata.hydrology,expected[0].hydrology);
    const hash=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(hash(await fs.readFile(path.join(base,'iris.wasm'))),manifest.wasmSha256);
    await fs.writeFile(path.join(local,'native-hydrology-matter-smoke-results.json'),JSON.stringify({scope:'native-hydrology-registered-overworld-targeted',result:'pass',fixtures:1,seeds:1,blockProbes:12,physicalBiomeProbes:12,results,referenceKey,actualWorkerClient:true,clientCacheReuse:true,olderModuleRefused:true,unsupportedIntermediateRefused:true,failedPreviewCleanup:failure,recoveryAndRelease:true,resources:resources.map(row=>({path:row.path,sha256:hash(row.text)})),wasmSha256:manifest.wasmSha256,browserVerified:false,webGpuVerified:false,terrainParityVerified:false,completePipeline:false},null,2)+'\n');
    console.log('Native hydrology matter matches Java at twelve selected block/biome probes through terrain-prefix and full registered Overworld mode, with publication counts, transport and recovery. No volume/state sweep.');
  }
}finally{client?.dispose();globalThis.Worker=previousWorker;await fs.rm(temporary,{recursive:true,force:true});}
