// Static delivery of the changed rendering modules; no terrain or raster test.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const directory=path.resolve(process.argv[2]??'dist'),build=JSON.parse(await fs.readFile(path.join(directory,'BUILD.json')));
assert(build.engine.available&&build.engine.registry.available,'Build with --require-engine before this check.');
const {createStudioServer}=await import(pathToFileURL(path.join(directory,'apps/server/index.mjs'))),root=await fs.mkdtemp(path.resolve('.local-tools/render-http-'));
const mappings=[['/app/main.mjs','apps/web/main.mjs'],['/app/lib/render-diagnostics.mjs','apps/web/lib/render-diagnostics.mjs'],['/app/lib/image-source.mjs','apps/web/lib/image-source.mjs'],['/app/workers/iris-worker.js','apps/web/workers/iris-worker.js'],['/packages/iris-engine/png.mjs','packages/iris-engine/png.mjs'],['/packages/resource-packs/texture-pixels.mjs','packages/resource-packs/texture-pixels.mjs'],['/packages/resource-packs/resource-filter.mjs','packages/resource-packs/resource-filter.mjs'],...['gpu-validation','gpu-session','models','world','map','selection','hydrology-overlay'].map(name=>['/packages/voxel-renderer/'+name+'.mjs','packages/voxel-renderer/'+name+'.mjs'])];
let server;const modules=[];
try{
  ({server}=await createStudioServer({root,host:'127.0.0.1'}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(origin+'/healthz')).status,200);const page=await(await fetch(origin+'/')).text();assert.match(page,/id="render-diagnostics"/);
  for(const [url,file]of mappings){const response=await fetch(origin+url);assert.equal(response.status,200,url);assert.match(response.headers.get('content-type'),/javascript/);const delivered=Buffer.from(await response.arrayBuffer()),source=await fs.readFile(file);assert.deepEqual(delivered,source,file);modules.push({url,sha256:createHash('sha256').update(source).digest('hex')});}
}finally{if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});}
const result={date:new Date().toISOString().slice(0,10),result:'pass',scope:'standalone rendering and image-input module delivery',modules,healthAndDiagnosticsControl:true,engineAndRegistryPresent:true,wasmSha256:build.engine.wasmSha256,sourceSha256:createHash('sha256').update(await fs.readFile(path.join(directory,'apps/web/engine/iris-generated/source.zip'))).digest('hex'),browserVerified:false,webGpuVerified:false,projectFinished:false};
await fs.writeFile('.local-tools/standalone-render-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:result.result,modules:modules.length,healthAndDiagnosticsControl:true}));
