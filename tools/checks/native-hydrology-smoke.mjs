// One authored pool fixture, one native-selected occupied column and one negative coordinate.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import {hydrologyFixture} from './hydrology-fixture.mjs';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools');
const directory=await fs.mkdtemp(path.join(local,'native-hydrology-'));
await fs.rm(path.join(local,'native-hydrology-smoke-results.json'),{force:true});
try{
  const pack=path.join(directory,'pack'),flat=JSON.parse(await fs.readFile(path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack/generators/flat.json'),'utf8'));
  const resources=hydrologyFixture(flat);
  for(const[name,value]of Object.entries(resources)){const filename=path.join(pack,name);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,JSON.stringify(value));}
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes');
  const classpath=[path.join(local,'layer-kernel-classes'),path.join(local,'browser-engine/target/classes'),path.join(local,'rotation-classes'),classes,...new Set(captures.flatMap(c=>c.classpath.map(e=>e.path)))].join(path.delimiter),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
  const env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args,log){const filename=path.join(local,log),handle=await fs.open(filename,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',handle.fd,handle.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(binary+' exited '+code+'; see '+filename)));});}finally{await handle.close();}}
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java'],'hydrology-reference-compile.log');
  const request=path.join(directory,'request.json'),reference=path.join(directory,'reference.json');
  await fs.writeFile(request,JSON.stringify({packs:[pack],seeds:['1'],points:[],hydrologyCheck:{pickPool:true,points:[[-17,-33]]}}));
  const referenceKey=createHash('sha256').update(JSON.stringify(resources)).update(await fs.readFile(path.join(classes,'art/arcane/iris/probe/NativeTerrainLinkCheck.class'))).update(await fs.readFile(path.join(local,'browser-engine/target/classes/studio/engine/hydrology/HydrologyDiagnostic.class'))).update(JSON.stringify(captures)).digest('hex');
  const cacheFile=path.join(local,'hydrology-reference-columns.json');let expected;
  if(process.argv.includes('--reuse-reference')){const cached=JSON.parse(await fs.readFile(cacheFile,'utf8'));assert.equal(cached.referenceKey,referenceKey,'Native hydrology reference inputs changed');expected=cached.columns;}
  else{
    await run('java',['-Xmx512m','-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',request,reference],'hydrology-reference.log');
    expected=JSON.parse(await fs.readFile(reference,'utf8'))[0][0];
    await fs.writeFile(cacheFile,JSON.stringify({referenceKey,columns:expected},null,2)+'\n');
  }
  if(process.argv.includes('--reference-only'))console.log('Captured two selected native hydrology columns. No Wasm/browser qualification.');
  else{
  const base=path.join(root,'apps/web/engine/iris-generated');await import(pathToFileURL(path.join(base,'iris.wasm-runtime.js')));
  const {exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(base,'iris.wasm')));
  api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'));
  for(const[name,value]of Object.entries(resources))api.registerPackResource(name,JSON.stringify(value));api.openPack();api.prepareTerrain('terrain3d','1');
  const results=[];
  for(const original of expected){const actual=JSON.parse(api.sampleHydrologyColumn(original.x,original.z)),native={...original};const admittedRoots=actual.admittedRoots,admission={planningCalls:actual.admittedPlanningCalls,carvingChunks:actual.admittedCarvingChunks,chargedCells:actual.chargedCarvingInputCells},workerFingerprint=actual.runtimeSettingsFingerprint,nativeFingerprint=native.runtimeSettingsFingerprint;assert.match(workerFingerprint,/^[0-9a-f]+$/);assert.equal(actual.settingsFingerprintPortable,false);delete actual.admittedRoots;delete native.admittedRoots;for(const field of ['admittedPlanningCalls','admittedCarvingChunks','chargedCarvingInputCells']){delete actual[field];delete native[field];}delete actual.runtimeSettingsFingerprint;delete native.runtimeSettingsFingerprint;assert.deepEqual(actual,native);assert.ok(admittedRoots>=0&&admittedRoots<=32);results.push({...actual,admittedRoots,admission,workerRuntimeSettingsFingerprint:workerFingerprint,nativeRuntimeSettingsFingerprint:nativeFingerprint});}
  assert.ok(results[0].layers.some(layer=>layer.featureType==='STANDING_POOL'&&layer.channel&&layer.fluidOwned));
  assert.equal(JSON.parse(api.sampleHydrologyColumn(expected[0].x,expected[0].z)).admittedRoots,0);
  assert.equal(JSON.parse(api.generationSessionStatistics()).activeLeases,0);assert.equal(JSON.parse(api.generationSessionStatistics()).scopeBound,false);
  assert.throws(()=>api.sampleHydrologyColumn(30000000,0));api.releaseTerrain();assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);
  const messages=[],manifestForWorker=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));
  const sandbox={navigator:{userAgent:'Node controlled worker host'},performance,crypto:webcrypto,TextEncoder,TextDecoder,DataView,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Float64Array,setTimeout,clearTimeout,console,stubApi:api,stubManifest:manifestForWorker,postMessage:message=>messages.push(message)};sandbox.self=sandbox;
  const context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);vm.runInContext('runtime=Promise.resolve({api:stubApi,manifest:stubManifest});registryRuntime=Promise.resolve({installed:true});',context);
  await sandbox.onmessage({data:{kind:'generate',id:1,options:{field:'terrain',dimensionKey:'terrain3d',packSnapshot:{resources:Object.entries(resources).map(([path,value])=>({path,text:JSON.stringify(value)}))},seed:'1',width:1,height:1,x:0,y:0,z:0,span:16}}});
  assert.match(messages.find(message=>message.error)?.error||'',/Complete hydrology terrain previews are not connected/);assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);
  let relay=true,latestWorker;const previousWorker=globalThis.Worker;
  globalThis.Worker=class{constructor(){latestWorker=this;this.terminated=false;}postMessage(data){if(relay)sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){this.terminated=true;}};
  const originalPost=sandbox.postMessage;sandbox.postMessage=message=>{messages.push(message);latestWorker?.onmessage?.({data:structuredClone(message)});};
  const client=new GenerationClient();let cancellation;
  try{
    const snapshot={resources:Object.entries(resources).map(([path,value])=>({path,text:JSON.stringify(value)}))};
    const report=await client.sampleHydrologyColumn(snapshot,'terrain3d','1',expected[0].x,expected[0].z);assert.equal(report.scope,'native-hydrology-column-development');assert.equal(report.dimension,'terrain3d');assert.equal(report.seed,'1');assert.equal(report.wasmSha256,manifestForWorker.wasmSha256);assert.match(report.snapshotSha256,/^[0-9a-f]{64}$/);
    const recovered={...report.column},recoveryExpected={...expected[0]};for(const field of ['admittedRoots','admittedPlanningCalls','admittedCarvingChunks','chargedCarvingInputCells','runtimeSettingsFingerprint']){delete recovered[field];delete recoveryExpected[field];}assert.deepEqual(recovered,recoveryExpected);assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);
    await assert.rejects(client.sampleHydrologyColumn(snapshot,'terrain3d','1',1.5,0),/whole-block/);await assert.rejects(client.sampleHydrologyColumn(snapshot,'terrain3d','9223372036854775808',0,0),/long range/);
    client.dispose();relay=false;const pending=client.sampleHydrologyColumn(snapshot,'terrain3d','1',0,0),worker=latestWorker;const rejected=assert.rejects(pending,{name:'AbortError'});client.cancel();await rejected;assert.equal(worker.terminated,true);assert.equal(client.workers.size,0);cancellation={controlledHost:true,synchronousWorkerTerminated:true,requestRejected:true};
  }finally{client.dispose();sandbox.postMessage=originalPost;globalThis.Worker=previousWorker;}
  const manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));
  await fs.writeFile(path.join(local,'native-hydrology-smoke-results.json'),JSON.stringify({scope:'native-hydrology-column-development',result:'pass',fixtures:1,seeds:1,columns:2,unsupportedPreview:{actualWorkerCode:true,provisionalTerrainRefused:true,contextReleased:true,freshContextRecovery:true},authoringTransport:{actualWorkerAndClient:true,selectedPoolCompared:true,snapshotAndModuleIdentity:true,contextReleased:true,invalidCoordinatesAndSeedRefused:true,cancellation},results,resources:Object.entries(resources).map(([name,value])=>({path:name,sha256:createHash('sha256').update(JSON.stringify(value)).digest('hex')})),wasmSha256:createHash('sha256').update(await fs.readFile(path.join(base,'iris.wasm'))).digest('hex'),manifestWasmSha256:manifest.wasmSha256,referenceKey,settingsFingerprintComparison:{compared:false,reason:"Original native settings fingerprint includes record hashes of enum values; Java Enum.hashCode is an identity hash. Both runtime-local values are retained, and shared/persistent hydrology caching is unavailable."},browserVerified:false,webGpuVerified:false,terrainParityVerified:false,completePipeline:false},null,2)+'\n');
  console.log('Native hydrology selected columns match JVM: one standing pool and one negative coordinate; warm reuse, bounds, release. No volume/state sweep.');
  }
}finally{await fs.rm(directory,{recursive:true,force:true});}
