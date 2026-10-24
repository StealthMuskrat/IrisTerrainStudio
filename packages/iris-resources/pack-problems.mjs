import{jsonPath}from'../shared/paths.mjs';
import{category}from'./catalog.mjs';
import{JsonDocument}from'../iris-config/document.mjs';
import{validateSchema}from'../iris-config/schema.mjs';
export const PROBLEM_LIMITS=Object.freeze({files:2048,fileBytes:1024*1024,textBytes:16*1024*1024,issues:2048,metadataUnits:1024*1024,schemaBytes:256*1024,schemaTotalBytes:2*1024*1024,schemaCategories:64,nodes:16384,schemaNodes:8192});
// Called in a disposable worker in the application, including schema regular expressions.
export function checkJsonSource(text,schemaText=null){
  const result={issues:[],jsonChecked:false,schema:schemaText===null||schemaText===undefined?'none':'not-checked',complete:true};let document;
  const issue=(message,kind,pointer='',offset)=>{const node=document?.nodes.get(pointer),start=offset??node?.start??0,end=offset===undefined&&node?node.end:Math.min(text.length,start+1);return{message:String(message).slice(0,512),kind,severity:'error',pointer:String(pointer).slice(0,1024),pointerClipped:String(pointer).length>1024,start,end};};
  if(typeof text!=='string'||text.length*2>PROBLEM_LIMITS.fileBytes)throw new Error('Source exceeds the per-file counted UTF-16 budget (1 MiB).');
  try{document=new JsonDocument(text,{maxNodes:PROBLEM_LIMITS.nodes});result.jsonChecked=true;for(const row of document.issues.slice(0,200))result.issues.push(issue(row.message,'json',row.pointer,row.offset));if(document.issues.length>200)result.complete=false;if(document.root.type!=='object')result.issues.push(issue('Iris resources must be JSON objects.','json'));}
  catch(error){result.complete=!/budget|nesting exceeds/.test(error.message);result.issues.push(issue(error.message,'json','',error.offset));return result;}
  if(schemaText!==null&&schemaText!==undefined){
    result.schema='not-checked';try{
      if(typeof schemaText!=='string'||schemaText.length*2>PROBLEM_LIMITS.schemaBytes)throw new Error('Attached schema exceeds 256 KiB of counted UTF-16 text.');
      const parsed=new JsonDocument(schemaText,{maxNodes:PROBLEM_LIMITS.schemaNodes});if(parsed.issues.length||!['object','boolean'].includes(parsed.root.type))throw new Error('Attached schema must be an object or boolean without duplicate properties.');
      // A duplicate source has ambiguous pointers; syntax findings must be repaired first.
      if(document.issues.length){result.schema='blocked-by-json';return result;}
      const found=validateSchema(document,parsed.value);result.schema='checked';for(const row of found)result.issues.push(issue(row.message,'schema',row.pointer,row.offset));if(found.length>=200||found.some(row=>/budget|Invalid schema|schema reference|references must|regular expression/.test(row.message)))result.complete=false;
    }catch(error){result.complete=false;result.issues.push(issue(error.message,'schema-setup'));}
  }
  if(result.issues.length>200){result.issues=result.issues.slice(0,200);result.complete=false;}return result;
}
export async function capturePackProblems(rows,read,checkSource,{filter='',current=()=>true,onProgress=()=>{},limits:input={}}={}){
  if(typeof filter!=='string'||filter.length>256)throw new Error('Use at most 256 characters in the source path filter.');const limits={...PROBLEM_LIMITS,...input};for(const[key,value]of Object.entries(limits))if(!(key in PROBLEM_LIMITS)||!Number.isSafeInteger(value)||value<1||value>PROBLEM_LIMITS[key])throw new Error('Invalid pack problem capture budget.');
  const result={files:[],issues:[],diagnostics:[],complete:true,stats:{filesRead:0,jsonChecked:0,schemaChecked:0,noSchema:0,schemaSkipped:0,textBytes:0,metadataUnits:0}},seen=new Set();
  const warn=(path,message)=>{result.complete=false;if(result.diagnostics.length<32)result.diagnostics.push({path:String(path).slice(0,1024),message:String(message).slice(0,512)});},guard=()=>{if(!current())throw new DOMException('Pack check cancelled or its inputs changed.','AbortError');};
  for(const row of rows){
    guard();if(typeof row.path!=='string'||!row.path.toLowerCase().endsWith('.json')||!row.path.toLowerCase().includes(filter.toLowerCase())||seen.has(row.path))continue;
    try{jsonPath(row.path);}catch(error){warn(row.path,error.message);continue;}
    if(category(row.path).excluded)continue;
    if(seen.size===limits.files){warn(row.path,'JSON resource count limit reached; later sources were omitted.');break;}seen.add(row.path);
    if(row.readOnly){warn(row.path,'Read-only or symbolic resource omitted.');continue;}
    if(result.issues.length===limits.issues||result.stats.metadataUnits>=limits.metadataUnits){warn(row.path,'Finding/metadata budget reached; later resources were omitted.');break;}
    if(Number.isFinite(row.size)&&row.size>limits.fileBytes){warn(row.path,'Saved source exceeds the per-file admission budget.');continue;}
    let source;try{result.stats.filesRead++;source=await read(row.path);}catch(error){guard();warn(row.path,error.message);continue;}guard();
    if(typeof source?.text!=='string'){warn(row.path,'Source text is unavailable.');continue;}const bytes=source.text.length*2;if(bytes>limits.fileBytes){warn(row.path,'Source exceeds 1 MiB of counted UTF-16 text.');continue;}if(result.stats.textBytes+bytes>limits.textBytes){warn(row.path,'Cumulative source payload limit reached; later resources were omitted.');break;}result.stats.textBytes+=bytes;
    let checked;try{checked=await checkSource(source.text,source.schemaText??null);}catch(error){guard();warn(row.path,error.message);continue;}guard();
    if(source.schemaError){checked.schema='not-checked';checked.complete=false;checked.issues.push({message:source.schemaError.slice(0,512),kind:'schema-setup',severity:'error',pointer:'',pointerClipped:false,start:0,end:Math.min(1,source.text.length)});}
    const file={path:row.path,etag:source.etag??null,owner:source.owner??null,schemaSource:source.schemaSource??null,jsonChecked:checked.jsonChecked,schema:checked.schema,complete:checked.complete};
    const fileCost=file.path.length+(file.etag?.length??0)+(file.schemaSource?.length??0)+128;if(result.stats.metadataUnits+fileCost>limits.metadataUnits){warn(row.path,'Metadata budget reached; later resources were omitted.');break;}result.stats.metadataUnits+=fileCost;result.files.push(file);result.stats.jsonChecked+=Number(checked.jsonChecked);if(checked.schema==='checked')result.stats.schemaChecked++;else if(checked.schema==='none')result.stats.noSchema++;else result.stats.schemaSkipped++;
    if(!checked.complete)warn(row.path,'Source/schema evaluation was incomplete or reached a limit.');
    for(const issue of checked.issues){const cost=issue.message.length+issue.pointer.length+row.path.length+128;if(result.issues.length===limits.issues||result.stats.metadataUnits+cost>limits.metadataUnits){file.complete=false;warn(row.path,'Finding/metadata budget reached; later findings were omitted.');break;}result.stats.metadataUnits+=cost;result.issues.push({...issue,path:file.path,etag:file.etag,owner:file.owner});}
    onProgress({...result.stats,issues:result.issues.length});
  }
  guard();return result;
}
export function problemReport(result,{pack,scope,filter}){
  const portable=({owner,...row})=>({...row,openText:!!owner});return JSON.stringify({format:'iris-terrain-studio-problems',version:1,pack,scope,filter,complete:result.complete,coverage:'JSON syntax/root/duplicates and the existing local schema-validator subset only. Missing attached schemas are counted. This report does not establish native references, engine compatibility, whole-pack validity or release parity.',limits:PROBLEM_LIMITS,stats:result.stats,diagnostics:result.diagnostics,files:result.files.map(portable),issues:result.issues.map(portable)},null,2)+'\n';
}
