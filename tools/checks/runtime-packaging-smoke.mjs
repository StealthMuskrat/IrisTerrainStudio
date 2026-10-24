// Small integrity/packaging fixtures only. Fixture bytes are not an Iris engine.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inspectRuntimeInstallation,runtimeStatusReader} from '../../apps/server/runtime-status.mjs';
import {buildApplication} from '../build-app.mjs';
import {generationAvailability} from '../../packages/iris-engine/client.mjs';
import {StudioApi} from '../../apps/web/lib/api.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools');
await fs.mkdir(local,{recursive:true});const fixture=await fs.mkdtemp(path.join(local,'runtime-smoke-'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=async(name,value)=>{const filename=path.join(fixture,name);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,typeof value==='object'&&!ArrayBuffer.isView(value)?JSON.stringify(value):value);};
try{
  for(const name of ['apps','packages','docs'])await fs.mkdir(path.join(fixture,name));
  for(const name of ['upstream.lock.json','package.json'])await fs.copyFile(path.join(root,name),path.join(fixture,name));
  const lock=JSON.parse(await fs.readFile(path.join(fixture,'upstream.lock.json'),'utf8'));
  let status=await inspectRuntimeInstallation(fixture);assert.equal(status.available,false);assert.equal(status.registry.available,false);assert.equal(status.laboratory.available,false);
  assert.equal(generationAvailability(null,'terrain').available,false);
  const prefix='apps/web/engine/iris-generated/',wasm=Buffer.from([0,97,115,109,1,0,0,0]),script=Buffer.from('/* controlled runtime fixture */');
  const manifest={formatVersion:1,scope:'iris-browser-engine-development',irisCommit:lock.iris.commit,exports:['sampleStyle'],volmLibCandidate:'fixture-candidate',platformSourceServerJarSha256:'a'.repeat(64),wasmSha256:hash(wasm),runtimeSha256:hash(script),configInventorySha256:hash('{}'),sourceSha256:hash('fixture-source')};
  await write(prefix+'manifest.json',manifest);await write(prefix+'iris.wasm',wasm);await write(prefix+'iris.wasm-runtime.js',script);await write(prefix+'config-inventory.json','{}');
  const registry={formatVersion:1,scope:'minecraft-development-registry-export',minecraft:{id:lock.minecraft.version,stable:true},blocks:1,states:1,volmLibCandidate:manifest.volmLibCandidate,sourceServerJarSha256:manifest.platformSourceServerJarSha256,files:{'browser-registry.json':{sha256:hash('{}'),bytes:2}}};
  await write('apps/web/engine/registry-generated/manifest.json',registry);await write('apps/web/engine/registry-generated/browser-registry.json','{}');
  status=await inspectRuntimeInstallation(fixture);assert.equal(status.available,true);assert.equal(status.registry.available,true);assert.equal(status.terrainAvailable,false);assert.equal(status.terrainParityVerified,false);
  assert.equal(generationAvailability(status,'terrain').available,true);assert.equal(generationAvailability(status,'iris-style2d').available,true);assert.equal(generationAvailability(status,'lab-white2d').available,false);assert.equal(generationAvailability(status,'hydrology').available,true);
  await write(prefix+'iris.wasm-runtime.js','changed');status=await inspectRuntimeInstallation(fixture);assert.equal(status.available,false);assert.match(status.reason,/differs/);await write(prefix+'iris.wasm-runtime.js',script);
  await write('apps/web/engine/registry-generated/manifest.json',{...registry,sourceServerJarSha256:'b'.repeat(64)});
  status=await inspectRuntimeInstallation(fixture);assert.equal(status.available,true);assert.equal(status.registry.available,false);assert.equal(generationAvailability(status,'terrain').available,false);assert.equal(generationAvailability(status,'iris-style2d').available,true);
  await write('apps/web/engine/registry-generated/manifest.json',registry);
  await fs.unlink(path.join(fixture,prefix+'iris.wasm'));await fs.symlink(path.join(fixture,prefix+'iris.wasm-runtime.js'),path.join(fixture,prefix+'iris.wasm'));
  assert.equal((await inspectRuntimeInstallation(fixture)).available,false);await fs.unlink(path.join(fixture,prefix+'iris.wasm'));await write(prefix+'iris.wasm',wasm);
  const readStatus=runtimeStatusReader(fixture);const [first,second]=await Promise.all([readStatus(),readStatus()]);assert.equal(first,second);assert.equal(await readStatus(),first);
  await write('dist/retained.txt','previous build');
  await assert.rejects(buildApplication({repository:fixture,requireEngine:true}),/not installed/);assert.equal(await fs.readFile(path.join(fixture,'dist/retained.txt'),'utf8'),'previous build');
  await write(prefix+'source.zip','fixture-source');await write('apps/fixture.mjs','export const fixture=true;');
  const report=await buildApplication({repository:fixture,requireEngine:true});assert.equal(report.engine.available,true);assert.equal(report.qualifiedTerrainEngine,false);await assert.rejects(fs.access(path.join(fixture,'dist/retained.txt')),{code:'ENOENT'});
  assert.deepEqual(Object.keys(JSON.parse(await fs.readFile(path.join(fixture,'dist/package.json'),'utf8')).scripts),['start']);
  const oldReport=await fs.readFile(path.join(fixture,'dist/BUILD.json'),'utf8');await assert.rejects(buildApplication({repository:fixture,release:true}),/Release build blocked/);assert.equal(await fs.readFile(path.join(fixture,'dist/BUILD.json'),'utf8'),oldReport);
  await fs.unlink(path.join(fixture,'apps/fixture.mjs'));await buildApplication({repository:fixture});await assert.rejects(fs.access(path.join(fixture,'dist/apps/fixture.mjs')),{code:'ENOENT'});
  await fs.writeFile(path.join(fixture,'.local-tools/app-build.lock'),'controlled owner');await assert.rejects(buildApplication({repository:fixture}),/Another application build/);await fs.unlink(path.join(fixture,'.local-tools/app-build.lock'));
  // Storage denial must not prevent module construction or in-memory authentication.
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,get(){throw new Error('Storage disabled');}});
  const api=new StudioApi();api.setToken('session-only');assert.equal(api.token,'session-only');delete globalThis.sessionStorage;

  // Verify the production laboratory worker loads each checked byte buffer once.
  const source=await fs.readFile(path.join(root,'apps/web/workers/noise-worker.js'),'utf8');
  const instance=new WebAssembly.Instance(new WebAssembly.Module(wasm));
  async function workerRun(corrupt=false){
    const requests=[],imports=[],revoked=[],blobs=new Map();let loads=0,result;
    const metadata={scope:'volmlib-primitive-portability',wasmSha256:hash(wasm),runtimeSha256:hash(script)};
    const context=vm.createContext({WebAssembly,Blob,URL:{createObjectURL(blob){blobs.set('blob:fixture',blob);return'blob:fixture';},revokeObjectURL(url){revoked.push(url);}},crypto:globalThis.crypto,performance,setTimeout,console,
      fetch:async url=>{requests.push(url);const data=url.endsWith('manifest.json')?null:url.endsWith('.wasm')?wasm:corrupt?Buffer.from('corrupt'):script;return{ok:true,json:async()=>metadata,arrayBuffer:async()=>Uint8Array.from(data).buffer};},
      importScripts:url=>imports.push(url),TeaVM:{wasmGC:{load:async bytes=>{loads++;assert.deepEqual(Buffer.from(bytes),wasm);return{instance,exports:{sample:()=> '3ff0000000000000'}};}}},
      self:{postMessage:value=>{if(value.kind==='result'||value.error)result=value;}}});
    vm.runInContext(source,context);await context.self.onmessage({data:{kind:'generate',id:1,options:{field:'lab-white2d',width:1,height:1,x:0,z:0,y:0,span:1,seed:'1'}}});
    assert.equal(requests.length,3);assert.equal(new Set(requests).size,3);
    if(corrupt){assert.match(result.error,/differs/);assert.equal(loads,0);assert.equal(imports.length,0);}else{
      assert.equal(new Float64Array(result.result.values)[0],1);assert.equal(loads,1);assert.deepEqual(imports,['blob:fixture']);assert.deepEqual(revoked,['blob:fixture']);assert.deepEqual(Buffer.from(await blobs.get('blob:fixture').arrayBuffer()),script);
    }
  }
  await workerRun();await workerRun(true);
  await fs.writeFile(path.join(local,'runtime-packaging-smoke-results.json'),JSON.stringify({scope:'runtime-installation-and-packaging-targeted',result:'pass',fixture:'Eight-byte empty Wasm header and controlled metadata/runtime doubles; no Iris algorithm execution',checks:['Absent, checksum-mismatched, symlinked and platform-incompatible installations refuse','Field-specific module and registry admission; hydrology requires the installed native module and registry','Concurrent status reads share bounded cached inspection','Packaging drops stale files, includes runtime-only start script, preserves the previous build on failure and rejects overlapping builds','Unqualified releases refuse before replacing a development build','Authentication survives denied session storage','Laboratory worker executes exactly the checked Wasm/runtime bytes and refuses corrupt runtime before execution'],browserVerified:false,webGpuVerified:false,terrainParityVerified:false},null,2)+'\n');
  console.log('Runtime/packaging checks passed: one tiny artifact fixture, staged publication/recovery, field admission, storage denial and exact-byte worker loading. No terrain or browser/GPU qualification.');
}finally{await fs.rm(fixture,{recursive:true,force:true});}
