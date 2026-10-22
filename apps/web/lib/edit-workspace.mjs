import{JsonDocument,EditHistory,stringify}from'../../../packages/iris-config/document.mjs';
import{validateSchema}from'../../../packages/iris-config/schema.mjs';
import{category}from'../../../packages/iris-resources/catalog.mjs';
import{jsonPath,packId,JSON_LIMIT}from'../../../packages/shared/paths.mjs';
const key=(pack,path)=>pack+'/'+path;
// Inactive buffers only. The live editor keeps its existing source/history limits.
export class EditWorkspace{
  constructor({maxEntries=16,maxBytes=64*1024*1024}={}){if(!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>16||!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>64*1024*1024)throw new Error('Invalid edit workspace budget.');this.records=new Map();this.bytes=0;this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.schemaSizes=new WeakMap();}
  cost(record){
    let schema=0;if(record.schema&&typeof record.schema==='object'){schema=this.schemaSizes.get(record.schema);if(schema===undefined){schema=stringify(record.schema).length*2;this.schemaSizes.set(record.schema,schema);}}
    return 256+2*(record.text.length+record.baseText.length+(record.history?.entries??[]).reduce((sum,text)=>sum+text.length,0))+schema;
  }
  stash(record){
    if(!record)return;packId(record.pack);jsonPath(record.path);const id=key(record.pack,record.path),prior=this.records.get(id),bytes=this.cost(record),remove=[],dirty=record.text!==record.baseText;let size=this.bytes-(prior?.bytes??0)+bytes,count=this.records.size-Number(!!prior)+1;
    for(const [candidate,value]of this.records){if(size<=this.maxBytes&&count<=this.maxEntries)break;if(candidate!==id&&value.record.text===value.record.baseText){remove.push(candidate);size-=value.bytes;count--;}}
    if(size>this.maxBytes||count>this.maxEntries){if(dirty)throw new Error('Open edits reached the inactive buffer limit (16 resources / 64 MiB of source, history and schema text). Save or close an edit before switching.');this.remove(record.pack,record.path);return;}
    for(const candidate of remove){this.bytes-=this.records.get(candidate).bytes;this.records.delete(candidate);}
    if(prior)this.bytes-=prior.bytes;
    const history=record.history?Object.assign(new EditHistory(record.text,record.history.maxBytes),{entries:record.history.entries.slice(),index:record.history.index}):new EditHistory(record.text);
    this.records.set(id,{record:{...record,history},bytes});this.bytes+=bytes;
  }
  peek(pack,path){return this.records.get(key(pack,path))?.record;}
  take(pack,path){const record=this.peek(pack,path);this.remove(pack,path);return record;}
  remove(pack,path){const id=key(pack,path),entry=this.records.get(id);if(entry){this.bytes-=entry.bytes;this.records.delete(id);}return entry?.record;}
  entries(active=null,pack=null){const rows=new Map([...this.records].map(([id,entry])=>[id,entry.record]));if(active)rows.set(key(active.pack,active.path),active);return[...rows.values()].filter(row=>!pack||row.pack===pack);}
  dirty(active=null,pack=null){return this.entries(active,pack).filter(row=>row.text!==row.baseText);}
  saved(snapshot,result){const record=this.peek(snapshot.pack,snapshot.path);if(!record||record.owner!==snapshot.owner)return false;this.stash({...record,baseText:snapshot.text,etag:result.etag});return true;}
}
export function editorSnapshot(state){if(!state.bufferOwner||!state.selected?.editable)return null;return{pack:state.pack,path:state.selected.path,owner:state.bufferOwner,text:state.text,baseText:state.baseText,etag:state.etag,history:state.history,schema:state.schema,editable:!state.selected.readOnly&&!category(state.selected.path).excluded};}
export function validateEdit(record,{allowCreate=false}={}){
  try{packId(record.pack);jsonPath(record.path);if(!record.editable||category(record.path).excluded)throw new Error('This resource is read-only.');if(!record.etag)throw new Error('A saved resource version is required.');if(record.etag==='*'&&!allowCreate)throw new Error('Open this resource and Save to review recreation before Save All.');if(new TextEncoder().encode(record.text).byteLength>JSON_LIMIT)throw new Error('Configuration exceeds 8 MiB.');const document=new JsonDocument(record.text),issues=[...document.issues];if(document.root.type!=='object')issues.push({message:'Iris resources must be JSON objects.'});if(record.schema!==null&&record.schema!==undefined)issues.push(...validateSchema(document,record.schema));return issues.filter(issue=>issue.severity!=='warning');}
  catch(error){return[{message:error.message}];}
}
// Serialize same-resource draft writes, including save/discard cleanup after older writes.
export class DraftQueue{
  constructor(write){this.write=write;this.pending=new Map();}
  put(key,value){const captured=value?{...value}:undefined,prior=this.pending.get(key)??Promise.resolve(),next=prior.catch(()=>{}).then(()=>this.write('drafts',key,captured));this.pending.set(key,next);next.finally(()=>{if(this.pending.get(key)===next)this.pending.delete(key);}).catch(()=>{});return next;}
}
