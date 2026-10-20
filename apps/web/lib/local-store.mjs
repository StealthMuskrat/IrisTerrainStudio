let database;
function open() {
  if (!database) database = new Promise((resolve, reject) => { const request = indexedDB.open('iris-terrain-studio', 1); request.onupgradeneeded = () => { for (const name of ['drafts','settings','resource-packs']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  return database;
}
export async function localGet(store, key) { const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
export async function localSet(store, key, value) { const db = await open(); return new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); const objectStore = tx.objectStore(store); if (value === undefined) objectStore.delete(key); else objectStore.put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
export async function localKeys(store) { const db = await open(); return new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).getAllKeys(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
