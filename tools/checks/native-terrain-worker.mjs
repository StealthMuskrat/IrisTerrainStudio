// Focused message-path check: actual Wasm and registry, Node-hosted worker script; no browser/GPU claim.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack');
const names=['dimensions/terrain3d.json','regions/ledges.json','biomes/ledges.json','generators/flat.json'];
const resources=await Promise.all(names.map(async path=>({path,text:await fs.readFile(fixture+'/'+path,'utf8')})));
const dimension=JSON.parse(resources[0].text);dimension.dimensionHeight={min:-64,max:320};resources[0].text=JSON.stringify(dimension);
const messages=[],scripts=new Map();let context;
const sandbox={performance,crypto:webcrypto,TextDecoder,TextEncoder,DataView,ArrayBuffer,Uint8Array,Float64Array,WebAssembly,WeakRef,FinalizationRegistry,setTimeout,clearTimeout,console,Response,
  Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){const key='runtime-'+scripts.size;scripts.set(key,new TextDecoder().decode(blob.parts[0]));return key;},revokeObjectURL(key){scripts.delete(key);}},
  fetch:async url=>{if(!url.startsWith('/app/'))throw new Error('Unexpected worker fetch');return new Response(await fs.readFile(path.join(root,'apps/web',url.slice(5))));},
  importScripts:url=>vm.runInContext(scripts.get(url),context),postMessage:data=>messages.push(data)};
sandbox.self=sandbox;context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(path.join(root,'apps/web/workers/iris-worker.js'),'utf8'),context);
context.awaitedApi=(await vm.runInContext('engine()',context)).api;
const options={seed:'1',dimensionKey:'terrain3d',packSnapshot:{resources},width:2,height:2,x:16,y:64,z:-16,span:32,buffet:false};
for(const[id,field]of ['terrain','biomes','density'].entries()){
  await sandbox.onmessage({data:{kind:'generate',id:id+1,options:{...options,field}}});const message=messages.findLast(row=>row.id===id+1&&row.kind!=='progress');assert.ok(message&&!message.error,message?.error);const result=message.result,values=new Float64Array(result.values);assert.equal(values.length,4);assert.equal(result.terrainInfo.minHeight,-64);assert.equal(result.terrainInfo.maxHeight,320);
  for(let row=0;row<2;row++)for(let column=0;column<2;column++){
    const x=options.x-options.span/2+(column+.5)*options.span/2,z=options.z-options.span/2+(row+.5)*options.span/2;
    const expected=vm.runInContext(field==='terrain'?`decode((awaitedApi).sampleTerrainHeight(${x},${z}))-64`:field==='biomes'?`(awaitedApi).sampleTerrainBiome(${x},${z})`:`(awaitedApi).sampleTerrainOccupancy(${x},${options.y},${z})`,context);
    assert.equal(field==='biomes'?result.categories[values[row*2+column]]:values[row*2+column],expected);
  }
  if(field==='density')assert.deepEqual(Array.from(result.categories),['Unshaped column','Empty','Solid']);
}
console.log('Focused native worker messages passed: procedural world-Y heights, biome keys and volumetric occupancy categories use the actual Wasm exports for 12 samples. No browser/GPU qualification is implied.');
