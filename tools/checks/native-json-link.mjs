import * as fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {nativePackInputs} from '../../packages/iris-engine/pack-inputs.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),local=path.join(root,'.local-tools'),java=process.env.IRIS_JAVA_HOME||path.join(local,'jdk-25.0.4.1+1'),classes=path.join(local,'inventory-classes'),directory=await fs.mkdtemp(path.join(local,'json-link-'));
const resources=new Map([
 ['generators/check.json','{"seed":9223372036854775807,"zoom":1.75,"surfaceDetail":0.5,"composite":["snippet/generator/check"],"future":{"seed":9223372036854775806}}'],
 ['snippet/generator/check.json','{"seed":-9007199254740993,"style":"snippet/style/check","octaves":2,"negative":true,"offsetY":0.125}'],
 ['snippet/style/check.json','{"style":"PERLIN","zoom":2,"fracture":{"style":"STATIC","multiplier":0.125}}']
]);
try{
  for(const[name,text]of resources){const filename=path.join(directory,name);await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,text);}
  const inputs=JSON.parse(await fs.readFile(path.join(local,'iris-inputs.json'))),classpath=inputs.classpath.map(entry=>entry.path).join(path.delimiter),env={...process.env,LD_LIBRARY_PATH:path.join(java,'lib')+':'+path.join(java,'lib/server')};
  function run(program,args){const result=spawnSync(path.join(java,'bin',program),args,{cwd:root,env,encoding:'utf8'});if(result.status!==0)throw new Error((result.stderr||result.stdout).split('\n').slice(-18).join('\n'));return result.stdout.trim().split('\n');}
  run('javac',['-classpath',classpath,'-d',classes,'tools/checks/NativeJsonLinkCheck.java']);
  const expected=run('java',['-Dvolmlib.noise.nativeBillow=false','-classpath',classes+path.delimiter+classpath,'NativeJsonLinkCheck',directory]).filter(value=>/^[0-9a-f]{1,16}$/.test(value)).map(value=>value.padStart(16,'0'));
  assert.equal(expected.length,3,'Native Gson reference did not produce its three scalar outputs.');
  const text=resources.get('generators/check.json'),snippets=await nativePackInputs('generator',text,async name=>({text:resources.get(name)}));
  await import(pathToFileURL(path.join(root,'apps/web/engine/iris-generated/iris.wasm-runtime.js')));
  const {exports:api}=await TeaVM.wasmGC.load(await fs.readFile(path.join(root,'apps/web/engine/iris-generated/iris.wasm')));
  api.clear();for(const resource of snippets)api.registerSnippet(resource.path,resource.text);api.loadGeneratorJson('check',text);
  const actual=[[17.25,-3.5],[-128.5,64.25],[0,0]].map(([x,z])=>api.sampleGenerator('check','813753',x,z));
  assert.deepEqual(actual,expected);
  console.log('Focused native JSON linkage passed: three generator samples match original native Gson loading, including two snippet types, large signed seeds, unknown fields and surface caching.');
}finally{await fs.rm(directory,{recursive:true,force:true});}
