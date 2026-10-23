// One small tree fixture with accepted/rejected native single-placement cases; eight probes total.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'placement-smoke-')),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
const roots=process.argv.includes('--roots'),resultName=roots?'native-rooted-placement-smoke':'native-placement-smoke';
let client,timeout;const previousWorker=globalThis.Worker;
try {
  const fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'),names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'];
  const resources=await Promise.all(names.map(async name=>({path:name,text:await fs.readFile(path.join(fixture,name),'utf8')})));
  const dimension=JSON.parse(resources[0].text),region=JSON.parse(resources[1].text),biome=JSON.parse(resources[2].text);dimension.dimensionHeight={min:0,max:64};dimension.logicalHeight=64;delete biome.terrain3D;biome.generators[0].min=32;biome.generators[0].max=32;
  biome.layers=[{palette:[{block:'minecraft:grass_block'}],minHeight:1,maxHeight:1},{palette:[{block:'minecraft:stone'}]}];biome.proceduralObjects={trees:[{name:'small-oak',variants:1,seed:17,heightMin:4,heightMax:4,roots,rotation:{enabled:false}}]};
  const cases=[];for(const reject of [false,true]){
    const configured=structuredClone(biome);if(reject)configured.proceduralObjects.trees[0].clamp={minimumHeight:50,maximumHeight:50};
    const snapshot=resources.map((resource,index)=>({path:resource.path,text:JSON.stringify(index===0?dimension:index===1?region:index===2?configured:JSON.parse(resource.text))})),pack=path.join(temporary,reject?'rejected':'accepted');for(const resource of snapshot){const target=path.join(pack,resource.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,resource.text);}cases.push({reject,resources:snapshot,pack});
  }
  const sampling={controls:[[0,0,0],[8,8,8],[8,63,8]],materials:['minecraft:oak_log','minecraft:oak_leaves'],ys:[33,34,35,36,37,38,39,40],limit:2};
  const requestFile=path.join(temporary,'request.json'),referenceFile=path.join(temporary,'reference.json');await fs.writeFile(requestFile,JSON.stringify({packs:cases.map(row=>row.pack),seeds:['1'],points:[[0,0]],singlePlacement:{key:'ledges',seed:'1'},materialSampling:sampling}));
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[classes,...new Set(captures.flatMap(capture=>capture.classpath.map(entry=>entry.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args){const log=path.join(temporary,binary+'.log'),file=await fs.open(log,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Native placement reference exited '+code)));});}catch(error){console.error((await fs.readFile(log,'utf8')).split('\n').slice(-15).join('\n'));throw error;}finally{await file.close();}}
  await run('javac',['-classpath',classpath,'-d',classes,'.upstream/VolmLib/native/minecraft-common/src/main/java/art/arcane/volmlib/nativelib/minecraft26_2/modded/NativeStateRotator.java','.upstream/Iris/adapters/modded-common/src/main/java/art/arcane/iris/modded/ModdedStateRotator.java','tools/checks/NativeTerrainLinkCheck.java']);await run('java',['-Dvolmlib.noise.nativeBillow=false',`-Djava.io.tmpdir=${path.join(local,'tmp')}`,'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',requestFile,referenceFile]);
  const references=JSON.parse(await fs.readFile(referenceFile,'utf8')).map(result=>result[0][0].singlePlacement);assert.equal(references[0].selected,2);assert.equal(references[0].probes.length,5);assert.ok(references[0].placedY>=0);assert.ok(references[0].journaledCells>0);assert.equal(references[1].placedY,-1);assert.equal(references[1].selected,0);assert.equal(references[1].probes.length,3);assert.equal(references[1].journaledCells,0);
  const scripts=new Map();let context,receiver;let generations=0;
  const sandbox={navigator:{userAgent:'Node controlled Wasm host'},performance,crypto:webcrypto,TextDecoder,TextEncoder,DataView,ArrayBuffer,Uint8Array,Float64Array,WebAssembly,WeakRef,FinalizationRegistry,setTimeout,clearTimeout,console,Response,
    Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){const key='runtime-'+scripts.size;scripts.set(key,new TextDecoder().decode(blob.parts[0]));return key;},revokeObjectURL(key){scripts.delete(key);}},
    fetch:async url=>{assert.ok(url.startsWith('/app/'));return new Response(await fs.readFile(path.join(root,'apps/web',url.slice(5))));},importScripts:url=>vm.runInContext(scripts.get(url),context),postMessage:data=>receiver?.({data:structuredClone(data)})};sandbox.self=sandbox;context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);
  globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){if(data.kind==='generate')generations++;sandbox.onmessage({data:structuredClone(data)}).catch(error=>this.onerror?.({message:error.message}));}terminate(){receiver=null;}};
  client=new GenerationClient();const results=[];
  for(let i=0;i<cases.length;i++){
    const fixture=cases[i],reference=references[i],options={field:'procedural-placement',seed:'1',dimensionKey:'terrain3d',packSnapshot:{resources:fixture.resources},procedural:{folder:'biomes',key:'ledges',family:'trees',index:0,variant:0},width:16,height:16,x:0,y:16,z:0,span:16,buffet:false};
    const result=await Promise.race([client.generate(options),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Placement worker timed out')),15000);})]);clearTimeout(timeout);
    const volume=result.volume;assert.ok(volume.blocks instanceof Uint32Array);assert.equal(volume.height,64);assert.equal(volume.metadata.accepted,!fixture.reject);assert.equal(volume.metadata.placedY,reference.placedY);assert.equal(volume.metadata.journaledCells,reference.journaledCells);assert.equal(volume.metadata.nativeDestinationTransaction,true);assert.equal(volume.metadata.prerequisiteJournal,true);assert.equal(volume.metadata.markerWindowChunks,9);assert.equal(volume.metadata.automaticScatter,false);assert.equal(volume.metadata.crossSourceCollisionReplay,false);assert.equal(volume.metadata.completePipeline,false);assert.equal(volume.metadata.placement.configuredSeed,'17');assert.equal(volume.metadata.placement.placementSeed,'1');
    for(const[x,y,z,key]of reference.probes)assert.equal(volume.palette[volume.blocks[x+16*(z+16*y)]].stateKey,key,`Placement probe ${x},${y},${z}`);
    assert.equal(await client.generate(options),result);results.push({case:fixture.reject?'rejected':'accepted',...reference,resources:fixture.resources.map(resource=>({path:resource.path,sha256:createHash('sha256').update(resource.text).digest('hex')}))});
  }
  assert.equal(generations,2);const manifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'),'utf8'));
  await fs.writeFile(path.join(local,resultName+'-results.json'),JSON.stringify({result:'pass',roots,baseFixtures:1,cases:2,seeds:1,chunksPerCase:1,probesCompared:8,workerGenerations:generations,results,wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,scope:'native-procedural-placement-development',automaticScatterVerified:false,crossSourceCollisionReplayVerified:false,fullGeometryParityVerified:false,browserVerified:false},null,2)+'\n');
  console.log('Targeted native placement smoke passed: one small tree fixture, accepted/rejected cases, eight probes, native journal counts and worker/client cache. No exhaustive state comparison.');
} finally {clearTimeout(timeout);client?.dispose();globalThis.Worker=previousWorker;await fs.rm(temporary,{recursive:true,force:true});}
