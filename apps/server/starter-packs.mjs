import fs from'node:fs/promises';
import{createHash}from'node:crypto';
import manifest from'../../packages/iris-resources/starters/index.json' with{type:'json'};
import{resourcePath}from'../../packages/shared/paths.mjs';
const base=new URL('../../packages/iris-resources/starters/',import.meta.url);
// Only bundled, pinned sources are admitted; callers cannot supply filesystem paths.
export function starterCatalog(){return manifest.starters.map(({id,name,description,dimension,irisCommit,files})=>({id,name,description,dimension,irisCommit,files:files.map(({path})=>path)}));}
export async function starterFiles(id){
  const entry=manifest.starters.find(row=>row.id===id);if(!entry)throw new Error('Choose an available terrain starter or an empty folder.');
  const files=new Map();let bytes=0;
  for(const row of entry.files){const name=resourcePath(row.path),data=await fs.readFile(new URL('terrain3d/'+name,base));if((bytes+=data.length)>1048576||createHash('sha256').update(data).digest('hex')!==row.sha256)throw new Error('Bundled terrain starter integrity check failed.');files.set(name,data);}
  return{files,dimension:entry.dimension};
}
