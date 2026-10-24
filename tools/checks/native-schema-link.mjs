import * as fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {JsonDocument} from '../../packages/iris-config/document.mjs';
import {validateSchema} from '../../packages/iris-config/schema.mjs';
import {loadNativePackSchema} from '../../packages/iris-config/native-schema.mjs';
import {NativePlatformMetadata} from '../../packages/minecraft-registry/platform.mjs';
import {BlockRegistry} from '../../packages/minecraft-registry/blocks.mjs';
import {createStudioServer} from '../../apps/server/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),base=path.join(root,'apps/web/engine/schema-generated'),fixture=path.join(root,'.upstream/Iris/probe/src/test/resources/terrain3d-pack');
const manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8')),rows=Object.keys(manifest.packFiles).map(path=>({path}));
const fetchOriginal=globalThis.fetch;
try{
  globalThis.fetch=async name=>{assert.ok(name.startsWith('/app/engine/schema-generated/'));return new Response(await fs.readFile(path.join(base,name.slice('/app/engine/schema-generated/'.length))),{status:200});};
  const head=async name=>'"'+createHash('sha256').update(await fs.readFile(path.join(fixture,name))).digest('hex')+'"';
  for(const row of rows){const result=await loadNativePackSchema(row.path,rows,head),document=new JsonDocument(await fs.readFile(path.join(fixture,row.path),'utf8'));assert.deepEqual(validateSchema(document,result.schema),[],row.path);}
  await assert.rejects(loadNativePackSchema(rows[0].path,rows,async()=>`"${'0'.repeat(64)}"`),/snapshot differs/);
  await assert.rejects(loadNativePackSchema(rows[0].path,rows.slice(1),head),/different pack snapshot/);
  const registry=path.join(root,'apps/web/engine/registry-generated'),read=async name=>JSON.parse(await fs.readFile(path.join(registry,name),'utf8'));
  const metadata=new NativePlatformMetadata(await read('native-registries.json'),new BlockRegistry(await read('blocks.json'),await read('manifest.json')));assert.ok(metadata.has('lootTables','minecraft:blocks/stone'));
  console.log(`Focused native schema linkage passed: the four unchanged fixture resources load matching native schemas and have zero reported validation issues; content and resource-set mismatches are rejected. ${manifest.warningCount} upstream metadata warnings remain recorded. No full application or schema conformance suite was run.`);
}finally{globalThis.fetch=fetchOriginal;}
const temporary=await fs.mkdtemp(path.join(root,'.local-tools/schema-auth-')),token='schema-auth-check-'.repeat(3),{server}=await createStudioServer({root:temporary,token});
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const origin='http://127.0.0.1:'+server.address().port;
  for(const name of ['/app/engine/schema-generated/manifest.json','/app/engine/%73chema-generated/manifest.json']){const denied=await fetch(origin+name);assert.equal(denied.status,401);await denied.arrayBuffer();}
  const allowed=await fetch(origin+'/app/engine/schema-generated/manifest.json',{headers:{Authorization:'Bearer '+token}});assert.equal(allowed.status,200);assert.equal((await allowed.json()).packSpecific,true);
  console.log('Focused schema access check passed: normal and encoded schema URLs require the configured token.');
}finally{await new Promise(resolve=>server.close(resolve));await fs.rm(temporary,{recursive:true,force:true});}
