import{packId,jsonPath,JSON_LIMIT}from'../../../packages/shared/paths.mjs';
import{category}from'../../../packages/iris-resources/catalog.mjs';
import{JsonDocument}from'../../../packages/iris-config/document.mjs';
export const DRAFT_LIMITS=Object.freeze({entries:128,payload:16*1024*1024,bundle:32*1024*1024,preview:65536});
const encoder=new TextEncoder();
function shape(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>!Object.hasOwn(value,key)))throw new Error('Unknown or missing draft fields.');}
export function draftRecord(key,value){
  if(typeof key!=='string')throw new Error('Invalid draft location.');const split=key.indexOf('/'),pack=packId(key.slice(0,split)),path=jsonPath(key.slice(split+1));if(split<1||category(path).excluded)throw new Error('Draft location is read-only.');
  shape(value,['text','baseText','baseEtag','savedAt']);for(const text of[value.text,value.baseText])if(typeof text!=='string'||text.length>JSON_LIMIT||encoder.encode(text).byteLength>JSON_LIMIT)throw new Error('Draft source exceeds 8 MiB or is not text.');
  if(typeof value.baseEtag!=='string'||!value.baseEtag||value.baseEtag.length>256||/[\u0000-\u001f\u007f]/u.test(value.baseEtag)||!Number.isSafeInteger(value.savedAt)||value.savedAt<0||value.savedAt>8640000000000000)throw new Error('Invalid draft version or saved time.');
  if(value.text===value.baseText)throw new Error('This copy has no unsaved source changes.');
  return{key,pack,path,value:{text:value.text,baseText:value.baseText,baseEtag:value.baseEtag,savedAt:value.savedAt}};
}
export function draftRows(snapshot){const rows=[],warnings=[];for(const item of snapshot.records){try{rows.push({...draftRecord(item.key,item.value),expected:item.value});}catch(error){warnings.push(String(item.key).slice(0,1024)+': '+error.message);}}return{rows,warnings,complete:snapshot.complete,bytes:snapshot.bytes};}
export function sameDraft(a,b){return JSON.stringify(a)===JSON.stringify(b);}
export function draftBundle(rows){
  if(rows.length>DRAFT_LIMITS.entries)throw new Error('Draft bundle exceeds 128 entries.');let bytes=0;const seen=new Set(),entries=rows.map(row=>{const item=draftRecord(row.key,row.value);if(seen.has(item.key))throw new Error('Duplicate draft location.');seen.add(item.key);bytes+=2*(item.value.text.length+item.value.baseText.length)+256+item.key.length*2;if(bytes>DRAFT_LIMITS.payload)throw new Error('Draft bundle exceeds 16 MiB of counted source.');return{pack:item.pack,path:item.path,...item.value};});
  const text=JSON.stringify({format:'iris-terrain-studio-drafts',version:1,entries},null,2)+'\n';if(encoder.encode(text).byteLength>DRAFT_LIMITS.bundle)throw new Error('Encoded draft bundle exceeds 32 MiB. Export fewer drafts.');return text;
}
export function parseDraftBundle(text){
  if(typeof text!=='string'||text.length>DRAFT_LIMITS.bundle||encoder.encode(text).byteLength>DRAFT_LIMITS.bundle)throw new Error('Draft import exceeds 32 MiB.');const document=new JsonDocument(text,{maxNodes:2048});if(document.issues.length)throw new Error('Draft bundle contains duplicate properties.');const value=JSON.parse(text.replace(/^\uFEFF/,''));shape(value,['format','version','entries']);if(value.format!=='iris-terrain-studio-drafts'||value.version!==1||!Array.isArray(value.entries)||value.entries.length>DRAFT_LIMITS.entries)throw new Error('Unknown draft bundle format or too many entries.');
  const rows=value.entries.map(entry=>{shape(entry,['pack','path','text','baseText','baseEtag','savedAt']);packId(entry.pack);jsonPath(entry.path);return draftRecord(entry.pack+'/'+entry.path,{text:entry.text,baseText:entry.baseText,baseEtag:entry.baseEtag,savedAt:entry.savedAt});});draftBundle(rows);return rows;
}
// Import only empty locations. Never replace a different local draft implicitly.
export async function draftImportPlan(rows,read){
  const changes=[],guards=[],conflicts=[],identical=[];for(const row of rows){const expected=await read(row.key);if(expected!==undefined){if(sameDraft(expected,row.value))identical.push(row.key);else conflicts.push(row.key);}else{changes.push({store:'drafts',key:row.key,value:row.value});guards.push({key:row.key,value:undefined});}}
  return{changes,guards,conflicts,identical};
}
