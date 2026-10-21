// One fixture, one seed/chunk, a bounded set of material probes, and the real worker/client path.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'deposit-smoke-')),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
const finish=process.argv.includes("--finish"),resultName=finish?"native-material-finish-smoke":"native-deposit-smoke";
let client,timeout;const previousWorker=globalThis.Worker;
try {
  const fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'),names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'];
  const resources=await Promise.all(names.map(async name=>({path:name,text:await fs.readFile(path.join(fixture,name),'utf8')})));
  const dimension=JSON.parse(resources[0].text),region=JSON.parse(resources[1].text),biome=JSON.parse(resources[2].text);dimension.dimensionHeight={min:0,max:64};dimension.logicalHeight=64;delete biome.terrain3D;biome.generators[0].min=32;biome.generators[0].max=32;
  const deposit=(block,y,count)=>({palette:[{block}],minHeight:y,maxHeight:y,minSize:1,maxSize:1,minPerChunk:count,maxPerChunk:count,surfaceClearance:0,varience:1});
  dimension.deposits=[deposit('minecraft:diamond_ore',16,2)];region.deposits=[deposit('minecraft:iron_ore',20,1)];biome.deposits=[deposit('minecraft:granite',24,1)];
  if(finish){biome.layers=[{palette:[{block:'minecraft:grass_block'}],minHeight:1,maxHeight:1},{palette:[{block:'minecraft:stone'}]}];biome.decorators=[{palette:[{block:'minecraft:dandelion'}],chance:1,forcePlace:true}];biome.floatingChildBiomes=[{footprintThreshold:0,minHeightAboveSurface:48,maxHeightAboveSurface:48,topShapeMode:'FLAT',maxTopHeight:2,bottomDepthMin:2,bottomDepthMax:2,inheritObjects:false}];}
  for(const[index,value]of [[0,dimension],[1,region],[2,biome]])resources[index].text=JSON.stringify(value);
  const pack=path.join(temporary,'pack');for(const resource of resources){const target=path.join(pack,resource.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,resource.text);}
  const sampling={controls:[[0,0,0],[0,63,0],[8,8,8],[0,32,0],[15,30,15]],materials:['minecraft:diamond_ore','minecraft:iron_ore','minecraft:granite'],ys:[16,20,24],limit:8};
  if(finish)sampling.controls.push([8,33,8],[8,51,8]);
  const requestFile=path.join(temporary,'request.json'),referenceFile=path.join(temporary,'reference.json');await fs.writeFile(requestFile,JSON.stringify({packs:[pack],seeds:['1'],points:[[0,0]],[finish?"materialFinish":"depositMaterials"]:true,materialSampling:sampling}));
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[classes,...new Set(captures.flatMap(capture=>capture.classpath.map(entry=>entry.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args){const log=path.join(temporary,binary+'.log'),file=await fs.open(log,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Native deposit reference exited '+code)));});}catch(error){console.error((await fs.readFile(log,'utf8')).split('\n').slice(-15).join('\n'));throw error;}finally{await file.close();}}
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java']);await run('java',['-Dvolmlib.noise.nativeBillow=false',`-Djava.io.tmpdir=${path.join(local,'tmp')}`,'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',requestFile,referenceFile]);
  const reference=JSON.parse(await fs.readFile(referenceFile,'utf8'))[0][0][0][finish?'materialFinish':'depositMaterials'];assert.equal(reference.selected,4);assert.equal(reference.probes.length,finish?11:9);assert.equal(reference.scope,finish?'native-overworld-material-finish-development':'native-overworld-deposit-material-stage-development');
  const scripts=new Map();let context,receiver;let generations=0;
  const sandbox={performance,crypto:webcrypto,TextDecoder,TextEncoder,DataView,ArrayBuffer,Uint8Array,Float64Array,WebAssembly,WeakRef,FinalizationRegistry,setTimeout,clearTimeout,console,Response,
    Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){const key='runtime-'+scripts.size;scripts.set(key,new TextDecoder().decode(blob.parts[0]));return key;},revokeObjectURL(key){scripts.delete(key);}},
    fetch:async url=>{assert.ok(url.startsWith('/app/'));return new Response(await fs.readFile(path.join(root,'apps/web',url.slice(5))));},importScripts:url=>vm.runInContext(scripts.get(url),context),postMessage:data=>receiver?.({data})};sandbox.self=sandbox;context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);
  globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){if(data.kind==='generate')generations++;sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){receiver=null;}};
  client=new GenerationClient();const options={field:finish?'material-finish-stage':'deposit-stage',seed:'1',dimensionKey:'terrain3d',packSnapshot:{resources},width:2,height:2,x:0,y:16,z:0,span:16,buffet:false};
  const result=await Promise.race([client.generate(options),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Deposit worker timed out')),15000);})]);clearTimeout(timeout);
  const volume=result.volume;assert.ok(volume.blocks instanceof Uint32Array);assert.equal(volume.height,64);assert.deepEqual(Array.from(volume.origin),[0,0,0]);assert.equal(volume.metadata.depositProcessing,true);assert.equal(volume.metadata.matterInsertion,true);assert.equal(volume.metadata.contentMatterGenerated,false);assert.equal(volume.metadata.completePipeline,false);if(finish){assert.equal(volume.metadata.surfaceDecoration,true);assert.equal(volume.metadata.floatingDecoration,true);assert.equal(volume.metadata.perfection,true);for(const probe of reference.probes.filter(p=>p[1]===33||p[1]===51))assert.equal(probe[3],"minecraft:dandelion");}
  for(const[x,y,z,key]of reference.probes)assert.equal(volume.palette[volume.blocks[x+16*(z+16*y)]].stateKey,key,`Deposit probe ${x},${y},${z}`);
  assert.equal(await client.generate(options),result);assert.equal(generations,1,'Cached deposit preview regenerated');
  await fs.writeFile(path.join(local,resultName+'-results.json'),JSON.stringify({result:'pass',fixtures:1,seeds:1,chunks:1,probesCompared:reference.probes.length,selectedDepositBlocks:reference.selected,probes:reference.probes,workerGenerations:generations,scope:reference.scope,resources:resources.map(resource=>({path:resource.path,sha256:createHash('sha256').update(resource.text).digest('hex'),bytes:Buffer.byteLength(resource.text)}))},null,2)+'\n');
  console.log(`Targeted native ${finish?'material finish':'deposit'} smoke passed: one fixture/seed/chunk, ${reference.probes.length} probes, worker/client metadata and cache reuse. No exhaustive block-state comparison.`);
} finally {clearTimeout(timeout);client?.dispose();globalThis.Worker=previousWorker;await fs.rm(temporary,{recursive:true,force:true});}
