// Two biome fixtures and one authored room; selected probes only, with the actual worker/client route.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=path.join(local,'jdk-25.0.4.1+1'),temporary=await fs.mkdtemp(path.join(local,'biome-finish-smoke-'));
let client;const previousWorker=globalThis.Worker;
try {
 const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[path.join(local,'rotation-classes'),classes,...new Set(captures.flatMap(c=>c.classpath.map(e=>e.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
 async function run(binary,args){const filename=path.join(temporary,binary+'.log'),log=await fs.open(filename,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',log.fd,log.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Native biome/final reference exited '+code)));});}catch(error){console.error((await fs.readFile(filename,'utf8')).split('\n').slice(-22).join('\n'));throw error;}finally{await log.close();}}
 await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java']);
 await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm')));api.installRegistry(await fs.readFile(path.join(local,'session-registry-fixture/browser-registry.json'),'utf8'));
 const fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'),names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'];
 async function resources(){return Promise.all(names.map(async name=>({path:name,text:await fs.readFile(path.join(fixture,name),'utf8')})));}
 async function reference(resources,name,request){const pack=path.join(temporary,name);for(const resource of resources){const target=path.join(pack,resource.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,resource.text);}const input=path.join(temporary,'request.json'),output=path.join(temporary,'reference.json');await fs.writeFile(input,JSON.stringify({packs:[pack],seeds:['1'],points:[],...request}));await run('java',['-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',input,output]);return JSON.parse(await fs.readFile(output,'utf8'))[0][0];}
 let receiver,generations=0,terminated=0,holdDispatch=false;
 const messages=[],sandbox={performance,crypto:webcrypto,TextEncoder,TextDecoder,DataView,ArrayBuffer,Uint8Array,Uint32Array,Float64Array,setTimeout,clearTimeout,console,stubApi:api,postMessage:data=>{messages.push(data);receiver?.({data});}};sandbox.self=sandbox;
 const context=vm.createContext(sandbox),workerSource=await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8');vm.runInContext(workerSource,context);vm.runInContext('runtime=Promise.resolve({api:stubApi,manifest:{irisCommit:"c3a9449a026078c44a87c9776766f54a67779392"}});registryRuntime=Promise.resolve({fixtureInput:true});',context);
 globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){if(data.kind==='generate'){generations++;if(holdDispatch)return;}sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){terminated++;receiver=null;}};
 client=new GenerationClient();
 const options=(field,resources,y)=>({field,seed:'1',dimensionKey:'terrain3d',packSnapshot:{resources},width:2,height:2,x:-8,y,z:-8,span:16,buffet:false});
 const resultRows=[];
 for(const sky of [false,true]){
  const rows=await resources(),dimension=JSON.parse(rows[0].text),biome=JSON.parse(rows[2].text);dimension.dimensionHeight={min:-32,max:32};dimension.logicalHeight=64;dimension.fluidHeight=-32;delete biome.terrain3D;biome.generators[0].min=32;biome.generators[0].max=32;
  biome.biomeScatter=['minecraft:plains','minecraft:badlands'];biome.biomeSkyScatter=sky?['minecraft:desert','minecraft:forest']:[];biome.biomeStyle={style:'WHITE'};
  rows[0].text=JSON.stringify(dimension);rows[2].text=JSON.stringify(biome);
  const points=[];for(const [x,z]of [[0,1],[1,4],[3,6],[7,8],[11,12],[15,15]])for(const y of [-32,31])points.push([x-16,y,z-16]);
  const expected=await reference(rows,sky?'sky':'ground',{physicalBiomeChecks:points}),results=new Map();
  for(const y of [-32,31])results.set(y,await client.generate(options('biome-stage',rows,y)));
  const selected=new Set();for(const[x,y,z,key]of expected){const result=results.get(y);assert.equal(result.scope,'iris-physical-biome-stage-development');assert.equal(result.nativeBiomeActuator,true);assert.equal(result.completePipeline,false);assert.equal(result.width,16);assert.equal(result.height,16);assert.equal(result.x,-8);assert.equal(result.z,-8);assert.equal(result.y,y);assert.equal(result.categories[result.values[(z&15)*16+(x&15)]],key);selected.add(key);}
  for(const key of selected)assert.ok((sky?biome.biomeSkyScatter:biome.biomeScatter).includes(key));
  const count=generations;assert.equal(await client.generate(options('biome-stage',rows,31)),results.get(31));assert.equal(generations,count);
  resultRows.push({sky,probes:expected,resources:rows.map(row=>({path:row.path,sha256:createHash('sha256').update(row.text).digest('hex')}))});
 }
 const rows=await resources(),dimension=JSON.parse(rows[0].text),biome=JSON.parse(rows[2].text);dimension.dimensionHeight={min:-32,max:96};dimension.logicalHeight=128;dimension.fluidHeight=-32;dimension.subterrainFeatures=[{id:'small-room',family:'LAVA_TUBE',biome:'ledges',worldYRange:{min:-24,max:56},spacing:48,probability:1,length:32,radius:8,height:16,fluidDepth:4,chimneyHeight:8,pillarSpacing:0,formationFraction:0}];delete biome.terrain3D;biome.generators[0].min=80;biome.generators[0].max=80;rows[0].text=JSON.stringify(dimension);rows[2].text=JSON.stringify(biome);
 const finalReference=await reference(rows,'lava',{subterrainCheck:true,subterrainFinish:true}),finalOptions={...options('subterrain-finish-stage',rows,0),x:finalReference.x+8,z:finalReference.z+8};const finished=await client.generate(finalOptions),volume=finished.volume;
 assert.equal(finished.scope,'iris-overworld-subterrain-finish-development');assert.equal(volume.metadata.subterrainPreservation,true);assert.equal(volume.metadata.subterrain.preservationApplied,true);assert.equal(volume.metadata.contentMatterGenerated,false);assert.equal(volume.metadata.customBlockProcessing,false);assert.equal(volume.metadata.completePipeline,false);assert.ok(volume.metadata.subterrain.samplingWorkCharged>0&&volume.metadata.subterrain.samplingWorkCharged<=volume.metadata.subterrain.workLimit);
 const kinds=new Set();for(const[x,y,z,key]of finalReference.probes){assert.equal(volume.palette[volume.blocks[x+16*(z+16*y)]].stateKey,key);const cell=JSON.parse(api.inspectSubterrainCell(finalReference.x+x,y-32,finalReference.z+z));kinds.add(cell.kind);}assert.ok(kinds.has('LAVA')&&kinds.has('AIR')&&kinds.has('SOLID'));
 assert.equal(await client.generate(finalOptions),finished);
 await assert.rejects(client.generate(options('biome-stage',rows,-33)),/world-Y bounds/);
 const recovered=await client.generate(options('biome-stage',rows,0));assert.equal(recovered.nativeBiomeActuator,true);
 // Controlled transport check: hold dispatch, then ensure the client terminates its synchronous-stage worker.
 holdDispatch=true;const pending=client.generate({...finalOptions,seed:'2'});for(let i=0;i<30&&!client.pending;i++)await new Promise(resolve=>setTimeout(resolve,0));assert.ok(client.pending?.interruptible);client.cancel();await assert.rejects(pending,{name:'AbortError'});assert.equal(terminated,1);
 const manifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'),'utf8'));
 await fs.writeFile(path.join(local,'native-biome-finish-smoke-results.json'),JSON.stringify({result:'pass',scope:'native-biome-subterrain-final-development-targeted',fixtures:3,seeds:1,biomeProbesCompared:24,materialProbesCompared:finalReference.probes.length,results:resultRows,finalProbes:finalReference.probes,subterrain:volume.metadata.subterrain,workerClientWithActualWasm:true,registryInput:'existing-20-type-fixture-only',cacheReuse:true,worldYRefusalAndRecovery:true,controlledStageCancellation:true,wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,browserVerified:false,fullTerrainParityVerified:false},null,2)+'\n');
 console.log('Targeted biome/final stage check passed: 24 physical-biome samples, nine room material probes, real worker/client routing, cache, bounds recovery and cancellation.');
}finally{client?.dispose();globalThis.Worker=previousWorker;await fs.rm(temporary,{recursive:true,force:true});}
