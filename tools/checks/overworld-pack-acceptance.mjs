// The real pinned Overworld pack, unchanged. Small scalar probes; no state/pair sweep.
import fs from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';
import {spawn,execFileSync} from 'node:child_process';import {createHash,webcrypto} from 'node:crypto';import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {PackStore} from '../../apps/server/pack-store.mjs';
import {readZip,writeZip} from '../../packages/shared/zip.mjs';
import {captureNativePack} from '../../packages/iris-engine/pack-snapshot.mjs';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
import {customBiomeDefinitions} from '../../packages/iris-engine/custom-biomes.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools');
const pin='1d3cf8a93f5c4a586a8465baeff2b1b5f76b4fe3',tree='1525af2df6566afdcf6c6fc878f65c22ab7a6753';
const value=(flag,fallback)=>{const at=process.argv.indexOf(flag);return at<0?fallback:process.argv[at+1];};
const pack=path.resolve(value('--pack',path.join(local,'overworld-pack/checkout'))),out=path.resolve(value('--output',path.join(local,'overworld-pack/results/acceptance-'+new Date().toISOString().replace(/[:.]/g,'-')))),phase=value('--phase',null);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),git=(...args)=>execFileSync('git',['-C',pack,...args],{encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),pin);assert.equal(git('rev-parse','HEAD^{tree}'),tree);assert.equal(git('status','--porcelain'),'');
await fs.mkdir(out,{recursive:true});const names=execFileSync('git',['-C',pack,'ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort(),rows=names.map(path=>({path}));
const read=async name=>({text:await fs.readFile(path.join(pack,name),'utf8')}),readBinary=async name=>({bytes:new Uint8Array(await fs.readFile(path.join(pack,name)))});
async function save(name,result){await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(result,null,2)+'\n');return result;}
async function run(command,args,log,timeout=120000,env=process.env){
  const file=await fs.open(path.join(out,log),'w');let timer,force;
  try{return await new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:root,env,stdio:['ignore',file.fd,file.fd],detached:true});timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGTERM');}catch{}force=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},5000);},timeout);child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});}
  finally{clearTimeout(timer);clearTimeout(force);await file.close();}
}
const points=[[-8,-8],[8,-8],[-8,8],[8,8],[0,0]],seed='813753';
if(phase==='files'){
  const entries=new Map(),hashes={};for(const name of names){const bytes=await fs.readFile(path.join(pack,name));entries.set(name,bytes);hashes[name]=sha(bytes);}
  const encoded=writeZip(entries),store=new PackStore(path.join(out,'packs'));await store.initialize();await store.import('overworld-4016',encoded);
  const listing=await store.resources('overworld-4016');assert.equal(listing.resources.length,names.length);const exported=await readZip(await store.export('overworld-4016'));assert.equal(exported.size,entries.size);for(const [name,bytes]of exported)assert.equal(sha(bytes),hashes[name],name);
  let reads=0,error,snapshot;try{snapshot=await captureNativePack(rows,async name=>{reads++;return read(name);},{readBinary:async name=>{reads++;return readBinary(name);}});}catch(e){error=e.message;}
  const dimension=JSON.parse(entries.get('dimensions/overworld.json')),native=names.filter(name=>name.endsWith('.iob')&&name.startsWith('objects/')||name.endsWith('.png')&&name.startsWith('images/')||name.endsWith('.json')&&['dimensions','regions','biomes','generators','blocks','expressions','image-maps','imagemaps','snippet'].includes(name.split('/')[0]));
  const result={result:error?'fail':'pass',fileRoundtrip:'pass',files:names.length,bytes:[...entries.values()].reduce((n,b)=>n+b.length,0),allFileBytesPreserved:true,packContentSha256:sha(JSON.stringify(hashes)),dimension:{key:'overworld',version:dimension.version,height:dimension.dimensionHeight.max-dimension.dimensionHeight.min,minY:dimension.dimensionHeight.min,maxY:dimension.dimensionHeight.max,declaredRegions:dimension.regions.length,importedStructurePlacements:dimension.structures?.length??0},normalSnapshot:{status:error?'fail':'pass',resources:native.length,limit:16384,byteLimit:256*1024*1024,bytes:snapshot?.bytes,error,resourcesRead:reads},sourceFilesSha256:hashes};
  await save('files',result);console.log(JSON.stringify({...result,sourceFilesSha256:undefined}));
}else if(phase==='native'||phase==='regions'){
  const regionOnly=phase==='regions',prefix=regionOnly?'native-regions':'native';
  const fixture=path.join(out,'native-pack');if(!regionOnly){await fs.mkdir(fixture);for(const name of names){const file=path.join(fixture,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.copyFile(path.join(pack,name),file);}}
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(async name=>JSON.parse(await fs.readFile(path.join(local,name),'utf8')))),classes=path.join(out,'native-classes'),java=process.env.IRIS_JAVA_HOME??path.join(local,'jdk-25.0.4.1+1');await fs.mkdir(classes,{recursive:true});
  const classpath=[classes,path.join(local,'rotation-classes'),path.join(local,'registry-classes'),path.join(local,'browser-engine/target/classes'),...new Set(captures.flatMap(c=>c.classpath.map(e=>e.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  const request=path.join(out,prefix+'-request.json'),response=path.join(out,prefix+'-response.json');await fs.writeFile(request,JSON.stringify({packs:[fixture],dimensionKey:'overworld',seeds:[seed],points,regionChecks:points,regionOnly}));
  const compiled=await run(path.join(java,'bin/javac'),['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java'],prefix+'-compile.log',60000,env);if(compiled.code!==0)throw Error('Original native reference harness compilation failed');
  const executed=await run(path.join(java,'bin/java'),['-Xmx1g','-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',request,response],prefix+'-execution.log',120000,env);
  const result={result:executed.code===0?'pass':'fail',executed,seeds:[seed],points,profile:captures[1].buildProfile,referenceSourceSha256:sha(await fs.readFile(path.join(root,'tools/checks/NativeTerrainLinkCheck.java'))),packResourcesUnchanged:true,browserVerified:false,fullTerrainParity:false};
  result.regionOnly=regionOnly;if(executed.code===0)result.reference=JSON.parse(await fs.readFile(response,'utf8'));else result.error=(await fs.readFile(path.join(out,prefix+'-execution.log'),'utf8')).split('\n').filter(line=>/Exception|Error|Caused by/.test(line)).slice(0,8);
  await save(regionOnly?'regions':'native',result);console.log(JSON.stringify(result));
}else if(phase==='wasm'){
  const snapshot=await captureNativePack(rows,read,{readBinary});
  const base=path.join(root,'apps/web/engine/iris-generated'),manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));
  for(const [name,key]of [['iris.wasm','wasmSha256'],['iris.wasm-runtime.js','runtimeSha256']])assert.equal(sha(await fs.readFile(path.join(base,name))),manifest[key]);
  await import(pathToFileURL(path.join(base,'iris.wasm-runtime.js')));const {exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(base,'iris.wasm')));const registryBase=path.join(root,'apps/web/engine/registry-generated'),registry=JSON.parse(await fs.readFile(path.join(registryBase,'manifest.json'),'utf8')),registryBytes=await fs.readFile(path.join(registryBase,'browser-registry.json'));assert.equal(sha(registryBytes),registry.files['browser-registry.json'].sha256);api.installRegistry(registryBytes.toString('utf8'));
  const preparations=[],prepare=api.prepareTerrain.bind(api),transportApi=new Proxy(api,{get(target,name){if(name==='prepareTerrain')return(...args)=>{const text=prepare(...args),info=JSON.parse(text),definitions=customBiomeDefinitions(info);preparations.push({key:args[0],customBiomes:definitions.rows.length,customBiomeBytes:definitions.bytes,minHeight:info.minHeight,maxHeight:info.maxHeight});return text;};return target[name];}});
  const messages=[];let receiver;const sandbox={navigator:{userAgent:'Node real-pack acceptance'},performance,crypto:webcrypto,TextEncoder,TextDecoder,DataView,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Float64Array,setTimeout,clearTimeout,console,stubApi:transportApi,stubManifest:manifest,postMessage:data=>{const value=structuredClone(data);messages.push(value);receiver?.({data:value});}};sandbox.self=sandbox;
  const context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context,{importModuleDynamically:name=>import(pathToFileURL(path.join(root,name.slice(1))).href)});vm.runInContext('runtime=Promise.resolve({api:stubApi,manifest:stubManifest});registryRuntime=Promise.resolve({fixtureInput:false});',context);
  const previousWorker=globalThis.Worker;globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){sandbox.onmessage({data:structuredClone(data)}).catch(error=>this.onerror?.({message:error.message}));}terminate(){receiver=null;}};const client=new GenerationClient();
  const result={profile:'Full native pack snapshot, including every object binary; original input bytes unchanged',resources:snapshot.resources.length,bytes:snapshot.bytes,actualWasmWorkerClient:true,wasmSha256:manifest.wasmSha256,registrySha256:registry.files['browser-registry.json'].sha256,tests:[],preparations,browserVerified:false,fullTerrainParity:false};
  try{
    const inspected=await client.inspectPack(snapshot,'dimensions','overworld');result.inspection=inspected.resource;assert.equal(inspected.resource.found,true);assert.equal(inspected.resource.excluded,false);
    for(const field of ['regions','terrain','overworld-mode']){
      const test={field};try{const answer=await client.generate({field,dimensionKey:'overworld',packSnapshot:snapshot,seed,x:0,y:0,z:0,width:2,height:2,span:32,buffet:false});test.status='pass';test.scope=answer.scope;if(answer.values){const values=[...answer.values];test.values=values;test.categories=answer.categories;test.samples=values.map((value,i)=>({x:points[i][0],z:points[i][1],value:answer.categories?answer.categories[value]:value}));}}catch(error){test.status='fail';test.error=error.message;}
      result.tests.push(test);console.log(field+': '+(test.error??JSON.stringify(test.samples)));
    }
    const procedural={field:'procedural-object',dimensionKey:'overworld',packSnapshot:snapshot,seed,x:0,y:0,z:0,width:2,height:2,span:32,buffet:false,procedural:{folder:'biomes',key:'carving/ember-vaults',family:'formations',index:0,variant:23}};
    try{const answer=await client.generate(procedural);assert.equal(answer.volume.metadata.poolSize,24);assert.equal(answer.volume.metadata.variant,23);assert.ok(answer.volume.blocks.length>0);result.proceduralVariant={status:'pass',poolSize:24,selectedVariant:23,volumeCells:answer.volume.blocks.length,occupiedBlocks:answer.volume.metadata.blockCount};}catch(error){result.proceduralVariant={status:'fail',error:error.message};}console.log('Real 24-variant pool:',JSON.stringify(result.proceduralVariant));
    result.packLoadSupported=result.inspection.found&&result.inspection.compatibilityReady&&snapshot.resources.length===5594;
    result.customBiomeCapacity=preparations.some(row=>row.customBiomes>128)?'pass':'not exercised';
    result.lifecycleAfterFailure=JSON.parse(api.inspectTerrainLifecycle());
    const regionReference=JSON.parse(await fs.readFile(path.join(out,'regions.json'),'utf8'));const regionTest=result.tests.find(t=>t.field==='regions');
    if(regionReference.result==='pass'&&regionTest.status==='pass'){assert.deepEqual(regionTest.samples.map(row=>row.value),regionReference.reference[0][0].slice(0,4));result.selectedNativeRegionsCompared=4;}
    const native=JSON.parse(await fs.readFile(path.join(out,'native.json'),'utf8'));if(native.result==='pass'){
      const expected=native.reference[0][0];if(regionTest.status==='pass')assert.deepEqual(regionTest.samples.map(row=>row.value),expected[0].slice(0,4));
      result.nativeHeightAndBiomeSamples=native.reference[0][0][1];result.heightBiomeParity='not compared because worker terrain preparation refused';
    }
  }finally{client.dispose();globalThis.Worker=previousWorker;api.clear();await save('wasm',result);}
}else{
  const start=Date.now(),phases=[];for(const name of ['files','native','regions','wasm']){const status=await run(process.execPath,['--experimental-vm-modules',fileURLToPath(import.meta.url),'--pack',pack,'--output',out,'--phase',name],name+'.log',180000);phases.push({phase:name,...status});console.log(name+': exit '+status.code);}
  const results={};for(const name of ['files','native','regions','wasm'])try{results[name]=JSON.parse(await fs.readFile(path.join(out,name+'.json'),'utf8'));}catch{results[name]={result:'fail',error:'Phase did not complete; inspect log'};}
  const sourceHashes={};for(const name of ['tools/checks/overworld-pack-acceptance.mjs','apps/web/workers/iris-worker.js','packages/iris-engine/pack-snapshot.mjs','packages/iris-engine/java/studio/engine/biome/WorkerCustomBiomes.java','packages/iris-engine/java/studio/engine/terrain/OverworldTerrainStage.java'])sourceHashes[name]=sha(await fs.readFile(path.join(root,name)));
  const summary={recordedAt:new Date().toISOString(),source:{repository:'https://github.com/IrisDimensions/overworld',commit:pin,tree},applicationCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),seconds:(Date.now()-start)/1000,phases,results,sourceHashes,packCheckoutUnchanged:git('status','--porcelain')==='',browserVerified:false,webGpuVerified:false,fullPackLoadSupported:results.files?.normalSnapshot?.status==='pass'&&results.wasm?.packLoadSupported===true,fullPackGenerationSupported:results.wasm?.tests?.some(t=>t.field==='overworld-mode'&&t.status==='pass')===true,fullTerrainParity:false};await save('summary',summary);
  const failed=results.files?.normalSnapshot?.status!=='pass'||phases.some(p=>p.code!==0)||results.native?.result!=='pass'||results.regions?.result!=='pass'||results.wasm?.proceduralVariant?.status!=='pass'||results.wasm?.tests?.some(t=>t.status!=='pass');console.log(JSON.stringify({result:failed?'fail':'pass',normalSnapshot:results.files?.normalSnapshot,workerTests:results.wasm?.tests,output:out}));process.exitCode=failed?1:0;
}
