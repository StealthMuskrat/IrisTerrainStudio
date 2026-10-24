import {JsonDocument} from './document.mjs';
import {resourcePath,JSON_LIMIT} from '../shared/paths.mjs';
const ignored=path=>path.split('/').some(part=>part==='.iris'||part.startsWith('.iris-terrain-studio'));

/** Native schemas contain pack-specific enums. Never attach a different pack's bundle. */
export async function loadNativePackSchema(resource,rows,head,{current=()=>true,headers={}}={}){
  const alive=()=>{if(!current())throw new DOMException('Resource changed.','AbortError');};
  alive();resourcePath(resource);const base='/app/engine/schema-generated/',response=await fetch(base+'manifest.json',{cache:'no-cache',headers});
  if(response.status===401)throw new Error('Enter the server access token before loading a native pack schema.');
  if(!response.ok)throw new Error('No native schema bundle is installed. Run npm run engine:schemas -- /path/to/your/pack locally.');
  const manifest=await response.json();alive();if(manifest.scope!=='native-pack-schema-development-export'||manifest.irisCommit!=='c3359e0a16438b1bb8468901c6171dcefdf63f7f'||manifest.minecraft!=='26.3'||manifest.packSpecific!==true)throw new Error('The native schema bundle does not identify the pinned Iris and Minecraft inputs.');
  const names=Object.keys(manifest.packFiles||{}).sort(),paths=rows.filter(row=>!ignored(row.path)).map(row=>resourcePath(row.path)).sort();
  if(!names.length||names.length>20000||names.length!==paths.length||names.some((name,index)=>name!==paths[index]||!/^[a-f0-9]{64}$/.test(manifest.packFiles[name])))throw new Error('The native schema bundle belongs to a different pack snapshot. Export schemas for this pack first.');
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,names.length)},async()=>{while(cursor<names.length){alive();const name=names[cursor++],etag=await head(name);alive();if(etag!==`"${manifest.packFiles[name]}"`)throw new Error(`The native schema snapshot differs at ${name}. Re-export schemas for the saved pack.`);}}));
  const parts=resource.split('/'),name=(parts[0]==='snippet'?parts.slice(0,2).join('/'):parts[0])+'.schema.json',record=manifest.files?.[name];
  if(!record||!Number.isSafeInteger(record.bytes)||record.bytes<1||record.bytes>JSON_LIMIT||!/^[a-f0-9]{64}$/.test(record.sha256))throw new Error('No native schema is exported for this resource type.');
  const file=await fetch(base+name,{cache:'no-cache',headers});if(!file.ok)throw new Error('The native schema file is missing.');const bytes=await file.arrayBuffer();alive();if(bytes.byteLength!==record.bytes)throw new Error('The native schema file size differs from its manifest.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');alive();if(hash!==record.sha256)throw new Error('The native schema file differs from its export checksum.');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),document=new JsonDocument(text);if(document.root.type!=='object'||document.issues.length)throw new Error('The exported native schema is not an unambiguous JSON object.');
  return {text,schema:document.value,manifest,name};
}
