// Controlled cancellation at production storage and worker context-release boundaries.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {ControlledStorage} from './controlled-noise-storage.mjs';
import {IndexedDbNoiseCache,NoiseTilePersistence} from '../../packages/iris-engine/noise-cache-store.mjs';
let finishOpen,current=true,touches=0;
const cache=new IndexedDbNoiseCache();cache.open=()=>new Promise(resolve=>{finishOpen=resolve;});
const pending=cache.save({key:'a'.repeat(64),bytes:44,savedAt:1,files:[]},undefined,()=>current);
current=false;finishOpen({transaction(){touches++;throw Error('Stale write reached storage');}});await pending;assert.equal(touches,0);
const afterOpen=new IndexedDbNoiseCache();let request,aborted=false,writes=0;
afterOpen.open=async()=>({transaction(){const tx={abort(){aborted=true;queueMicrotask(()=>tx.onabort());},objectStore:()=>({getAll(){return request={};},put(){writes++;}})};return tx;}});
current=true;const queued=afterOpen.save({key:'b'.repeat(64),bytes:44,savedAt:1,files:[]},undefined,()=>current);
await Promise.resolve();await Promise.resolve();current=false;request.result=[];request.onsuccess();await assert.rejects(queued);assert.equal(aborted,true);assert.equal(writes,0);
// A corruption cleanup must not delete a newer request's namespace after waiting for storage.
const removeCache=new IndexedDbNoiseCache();let finishRemoveOpen,deleteTouches=0;removeCache.open=()=>new Promise(resolve=>{finishRemoveOpen=resolve;});current=true;
const removing=removeCache.remove('c'.repeat(64),()=>current);current=false;finishRemoveOpen({transaction(){deleteTouches++;throw Error('Stale corruption cleanup reached storage');}});await removing;assert.equal(deleteTouches,0);
const backend=new ControlledStorage(),key='d'.repeat(64);backend.maps.tiles.set(key,{version:0,key});backend.maps.index.set(key,{key});const originalRemove=backend.remove.bind(backend);let releaseRemove,removeStarted;const started=new Promise(resolve=>{removeStarted=resolve;});backend.remove=async(...args)=>{removeStarted();await new Promise(resolve=>{releaseRemove=resolve;});return originalRemove(...args);};current=true;
const restoring=new NoiseTilePersistence(backend).restore({},key,()=>current);await started;current=false;releaseRemove();assert.equal((await restoring).status,'stale');assert.equal(backend.maps.tiles.size,1);assert.equal(backend.maps.index.size,1);
// A release that awaited runtime loading must not clear a newly active request.
let resolveRuntime,clears=0;const pendingRuntime=new Promise(resolve=>{resolveRuntime=resolve;}),sandbox={pendingRuntime};sandbox.self=sandbox;const context=vm.createContext(sandbox);vm.runInContext(await fs.readFile(fileURLToPath(new URL('../../apps/web/workers/iris-worker.js',import.meta.url)),'utf8'),context);vm.runInContext('runtime=pendingRuntime;',context);
const release=sandbox.onmessage({data:{kind:'release-context'}});vm.runInContext('active=123;',context);resolveRuntime({api:{clear(){clears++;}}});await release;assert.equal(clears,0);vm.runInContext('active=0;',context);await sandbox.onmessage({data:{kind:'release-context'}});assert.equal(clears,1);
await fs.writeFile(fileURLToPath(new URL('../../.local-tools/noise-persistence-stale-save-results.json',import.meta.url)),JSON.stringify({result:'pass',staleBeforeTransactionCreatesNoTransaction:true,staleBeforePutAbortsTransaction:true,staleWriteCount:writes,staleCorruptionCleanupCreatesNoTransaction:true,staleCorruptionCleanupPreservesNewerNamespace:true,staleDeleteCount:deleteTouches,delayedContextReleasePreservesNewActiveRequest:true,currentIdleReleaseStillClears:true},null,2)+'\n');
console.log('Stale cache saves/removals stop before storage mutations; delayed context release preserves a new request.');
