const pinnedIris='c3a9449a026078c44a87c9776766f54a67779392';
export async function loadFieldInventory(){
  const base='/app/engine/iris-generated/',manifestResponse=await fetch(base+'manifest.json');if(!manifestResponse.ok)return null;
  const manifest=await manifestResponse.json();if(!manifest.configInventorySha256)return null;
  const response=await fetch(base+'config-inventory.json');if(!response.ok)throw new Error('The native field inventory is missing. Rebuild the local engine.');
  const bytes=await response.arrayBuffer(),actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  if(actual!==manifest.configInventorySha256)throw new Error('Native field metadata differs from its build manifest.');
  const inventory=JSON.parse(new TextDecoder().decode(bytes));if(inventory.scope!=='pinned-native-field-inventory'||inventory.irisCommit!==pinnedIris)throw new Error('Native field metadata does not identify the pinned Iris source.');return inventory;
}
export function fieldHint(inventory,path,parts=[]){
  if(!inventory)return{};
  const folders=path.split('/'),root=['snippet','snippets'].includes(folders[0])?folders[1]:folders[0];let current={definition:inventory.roots[root]};
  for(const part of parts){
    if(current.kind==='array'){current=current.items||{};continue;}
    if(current.kind==='map'){current=current.values||{};continue;}
    const properties=current.definition?inventory.definitions[current.definition]?.properties:current.properties;current=properties?.[part]||{};
  }
  const definition=current.definition?inventory.definitions[current.definition]:null;
  return{...definition,...current,type:current.kind==='integer'?'integer':current.kind==='number'?'number':current.kind==='boolean'?'boolean':current.kind==='string'?'string':undefined};
}
