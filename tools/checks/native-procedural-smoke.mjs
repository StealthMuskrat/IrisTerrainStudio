// Two tiny native procedural variants, four material probes, actual worker/client delivery.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
import {captureNativePack} from '../../packages/iris-engine/pack-snapshot.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'procedural-smoke-')),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
const previousWorker=globalThis.Worker;let client,timeout;
try{
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[classes,...new Set(captures.flatMap(capture=>capture.classpath.map(entry=>entry.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args){const file=await fs.open(path.join(temporary,binary+'.log'),'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Native procedural reference exited '+code)));});}catch(error){console.error((await fs.readFile(path.join(temporary,binary+'.log'),'utf8')).split('\n').slice(-15).join('\n'));throw error;}finally{await file.close();}}
  const fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'),names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'];
  const resources=await Promise.all(names.map(async name=>({path:name,text:await fs.readFile(path.join(fixture,name),'utf8')})));const biome=JSON.parse(resources[2].text);biome.proceduralObjects={trees:[{name:'small-oak',variants:1,seed:'EXACT_LONG',heightMin:4,heightMax:4,roots:false}],formations:[{name:'small-rock',variants:1,seed:17,form:'BOULDER',heightMin:3,heightMax:3,baseWidthMin:2,baseWidthMax:2}]};resources[2].text=JSON.stringify(biome).replace('"EXACT_LONG"','9007199254740993');
  const pack=path.join(temporary,'pack');for(const resource of resources){const filename=path.join(pack,resource.path);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,resource.text);}const referenceFile=path.join(temporary,'reference.json');
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeProceduralLinkCheck.java']);await run('java',[`-Djava.io.tmpdir=${path.join(local,'tmp')}`,'-classpath',classpath,'art.arcane.iris.probe.NativeProceduralLinkCheck',pack,referenceFile]);
  const references=JSON.parse(await fs.readFile(referenceFile,'utf8')),snapshot=await captureNativePack(resources,async name=>resources.find(resource=>resource.path===name));
  const scripts=new Map();let context,receiver,generations=0;
  const sandbox={navigator:{userAgent:'Node controlled worker host'},performance,crypto:webcrypto,TextDecoder,TextEncoder,DataView,ArrayBuffer,Uint8Array,Float64Array,WebAssembly,WeakRef,FinalizationRegistry,setTimeout,clearTimeout,console,Response,
    Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){const key='runtime-'+scripts.size;scripts.set(key,new TextDecoder().decode(blob.parts[0]));return key;},revokeObjectURL(key){scripts.delete(key);}},
    fetch:async url=>{assert.ok(url.startsWith('/app/'));return new Response(await fs.readFile(path.join(root,'apps/web',url.slice(5))));},importScripts:url=>vm.runInContext(scripts.get(url),context),postMessage:data=>receiver?.({data:structuredClone(data)})};sandbox.self=sandbox;context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);
  globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){if(data.kind==='generate')generations++;const message=structuredClone(data);sandbox.onmessage({data:message}).catch(error=>this.onerror?.({message:error.message}));}terminate(){receiver=null;}};
  client=new GenerationClient();
  timeout=setTimeout(()=>{throw new Error('Procedural worker timed out');},15000);
  const info=await client.inspectPack(snapshot,'biomes','ledges');assert.deepEqual(Array.from(info.resource.proceduralObjects,entry=>entry.family),['trees','formations']);assert.equal(info.resource.proceduralObjects[0].seed,'9007199254740993');
  const results=[];let firstResult;
  for(const reference of references){
    const options={field:'procedural-object',seed:'0',width:1,height:1,x:0,y:0,z:0,span:1,packSnapshot:snapshot,procedural:{folder:'biomes',key:'ledges',family:reference.family,index:0,variant:0}},result=await client.generate(options),volume=result.volume;
    assert.ok(volume.blocks instanceof Uint32Array);assert.deepEqual([volume.width,volume.height,volume.depth],reference.size);assert.deepEqual(Array.from(volume.origin),reference.origin);assert.equal(volume.metadata.key,reference.key);assert.equal(volume.metadata.blockCount,reference.blockCount);assert.equal(volume.metadata.coordinateSpace,'native-object-local');assert.equal(volume.metadata.placementConnected,false);assert.equal(volume.metadata.completePipeline,false);assert.equal(volume.metadata.seed,reference.family==='trees'?'9007199254740993':'17');
    for(const[x,y,z,key]of reference.probes){const index=x-volume.origin[0]+volume.width*(z-volume.origin[2]+volume.depth*(y-volume.origin[1]));assert.equal(volume.palette[volume.blocks[index]].stateKey,key);}
    assert.equal(await client.generate(options),result);if(reference.family==='trees')firstResult=result;
    results.push({...reference,seed:volume.metadata.seed});
  }
  const api=(await vm.runInContext('runtime',context)).api;assert.equal(JSON.parse(api.openPack()).resources,0,'Procedural native inputs were retained after serialization');api.clear();
  assert.equal(generations,2);assert.ok(firstResult.volume.palette.some(state=>state.stateKey.includes('persistent=false')),'Native plausible leaves lost their decay state');
  await assert.rejects(client.generate({field:'procedural-object',seed:'0',width:1,height:1,x:0,y:0,z:0,span:1,packSnapshot:snapshot,procedural:{folder:'biomes',key:'ledges',family:'trees',index:0,variant:1}}),/variant index/);
  clearTimeout(timeout);
  const manifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'),'utf8'));
  await fs.writeFile(path.join(local,'native-procedural-smoke-results.json'),JSON.stringify({result:'pass',fixtures:1,familiesChecked:2,variantsPerFamily:1,blockProbes:4,workerGenerations:generations,results,resources:resources.map(resource=>({path:resource.path,sha256:createHash('sha256').update(resource.text).digest('hex')})),wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,checks:['native descriptors and exact long seed','native pool key, bounds and block count','four material probes','native plausible leaf state','typed volume and local coordinates','cache reuse','native input ownership released after serialization','out-of-range variant refusal'],worldPlacementVerified:false,browserVerified:false,unverifiedFamilies:['coral','fungi','crystals']},null,2)+'\n');
  console.log('Targeted native procedural smoke passed: two tiny baked variants, four block probes, worker/client metadata and cache reuse. No terrain sweep.');
}finally{clearTimeout(timeout);client?.dispose();globalThis.Worker=previousWorker;await fs.rm(temporary,{recursive:true,force:true});}
