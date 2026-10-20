// Focused message-path check: actual Wasm and registry, Node-hosted worker script; no browser/GPU claim.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GenerationClient} from '../../packages/iris-engine/client.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack');
const names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'];
const resources=await Promise.all(names.map(async path=>({path,text:await fs.readFile(fixture+'/'+path,'utf8')})));
const dimension=JSON.parse(resources[0].text);dimension.dimensionHeight={min:-64,max:320};resources[0].text=JSON.stringify(dimension);
const messages=[],scripts=new Map();let context,clientReceiver=null;
const sandbox={performance,crypto:webcrypto,TextDecoder,TextEncoder,DataView,ArrayBuffer,Uint8Array,Float64Array,WebAssembly,WeakRef,FinalizationRegistry,setTimeout,clearTimeout,console,Response,
  Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){const key='runtime-'+scripts.size;scripts.set(key,new TextDecoder().decode(blob.parts[0]));return key;},revokeObjectURL(key){scripts.delete(key);}},
  fetch:async url=>{if(!url.startsWith('/app/'))throw new Error('Unexpected worker fetch');return new Response(await fs.readFile(path.join(root,'apps/web',url.slice(5))));},
  importScripts:url=>vm.runInContext(scripts.get(url),context),postMessage:data=>{messages.push(data);clientReceiver?.({data});}};
sandbox.self=sandbox;context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);
context.awaitedApi=(await vm.runInContext('engine()',context)).api;
const options={seed:'1',dimensionKey:'terrain3d',packSnapshot:{resources},width:2,height:2,x:16,y:64,z:-16,span:32,buffet:false};

const caveResources=resources.map(resource=>({...resource})),caveDimension=JSON.parse(caveResources[0].text);caveDimension.caveLavaHeight=64;caveDimension.caveProfile={enabled:true,allowLava:false,verticalRange:{min:2,max:96}};caveResources[0].text=JSON.stringify(caveDimension);
const request={...options,field:'caves',y:-32,packSnapshot:{resources:caveResources}};
await sandbox.onmessage({data:{kind:'generate',id:1,options:request}});
const message=messages.findLast(row=>row.id===1&&row.kind!=='progress');assert.ok(message&&!message.error,message?.error);const result=message.result,values=new Float64Array(result.values),expected=JSON.parse(context.awaitedApi.carveDimensionChunk(16,-16));
assert.equal(result.scope,'iris-dimension-cave-markers-development');assert.equal(result.completePipeline,false);assert.equal(result.terrainInfo.minHeight,-64);assert.equal(result.width,16);assert.equal(result.height,16);assert.equal(result.x,24);assert.equal(result.z,-8);assert.equal(result.span,16);assert.equal(result.y,-32);assert.equal(result.carved,expected.carved);assert.ok(result.carved>0);assert.equal(values.length,256);
for(let i=0;i<256;i++){const marker=expected.palette[expected.cells[32*256+i]];assert.equal(values[i],marker===null?0:marker.liquid+1);}
assert.deepEqual(Array.from(result.categories),['No cave marker','Air marker','Fluid palette marker','Lava marker','Forced air marker']);
await sandbox.onmessage({data:{kind:'generate',id:2,options:{...request,packSnapshot:{resources}}}});assert.match(messages.findLast(row=>row.id===2).error,/disabled/);
await sandbox.onmessage({data:{kind:'generate',id:3,options:{...request,y:321}}});const outside=messages.findLast(row=>row.id===3&&row.kind!=='progress');assert.ok(outside&&!outside.error,outside?.error);assert.ok(new Float64Array(outside.result.values).every(value=>value===0));
const pending=sandbox.onmessage({data:{kind:'generate',id:4,options:request}});await sandbox.onmessage({data:{kind:'cancel',id:4}});await pending;assert.equal(messages.some(row=>row.id===4&&row.kind==='result'),false);
const savedWorker=globalThis.Worker;let client;
try{
 globalThis.Worker=class{constructor(){clientReceiver=event=>this.onmessage?.(event);}postMessage(data){sandbox.onmessage({data}).catch(error=>this.onerror?.({message:error.message}));}terminate(){clientReceiver=null;}};
 client=new GenerationClient();const generated=await client.generate(request);assert.ok(generated.values instanceof Float64Array);assert.equal(generated.values.length,256);assert.equal(client.cacheBytes,2048);const count=messages.length;assert.equal(await client.generate(request),generated);assert.equal(messages.length,count);
}finally{client?.dispose();globalThis.Worker=savedWorker;}
console.log('Focused native cave worker linkage passed: world-Y slice, native markers, outside-height handling, disabled profile refusal, cancellation, and actual-Wasm client transfer/cache reuse. No browser/GPU qualification is implied.');
