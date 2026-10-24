import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const SHA256=/^[a-f0-9]{64}$/;
const LIMITS={manifest:256*1024,wasm:256*1024*1024,runtime:8*1024*1024,registry:16*1024*1024,inventory:8*1024*1024,source:256*1024*1024};
// Inspect a bounded, owned file handle, including a second stat after reading.
// An artifact swapped during inspection must never turn a manifest into availability.
async function checkedFile(root,relative,limit,expected,{json=false,bytes}={}){
  const rootStat=await fs.lstat(root);
  if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw new Error('Engine artifacts must use a regular directory.');
  const parts=relative.split('/');let directory=root;
  for(const part of parts.slice(0,-1)){
    directory=path.join(directory,part);const stat=await fs.lstat(directory);
    if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error(`${relative}: artifact directory is not a regular directory.`);
  }
  const filename=path.join(root,relative),entry=await fs.lstat(filename);
  if(!entry.isFile()||entry.isSymbolicLink())throw new Error(`${relative}: artifact is not a regular file.`);
  const handle=await fs.open(filename,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
    const before=await handle.stat();
    if(!before.isFile()||before.dev!==entry.dev||before.ino!==entry.ino||before.size<1||before.size>limit||bytes!==undefined&&before.size!==bytes)throw new Error(`${relative}: artifact size or identity is invalid.`);
    const hash=createHash('sha256'),chunks=[];let size=0;
    for await(const chunk of handle.createReadStream({autoClose:false})){
      if((size+=chunk.length)>limit)throw new Error(`${relative}: artifact exceeds its byte limit.`);
      hash.update(chunk);if(json)chunks.push(chunk);
    }
    const after=await handle.stat();
    if(size!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw new Error(`${relative}: artifact changed during inspection.`);
    const sha256=hash.digest('hex');
    if(expected!==undefined&&(!SHA256.test(expected)||sha256!==expected))throw new Error(`${relative}: artifact differs from its manifest.`);
    return {sha256,bytes:size,...(json?{value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}:{})};
  }finally{await handle.close();}
}
function unavailable(error,label){return {available:false,reason:error.code==='ENOENT'?`${label} is not installed.`:error.code==='ELOOP'?`${label} contains a symbolic link.`:error.code?`${label} could not be read.`:error instanceof SyntaxError?`${label} has invalid JSON metadata.`:error.message};}

/** File integrity and input compatibility only; this cannot establish engine parity. */
export async function inspectRuntimeInstallation(repository,{distribution=false}={}){
  const lock=JSON.parse(await fs.readFile(path.join(repository,'upstream.lock.json'),'utf8'));
  const root=path.join(repository,'apps/web/engine');let manifest;
  let iris,registry,laboratory;
  try{
    const record=await checkedFile(root,'iris-generated/manifest.json',LIMITS.manifest,undefined,{json:true});manifest=record.value;
    if(manifest.formatVersion!==1||manifest.scope!=='iris-browser-engine-development'||manifest.irisCommit!==lock.iris.commit||!Array.isArray(manifest.exports)||!manifest.exports.length||manifest.exports.length>256||manifest.exports.some(name=>typeof name!=='string'||!/^[$A-Z_a-z][$\w]*$/.test(name)))throw new Error('Iris engine metadata does not identify the pinned browser build.');
    for(const [name,field,limit]of[['iris.wasm','wasmSha256',LIMITS.wasm],['iris.wasm-runtime.js','runtimeSha256',LIMITS.runtime],['config-inventory.json','configInventorySha256',LIMITS.inventory],...(distribution?[['source.zip','sourceSha256',LIMITS.source]]:[])]){
      if(!SHA256.test(manifest[field]))throw new Error(`Iris engine metadata has no ${name} checksum.`);
      await checkedFile(root,'iris-generated/'+name,limit,manifest[field]);
    }
    iris={available:true,manifestSha256:record.sha256,wasmSha256:manifest.wasmSha256,runtimeSha256:manifest.runtimeSha256,scope:manifest.scope,irisCommit:manifest.irisCommit,volmLibCandidate:manifest.volmLibCandidate,platformSourceServerJarSha256:manifest.platformSourceServerJarSha256};
  }catch(error){iris=unavailable(error,'Iris browser engine');}
  try{
    const record=await checkedFile(root,'registry-generated/manifest.json',LIMITS.manifest,undefined,{json:true}),data=record.value;
    if(data.scope!=='minecraft-development-registry-export'||data.minecraft?.id!==lock.minecraft.version||data.minecraft.stable!==true||!Number.isSafeInteger(data.blocks)||data.blocks<1||!Number.isSafeInteger(data.states)||data.states<data.blocks)throw new Error('Native registry metadata does not identify the target Minecraft version.');
    if(!iris.available)throw new Error('Install a matching Iris browser engine before using the native registry.');
    if(data.volmLibCandidate!==manifest.volmLibCandidate||!SHA256.test(manifest.platformSourceServerJarSha256)||data.sourceServerJarSha256!==manifest.platformSourceServerJarSha256)throw new Error('Native registry and browser engine use different platform inputs.');
    const file=data.files?.['browser-registry.json'];
    if(!file||!SHA256.test(file.sha256)||!Number.isSafeInteger(file.bytes))throw new Error('Native registry metadata has no browser input checksum.');
    await checkedFile(root,'registry-generated/browser-registry.json',LIMITS.registry,file.sha256,{bytes:file.bytes});
    registry={available:true,manifestSha256:record.sha256,sha256:file.sha256,blocks:data.blocks,states:data.states};
  }catch(error){registry=unavailable(error,'Native browser registry');}
  try{
    const record=await checkedFile(root,'generated/manifest.json',LIMITS.manifest,undefined,{json:true}),data=record.value;
    if(data.formatVersion!==1||data.scope!=='volmlib-primitive-portability')throw new Error('Noise laboratory metadata does not identify the primitive module.');
    const evidence=JSON.parse(await fs.readFile(path.join(repository,'docs/evidence/noise-rng-portability-2026-10-20.json'),'utf8'));
    if(data.wasmSha256!==evidence.wasmSha256||data.runtimeSha256!==evidence.runtimeSha256)throw new Error('Noise laboratory artifacts differ from the recorded primitive evidence.');
    await checkedFile(root,'generated/probe.wasm',LIMITS.wasm,data.wasmSha256);
    await checkedFile(root,'generated/probe.wasm-runtime.js',LIMITS.runtime,data.runtimeSha256);
    laboratory={available:true,manifestSha256:record.sha256,wasmSha256:data.wasmSha256,runtimeSha256:data.runtimeSha256};
  }catch(error){laboratory=unavailable(error,'Native noise laboratory');}
  return {...iris,registry,laboratory,terrainAvailable:false,terrainParityVerified:false,releaseMatchVerified:false};
}

export function runtimeStatusReader(repository,{ttl=5000}={}){
  let pending,cached,expires=0;
  return ()=>{
    if(pending)return pending;
    if(cached&&Date.now()<expires)return Promise.resolve(cached);
    pending=inspectRuntimeInstallation(repository).then(value=>{cached=value;expires=Date.now()+ttl;return value;}).finally(()=>{pending=null;});
    return pending;
  };
}
