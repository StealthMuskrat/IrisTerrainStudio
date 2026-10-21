// Browser-local storage of original native CNM bytes. No noise evaluation or tile decoding here.
export const NOISE_CACHE_LIMITS=Object.freeze({files:64,snapshotBytes:8*1024*1024,records:8,totalBytes:32*1024*1024,tileSize:1024});
const validKey=key=>typeof key==='string'&&/^[a-f0-9]{64}$/.test(key);
const validName=name=>typeof name==='string'&&/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,511}\.cnm$/.test(name);
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
function tileBytes(value){
 if(!ArrayBuffer.isView(value)||Object.prototype.toString.call(value)!=='[object Uint8Array]'||value.byteLength<12||value.byteLength>8+4*NOISE_CACHE_LIMITS.tileSize**2)throw new Error('Invalid stored native noise tile bytes.');
 const view=new DataView(value.buffer,value.byteOffset,value.byteLength),width=view.getInt32(0),height=view.getInt32(4);
 if(width<1||width>NOISE_CACHE_LIMITS.tileSize||height!==width||value.byteLength!==8+4*width*height)throw new Error('Invalid stored native noise tile dimensions.');
 return value.slice();
}
function binaryString(bytes){const parts=[];for(let i=0;i<bytes.length;i+=16384)parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));return parts.join('');}

/** All payload/index writes and eviction share one IndexedDB transaction. */
export class IndexedDbNoiseCache {
 constructor(factory=globalThis.indexedDB){this.factory=factory;this.database=null;}
 open(){
  if(!this.database)this.database=new Promise((resolve,reject)=>{
   if(!this.factory){reject(new Error('Browser cache storage is unavailable.'));return;}
   const request=this.factory.open('iris-native-noise-cache',1);let settled=false;
   const timer=setTimeout(()=>{settled=true;reject(new Error('Browser cache storage did not open.'));},2000);
   request.onupgradeneeded=()=>{for(const name of ['tiles','index'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
   request.onblocked=()=>{clearTimeout(timer);settled=true;reject(new Error('Browser cache storage is blocked.'));};
   request.onerror=()=>{clearTimeout(timer);settled=true;reject(request.error);};
   request.onsuccess=()=>{clearTimeout(timer);if(settled){request.result.close();return;}const db=request.result;db.onversionchange=()=>{db.close();this.database=null;};resolve(db);};
  }).catch(error=>{this.database=null;throw error;});return this.database;
 }
 async transaction(mode,action,isCurrent=()=>true){
  const db=await this.open();if(!isCurrent())return;return new Promise((resolve,reject)=>{
   const tx=db.transaction(['tiles','index'],mode);let result;const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(new Error('Browser cache transaction timed out.'));},2000);
   tx.oncomplete=()=>{clearTimeout(timer);resolve(result);};tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(tx.error||new Error('Browser cache transaction aborted.'));};
   try{action(tx,value=>{result=value;});}catch(error){clearTimeout(timer);try{tx.abort();}catch{}reject(error);}
  });
 }
 get(key){return this.transaction('readonly',(tx,result)=>{const request=tx.objectStore('tiles').get(key);request.onsuccess=()=>result(request.result);});}
 remove(key){return this.transaction('readwrite',tx=>{tx.objectStore('tiles').delete(key);tx.objectStore('index').delete(key);});}
 clear(){return this.transaction('readwrite',tx=>{tx.objectStore('tiles').clear();tx.objectStore('index').clear();});}
 save(record,limits=NOISE_CACHE_LIMITS,isCurrent=()=>true){return this.transaction('readwrite',tx=>{
  const tiles=tx.objectStore('tiles'),index=tx.objectStore('index'),request=index.getAll();request.onsuccess=()=>{
   if(!isCurrent()){tx.abort();return;}
   const previous=request.result.filter(row=>row.key!==record.key).sort((a,b)=>a.savedAt-b.savedAt||a.key.localeCompare(b.key));
   let total=record.bytes+previous.reduce((sum,row)=>sum+row.bytes,0),count=previous.length+1;
   while(previous.length&&(total>limits.totalBytes||count>limits.records)){const oldest=previous.shift();total-=oldest.bytes;count--;tiles.delete(oldest.key);index.delete(oldest.key);}
   if(total>limits.totalBytes||count>limits.records){tx.abort();return;}
   tiles.put(record,record.key);index.put({key:record.key,bytes:record.bytes,savedAt:record.savedAt},record.key);
  };
 },isCurrent);}
}

