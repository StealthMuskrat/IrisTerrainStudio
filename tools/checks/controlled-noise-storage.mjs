// Controlled request/store host for focused persistence checks; real browser IndexedDB remains unqualified.
import {IndexedDbNoiseCache} from '../../packages/iris-engine/noise-cache-store.mjs';
export class ControlledStorage extends IndexedDbNoiseCache {
 constructor(){super();this.maps={tiles:new Map(),index:new Map()};this.fail=false;}
 transaction(mode,action,isCurrent=()=>true){if(!isCurrent())return Promise.resolve();return new Promise((resolve,reject)=>{
  const working=structuredClone(this.maps);let result,pending=0,ended=false;const finish=()=>{if(ended||pending)return;ended=true;if(this.fail){reject(new Error('Controlled quota failure'));return;}if(mode==='readwrite')this.maps=working;resolve(result);};
  const tx={abort:()=>{ended=true;reject(new Error('Controlled abort'));},objectStore:name=>({get:key=>request(()=>working[name].get(key)),getAll:()=>request(()=>[...working[name].values()]),put:(value,key)=>working[name].set(key,structuredClone(value)),delete:key=>working[name].delete(key),clear:()=>working[name].clear()})};
  const request=read=>{pending++;const r={};queueMicrotask(()=>{if(ended)return;try{r.result=structuredClone(read());r.onsuccess?.();pending--;finish();}catch(error){ended=true;reject(error);}});return r;};try{action(tx,value=>{result=value;});queueMicrotask(finish);}catch(error){ended=true;reject(error);}
 });}
}
