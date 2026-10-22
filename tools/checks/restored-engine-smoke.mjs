// One upstream fixture, one seed, two scalar points and three selected block probes.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {inspectRuntimeInstallation} from '../../apps/server/runtime-status.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'restored-engine-'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
  const installation=await inspectRuntimeInstallation(root,{distribution:true});assert.equal(installation.available,true,installation.reason);assert.equal(installation.registry.available,true,installation.registry.reason);
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse)));
  const java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1'),classes=path.join(local,'registry-classes'),classpath=[path.join(local,'rotation-classes'),classes,...new Set(captures.flatMap(c=>c.classpath.map(e=>e.path)))].join(path.delimiter);
  const env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args){const filename=path.join(temporary,binary+'.log'),file=await fs.open(filename,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(binary+' exited '+code)));});}catch(error){console.error((await fs.readFile(filename,'utf8')).split('\n').slice(-12).join('\n'));throw error;}finally{await file.close();}}
  const source=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'),names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'],resources=[];
  const pack=path.join(temporary,'pack');for(const name of names){const text=await fs.readFile(path.join(source,name),'utf8'),filename=path.join(pack,name);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,text);resources.push({path:name,text});}
  const points=[[0,0],[17.25,-3.5]],probes=[[0,0,0],[8,127,8],[15,255,15]],input=path.join(temporary,'request.json'),output=path.join(temporary,'reference.json');
  await fs.writeFile(input,JSON.stringify({packs:[pack],seeds:['1'],points,terrainPaintProbes:{x:0,z:0,points:probes}}));
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java']);
  await run('java',['-Xmx1g','-Dvolmlib.noise.nativeBillow=false','-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',input,output]);
  const expected=JSON.parse(await fs.readFile(output,'utf8'))[0];
  const base=path.join(root,'apps/web/engine/iris-generated');await import(pathToFileURL(path.join(base,'iris.wasm-runtime.js')));
  const {exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(base,'iris.wasm')));
  const installed=JSON.parse(api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8')));assert.equal(installed.blocks,installation.registry.blocks);assert.equal(installed.states,installation.registry.states);
  try{
    for(const resource of resources)api.registerPackResource(resource.path,resource.text);api.openPack();api.prepareTerrain('terrain3d','1');
    assert.deepEqual(points.map(([x,z])=>({height:api.sampleTerrainHeight(x,z).replace(/^0+(?=.)/,''),biome:api.sampleTerrainBiome(x,z)})),expected[1]);
    const chunk=JSON.parse(api.paintTerrainChunk(0,0));
    for(const[x,y,z,key]of expected[0])assert.equal(chunk.palette[chunk.cells[(y*16+z)*16+x]],key);
  }finally{api.clear();}
  await fs.writeFile(path.join(local,'restored-engine-smoke-results.json'),JSON.stringify({scope:'restored-native-engine-installation-targeted',result:'pass',fixtures:1,seeds:1,scalarPoints:2,blockProbes:3,expected,blocks:installed.blocks,states:installed.states,wasmSha256:installation.wasmSha256,registrySha256:installation.registry.sha256,resources:resources.map(row=>({path:row.path,sha256:hash(row.text)})),browserVerified:false,webGpuVerified:false,terrainParityVerified:false},null,2)+'\n');
  console.log('Restored engine passed: one fixture/seed, two exact height/biome samples and three selected terrain material probes match native Java. No state sweep or full terrain qualification.');
}finally{await fs.rm(temporary,{recursive:true,force:true});}
