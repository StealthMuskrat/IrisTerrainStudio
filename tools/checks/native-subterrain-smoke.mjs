// Two small authored rooms, one seed, nine selected cells each. No registry or voxel-volume sweep.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=path.join(local,'jdk-25.0.4.1+1'),temporary=await fs.mkdtemp(path.join(local,'subterrain-smoke-'));
try {
 const fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'),names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'],cases=[];
 for(const family of ['CENOTE','LAVA_TUBE']){
  const resources=await Promise.all(names.map(async name=>({path:name,text:await fs.readFile(path.join(fixture,name),'utf8')}))),dimension=JSON.parse(resources[0].text),biome=JSON.parse(resources[2].text);
  dimension.dimensionHeight={min:-32,max:96};dimension.logicalHeight=128;dimension.fluidHeight=-32;dimension.subterrainFeatures=[{id:'small-room',family,biome:'ledges',worldYRange:{min:-24,max:56},spacing:48,probability:1,length:32,radius:8,height:16,fluidDepth:4,chimneyHeight:8,pillarSpacing:0,formationFraction:0}];
  delete biome.terrain3D;biome.generators[0].min=80;biome.generators[0].max=80;resources[0].text=JSON.stringify(dimension);resources[2].text=JSON.stringify(biome);
  const pack=path.join(temporary,family);for(const resource of resources){const target=path.join(pack,resource.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,resource.text);}cases.push({family,resources,pack,finish:family==='LAVA_TUBE'});
 }
 const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[path.join(local,'rotation-classes'),classes,...new Set(captures.flatMap(c=>c.classpath.map(e=>e.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
 async function run(binary,args){const filename=path.join(temporary,binary+'.log'),log=await fs.open(filename,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',log.fd,log.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Native subterrain reference exited '+code)));});}catch(error){console.error((await fs.readFile(filename,'utf8')).split('\n').slice(-24).join('\n'));throw error;}finally{await log.close();}}
 await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java']);
 await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm')));api.installRegistry(await fs.readFile(path.join(local,'session-registry-fixture/browser-registry.json'),'utf8'));
 const results=[];
 for(const row of cases){
  const request=path.join(temporary,'request.json'),reference=path.join(temporary,'reference.json');await fs.writeFile(request,JSON.stringify({packs:[row.pack],seeds:['1'],points:[],subterrainCheck:row.finish}));await run('java',['-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',request,reference]);const expected=JSON.parse(await fs.readFile(reference,'utf8'))[0][0];
  api.clear();for(const resource of row.resources)api.registerPackResource(resource.path,resource.text);api.openPack();api.prepareTerrain('terrain3d','1');
  const chunk=JSON.parse((row.finish?api.paintMaterialFinishChunk:api.paintCaveComponentChunk)(expected.x,expected.z));assert.equal(chunk.subterrain.enabled,true);assert.equal(chunk.subterrain.nativePlanner,true);assert.ok(chunk.subterrain.samplingWorkCharged>0&&chunk.subterrain.samplingWorkCharged<=chunk.subterrain.workLimit);
  const diagnostics=[];for(const[i,[x,y,z,key]]of expected.probes.entries()){assert.equal(chunk.palette[chunk.cells[x+16*(z+16*y)]],key,`${row.family} material ${x},${y},${z}`);const cell=JSON.parse(api.inspectSubterrainCell(chunk.x+x,chunk.minY+y,chunk.z+z));assert.deepEqual(cell,expected.diagnostics[i]);diagnostics.push(cell);}
  const kinds=new Set(diagnostics.map(cell=>cell.kind));assert.ok(kinds.has('AIR'));assert.ok(kinds.has('SOLID'));assert.ok(kinds.has(row.family==='CENOTE'?'WATER':'LAVA'));assert.ok(kinds.has('OUTSIDE'));
  assert.throws(()=>api.inspectSubterrainCell(chunk.x,chunk.minY-1,chunk.z));
  results.push({family:row.family,finish:row.finish,x:chunk.x,z:chunk.z,minY:chunk.minY,probes:expected.probes,diagnostics,subterrain:chunk.subterrain,resources:row.resources.map(resource=>({path:resource.path,sha256:createHash('sha256').update(resource.text).digest('hex')}))});
 }
 api.clear();const manifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'),'utf8'));await fs.writeFile(path.join(local,'native-subterrain-smoke-results.json'),JSON.stringify({result:'pass',scope:'native-subterrain-development-targeted',fixtures:2,seeds:1,chunks:2,materialProbesCompared:18,cellDiagnosticsCompared:18,negativeWorldMinimum:true,results,wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,browserVerified:false,fullTerrainParityVerified:false},null,2)+'\n');console.log('Native subterrain passed: cenote carving and lava-tube material finish; 18 material probes and 18 cell diagnostics.');
}finally{await fs.rm(temporary,{recursive:true,force:true});}
