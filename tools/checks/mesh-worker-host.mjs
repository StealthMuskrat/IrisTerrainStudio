// Controlled VM hosts execute the actual worker body with its actual module bindings.
// These hosts test message behavior; they do not execute a browser or GPU.
import {readFile} from 'node:fs/promises';

const url=new URL('../../packages/voxel-renderer/mesh-worker.mjs',import.meta.url);
export async function loadMeshWorkerHost(){
  let source=await readFile(url,'utf8');const bindings={};
  const imports=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)];
  for(const match of imports){
    const module=await import(new URL(match[2],url));
    for(const item of match[1].split(',')){
      const [name,alias=name]=item.trim().split(/\s+as\s+/);
      if(!(name in module))throw new Error(`Missing actual mesh-worker binding: ${name}`);
      bindings[alias]=module[name];
    }
    source=source.replace(match[0],'');
  }
  return{source,bindings};
}
