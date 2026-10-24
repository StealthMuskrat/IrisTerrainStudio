// Seven selected native state merges, two mask checks and one unavailable-handle refusal.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1'),temporary=await fs.mkdtemp(path.join(local,'merge-smoke-'));
const cases=[
 {base:'minecraft:furnace[facing=west,lit=true]',update:'minecraft:furnace[lit=false]',match:'minecraft:furnace[facing=west,lit=true]'},
 {base:'minecraft:oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=true]',update:'minecraft:oak_stairs[shape=outer_left,half=top]'},
 {base:'minecraft:redstone_wire[north=side,east=up,power=3]',update:'minecraft:redstone_wire[power=7]'},
 {base:'minecraft:birch_log[axis=x]',update:'minecraft:birch_log'},
 {base:'minecraft:stone',update:'minecraft:dirt'},
 {base:'minecraft:blast_furnace[facing=west,lit=true]',update:'minecraft:blast_furnace[facing=north]',normalize:true},
 {base:'minecraft:stone',update:'minecraft:acacia_leaves[distance=4,persistent=false,waterlogged=false]',match:'minecraft:acacia_leaves[distance=4,persistent=false,waterlogged=false]'}
];
try{
 const inputs=await Promise.all(['registry-inputs.json','iris-inputs.json'].map(name=>fs.readFile(path.join(local,name),'utf8').then(JSON.parse))),classes=path.join(local,'registry-classes'),classpath=[path.join(local,'rotation-classes'),classes,...new Set(inputs.flatMap(input=>input.classpath.map(entry=>entry.path)))].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server')].join(path.delimiter)};
 async function run(binary,args){const handle=await fs.open(path.join(temporary,binary+'.log'),'w');try{await new Promise((resolve,reject)=>{const child=spawn(path.join(java,'bin',binary),args,{cwd:root,env,stdio:['ignore',handle.fd,handle.fd]});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Native merge check failed: '+code)));});}catch(error){console.error((await fs.readFile(path.join(temporary,binary+'.log'),'utf8')).split('\n').slice(-12).join('\n'));throw error;}finally{await handle.close();}}
 const request=path.join(temporary,'request.json'),reference=path.join(temporary,'reference.json');await fs.writeFile(request,JSON.stringify(cases));
 await run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeMergeCheck.java']);await run('java',['-Djava.io.tmpdir='+path.join(local,'tmp'),'-classpath',classpath,'art.arcane.iris.probe.NativeMergeCheck',request,reference]);const expected=JSON.parse(await fs.readFile(reference,'utf8'));
 await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));const{exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm')));await api.installRegistry(await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8'));
 const wireText=await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'),'utf8');
 const results=cases.map((entry,index)=>{const state=api.diagnosticStateMerge(entry.base,entry.update,entry.normalize===true);assert.equal(state,expected[index].state,'Native merge '+index);let match;if(entry.match){match=api.registryMatches(entry.match,state);assert.equal(match,expected[index].match,'Merged first-parse mask');}return{...entry,result:state,...(entry.match?{matchingResult:match}:{} )};});
 assert.equal(results[0].result,'minecraft:furnace[facing=west,lit=false]');assert.equal(results[0].matchingResult,false);assert.equal(results[3].result,'minecraft:birch_log[axis=x]');assert.equal(results[4].result,'minecraft:dirt');assert.equal(results[5].result,'minecraft:blast_furnace[facing=north,lit=false]');assert.equal(results[6].result,'minecraft:acacia_leaves[distance=4,persistent=true,waterlogged=false]');assert.equal(results[6].matchingResult,true);
 const wire=JSON.parse(wireText),group=wire.propertyGroups[wire.blockPropertyGroups['minecraft:oak_stairs']];group.find(property=>property.name==='shape').allowedValues.push('invented');api.installRegistry(JSON.stringify(wire));assert.throws(()=>api.diagnosticStateMerge(cases[1].base,cases[1].update,false),/Rotation metadata domain differs/);api.installRegistry(wireText);
 const manifest=JSON.parse(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/manifest.json'),'utf8')),registry=await fs.readFile(path.join(root,'apps/web/engine/registry-generated/browser-registry.json'));
 await fs.writeFile(path.join(local,'native-merge-smoke-results.json'),JSON.stringify({result:'pass',stateMerges:cases.length,matchingMaskChecks:2,unavailableHandleRefusals:1,results,wasmSha256:manifest.wasmSha256,sourceSha256:manifest.sourceSha256,registrySha256:createHash('sha256').update(registry).digest('hex'),scope:'native-state-merge-development-targeted',fullStateCoverageVerified:false,geometryVerified:false,browserVerified:false},null,2)+'\n');console.log('Native merge smoke passed: seven merges, two result masks and one inconsistent-property refusal. No registry/state sweep.');
}finally{await fs.rm(temporary,{recursive:true,force:true});}
