import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const LIMIT=64*1024*1024,roles=['baseline','default'];
export async function inspectDefaultAssets(directory){
  let manifest;
  try{
    const stat=await fs.lstat(path.join(directory,'manifest.json'));if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)throw new Error('Invalid default asset manifest.');
    const real=await fs.realpath(directory),manifestBytes=await fs.readFile(path.join(real,'manifest.json'));manifest=JSON.parse(manifestBytes.toString('utf8'));
    if(manifest.format!=='iris-terrain-studio-default-assets'||manifest.version!==1||manifest.target?.minecraftVersion!=='26.3'||JSON.stringify(manifest.target?.resourceFormat)!=='[97,1]'||!Array.isArray(manifest.packs)||manifest.packs.length!==2)throw new Error('Default asset metadata or target is invalid.');
    const archives=new Map(),packs=[];
    for(let i=0;i<roles.length;i++){
      const record=manifest.packs[i],role=roles[i],filename=path.join(real,role+'.zip');
      if(record.role!==role||record.filename!==role+'.zip'||typeof record.name!=='string'||record.name.length>256||!Number.isSafeInteger(record.bytes)||record.bytes<22||record.bytes>LIMIT||!/^[a-f0-9]{64}$/.test(record.sha256)||!/^[a-f0-9]{64}$/.test(record.sourceSha256))throw new Error('Invalid default asset archive record.');
      const stat=await fs.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==record.bytes)throw new Error('Default asset file size or type differs from its manifest.');
      const bytes=await fs.readFile(filename);if(createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw new Error('Default asset hash differs from its manifest.');
      archives.set(role,bytes);packs.push({role,name:record.name,bytes:record.bytes,sha256:record.sha256,sourceSha256:record.sourceSha256});
    }
    return{status:{configured:true,packs,qualification:{sourceCompatibilityVerified:false,clientRenderingParity:false}},archives,manifestBytes};
  }catch(error){if(error.code==='ENOENT'&&!manifest)return{status:{configured:false,packs:[]},archives:new Map()};throw error;}
}
export function defaultAssetsReader(directory){let cached;return()=>cached??=inspectDefaultAssets(directory).catch(()=>({status:{configured:false,packs:[],reason:'Configured rendering assets failed integrity checks. Reprovision the local authorized inputs.'},archives:new Map()}));}
