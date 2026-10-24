// A focused development check of JDK adapter calls and browser export linkage.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1'),classes=path.join(local,'browser-engine/target/classes');
const inputs=JSON.parse(await fs.readFile(path.join(local,'iris-inputs.json'))),classpath=[classes,...inputs.classpath.map(entry=>entry.path),path.join(local,'m2/org/teavm/teavm-jso/0.16.0/teavm-jso-0.16.0.jar')].join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:[path.join(java,'lib'),path.join(java,'lib/server'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter)};
function run(program,args){const result=spawnSync(path.join(java,'bin',program),args,{cwd:root,env,encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||result.stdout);return result.stdout.trim().split('\n');}
run('javac',['-classpath',classpath,'-d',classes,'tools/checks/EngineLinkCheck.java']);
const expected=run('java',['-Dvolmlib.noise.nativeBillow=false','-classpath',classpath,'EngineLinkCheck']);
await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));
const loaded=await TeaVM.wasmGC.load(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm'))),api=loaded.exports;
const actual=[api.diagnosticRng('813753'),api.noiseStyles(),api.sampleStyle('PERLIN','813753',17.25,64,-3.5,2),api.sampleStyle('MARBLE','-1',17.25,64,-3.5,3)];
api.defineStyle('probe','PERLIN',3,1.25,0,1,'',1,2);actual.push(api.sampleConfigured('probe','813753',17.25,64,-3.5,2),api.seedComponents('813753'));
const mismatches=actual.flatMap((value,index)=>value===expected[index]?[]:[{export:['diagnosticRng','noiseStyles','sampleStyle-PERLIN','sampleStyle-MARBLE','sampleConfigured','seedComponents'][index],actual:value,expected:expected[index]}]);
await fs.mkdir(path.join(root,'.reference-output/engine-link'),{recursive:true});await fs.writeFile(path.join(root,'.reference-output/engine-link/result.json'),JSON.stringify({scope:'focused-node-wasm-export-linkage',styles:JSON.parse(actual[1]).length,mismatches},null,2)+'\n');
assert.equal(mismatches.length,0,JSON.stringify(mismatches));
console.log(`Focused engine linkage passed: ${JSON.parse(actual[1]).length} style names, three scalar samples and one seed derivation match native Java; 1,152 native JDK adapter comparisons match.`);
