import * as fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'registry-link-')),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
try{
  const names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'],fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'),source=new Map(await Promise.all(names.map(async name=>[name,await fs.readFile(path.join(fixture,name),'utf8')])));
  const packs=[];for(const kind of ['baseline','missing-biome','missing-block','fallback','backup','weighted-regions']){
    const resources=new Map(source),dimension=JSON.parse(resources.get(names[0])),biome=JSON.parse(resources.get(names[2]));
    if(kind==='missing-biome')biome.derivative='minecraft:studio_missing_biome';
    if(['missing-block','fallback','backup'].includes(kind))biome.layers[0].palette[0].block='minecraft:studio_missing_block';
    if(kind==='fallback')dimension.blockFallbacks={'minecraft:studio_missing_block':'minecraft:stone'};
    if(kind==='backup')biome.layers[0].palette[0].backup={block:'minecraft:stone'};
    if(kind==='weighted-regions'){dimension.regions.push('alternate');dimension.regionStyle={style:'SIMPLEX',zoom:.02};dimension.regionZoom=1;const alternate=JSON.parse(resources.get(names[1]));alternate.name='Alternate';alternate.rarity=2;resources.set('regions/alternate.json',JSON.stringify(alternate));}
    if(kind!=='baseline'){resources.set(names[0],JSON.stringify(dimension));resources.set(names[2],JSON.stringify(biome));}
    const directory=path.join(temporary,kind);for(const[name,text]of resources){const filename=path.join(directory,name);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,text);}packs.push({directory,resources});
  }
  const states=['minecraft:stone','stone','minecraft:oak_log[axis=x]','oak_log["axis"="z",]'," oak_log[ axis = 'x' ] ",'minecraft:oak_log[axis=invalid]','minecraft:oak_log[bad=x]','minecraft:oak_leaves[persistent=false]','minecraft:cauldron[level=2]','minecraft:grass_path','MINECRAFT:STONE','minecraft:stone trailing','minecraft:water[level=+1]','minecraft:water[level=01]','minecraft:water[level=1,]','minecraft:water[level=+0]','minecraft:oak_log[axis=x,axis=y]','minecraft:studio_missing_block'];
  const matches=[['minecraft:oak_log[axis=x]','minecraft:oak_log'],['minecraft:oak_log','minecraft:oak_log[axis=x]'],['minecraft:oak_log[axis=z]','minecraft:oak_log[axis=x]'],['minecraft:stone','minecraft:stone']];
  const regionSeeds=['0','1','-9007199254740993','9223372036854775807'],points=[[0,0],[17.25,-3.5],[-128.5,64.25],[-4096,4096],[8192.5,-8192.25],[30000000,0],[-29999999,42],[256,192],[1024,2048],[-512,-2048],[100000,-100000],[3.14159,2.71828]];
  const request=path.join(temporary,'request.json'),reference=path.join(temporary,'reference.json');await fs.writeFile(request,JSON.stringify({states,matches,packs:packs.map(pack=>pack.directory),regionSeeds,points}));
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[classes,...new Set(captures.flatMap(capture=>capture.classpath.map(entry=>entry.path)))].join(path.delimiter);
  const env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args){const logfile=path.join(temporary,binary+'.log'),file=await fs.open(logfile,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Native registry reference exited ${code}: ${logfile}`)));});}catch(error){console.error((await fs.readFile(logfile,'utf8')).split('\n').slice(-12).join('\n'));throw error;}finally{await file.close();}}
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeRegistryLinkCheck.java']);await run('java',['-Xmx2g',`-Djava.io.tmpdir=${path.join(local,'tmp')}`,'-classpath',classpath,'art.arcane.iris.probe.NativeRegistryLinkCheck',request,reference]);
  const expected=JSON.parse(await fs.readFile(reference,'utf8'));await fs.copyFile(reference,path.join(local,'native-registry-link-native-reference.json'));
  await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm')));
  assert.deepEqual(JSON.parse(api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'))),{blocks:1286,states:35723});
  const actualStates=states.map(text=>{let strict;try{strict=JSON.parse(api.registryState(text,true));}catch{strict={error:true};}return{strict,compat:JSON.parse(api.registryState(text,false))};});assert.deepEqual(actualStates,expected.states,'Native block parsing or state metadata differs');
  assert.deepEqual(matches.map(pair=>api.registryMatches(...pair)),expected.matches,'Native partial-property matching differs');
  const actualPacks=packs.map(pack=>{api.clear();for(const[path,text]of pack.resources)api.registerPackResource(path,text);api.openPack();const result=JSON.parse(api.inspectPackResource('dimensions','terrain3d')),record={excluded:result.excluded,findings:result.findings,incomplete:!result.compatibilityReady};if(!result.excluded)record.regions=regionSeeds.map(seed=>{api.prepareRegionSelection('terrain3d',seed,false);return points.map(point=>api.sampleRegion(...point));});return record;});assert.deepEqual(actualPacks,expected.packs,'Native compatibility or region selection differs');
  await fs.writeFile(path.join(local,'native-registry-link-results.json'),JSON.stringify({states:states.length,matches:matches.length,packs:packs.map((pack,index)=>({name:path.basename(pack.directory),...actualPacks[index]}))},null,2)+'\n');
  console.log('Focused native registry linkage passed: 18 parser/state cases, four partial-match cases, six native compatibility scenarios and 192 region selections agree between Java and Node Wasm. No terrain or complete browser qualification is implied.');
}finally{await fs.rm(temporary,{recursive:true,force:true});}
