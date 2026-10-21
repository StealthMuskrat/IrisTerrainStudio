import { resourcePath, isPlainObject } from '../shared/paths.mjs';
import { writeZip } from '../shared/zip.mjs';

export const BUNDLE_MANIFEST = 'studio-rendering-bundle.json';
export const ASSET_LIMITS = Object.freeze({ bytes:64*1024*1024, files:8192, roots:4096, json:2*1024*1024 });
const encoder=new TextEncoder(),decoder=new TextDecoder();
export async function assetDigest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function assetCurrent(isCurrent){if(!isCurrent())throw new DOMException('The displayed volume or resource packs changed. Inspect dependencies again.','AbortError');}
function bundlePath(path){resourcePath(path);if(!path.startsWith('assets/')&&!path.startsWith('sources/'))throw new Error(`Invalid rendering-bundle asset path: ${path}`);return path;}
export function assetJson(bytes,path){
  if(bytes.length>ASSET_LIMITS.json)throw new Error(`Asset JSON exceeds 2 MiB: ${path}`);
  let value;try{value=JSON.parse(decoder.decode(bytes));}catch{throw new Error(`Invalid asset JSON: ${path}`);}
  if(!isPlainObject(value))throw new Error(`Asset JSON must be an object: ${path}`);return value;
}

// This is a Studio container, not a Minecraft pack-format conversion. Asset bytes remain unchanged.
export async function writeRenderingBundle(capture,{isCurrent=()=>true}={}){
  assetCurrent(isCurrent);
  if(capture.report.errors.length)throw new Error('Resolve dependency errors before exporting a rendering bundle.');
  const entries=new Map(),files=[];let total=0;
  for(const [path,input] of capture.files){
    bundlePath(path);const bytes=input.slice();
    if(entries.size>=ASSET_LIMITS.files||(total+=bytes.length)>ASSET_LIMITS.bytes)throw new Error('Rendering bundle exceeds its file or byte budget.');
    entries.set(path,bytes);
  }
  // Take the complete snapshot before the first await; later pack mutations cannot change hashes or output.
  const report=structuredClone(capture.report),provenance=new Map(report.files.map(file=>[file.path,file]));
  for(const [path,bytes]of entries){assetCurrent(isCurrent);files.push({...provenance.get(path),path,bytes:bytes.length,sha256:await assetDigest(bytes)});}
  assetCurrent(isCurrent);
  const manifest={format:'iris-terrain-studio-rendering-bundle',version:1,roots:report.roots,blocks:report.blocks,sources:report.sources,files,
    scope:'All model candidates for the listed block types; original JSON, PNG and metadata bytes. No block-state enumeration or model selection.',
    qualification:{minecraftPackFormatResolved:false,clientRenderingParity:false,complete:false},warnings:report.warnings};
  const json=encoder.encode(JSON.stringify(manifest,null,2));if(json.length>ASSET_LIMITS.json)throw new Error('Rendering-bundle manifest exceeds 2 MiB.');
  entries.set(BUNDLE_MANIFEST,json);const zip=writeZip(entries);
  if(zip.length>ASSET_LIMITS.bytes)throw new Error('Rendering-bundle ZIP exceeds 64 MiB, including metadata.');
  assetCurrent(isCurrent);return{bytes:zip,manifest};
}

export async function readRenderingBundle(entries){
  const manifest=assetJson(entries.get(BUNDLE_MANIFEST),BUNDLE_MANIFEST);
  if(manifest.format!=='iris-terrain-studio-rendering-bundle'||manifest.version!==1)throw new Error('Unsupported Studio rendering-bundle format.');
  if(!Array.isArray(manifest.files)||manifest.files.length>ASSET_LIMITS.files||!Array.isArray(manifest.roots)||manifest.roots.length>ASSET_LIMITS.roots||manifest.roots.some(root=>typeof root!=='string'||root.length>1024)||!Array.isArray(manifest.sources)||manifest.sources.length>128)throw new Error('Invalid rendering-bundle manifest or admission budget.');
  const seen=new Set();let total=0;
  for(const file of manifest.files){
    if(!isPlainObject(file))throw new Error('Invalid rendering-bundle file record.');
    const path=bundlePath(file.path),bytes=entries.get(path);
    if(seen.has(path)||!bytes||!Number.isSafeInteger(file.bytes)||file.bytes!==bytes.length||!/^[a-f0-9]{64}$/.test(file.sha256)|| (total+=bytes.length)>ASSET_LIMITS.bytes)throw new Error(`Invalid rendering-bundle file: ${path}`);
    seen.add(path);if(await assetDigest(bytes)!==file.sha256)throw new Error(`Rendering-bundle hash mismatch: ${path}`);
  }
  if(entries.size!==seen.size+1)throw new Error('Rendering bundle contains unlisted files.');
  // Qualification claims in imported manifests are never trusted as runtime support flags.
  return manifest;
}
