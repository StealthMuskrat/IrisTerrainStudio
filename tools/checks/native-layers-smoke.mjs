// Four small layered packs, one seed, two native columns and four material/biome probes each.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
import {VoxelVolume} from '../../packages/voxel-renderer/volume.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'native-layers-'));
const previousWorker=globalThis.Worker;let client;
try{
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse)));
  const classes=path.join(local,'registry-classes'),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
  const classpath=[path.join(local,'layer-kernel-classes'),path.join(local,'browser-engine/target/classes'),path.join(local,'rotation-classes'),classes,...new Set(captures.flatMap(c=>c.classpath.map(e=>e.path)))].join(path.delimiter);
  const env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args,name){const filename=path.join(temporary,name),file=await fs.open(filename,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(binary+' exited '+code)));});}catch(error){const log=await fs.readFile(filename,'utf8');await fs.writeFile(path.join(local,'native-layers-failure.log'),log);console.error(log.split('\n').filter(line=>/Exception|Error|Caused by|Unsupported|NativeTerrainLinkCheck/.test(line)).slice(0,12).join('\n'));throw error;}finally{await file.close();}}
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java'],'compile.log');
  const base=path.join(root,'apps/web/engine/iris-generated');await import(pathToFileURL(path.join(base,'iris.wasm-runtime.js')));
  const manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8')),{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(base,'iris.wasm')));
  api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'));
  let receiver;
  const sandbox={navigator:{userAgent:'Node controlled worker host'},performance,crypto:webcrypto,TextEncoder,TextDecoder,DataView,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Float64Array,setTimeout,clearTimeout,console,stubApi:api,stubManifest:manifest,postMessage:data=>receiver?.({data:structuredClone(data)})};sandbox.self=sandbox;
  const context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);vm.runInContext('runtime=Promise.resolve({api:stubApi,manifest:stubManifest});registryRuntime=Promise.resolve({installed:true});',context);
  globalThis.Worker=class{constructor(){receiver=event=>this.onmessage?.(event);}postMessage(data){sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){receiver=null;}};
  client=new GenerationClient();
  const flat=JSON.parse(await fs.readFile(path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack/generators/flat.json'),'utf8'));
  const definition=(key,region,mode='OVERWORLD',min=-32,max=96)=>({name:key,version:1,mode:{type:mode},regions:[region],environment:'NORMAL',dimensionHeight:{min,max},logicalHeight:max-min,fluidHeight:0,caveLavaHeight:0,caveProfile:{enabled:false}});
  function resources(kind){
    const host=definition('Host','floor',kind==='stack-blend'?'OVERWORLD':'SUPERFLAT');
    if(kind.startsWith('upper')){host.upperDimension=kind==='upper-self'?'terrain3d':'sky';host.upperDimensionGap=12;host.upperDimensionObjects=true;}
    else host.dimensionStack={dimensions:['sky','middle','terrain3d'],spacer:8,...(kind==='stack-blend'?{blend:{amplitude:3,style:{style:'PERLIN',zoom:8}}}:{})};
    const biome=(name,block,height,physical)=>({name,derivative:physical,vanillaDerivative:physical,layers:[{palette:[{block}]}],generators:[{generator:'flat',min:height,max:height}]});
    const middle=biome('Middle','minecraft:andesite',12,'minecraft:desert');
    if(kind==='stack-blend')middle.terrain3D={amplitude:4,horizontalScale:12,verticalScale:12,minimumSlope:0,slopeFade:1,fluidClearance:0,fluidFade:1,crackDepth:0};
    return Object.entries({'dimensions/terrain3d.json':host,'dimensions/sky.json':definition('Sky','sky','OVERWORLD',0,64),'dimensions/middle.json':definition('Middle','middle','OVERWORLD',0,64),'regions/floor.json':{name:'Floor',landBiomes:['floor'],seaBiomes:['floor'],shoreBiomes:['floor']},'regions/sky.json':{name:'Sky',landBiomes:['sky'],seaBiomes:['sky'],shoreBiomes:['sky']},'regions/middle.json':{name:'Middle',landBiomes:['middle'],seaBiomes:['middle'],shoreBiomes:['middle']},'biomes/floor.json':biome('Floor','minecraft:stone',16,'minecraft:plains'),'biomes/sky.json':biome('Sky','minecraft:diorite',24,'minecraft:forest'),'biomes/middle.json':middle,'generators/flat.json':flat}).map(([path,value])=>({path,text:JSON.stringify(value)}));
  }
  const points=[[1,1],[-17,33]],results=[];
  for(const kind of ['upper-cross','upper-self','stack-blend','stack-simple']){
    const input=resources(kind),pack=path.join(temporary,kind);for(const row of input){const filename=path.join(pack,row.path);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,row.text);}
    const request=path.join(temporary,kind+'-request.json'),reference=path.join(temporary,kind+'-reference.json');
    await fs.writeFile(request,JSON.stringify({packs:[pack],seeds:['1'],points:[],layerColumns:points,registeredOverworldCheck:{x:0,z:0,generate:true,configuredMode:true,autoLayerControls:true,controls:[]}}));
    await run('java',['-Xmx1g','-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',request,reference],kind+'.log');
    const expected=JSON.parse(await fs.readFile(reference,'utf8'))[0],full=kind==='stack-blend';
    const result=await client.generate({field:full?'overworld-mode':'terrain-mode',dimensionKey:'terrain3d',packSnapshot:{resources:input},seed:'1',width:16,height:16,x:8,y:0,z:8,span:16,buffet:false});
    assert.deepEqual(points.map(([x,z])=>JSON.parse(api.inspectTerrainLayerColumn(x,z))),expected[0],kind+' native layer column');
    const volume=new VoxelVolume(result.volume),native=expected[1];
    for(const[x,y,z,block,biome]of native.probes){assert.equal(volume.block(x,y,z).stateKey,block,kind+' block');assert.equal(volume.biome(x,y,z),biome,kind+' biome');}
    assert.equal(result.volume.metadata.registeredTerrainStages,native.terrainStages);assert.equal(result.volume.metadata.registeredContentStages,native.contentStages);assert.equal(result.volume.metadata.activeLeasesAfter,0);
    assert.equal(result.volume.metadata.terrainInfo.dimensionStackLayers,kind.startsWith('stack')?3:0);assert.equal(result.volume.metadata.terrainInfo.scalarFields,'host-dimension');
    assert.equal(result.volume.metadata.completePipeline,false);assert.equal(JSON.parse(api.generationSessionStatistics()).scopeBound,false);
    results.push({kind,columns:expected[0],probes:native.probes,terrainStages:native.terrainStages,contentStages:native.contentStages,resources:input.map(row=>({path:row.path,sha256:createHash('sha256').update(row.text).digest('hex')}))});
  }
  client.dispose();
  const invalid=(change,upperChange)=>{api.clear();for(const row of resources('upper-cross')){let text=row.text;if(row.path==='dimensions/terrain3d.json'){const value=JSON.parse(text);change(value);text=JSON.stringify(value);}if(upperChange&&row.path==='dimensions/sky.json'){const value=JSON.parse(text);upperChange(value);text=JSON.stringify(value);}api.registerPackResource(row.path,text);}api.openPack();assert.throws(()=>api.prepareTerrain('terrain3d','1'));assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);};
  invalid(dimension=>dimension.upperDimension='missing');
  invalid(dimension=>dimension.dimensionStack={dimensions:['sky','terrain3d'],spacer:8});
  invalid(dimension=>{delete dimension.upperDimension;dimension.dimensionStack={dimensions:['terrain3d','sky'],spacer:8};});
  invalid(dimension=>{delete dimension.upperDimension;dimension.dimensionStack={dimensions:[...Array(16).fill('sky'),'terrain3d'],spacer:8};});
  invalid(dimension=>dimension.dimensionHeight={min:0,max:4097});
  invalid(()=>{},dimension=>dimension.dimensionHeight={min:0,max:4097});
  api.clear();for(const row of resources('upper-self'))api.registerPackResource(row.path,row.text);api.openPack();assert.equal(JSON.parse(api.prepareTerrain('terrain3d','1')).upperDimension,'terrain3d');assert.ok(JSON.parse(api.inspectTerrainLayerColumn(1,1)).upper);api.releaseTerrain();assert.equal(JSON.parse(api.inspectTerrainLifecycle()).prepared,false);
  await fs.writeFile(path.join(local,'native-layers-smoke-results.json'),JSON.stringify({scope:'native-upper-and-stack-layers-targeted',result:'pass',fixtures:4,seeds:1,layerColumns:8,materialProbes:16,physicalBiomeProbes:16,invalidInputsRefused:6,recoveryAndRelease:true,actualWorkerProtocol:true,browserVerified:false,webGpuVerified:false,terrainParityVerified:false,wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,layerKernelInputs:manifest.layerKernelInputs,results},null,2)+'\n');
  console.log('Native layers passed: four small packs, eight native columns and sixteen selected material/biome probes; invalid-input cleanup and recovery. No chunk/state sweep or browser qualification.');
}finally{client?.dispose();globalThis.Worker=previousWorker;await fs.rm(temporary,{recursive:true,force:true});}
