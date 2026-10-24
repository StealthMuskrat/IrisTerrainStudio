import{packId,jsonPath}from'../../../packages/shared/paths.mjs';
import{numericSeed}from'../../../packages/iris-engine/client.mjs';
import{navigationSettings,cameraFromView}from'../../../packages/voxel-renderer/navigation.mjs';
import{JsonDocument}from'../../../packages/iris-config/document.mjs';
export const VIEW_LIMITS=Object.freeze({entries:64,storedBytes:128*1024,importBytes:256*1024});
const clone=value=>structuredClone(value),bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
function object(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))throw new Error('Unknown or invalid saved-view fields.');}
function text(value,label,max=128){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))throw new Error('Invalid '+label+'.');return value;}
function path(value){jsonPath(value);return value;}
export function previewSetup(input){
  object(input,['field','seed','x','z','y','span','resolution','chunks','dimension','resource','style','grid','studioLayout','palette','view']);
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(input.field)||['procedural-object','procedural-placement'].includes(input.field))throw new Error('This field needs a live procedural selection and cannot be saved as a preview setup.');
  if(typeof input.seed!=='string'||input.seed.length>128)throw new Error('Invalid entered seed.');numericSeed(input.seed);
  if(![input.x,input.z,input.y,input.span].every(Number.isFinite)||input.span<=0||input.span>4096||Math.abs(input.x)+input.span/2>30000000||Math.abs(input.z)>30000000||Math.abs(input.y)>30000000||!Number.isInteger(input.resolution)||input.resolution<1||input.resolution>512)throw new Error('Saved preview coordinates/resolution exceed the preview limits.');
  if(input.chunks!==undefined&&![1,2,4].includes(input.chunks))throw new Error('Choose a saved chunk edge of 1, 2 or 4.');
  if(typeof input.dimension!=='string'||input.dimension&&(!input.dimension.startsWith('dimensions/')||!path(input.dimension)))throw new Error('Choose a dimension JSON resource.');
  if(input.resource!==null){path(input.resource);if(input.field!=='iris-generator')throw new Error('Only a generator setup can bind a standalone generator resource.');}
  if(input.style!==null){object(input.style,['name','path','pointer','expressionResource']);text(input.style.name,'style name',128);if(input.style.path!==null)path(input.style.path);if(typeof input.style.pointer!=='string'||input.style.pointer.length>1024||input.style.pointer!==''&&(!input.style.pointer.startsWith('/')||/~(?:[^01]|$)/.test(input.style.pointer))||typeof input.style.expressionResource!=='boolean')throw new Error('Invalid saved style location.');}
  if(input.style&&(!input.field.startsWith('iris-style')||input.style.path===null&&(input.style.pointer!==''||input.style.expressionResource||!/^[A-Z][A-Z0-9_]*$/.test(input.style.name))))throw new Error('Invalid built-in style or resource-style binding.');
  if(input.field.startsWith('iris-style')&&!input.style)throw new Error('Choose a noise style before saving this setup.');if(input.field==='iris-generator'&&(!input.resource?.startsWith('generators/')))throw new Error('Open a generator before saving its preview setup.');
  if(typeof input.grid!=='boolean'||typeof input.studioLayout!=='boolean'||!['terrain','grayscale','heat'].includes(input.palette)||!['map','world','split'].includes(input.view))throw new Error('Invalid preview display controls.');return clone(input);
}
export function cameraBookmark(input){
  object(input,['volume','camera','navigation','source']);const v=input.volume;object(v,['origin','width','height','depth']);
  if(!Array.isArray(v.origin)||v.origin.length!==3||!v.origin.every(Number.isSafeInteger)||![v.width,v.height,v.depth].every(value=>Number.isSafeInteger(value)&&value>0&&value<=4096)||v.width*v.height*v.depth>16777216)throw new Error('Invalid stored-volume bounds.');
  object(input.camera,['eye','yaw','pitch','distance']);cameraFromView(v,input.camera);object(input.navigation,['mode','speed']);if(input.navigation.mode===undefined||input.navigation.speed===undefined)throw new Error('Camera navigation mode and speed are required.');navigationSettings(input.navigation);
  if(input.source!==null){object(input.source,['field','seed','dimension']);if(input.source.field!==null)text(input.source.field,'source field',128);if(input.source.seed!==null)text(input.source.seed,'source seed',128);if(input.source.dimension!==null)text(input.source.dimension,'source dimension',1024);}
  return clone(input);
}
export function viewEntry(input){
  object(input,['id','name','pack','kind','data','remember']);if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id))throw new Error('Invalid saved-view identity.');text(input.name,'saved-view name',80);if(typeof input.pack!=='string')throw new Error('Invalid saved pack binding.');if(input.pack)packId(input.pack);if(typeof input.remember!=='boolean')throw new Error('Invalid saved-view persistence choice.');
  const data=input.kind==='preview'?previewSetup(input.data):input.kind==='camera'?cameraBookmark(input.data):null;if(!data)throw new Error('Unknown saved-view kind.');return{...input,data};
}
function valid(entries){if(entries.length>VIEW_LIMITS.entries)throw new Error('The view library admits at most 64 entries.');const ids=new Set();for(const entry of entries){viewEntry(entry);if(ids.has(entry.id))throw new Error('Duplicate saved-view identity.');ids.add(entry.id);}if(bytes({version:1,entries})>VIEW_LIMITS.storedBytes)throw new Error('The view library exceeds its 128 KiB budget.');}
const manifest=entries=>({version:1,entries:entries.filter(entry=>entry.remember)});
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const identity=entry=>JSON.stringify([entry.name,entry.pack,entry.kind,canonical(entry.data)]);
export function parseViewBundle(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>VIEW_LIMITS.importBytes)throw new Error('Saved-view import exceeds 256 KiB.');const doc=new JsonDocument(text,{maxNodes:8192});if(doc.issues.length)throw new Error('Saved-view import has duplicate properties.');
  // Parse with native JSON numbers after the exact parser has checked structure/duplicates.
  const value=JSON.parse(text.charCodeAt(0)===0xfeff?text.slice(1):text);object(value,['format','version','entries']);if(value.format!=='iris-terrain-studio-views'||value.version!==1||!Array.isArray(value.entries))throw new Error('Unknown saved-view bundle format.');const entries=value.entries.map(viewEntry);valid(entries);return entries;
}
export class ViewLibrary{
  constructor({read,write,id=()=>crypto.randomUUID()}){Object.assign(this,{read,write,id});this._entries=[];this.revision=0;this.saved=undefined;this.ready=false;this.warnings=[];this.queue=Promise.resolve();}
  get entries(){return clone(this._entries);}
  enqueue(action){const result=this.queue.then(action);this.queue=result.catch(()=>{});return result;}
  restore(){return this.enqueue(async()=>{
    try{
      const stored=await this.read();if(stored!==undefined){object(stored,['version','entries']);if(stored.version!==1||!Array.isArray(stored.entries)||stored.entries.some(entry=>!entry.remember))throw new Error('Invalid saved-view settings.');valid(stored.entries);}
      const session=this.entries.filter(entry=>!entry.remember),entries=(stored?.entries??[]).map(viewEntry),ids=new Map(entries.map(entry=>[entry.id,entry]));
      for(const entry of session){const prior=ids.get(entry.id);if(prior&&identity(prior)!==identity(entry))throw new Error('A remembered identity conflicts with a session view; the session copy was retained.');if(!prior)entries.push(entry);}valid(entries);
      this._entries=entries;this.saved=clone(stored);this.ready=true;this.warnings=[];this.revision++;
    }catch(error){this.ready=false;this.warnings=['Saved views could not be loaded: '+error.message+'. Existing entries remain available.'];}
    return this.warnings;
  });}
  change(edit,{revision}={}){return this.enqueue(async()=>{
    if(revision!==undefined&&this.revision!==revision)throw new Error('The view library changed. Review the action again.');const next=clone(this.entries);edit(next);valid(next);const saved=manifest(next),wanted=JSON.stringify(saved),prior=JSON.stringify(this.saved);
    if((saved.entries.length||this.saved!==undefined)&&wanted!==prior){if(!this.ready)throw new Error('Retry saved views before remembering changes. Session-only entries remain available.');try{await this.write(saved,this.saved);}catch(error){if(error.name==='ViewLibraryConflict'){this.ready=false;this.warnings=[error.message];}throw error;}this.saved=clone(saved);}
    this._entries=next;this.revision++;return this.entries;
  });}
  add({name,pack,kind,data,remember=false}){const entry=viewEntry({id:this.id(),name:name.trim(),pack,kind,data,remember});return this.change(entries=>entries.push(entry));}
  update(id,{name,remember},{revision}={}){return this.change(entries=>{const entry=entries.find(row=>row.id===id);if(!entry)throw new Error('This saved view is no longer available.');entry.name=name.trim();entry.remember=remember;},{revision});}
  remove(id,options){return this.change(entries=>{const index=entries.findIndex(row=>row.id===id);if(index<0)throw new Error('This saved view is no longer available.');entries.splice(index,1);},options);}
  import(entries,{remember=false,revision}={}){const captured=entries.map(viewEntry);return this.change(next=>{const known=new Set(next.map(identity));for(const entry of captured){const key=identity(entry);if(known.has(key))continue;known.add(key);next.push({...clone(entry),id:this.id(),remember});}},{revision});}
  export(){valid(this.entries);return JSON.stringify({format:'iris-terrain-studio-views',version:1,entries:this.entries},null,2)+'\n';}
}
