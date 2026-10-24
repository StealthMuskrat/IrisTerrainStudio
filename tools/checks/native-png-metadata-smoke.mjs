// Six two-pixel sources. Original JDK/Iris reference, actual Wasm and worker transport.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {decodeNativePng} from '../../packages/iris-engine/png.mjs';
import {decodeTexturePng} from '../../packages/resource-packs/texture-pixels.mjs';
import {nativePngSourceNotes} from '../../apps/web/lib/image-source.mjs';
import {crc32} from '../../packages/shared/zip.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),jdk=path.join(local,'jdk-25.0.4.1+1'),temporary=await fs.mkdtemp(path.join(local,'png-metadata-')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function chunks(bytes){const result=[];for(let at=8;at<bytes.length;){const size=bytes.readUInt32BE(at);result.push({type:bytes.toString('ascii',at+4,at+8),data:bytes.subarray(at+8,at+8+size)});at+=size+12;}return result;}
function encode(rows){return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),...rows.map(({type,data})=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);b.set(data,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;})]);}
const chunk=(type,data)=>({type,data}),uint=value=>{const b=Buffer.alloc(4);b.writeUInt32BE(value);return b;},frame=sequence=>{const b=Buffer.alloc(26);b.writeUInt32BE(sequence);b.writeUInt32BE(2,4);b.writeUInt32BE(1,8);b.writeUInt16BE(1,20);b.writeUInt16BE(10,22);return chunk('fcTL',b);};
try{
  const inputs=JSON.parse(await fs.readFile(path.join(local,'iris-inputs.json'))),classes=path.join(temporary,'classes'),classpath=inputs.classpath.map(e=>e.path).join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(jdk,'lib'),path.join(jdk,'lib/server')].join(path.delimiter)};
  await fs.mkdir(classes);const cp=classes+path.delimiter+classpath;
  async function run(binary,args){const name=path.join(temporary,binary+'.log'),log=await fs.open(name,'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(jdk,'bin',binary),args,{cwd:root,env,stdio:['ignore',log.fd,log.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Native PNG metadata reference exited '+code)));});}catch(error){console.error(await fs.readFile(name,'utf8'));throw error;}finally{await log.close();}}
  await run('javac',['-implicit:none','-classpath',classpath,'-d',classes,'tools/checks/NativePngMetadataCheck.java']);
  await run('java',['-Djava.awt.headless=true','-classpath',cp,'art.arcane.iris.probe.NativePngMetadataCheck','inputs',temporary]);
  const base=await fs.readFile(path.join(temporary,'base.png')),parts=chunks(base),idat=parts.filter(p=>p.type==='IDAT'),head=parts[0],end=parts.at(-1),profile=await fs.readFile(path.join(temporary,'linear-rgb.icc.z'));
  const icc=chunk('iCCP',Buffer.concat([Buffer.from('linear\0\0'),profile])),mastering=Buffer.alloc(24);[35400,14600,8500,39850,6550,2300,15635,16450].forEach((v,i)=>mastering.writeUInt16BE(v,2*i));mastering.writeUInt32BE(10000000,16);mastering.writeUInt32BE(50,20);
  const hdr=[chunk('cICP',Buffer.from([9,16,0,1])),chunk('mDCV',mastering),chunk('cLLI',Buffer.concat([uint(10000000),uint(4000000)]))],laterPixels=deflateSync(Buffer.from([0,201,202,203,255,204,205,206,255]));
  const animated=(inAnimation,metadata=[])=>encode([head,...metadata,chunk('acTL',Buffer.concat([uint(inAnimation?2:1),uint(0)])),...(inAnimation?[frame(0)]:[]),...idat,frame(inAnimation?1:0),chunk('fdAT',Buffer.concat([uint(inAnimation?2:1),laterPixels])),end]);
  const fixtures=new Map([['base',base],['icc',encode([head,icc,...idat,end])],['hdr',encode([head,...hdr,...idat,end])],['apng-frame',animated(true)],['apng-poster',animated(false)],['combined',animated(false,[icc,...hdr])]]);
  for(const[name,bytes]of fixtures)await fs.writeFile(path.join(temporary,name+'.png'),bytes);
  await run('java',['-Djava.awt.headless=true','-classpath',cp,'art.arcane.iris.probe.NativePngMetadataCheck','reference',temporary]);
  const expected=JSON.parse(await fs.readFile(path.join(temporary,'reference.json')));assert.equal(expected.length,6);
  const manifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'))),wasm=await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm'));assert.equal(manifest.irisCommit,inputs.irisCommit);assert.equal(manifest.volmLibCandidate,inputs.volmLibCandidate);assert.equal(sha(wasm),manifest.wasmSha256);assert.equal(sha(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js'))),manifest.runtimeSha256);
  await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(wasm);
  api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'));
  const messages=[],sandbox={performance,crypto:webcrypto,TextEncoder,TextDecoder,DataView,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Float64Array,setTimeout,clearTimeout,console,stubApi:api,postMessage:data=>messages.push(data)};sandbox.self=sandbox;
  const context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context,{importModuleDynamically:async specifier=>{assert.equal(specifier,'/packages/iris-engine/png.mjs');return import(pathToFileURL(path.join(root,'packages/iris-engine/png.mjs')));}});vm.runInContext('runtime=Promise.resolve({api:stubApi,manifest:{}});registryRuntime=Promise.resolve({fixtureInput:true});',context);
  let requestId=0;const rows=[];
  for(const row of expected){
    const png=fixtures.get(row.name),decoded=await decodeNativePng(png);assert.deepEqual([...decoded.samples],row.bands);assert.deepEqual(row.bands,[11,22,33,255,44,55,66,127]);assert.deepEqual(row.previewArgb,expected[0].previewArgb);for(const key of['width','height','channels','bitDepth'])assert.equal(decoded[key],row[key]);
    const snapshot={resources:[{path:'images/'+row.name+'.png',bytes:png},{path:'image-maps/'+row.name+'.json',text:JSON.stringify({source:row.name,type:'ALPHA_MASK'})}]};
    await sandbox.onmessage({data:{kind:'inspect-pack',id:++requestId,snapshot,folder:'images',name:row.name}});let info=messages.at(-1);assert.equal(info.kind,'info',info.error);assert.equal(info.info.resource.found,true);assert.deepEqual(Array.from(info.info.resource.sampleBands,pixel=>Array.from(pixel).slice(2)).flat(),row.bands);
    const source=info.info.resource.pngSource;if(row.name==='base')assert.equal(source,undefined);else{assert.equal(source.path,'images/'+row.name+'.png');assert.equal(source.policy,'jdk-png-default-image');assert(nativePngSourceNotes(source).length>0);await assert.rejects(decodeTexturePng(png),/Minecraft textures/);}
    await sandbox.onmessage({data:{kind:'sample-image-map',id:++requestId,snapshot,name:row.name,points:[[0,0],[1,0]]}});info=messages.at(-1);assert.equal(info.kind,'info',info.error);assert.equal(info.info.samples.length,2);assert.equal(info.info.resource.contentHash,row.contentHash);assert.equal(info.info.resource.sourceHash,row.sourceHash);for(let x=0;x<2;x++){const bits=new DataView(new ArrayBuffer(8));bits.setFloat64(0,info.info.samples[x].normalized);assert.equal(bits.getBigUint64(0).toString(16).padStart(16,'0'),row.normalized[x]);}
    rows.push({...row,pngSha256:sha(png),sourceMetadata:source??null});
  }
  assert.deepEqual([...((await decodeTexturePng(base)).pixels)],expected[0].bands);
  const aliases={resources:[{path:'images/pixel.z.png',bytes:base},{path:'images/pixel.a.png',bytes:fixtures.get('icc')}]};
  await sandbox.onmessage({data:{kind:'inspect-pack',id:++requestId,snapshot:aliases,folder:'images',name:'pixel'}});assert.equal(messages.at(-1).info.resource.pngSource.path,'images/pixel.a.png');
  await sandbox.onmessage({data:{kind:'inspect-pack',id:++requestId,snapshot:aliases,folder:'images',name:'pixel.z'}});assert.equal(messages.at(-1).info.resource.pngSource,undefined);
  const corrupt=Buffer.from(fixtures.get('apng-poster'));corrupt[corrupt.length-17]^=1;await assert.rejects(decodeNativePng(corrupt),/checksum/);
  await assert.rejects(decodeNativePng(base,{metadataPolicy:'unknown'}),/metadata policy/);
  await sandbox.onmessage({data:{kind:'inspect-pack',id:++requestId,snapshot:{resources:[{path:'images/bad.png',bytes:corrupt}]},folder:'images',name:'bad'}});assert.match(messages.at(-1).error,/checksum/);
  await sandbox.onmessage({data:{kind:'inspect-pack',id:++requestId,snapshot:aliases,folder:'images',name:'pixel'}});assert.equal(messages.at(-1).kind,'info');
  const workspaceSha256={};for(const file of['packages/iris-engine/png.mjs','packages/resource-packs/texture-pixels.mjs','apps/web/workers/iris-worker.js','apps/web/lib/image-source.mjs','tools/checks/NativePngMetadataCheck.java','tools/checks/native-png-metadata-smoke.mjs'])workspaceSha256[file]=sha(await fs.readFile(path.join(root,file)));
  const nativeClassSha256={};for(const file of['art/arcane/iris/generation/image/IrisImage.class','art/arcane/iris/generation/image/CompiledIrisImageMap.class']){for(const entry of inputs.classpath)if(entry.directory){try{nativeClassSha256[file]=sha(await fs.readFile(path.join(entry.path,file)));break;}catch(error){if(error.code!=='ENOENT')throw error;}}assert(nativeClassSha256[file]);}
  const report={irisCommit:inputs.irisCommit,volmLibCandidate:inputs.volmLibCandidate,nativeBuildProfile:inputs.buildProfile,workspaceSha256,nativeClassSha256,date:'2026-10-23',result:'pass',scope:'native JDK PNG metadata/default-image decoding',rows,rawBandsCompared:48,mapSamplesCompared:12,originalJdkReaderAndIrisCompiler:true,actualWasmAndWorker:true,linearIccNotApplied:true,hdrMetadataNotApplied:true,apngDefaultInAndOutsideAnimation:true,laterFramesNotInflated:true,inspectorMetadataOwnershipAndDottedLookup:true,plainTextureBehaviorRetained:true,metadataTextureAdmissionUnchanged:true,corruptionRefusedAndRecovery:true,sourceNotes:true,wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,browserVerified:false,webGpuVerified:false,fullTerrainParityVerified:false,projectFinished:false};
  await fs.writeFile(path.join(local,'native-png-metadata-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({result:'pass',images:6,pixels:12,rawBandsCompared:48,mapSamplesCompared:12,actualWasmAndWorker:true}));
}finally{await fs.rm(temporary,{recursive:true,force:true});}
