import * as fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),temporary=await fs.mkdtemp(path.join(local,'terrain-link-')),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1');
try{
  const names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'],fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack'),source=new Map(await Promise.all(names.map(async name=>[name,await fs.readFile(path.join(fixture,name),'utf8')])));
  const packs=[];
  for(const kind of ['exact','adaptive','coarse','modules','aquifer','negative-minimum']){
    const resources=new Map(source),dimension=JSON.parse(resources.get(names[0])),biome=JSON.parse(resources.get(names[2]));delete biome.terrain3D;
    const profile={enabled:true,verticalRange:{min:2,max:96}};
    if(kind==='exact')profile.adaptiveSampling=false;
    if(kind==='coarse')profile.sampleStep=4;
    if(kind==='modules'){profile.warpStrength=3;profile.warpStyle={style:'SIMPLEX',zoom:24};profile.modules=[{style:{style:'PERLIN',zoom:28},weight:0.25,invert:true,threshold:0.1,verticalRange:{min:8,max:80}}];}
    if(kind==='aquifer'){dimension.fluidHeight=64;dimension.caveLavaHeight=12;profile.fluidRequiresFloor=false;profile.densityThreshold={min:0.1,max:0.1};}
    if(kind==='negative-minimum'){dimension.dimensionHeight={min:-64,max:320};dimension.caveLavaHeight=64;profile.allowLava=false;}
    dimension.caveProfile=profile;
    resources.set(names[0],JSON.stringify(dimension));resources.set(names[2],JSON.stringify(biome));
    const directory=path.join(temporary,kind);for(const[name,text]of resources){const filename=path.join(directory,name);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,text);}packs.push({directory,resources});
  }
  const seeds=['0','9223372036854775807'],points=[[0,0],[-16,32]],request=path.join(temporary,'request.json'),reference=path.join(temporary,'reference.json');
  await fs.writeFile(request,JSON.stringify({packs:packs.map(pack=>pack.directory),seeds,points,caves:true}));
  const captures=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[classes,...new Set(captures.flatMap(capture=>capture.classpath.map(entry=>entry.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
  async function run(binary,args){const logfile=path.join(temporary,binary+'.log'),file=await fs.open(logfile,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',file.fd,file.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Native terrain reference exited ${code}`)));});}catch(error){console.error((await fs.readFile(logfile,'utf8')).split('\n').slice(-18).join('\n'));throw error;}finally{await file.close();}}
  await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeTerrainLinkCheck.java']);await run('java',['-Dvolmlib.noise.nativeBillow=false',`-Djava.io.tmpdir=${path.join(local,'tmp')}`,'-classpath',classpath,'art.arcane.iris.probe.NativeTerrainLinkCheck',request,reference]);
  const expected=JSON.parse(await fs.readFile(reference,'utf8'));await fs.copyFile(reference,path.join(local,'native-cave-link-native-reference.json'));
  await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm')));api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'));
  const actual=packs.map(pack=>seeds.map(seed=>{api.clear();for(const[name,text]of pack.resources)api.registerPackResource(name,text);try{const metadata=JSON.parse(api.prepareTerrain('terrain3d',seed)),dimension=JSON.parse(pack.resources.get(names[0]));assert.equal(metadata.minHeight,dimension.dimensionHeight.min);assert.equal(metadata.maxHeight,dimension.dimensionHeight.max);assert.equal(metadata.terrainParityVerified,false);}catch(error){throw new Error('Prepare '+path.basename(pack.directory)+' seed '+seed,{cause:error});}return points.map(([x,z])=>{try{return {height:api.sampleTerrainHeight(x,z).replace(/^0+(?=.)/,''),biome:api.sampleTerrainBiome(x,z),caves:JSON.parse(api.carveDimensionChunk(x,z))};}catch(error){throw new Error('Sample '+path.basename(pack.directory)+' seed '+seed+' at '+x+','+z,{cause:error});}});}));assert.deepEqual(actual,expected,'Native cave marker composition differs');
  api.clear();for(const[name,text]of source)api.registerPackResource(name,text);api.prepareTerrain('terrain3d','1');assert.throws(()=>api.carveDimensionChunk(0,0),/disabled/);
  api.clear();for(const[name,text]of packs[0].resources){let value=text;if(name===names[0]){const dimension=JSON.parse(text);dimension.caveProfile.baseDensityStyle={style:'SIMPLEX',cacheSize:4};value=JSON.stringify(dimension);}api.registerPackResource(name,value);}api.prepareTerrain('terrain3d','1');assert.throws(()=>api.carveDimensionChunk(0,0),/not connected/);
  api.clear();for(const[name,text]of packs[0].resources)api.registerPackResource(name,text);api.prepareTerrain('terrain3d','1');assert.throws(()=>api.carveDimensionChunk(1,0),/bounds/);assert.ok(JSON.parse(api.carveDimensionChunk(0,0)).carved>0);
  for(const sample of actual.flat(2)){assert.ok(sample.caves.carved>0);assert.equal(sample.caves.palette[0],null);for(const index of sample.caves.cells)assert.ok(Number.isInteger(index)&&index>=0&&index<sample.caves.palette.length);}
  assert.deepEqual([...new Set(actual.flat(2).flatMap(sample=>sample.caves.palette.filter(Boolean).map(marker=>marker.liquid)))].sort(),[0,1,2,3]);
  await fs.writeFile(path.join(local,'native-cave-link-results.json'),JSON.stringify({packs:packs.map(pack=>({name:path.basename(pack.directory),resources:[...pack.resources].map(([path,text])=>({path,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')}))})),seeds,points,cellsCompared:actual.flat(2).reduce((count,sample)=>count+sample.caves.cells.length,0),palettes:actual.flat(2).map(sample=>sample.caves.palette)},null,2)+'\n');console.log('Focused native cave linkage passed: 24 dimension-profile chunks across exact, adaptive, coarse, module/warp, aquifer and negative-minimum inputs. Markers match native Java; block resolution and complete pipeline remain outstanding.');
}finally{await fs.rm(temporary,{recursive:true,force:true});}
