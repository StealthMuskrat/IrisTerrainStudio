// Local authorized inputs only. No source archive is downloaded or committed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {MinecraftResourcePack,ResourcePackStack,identifier} from '../../packages/resource-packs/pack.mjs';
import {inspectRenderingDependencies,blockDefinitionPaths} from '../../packages/resource-packs/dependencies.mjs';
import {writeZip} from '../../packages/shared/zip.mjs';
import {assetDigest} from '../../packages/resource-packs/bundle.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const encode=value=>new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');
async function input(filename){const stat=await fs.stat(filename);if(!stat.isFile()||stat.size>64*1024*1024)throw new Error('Each authorized resource-pack input must be a regular ZIP within 64 MiB.');return new Uint8Array(await fs.readFile(filename));}
export async function prepareDefaults({baseline,overrides,roots,destination=path.join(root,'.local-assets/rendering-defaults')}={}){
  if(!baseline||!overrides)throw new Error('Supply --baseline and --overrides authorized local ZIP paths.');
  const packs=await Promise.all([baseline,overrides].map(async filename=>MinecraftResourcePack.open(await input(filename),path.basename(filename))));
  if(packs.some(pack=>pack.metadata.studioRenderingBundle))throw new Error('Provision original Minecraft resource packs, not an already-resolved Studio bundle.');
  if(!roots)roots=blockDefinitionPaths(packs).flatMap(name=>{const match=/^assets\/([^/]+)\/blockstates\/(.+)\.json$/.exec(name);return match?[match[1]+':'+match[2]]:[];});
  if(!Array.isArray(roots)||!roots.length||roots.length>4096)throw new Error('Supply 1–4096 block-type roots.');
  roots=roots.map(value=>identifier(value).id);
  const baselineStack=new ResourcePackStack([packs[0]]),combinedStack=new ResourcePackStack(packs);
  let baselineCapture,combinedCapture;
  try{
    const baselineRoots=roots.filter(id=>{const [namespace,key]=id.split(':');return baselineStack.resolve(`assets/${namespace}/blockstates/${key}.json`);});
    baselineCapture=await inspectRenderingDependencies(baselineStack,baselineRoots,{retainBlockDefinitions:true});
    combinedCapture=await inspectRenderingDependencies(combinedStack,roots,{retainBlockDefinitions:true});
    const failures=[...baselineCapture.report.errors,...combinedCapture.report.errors];
    if(failures.length)throw new Error('Default asset dependencies are incomplete: '+failures.slice(0,8).map(e=>e.context+': '+e.message).join('; '));
  }finally{await baselineStack.dispose();await combinedStack.dispose();}
  const selected=packs.map(pack=>new Map([['pack.mcmeta',pack.entries.get('pack.mcmeta')]]));
  // Retain original paths and metadata, including active overlays and native filters.
  // The baseline also retains dependencies introduced only by override models.
  for(const [capture,sources] of [[baselineCapture,[0]],[combinedCapture,[0,1]]])for(const file of capture.report.files){const index=sources[file.source];selected[index].set(file.sourcePath,packs[index].entries.get(file.sourcePath));}
  const archives=selected.map(entries=>writeZip(entries)),roles=['baseline','default'];
  const records=await Promise.all(archives.map(async(bytes,index)=>({role:roles[index],name:(index?'Default overrides: ':'Vanilla baseline: ')+packs[index].name.slice(0,200),filename:roles[index]+'.zip',bytes:bytes.length,sha256:await assetDigest(bytes),sourceSha256:packs[index].digest,files:selected[index].size})));
  const manifest={format:'iris-terrain-studio-default-assets',version:1,target:{minecraftVersion:'26.3',resourceFormat:[97,1]},roots:combinedCapture.report.roots,packs:records,sources:combinedCapture.report.sources,dependencies:{baseline:baselineCapture.report.counts,combined:combinedCapture.report.counts},qualification:{sourceCompatibilityVerified:false,clientRenderingParity:false},scope:'Local authorized inputs, all block definitions, original winning dependency bytes and source notices; no block-state enumeration or image resampling.'};
  // Publish only a fully validated immutable directory; never replace an installation silently.
  await fs.mkdir(path.dirname(destination),{recursive:true});const stage=await fs.mkdtemp(path.join(path.dirname(destination),'.rendering-defaults-'));
  try{for(let i=0;i<archives.length;i++)await fs.writeFile(path.join(stage,records[i].filename),archives[i]);await fs.writeFile(path.join(stage,'manifest.json'),encode(manifest));
    try{await fs.lstat(destination);throw new Error('Default asset destination already exists. Choose a new --output directory to review the replacement.');}catch(error){if(error.code!=='ENOENT')throw error;}
    await fs.rename(stage,destination);
  }finally{await fs.rm(stage,{recursive:true,force:true});}
  return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){const key={'--baseline':'baseline','--overrides':'overrides','--roots':'roots','--output':'destination'}[args[i]];if(!key||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Use --baseline ZIP --overrides ZIP [--roots JSON] [--output DIR].');options[key]=args[i+1];}if(options.roots)options.roots=JSON.parse(await fs.readFile(options.roots,'utf8'));const result=await prepareDefaults(options);console.log(`Prepared ${result.roots.length} block-type roots in two local default packs. Input identities are recorded; redistribution and client parity are not qualified.`);}
  catch(error){console.error(error.message);process.exitCode=1;}
}
