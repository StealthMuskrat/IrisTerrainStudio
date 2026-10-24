// One contained deep-fluid fixture, one column, and six selected cells per registered mode. No volume comparison.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
import {VoxelVolume} from '../../packages/voxel-renderer/volume.mjs';
import {deepHydrologyFixture} from './hydrology-fixture.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'hydrology-containment-'));
const previousWorker=globalThis.Worker;let client;
await fs.rm(path.join(local,'native-hydrology-containment-smoke-results.json'),{force:true});
try{
  const flat=JSON.parse(await fs.readFile(path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack/generators/flat.json'),'utf8')),source=deepHydrologyFixture(flat),resources=Object.entries(source).map(([path,value])=>({path,text:JSON.stringify(value)})),pack=path.join(temporary,'pack');
  for(const resource of resources){const name=path.join(pack,resource.path);await fs.mkdir(path.dirname(name),{recursive:true});await fs.writeFile(name,resource.text);}
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),java=path.join(local,'jdk-25.0.4.1+1');
  const classpath=[path.join(local,'layer-kernel-classes'),path.join(local,'browser-engine/target/classes'),path.join(local,'rotation-classes'),classes,...new Set(captures.flatMap(c=>c.classpath.map(e=>e.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args,log){const handle=await fs.open(path.join(local,log),'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',handle.fd,handle.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${binary} exited ${code}; see .local-tools/${log}`)));});}finally{await handle.close();}}
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java'],'hydrology-containment-reference-compile.log');
  const controls=[[11,18,12],[11,19,12],[11,20,12],[11,21,12],[12,21,12],[0,20,0]],checks=[false,true].map(generate=>({generate,x:48,z:16,controls,hydrologyPublication:true}));
  const request=path.join(temporary,'request.json'),reference=path.join(temporary,'reference.json'),referenceKey=createHash('sha256').update(JSON.stringify(resources)).update(JSON.stringify(checks)).update('column:59,28').update(await fs.readFile(path.join(classes,'art/arcane/iris/probe/NativeTerrainLinkCheck.class'))).update(await fs.readFile(path.join(local,'browser-engine/target/classes/studio/engine/hydrology/HydrologyMatterSnapshot.class'))).update(await fs.readFile(path.join(local,'browser-engine/target/classes/studio/engine/hydrology/HydrologyDiagnostic.class'))).update(JSON.stringify(captures)).digest('hex');
  let expected,nativeColumn;const cache=path.join(local,'hydrology-containment-reference.json');
  if(process.argv.includes('--reuse-reference')){const record=JSON.parse(await fs.readFile(cache,'utf8'));assert.equal(record.referenceKey,referenceKey);expected=record.results;nativeColumn=record.column;}
  else{await fs.writeFile(request,JSON.stringify({packs:[pack],seeds:['1'],points:[],hydrologyCheck:{points:[[59,28]]},registeredOverworldChecks:checks}));await run('java',['-Xmx512m','-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',request,reference],'hydrology-containment-reference.log');const rows=JSON.parse(await fs.readFile(reference,'utf8'))[0];nativeColumn=rows[0][0];expected=rows.slice(1,1+checks.length);await fs.writeFile(cache,JSON.stringify({referenceKey,column:nativeColumn,results:expected},null,2)+'\n');}
  if(process.argv.includes('--reference-only')){console.log('Captured native deep-fluid column and selected block probes.');}
  else{
    const base=path.join(root,'apps/web/engine/iris-generated'),manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));await import(pathToFileURL(path.join(base,'iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(base,'iris.wasm')));api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'));
    let recordedPrefix,controlledPrefix,recordedFull,controlledFull;
    const overrides={paintRegisteredOverworldTerrainChunk(...args){const result=controlledPrefix??api.paintRegisteredOverworldTerrainChunk(...args);if(controlledPrefix===undefined)recordedPrefix=result;return result;},generateOverworldChunk(...args){const result=controlledFull??api.generateOverworldChunk(...args);if(controlledFull===undefined)recordedFull=result;return result;}};
    const workerApi=new Proxy(overrides,{get:(target,key)=>Object.hasOwn(target,key)?target[key]:api[key]});
    let receiver,generations=0;const sandbox={navigator:{userAgent:'Node controlled worker host'},performance,crypto:webcrypto,TextEncoder,TextDecoder,DataView,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Float64Array,setTimeout,clearTimeout,console,stubApi:workerApi,stubManifest:manifest,postMessage:message=>receiver?.({data:structuredClone(message)})};sandbox.self=sandbox;const context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);vm.runInContext('runtime=Promise.resolve({api:stubApi,manifest:stubManifest});registryRuntime=Promise.resolve({installed:true});',context);
    globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){if(data.kind==='generate')generations++;sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){receiver=null;}};client=new GenerationClient();
    const options={seed:'1',dimensionKey:'terrain3d',packSnapshot:{resources},width:16,height:16,x:56,y:0,z:24,span:16},results=[];
    const columnReport=await client.sampleHydrologyColumn({resources},'terrain3d','1',59,28);
    function semanticColumn(column){const copy={...column};for(const key of ['runtimeSettingsFingerprint','admittedRoots','admittedPlanningCalls','admittedCarvingChunks','chargedCarvingInputCells'])delete copy[key];return copy;}
    assert.deepEqual(semanticColumn(columnReport.column),semanticColumn(nativeColumn));
    assert.ok(columnReport.column.layers.some(row=>row.featureType==='DEEP_POOL'&&row.fluidOwned));
    assert.ok(columnReport.column.admittedCarvingChunks>0);
    assert.ok(columnReport.column.containment.plans.some(row=>row.accepted&&row.touchesColumn&&row.actions>0&&row.baselinePreconditions>=row.actions));
    assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);
    for(let index=0;index<2;index++){
      const field=index?'overworld-mode':'overworld-terrain',result=await client.generate({...options,field}),volume=new VoxelVolume(result.volume),metadata=volume.metadata,native=expected[index];
      for(const[x,y,z,block,biome]of native.probes){assert.equal(volume.block(x,y,z).stateKey,block);assert.equal(volume.biome(x,y,z),biome);}
      assert.deepEqual(metadata.hydrology,native.hydrology);assert.equal(metadata.hydrology.nativeComponentFlag,true);assert.ok(metadata.hydrology.sealGuards>0);assert.ok(metadata.hydrology.wetSources>0);assert.ok(metadata.hydrology.dryAir>0);assert.equal(metadata.hydrology.fluidSimulationExecuted,false);assert.ok(metadata.hydrology.sections.length>0);assert.equal(metadata.hydrology.profiles[0].key,'deep_lava');assert.ok(metadata.hydrologyAdmission.carvingChunks>0);assert.equal(metadata.hydrologyAdmission.carvingInputChunks.length,metadata.hydrologyAdmission.carvingChunks);assert.ok(metadata.hydrologyAdmission.carvingInputChunks.some(([cx,cz])=>Math.abs(cx-3)>3||Math.abs(cz-1)>3));assert.equal(metadata.executedContentStages,index?9:0);assert.equal(metadata.completePipeline,false);assert.equal(metadata.activeLeasesAfter,0);const session=JSON.parse(api.generationSessionStatistics());assert.equal(session.activeLeases,0);assert.equal(session.scopeBound,false);
      results.push({field,probes:native.probes,hydrology:metadata.hydrology,admission:metadata.hydrologyAdmission});
    }
    assert.ok(results[1].probes.some(row=>row[3]==='minecraft:lava[level=0]'));
    assert.ok(results[1].probes.some(row=>row[3]==='minecraft:cave_air'));
    const before=generations;await client.generate({...options,field:'overworld-mode'});assert.equal(generations,before);
    // Corrupt only already generated metadata; these refusals do not generate more native terrain.
    const missingInput=JSON.parse(recordedPrefix);missingInput.hydrologyAdmission.carvingInputChunks.pop();controlledPrefix=JSON.stringify(missingInput);client.invalidate();await assert.rejects(client.generate({...options,field:'overworld-terrain'}),/carving-input metadata is incomplete/);assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);
    controlledPrefix=undefined;const escapedContent=JSON.parse(recordedFull),far=escapedContent.componentFlags.find(row=>Math.abs(row[0]-3)>3||Math.abs(row[1]-1)>3);assert.ok(far);far[3]=true;controlledFull=JSON.stringify(escapedContent);client.invalidate();await assert.rejects(client.generate({...options,field:'overworld-mode'}),/Overworld content diagnostics are incomplete/);assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);controlledFull=undefined;
    client.invalidate();const recovery=await client.generate({...options,field:'overworld-terrain'});assert.deepEqual(recovery.volume.metadata.hydrology,expected[0].hydrology);
    const hash=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(hash(await fs.readFile(path.join(base,'iris.wasm'))),manifest.wasmSha256);
    await fs.writeFile(path.join(local,'native-hydrology-containment-smoke-results.json'),JSON.stringify({scope:'native-hydrology-contained-deep-fluid-targeted',result:'pass',fixtures:1,seeds:1,blockProbes:12,physicalBiomeProbes:12,column:columnReport.column,results,referenceKey,actualWorkerClient:true,clientCacheReuse:true,carvingInputIdentityValidated:true,controlledStoredMetadataRefusals:{missingInput:true,contentOutsideScheduler:true,additionalTerrainGenerations:0},recoveryAndRelease:true,resources:resources.map(row=>({path:row.path,sha256:hash(row.text)})),wasmSha256:manifest.wasmSha256,browserVerified:false,webGpuVerified:false,terrainParityVerified:false,completePipeline:false},null,2)+'\n');
    console.log('Native contained deep fluid matches Java at one column and twelve selected block/biome probes; actual carving inputs, wet/dry/guard publication, section/profile summaries and recovery. No volume/state sweep.');
  }
}finally{client?.dispose();globalThis.Worker=previousWorker;await fs.rm(temporary,{recursive:true,force:true});}
