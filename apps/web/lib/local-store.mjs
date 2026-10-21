let database;
function open() {
  if (!database) database = new Promise((resolve, reject) => { const request = indexedDB.open('iris-terrain-studio', 1); request.onupgradeneeded = () => { for (const name of ['drafts','settings','resource-packs']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); }; request.onsuccess = () => {const db=request.result;db.onversionchange=()=>{db.close();database=undefined;};resolve(db);}; request.onerror = () => {database=undefined;reject(request.error);}; });
  const pending=database;pending.catch(()=>{if(database===pending)database=undefined;});return pending;
}
export async function localGet(store, key) { const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export async function localSet(store, key, value) { return localBatch([{store,key,value}]); }
export async function localKeys(store) { const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).getAllKeys(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export async function localBatch(changes,options={}){
  const captured=structuredClone(changes),guarded=Object.hasOwn(options,'expectedTextureConfig'),expected=structuredClone(options.expectedTextureConfig);if(!captured.length)return;
  if(captured.some(change=>!['drafts','settings','resource-packs'].includes(change.store)))throw new Error('Unknown browser-local store.');
  const db=await open();return new Promise((resolve,reject)=>{
    const stores=[...new Set([...captured.map(change=>change.store),...(guarded?['settings']:[])])],tx=db.transaction(stores,'readwrite');let failure;tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure??tx.error??new Error('Browser-local save failed.'));tx.onabort=()=>reject(failure??tx.error??new Error('Browser-local save aborted.'));
    const apply=()=>{try{for(const {store,key,value}of captured){const target=tx.objectStore(store);if(value===undefined)target.delete(key);else target.put(value,key);}}catch(error){failure=error;tx.abort();reject(error);}};
    if(guarded){const request=tx.objectStore('settings').get('texture-library');request.onsuccess=()=>{try{if(JSON.stringify(request.result)!==JSON.stringify(expected)){failure=new Error('Saved rendering packs changed in another tab. Retry saved packs before saving.');failure.name='TextureLibraryConflict';tx.abort();return;}apply();}catch(error){failure=error;tx.abort();reject(error);}};}else apply();
  });
}
export async function localTextureSnapshot(){
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction(['settings','resource-packs'],'readonly'),config=tx.objectStore('settings').get('texture-library'),store=tx.objectStore('resource-packs'),keys=store.getAllKeys(),values=store.getAll();
    tx.oncomplete=()=>resolve({config:config.result,records:keys.result.map((key,index)=>({key,value:values.result[index]}))});tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Browser-local read aborted.'));
  });
}
