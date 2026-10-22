let database;
function open() {
  if (!database) database = new Promise((resolve, reject) => { const request = indexedDB.open('iris-terrain-studio', 1); request.onupgradeneeded = () => { for (const name of ['drafts','settings','resource-packs']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); }; request.onsuccess = () => {const db=request.result;db.onversionchange=()=>{db.close();database=undefined;};resolve(db);}; request.onerror = () => {database=undefined;reject(request.error);}; });
  const pending=database;pending.catch(()=>{if(database===pending)database=undefined;});return pending;
}
export async function localGet(store, key) { const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export async function localSet(store, key, value) { return localBatch([{store,key,value}]); }
export async function localKeys(store) { const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).getAllKeys(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export async function localBatch(changes,options={}){
  const captured=structuredClone(changes),guards=[];
  for(const guard of options.expectedDrafts??[]){if(typeof guard.key!=='string')throw new Error('Invalid draft guard.');guards.push({store:'drafts',key:guard.key,expected:structuredClone(guard.value),name:'DraftConflict',label:'This local draft changed in another tab. Refresh drafts before continuing.'});}
  for(const [option,key,name,label]of[['expectedTextureConfig','texture-library','TextureLibraryConflict','Saved rendering packs changed in another tab. Retry saved packs before saving.'],['expectedViewConfig','view-library','ViewLibraryConflict','Saved views changed in another tab. Retry saved views before saving.']])if(Object.hasOwn(options,option))guards.push({key,name,label,expected:structuredClone(options[option])});
  if(!captured.length)return;if(captured.some(change=>!['drafts','settings','resource-packs'].includes(change.store)))throw new Error('Unknown browser-local store.');
  const db=await open();return new Promise((resolve,reject)=>{
    const stores=[...new Set([...captured.map(change=>change.store),...guards.map(guard=>guard.store??'settings')])],tx=db.transaction(stores,'readwrite');let failure;tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure??tx.error??new Error('Browser-local save failed.'));tx.onabort=()=>reject(failure??tx.error??new Error('Browser-local save aborted.'));
    const fail=error=>{failure=error;tx.abort();};
    const apply=()=>{try{for(const {store,key,value}of captured){const target=tx.objectStore(store);if(value===undefined)target.delete(key);else target.put(value,key);}}catch(error){fail(error);}};
    if(guards.length){let pending=guards.length;for(const guard of guards){const request=tx.objectStore(guard.store??'settings').get(guard.key);request.onsuccess=()=>{if(failure)return;try{if(JSON.stringify(request.result)!==JSON.stringify(guard.expected)){const error=new Error(guard.label);error.name=guard.name;fail(error);return;}if(--pending===0)apply();}catch(error){fail(error);}};}}else apply();
  });
}

export async function localTextureSnapshot(){
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction(['settings','resource-packs'],'readonly'),config=tx.objectStore('settings').get('texture-library'),store=tx.objectStore('resource-packs'),keys=store.getAllKeys(),values=store.getAll();
    tx.oncomplete=()=>resolve({config:config.result,records:keys.result.map((key,index)=>({key,value:values.result[index]}))});tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Browser-local read aborted.'));
  });
}

// Cursor admission avoids materializing every stored draft. No records are removed here.
export async function localDraftSnapshot({maxEntries=128,maxBytes=16*1024*1024}={}){
  if(!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>128||!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>16*1024*1024)throw new Error('Invalid draft snapshot budget.');
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readonly'),request=tx.objectStore('drafts').openCursor(),records=[];let bytes=0,complete=true;
    request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(records.length===maxEntries){complete=false;return;}const value=cursor.value,cost=2*((typeof value?.text==='string'?value.text.length:0)+(typeof value?.baseText==='string'?value.baseText.length:0)+String(cursor.key).length)+256;if(bytes+cost>maxBytes){complete=false;return;}bytes+=cost;records.push({key:cursor.key,value});cursor.continue();};
    tx.oncomplete=()=>resolve({records,bytes,complete});tx.onerror=()=>reject(tx.error??new Error('Local draft read failed.'));tx.onabort=()=>reject(tx.error??new Error('Local draft read aborted.'));
  });
}
