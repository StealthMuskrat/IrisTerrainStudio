import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {JsonDocument} from '../../packages/iris-config/document.mjs';
import {validateSchema} from '../../packages/iris-config/schema.mjs';
import {PackStore} from '../../apps/server/pack-store.mjs';
const schema=new JsonDocument('{"type":"integer","maximum":9223372036854775807}').value;
assert.equal(validateSchema(new JsonDocument('9223372036854775807'),schema).length,0);
assert.equal(validateSchema(new JsonDocument('9223372036854775808'),schema).length,1);
assert.equal(validateSchema(new JsonDocument('1e2'),{type:'integer'}).length,0);
assert.equal(validateSchema(new JsonDocument('"snippet/style/ridges"'),{anyOf:[{type:'object'},{type:'string',pattern:'^snippet/style/'}]}).length,0);
assert.ok(validateSchema(new JsonDocument('{"kind":"land"}'),{if:{properties:{kind:{const:'land'}}},then:{required:['height']}}).length);
assert.equal(validateSchema(new JsonDocument('2'),{minimum:2,exclusiveMinimum:false}).length,0);
assert.ok(validateSchema(new JsonDocument('2'),{minimum:2,exclusiveMinimum:true}).length);
const root=await mkdtemp(path.resolve('.local-tools/editor-check-'));
try{
  const store=new PackStore(root);await store.initialize();await store.create('recovery');
  const text='{"seed":9223372036854775807,"unknown":{"future":[1e2,true]}}\n';
  const saved=await store.save('recovery','generators/ridges.json',text,'*',true);
  await store.operation('recovery',{type:'delete',path:saved.path,etag:saved.etag});
  const backup=(await store.backups('recovery',null))[0];assert.equal(backup.path,saved.path);
  await store.restore('recovery',backup.path,backup.id,'*');
  assert.equal((await store.read('recovery',backup.path)).data.toString(),text);
  await assert.rejects(store.restore('recovery',backup.path,backup.id,'*'),error=>error.status===409);
}finally{await rm(root,{recursive:true,force:true});}
console.log('Focused check passed: exact schema bounds, alternatives/conditions, deleted-resource recovery and overwrite conflict.');
