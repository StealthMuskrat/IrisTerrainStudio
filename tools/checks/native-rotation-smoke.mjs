// Nine native directional-state operations and one matching-mask check; no registry sweep.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1'),temporary=await fs.mkdtemp(path.join(local,'rotation-smoke-'));
const cases=[
 {state:'minecraft:stone',x:0,y:90,z:0},
 {state:'minecraft:oak_log[axis=y]',x:-45,y:0,z:0},
 {state:'minecraft:furnace[facing=north]',x:0,y:90,z:0,match:'minecraft:furnace[facing=north,lit=true]'},
 {state:'minecraft:furnace[facing=north]',x:90,y:0,z:0},
 {state:'minecraft:wall_torch[facing=north]',x:90,y:0,z:0},
 {state:'minecraft:oak_sign[rotation=1]',x:0,y:90,z:0},
 {state:'minecraft:vine[north=true,west=true,up=true]',x:0,y:90,z:0},
 {state:'minecraft:cobblestone_wall[north=low,east=tall,south=none,west=none,up=false]',x:0,y:90,z:0},
 {state:'minecraft:redstone_wire[north=side,east=up,south=none,west=none,power=0]',x:0,y:-90,z:0}
];
try{
 const inputs=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[path.join(local,'rotation-classes'),classes,...new Set(inputs.flatMap(input=>input.classpath.map(entry=>entry.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
 async function run(binary,args){const handle=await fs.open(path.join(temporary,binary+'.log'),'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',handle.fd,handle.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Native rotation check failed: '+code)));});}catch(error){console.error((await fs.readFile(path.join(temporary,binary+'.log'),'utf8')).split('\n').slice(-12).join('\n'));throw error;}finally{await handle.close();}}
 const request=path.join(temporary,'request.json'),reference=path.join(temporary,'reference.json');await fs.writeFile(request,JSON.stringify(cases));
 await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeRotationCheck.java']);await run('java',['-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeRotationCheck',request,reference]);const expected=JSON.parse(await fs.readFile(reference,'utf8'));
 await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm')));await api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'));
 const results=cases.map((entry,index)=>{const state=api.diagnosticStateRotation(entry.state,entry.x,entry.y,entry.z);assert.equal(state,expected[index].state,'Native rotation '+index);let match;if(entry.match){match=api.registryMatches(entry.match,state);assert.equal(match,expected[index].match,'Rotated first-parse matching mask');}return{...entry,result:state,...(entry.match?{match}:{} )};});
 assert.equal(results[4].result,null);assert.notEqual(results[2].result,results[3].result);assert.equal(results[2].match,true);
 const wireText=await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'),wire=JSON.parse(wireText),group=wire.propertyGroups[wire.blockPropertyGroups['minecraft:furnace']];group.find(property=>property.name==='facing').allowedValues.push('sideways');api.installRegistry(JSON.stringify(wire));assert.throws(()=>api.diagnosticStateRotation('minecraft:furnace[facing=north]',0,90,0),/Rotation metadata domain differs/);api.installRegistry(wireText);
 const manifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'),'utf8')),registry=await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'));
 await fs.writeFile(path.join(local,'native-rotation-smoke-results.json'),JSON.stringify({result:'pass',stateOperations:cases.length,matchingMaskChecks:1,unavailableHandleRefusals:1,results,wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,registrySha256:createHash('sha256').update(registry).digest('hex'),scope:'native-state-rotation-development-targeted',fullStateCoverageVerified:false,geometryVerified:false,browserVerified:false},null,2)+'\n');console.log('Native rotation smoke passed: nine selected states and one first-parse matching mask. No registry/state sweep.');
}finally{await fs.rm(temporary,{recursive:true,force:true});}
