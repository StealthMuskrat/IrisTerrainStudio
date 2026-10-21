// Controlled cancellation at the production IndexedDB adapter's two asynchronous write boundaries.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {IndexedDbNoiseCache} from '../../packages/iris-engine/noise-cache-store.mjs';
let finishOpen,current=true,touches=0;
const cache=new IndexedDbNoiseCache();cache.open=()=>new Promise(resolve=>{finishOpen=resolve;});
const pending=cache.save({key:'a'.repeat(64),bytes:44,savedAt:1,files:[]},undefined,()=>current);
current=false;finishOpen({transaction(){touches++;throw Error('Stale write reached storage');}});await pending;assert.equal(touches,0);
const afterOpen=new IndexedDbNoiseCache();let request,aborted=false,writes=0;
afterOpen.open=async()=>({transaction(){const tx={abort(){aborted=true;queueMicrotask(()=>tx.onabort());},objectStore:()=>({getAll(){return request={};},put(){writes++;}})};return tx;}});
current=true;const queued=afterOpen.save({key:'b'.repeat(64),bytes:44,savedAt:1,files:[]},undefined,()=>current);
await Promise.resolve();await Promise.resolve();current=false;request.result=[];request.onsuccess();await assert.rejects(queued);assert.equal(aborted,true);assert.equal(writes,0);
await fs.writeFile(fileURLToPath(new URL('../../.local-tools/noise-persistence-stale-save-results.json',import.meta.url)),JSON.stringify({result:'pass',staleBeforeTransactionCreatesNoTransaction:true,staleBeforePutAbortsTransaction:true,staleWriteCount:writes},null,2)+'\n');
console.log('Stale cache saves stop after database open and before transaction writes.');
