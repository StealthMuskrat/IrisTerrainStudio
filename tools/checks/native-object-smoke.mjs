// One tiny native-written object, bounded inspection, binary transport and cache behavior.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
import {captureNativePack} from '../../packages/iris-engine/pack-snapshot.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'object-smoke-')),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
const previousWorker=globalThis.Worker;let client,timeout;
try{
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[classes,...new Set(captures.flatMap(capture=>capture.classpath.map(entry=>entry.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args){const file=await fs.open(path.join(temporary,binary+'.log'),'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Native object reference exited '+code)));});}catch(error){console.error((await fs.readFile(path.join(temporary,binary+'.log'),'utf8')).split('\n').slice(-15).join('\n'));throw error;}finally{await file.close();}}
  const binary=path.join(temporary,'sample.iob'),referenceFile=path.join(temporary,'reference.json');
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeObjectLinkCheck.java']);await run('java',[`-Djava.io.tmpdir=${path.join(local,'tmp')}`,'-classpath',classpath,'art.arcane.iris.probe.NativeObjectLinkCheck',binary,referenceFile]);
  const bytes=new Uint8Array(await fs.readFile(binary)),reference=JSON.parse(await fs.readFile(referenceFile,'utf8')),changedBytes=new Uint8Array(await fs.readFile(path.join(temporary,'changed.iob')));assert.equal(changedBytes.length,bytes.length);assert.equal(reference.blockCount,2);
  const rows=[{path:'objects/nested/sample.iob'},{path:'biomes/raw.json'},{path:'assets/preserved.bin'}],text='{"unknownInteger":9007199254740993}';
  const snapshot=await captureNativePack(rows,async()=>({text}),{readBinary:async()=>({bytes})});assert.equal(snapshot.resources.length,2);assert.equal(snapshot.resources[0].text,text);assert.notEqual(snapshot.resources[1].bytes,bytes);assert.equal(snapshot.bytes,text.length*2+bytes.length);
  await assert.rejects(captureNativePack([{path:'objects/../sample.iob'}],async()=>({text}),{readBinary:async()=>({bytes})}),/Invalid pack resource path/);
  const scripts=new Map();let context,receiver,generations=0;
  const sandbox={performance,crypto:webcrypto,TextDecoder,TextEncoder,DataView,ArrayBuffer,Uint8Array,Float64Array,WebAssembly,WeakRef,FinalizationRegistry,setTimeout,clearTimeout,console,Response,
    Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){const key='runtime-'+scripts.size;scripts.set(key,new TextDecoder().decode(blob.parts[0]));return key;},revokeObjectURL(key){scripts.delete(key);}},
    fetch:async url=>{assert.ok(url.startsWith('/app/'));return new Response(await fs.readFile(path.join(root,'apps/web',url.slice(5))));},importScripts:url=>vm.runInContext(scripts.get(url),context),postMessage:data=>receiver?.({data})};sandbox.self=sandbox;context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);
  globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){if(data.kind==='generate')generations++;const message=structuredClone(data);sandbox.onmessage({data:message}).catch(error=>this.onerror?.({message:error.message}));}terminate(){receiver=null;}};
  client=new GenerationClient();
  timeout=setTimeout(()=>{throw new Error('Object worker timed out');},15000);
  const inspect=await client.inspectPack(snapshot,'objects','nested/sample');assert.equal(inspect.resource.found,true);assert.equal(inspect.resources,2);assert.deepEqual(Array.from(inspect.resource.dimensions),reference.dimensions);assert.equal(inspect.resource.blockCount,reference.blockCount);assert.deepEqual(Array.from(inspect.resource.paletteKeys),reference.paletteKeys);assert.deepEqual(JSON.parse(JSON.stringify(inspect.resource.blocks)),reference.blocks);assert.equal(inspect.resource.placementConnected,false);assert.equal(inspect.resource.tileEntitiesSupported,false);
  const bad={resources:[{path:'objects/truncated.iob',bytes:bytes.slice(0,-1)}]};await assert.rejects(client.inspectPack(bad,'objects','truncated'),/Cannot decode native object/);
  const tiled=bytes.slice();tiled[tiled.length-1]=1;await assert.rejects(client.inspectPack({resources:[{path:'objects/tiled.iob',bytes:tiled}]},'objects','tiled'),/tile-entity payloads/);
  assert.equal((await client.inspectPack(snapshot,'objects','nested/sample')).resource.blockCount,2,'A failed decode contaminated the next snapshot');
  const changed={...snapshot,resources:snapshot.resources.map(resource=>resource.bytes?{path:resource.path,bytes:changedBytes}:resource)};const modified=await client.inspectPack(changed,'objects','nested/sample');assert.ok(modified.resource.paletteKeys.includes('minecraft:glass'));assert.ok(!modified.resource.paletteKeys.includes('minecraft:stone'),'A previous snapshot leaked its palette cache');
  const options={field:'iris-style2d',style:'STATIC',seed:'1',width:1,height:1,x:0,y:0,z:0,span:1,packSnapshot:snapshot};
  const result=await client.generate(options);assert.equal(await client.generate(options),result);await client.generate({...options,packSnapshot:changed});assert.equal(generations,2,'Changed binary contents reused a stale preview');
  clearTimeout(timeout);
  const manifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'),'utf8'));
  await fs.writeFile(path.join(local,'native-object-smoke-results.json'),JSON.stringify({result:'pass',fixtures:1,storedInputBlocks:3,decodedBlockProbes:2,nativeFiltering:'structure_void removed by original reader',reference,binaryBytes:bytes.length,binarySha256:createHash('sha256').update(bytes).digest('hex'),wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,workerGenerations:generations,checks:['raw JSON token preservation','owned binary snapshot','nested object path','native V2 dimensions and two decoded states','native raw palette and same-path snapshot cache isolation','truncation rejected','tile payload refused','snapshot recovery after failure','binary-aware cache reuse and invalidation'],legacyV1Verified:false,browserVerified:false,placementConnected:false},null,2)+'\n');
  console.log('Targeted native object smoke passed: one tiny fixture, two block probes, binary snapshot/worker/cache and failure recovery. No terrain or exhaustive state sweep.');
}finally{clearTimeout(timeout);client?.dispose();globalThis.Worker=previousWorker;await fs.rm(temporary,{recursive:true,force:true});}
