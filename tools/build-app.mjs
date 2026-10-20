import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),destination=path.join(root,'dist');
await fs.mkdir(destination,{recursive:true});
for(const name of ['apps','packages','upstream.lock.json','package.json','README.md'])await fs.cp(path.join(root,name),path.join(destination,name),{recursive:true,force:true});
await fs.writeFile(path.join(destination,'BUILD.json'),JSON.stringify({name:'Iris Terrain Studio',builtAt:new Date().toISOString(),node:process.version,qualifiedTerrainEngine:false},null,2)+'\n');
console.log('Application copied to dist/. Start with: node dist/apps/server/index.mjs');
console.log('This development build includes pack editing. Terrain-engine qualification remains incomplete.');