export class NoiseTilePersistence {
 constructor(backend=new IndexedDbNoiseCache()){this.backend=backend;}
 async restore(api,key,isCurrent=()=>true){
  if(!validKey(key))throw new Error('Invalid native noise cache namespace.');
  try{
   const record=await this.backend.get(key);if(!isCurrent())return {status:'stale'};if(!record)return {status:'miss',restoredFiles:0};
   try{
    if(record.version!==1||record.key!==key||!Array.isArray(record.files)||record.files.length>NOISE_CACHE_LIMITS.files)throw new Error('Invalid stored native noise cache record.');
    const files=[],names=new Set();let bytes=0;
    for(const file of record.files){
     if(!validName(file.name)||names.has(file.name))throw new Error('Invalid stored native noise tile name.');names.add(file.name);const payload=tileBytes(file.bytes);bytes+=payload.length;
     if(bytes>NOISE_CACHE_LIMITS.snapshotBytes||!validKey(file.sha256)||await hash(payload)!==file.sha256)throw new Error('Stored native noise tile checksum differs.');
     if(!isCurrent())return {status:'stale'};files.push({name:file.name,bytes:payload});
    }
    if(record.bytes!==bytes)throw new Error('Stored native noise cache size differs.');
    // All async validation finishes before touching the owned native snapshot.
    if(!isCurrent())return {status:'stale'};
    try{for(const file of files)api.restoreNoiseCacheTile(file.name,binaryString(file.bytes));}catch(error){api.discardRestoredNoiseCache();throw error;}
    return {status:'restored',restoredFiles:files.length,restoredBytes:bytes};
   }catch(error){if(!isCurrent())return {status:'stale'};await this.backend.remove(key);return {status:'discarded',restoredFiles:0};}
  }catch(error){return {status:'unavailable',restoredFiles:0};}
 }
 async save(api,key,isCurrent=()=>true){
  if(!validKey(key))throw new Error('Invalid native noise cache namespace.');if(!isCurrent())return {status:'stale'};
  try{
   const entries=JSON.parse(api.inspectNoiseCache());if(!Array.isArray(entries)||entries.length>NOISE_CACHE_LIMITS.files)throw new Error('Invalid native noise cache export.');
   if(!entries.length)return {status:'empty',savedFiles:0};
   const files=[],names=new Set();let bytes=0;
   // Capture all native bytes synchronously; do not access another snapshot after an await.
   for(const entry of entries){
    if(!validName(entry.name)||names.has(entry.name)||!Number.isInteger(entry.bytes)||entry.bytes<12||entry.bytes>8+4*NOISE_CACHE_LIMITS.tileSize**2||(bytes+=entry.bytes)>NOISE_CACHE_LIMITS.snapshotBytes)throw new Error('Native noise cache export exceeds its limits.');names.add(entry.name);
    const payload=api.exportNoiseCacheTile(entry.name);if(typeof payload!=='string'||payload.length!==entry.bytes)throw new Error('Native noise cache export is truncated.');const encoded=new Uint8Array(payload.length);for(let i=0;i<encoded.length;i++){const value=payload.charCodeAt(i);if(value>255)throw new Error('Invalid native noise cache export byte.');encoded[i]=value;}
    files.push({name:entry.name,bytes:tileBytes(encoded),sha256:entry.sha256});
   }
   for(const file of files){if(await hash(file.bytes)!==file.sha256)throw new Error('Native noise cache export checksum differs.');if(!isCurrent())return {status:'stale'};}
   if(!isCurrent())return {status:'stale'};await this.backend.save({version:1,key,bytes,savedAt:Date.now(),files},NOISE_CACHE_LIMITS,isCurrent);if(!isCurrent())return {status:'stale'};return {status:'saved',savedFiles:files.length,savedBytes:bytes};
  }catch(error){return {status:'unavailable',savedFiles:0};}
 }
 clear(){return this.backend.clear();}
}

const scalarFields=new Set(['iris-style2d','iris-style3d','iris-generator','iris-continent','iris-region-control','regions','terrain','biomes','density']);
export function usesPersistentNoiseCache(options,manifest){
 if(!scalarFields.has(options.field)||!validKey(manifest.wasmSha256)||typeof globalThis.indexedDB==='undefined')return false;
 const texts=[options.nativeConfig?.text,...(options.nativeConfig?.snippets||[]).map(row=>row.text),...(options.packSnapshot?.resources||[]).map(row=>row.text)];
 return texts.some(text=>typeof text==='string'&&/"cacheSize"\s*:\s*[1-9]\d*/.test(text));
}
export async function noiseCacheNamespace(options,manifest){
 if(!validKey(manifest.wasmSha256))throw new Error('Native noise cache requires a build identity.');
 const resources=[];for(const resource of options.packSnapshot?.resources||[]){const bytes=resource.bytes!==undefined?resource.bytes:new TextEncoder().encode(resource.text);resources.push([resource.path,await hash(bytes)]);}resources.sort((a,b)=>a[0].localeCompare(b[0]));
 return hash(new TextEncoder().encode(JSON.stringify([1,manifest.wasmSha256,manifest.runtimeSha256,manifest.noiseCacheIdentity?.implementationFingerprint,manifest.platformSourceServerJarSha256,manifest.registrySha256,options.seed,options.dimensionKey,options.buffet===true,options.style,options.nativeConfig,options.configured,options.generator,resources])));
}
export const noiseTilePersistence=new NoiseTilePersistence();
