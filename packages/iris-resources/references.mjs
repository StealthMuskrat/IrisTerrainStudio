import{JsonDocument}from'../iris-config/document.mjs';
import{resourcePath}from'../shared/paths.mjs';
import{resourceId}from'./catalog.mjs';
export const REFERENCE_LIMITS=Object.freeze({targets:8192,files:2048,fileBytes:1024*1024,textBytes:16*1024*1024,nodesPerFile:32768,nodes:131072,strings:65536,links:32768,metadataUnits:4*1024*1024,aliasUnits:4*1024*1024,targetsPerMatch:64});
function budgets(input){const limits={...REFERENCE_LIMITS,...input};for(const [key,value]of Object.entries(limits))if(!(key in REFERENCE_LIMITS)||!Number.isSafeInteger(value)||value<1||value>REFERENCE_LIMITS[key])throw new Error('Invalid reference capture budget.');return limits;}
// String equality is evidence of a possible reference, never proof of field semantics.
export class ReferenceIndex{
  constructor(rows,{limits}={}){
    this.limits=budgets(limits);this.paths=new Set();this.aliases=new Map();this.matches=[];this.sources=new Map();this.incoming=new Map();this.outgoing=new Map();this.diagnostics=[];this.complete=true;this.stats={filesRead:0,filesIndexed:0,nodes:0,strings:0,links:0,textBytes:0,metadataUnits:0,aliasUnits:0,diagnostics:0};
    for(const row of rows){let path;try{path=resourcePath(row.path);}catch{this.warn(String(row.path).slice(0,1024),'Invalid resource path omitted.');continue;}if(this.paths.has(path))continue;
      const aliases=new Set([resourceId(path),resourceId(path).split('/').at(-1),path,path.replace(/\.(json|png|iob)$/i,''),path.split('/').at(-1),path.replace(/^[^/]+\//,'')]),units=[...aliases].reduce((sum,value)=>sum+value.length,0);
      if(this.paths.size>=this.limits.targets||this.stats.aliasUnits+units>this.limits.aliasUnits){this.warn(path,'Target alias budget reached; later targets were omitted.');break;}
      this.paths.add(path);this.stats.aliasUnits+=units;for(const alias of aliases){const targets=this.aliases.get(alias)??[];targets.push(path);this.aliases.set(alias,targets);}
    }
  }
  warn(path,message){this.complete=false;this.stats.diagnostics++;if(this.diagnostics.length<64)this.diagnostics.push({path,message});}
  add(path,text,{etag=null,owner=null}={}){
    const available=Math.min(this.limits.nodesPerFile,this.limits.nodes-this.stats.nodes);if(available<1)throw new Error('JSON node inspection budget reached.');let document;try{document=new JsonDocument(text,{maxNodes:available});this.stats.nodes+=document.nodeCount;}catch(error){this.stats.nodes+=Math.min(available,error.nodeCount??available);throw error;}if(document.issues.length)throw new Error('Duplicate properties make this source ambiguous.');
    const staged=[];let links=0,units=0;for(const node of document.nodes.values()){
      if(node.type!=='string')continue;if(this.stats.strings>=this.limits.strings)throw new Error('String inspection budget reached.');this.stats.strings++;const candidates=this.aliases.get(node.value);if(!candidates?.length)continue;
      const targets=candidates.slice(0,this.limits.targetsPerMatch);if(targets.length!==candidates.length)this.warn(path,'A string has more candidate targets than the per-match limit.');
      links+=targets.length;units+=path.length+node.pointer.length+node.value.length+targets.reduce((sum,target)=>sum+target.length,0);
      if(this.stats.links+links>this.limits.links||this.stats.metadataUnits+units>this.limits.metadataUnits)throw new Error('Reference metadata budget reached.');
      staged.push({path,pointer:node.pointer,value:node.value,targets,candidateCount:candidates.length,etag,owner});
    }
    this.sources.set(path,{etag,owner});this.stats.filesIndexed++;this.stats.links+=links;this.stats.metadataUnits+=units;
    for(const row of staged){this.matches.push(row);const source=this.outgoing.get(path)??[];source.push(row);this.outgoing.set(path,source);for(const target of row.targets){const incoming=this.incoming.get(target)??[];incoming.push(row);this.incoming.set(target,incoming);}}
  }
  rows(path,direction='outgoing'){if(!['incoming','outgoing'].includes(direction))throw new Error('Choose incoming or outgoing matches.');return(direction==='incoming'?this.incoming.get(path)?.filter(row=>row.path!==path):this.outgoing.get(path))??[];}
  page(path,{direction='outgoing',query='',page=0}={}){
    if(typeof query!=='string'||query.length>256||!Number.isSafeInteger(page)||page<0)throw new Error('Invalid reference search or page.');const needle=query.trim().toLowerCase(),rows=this.rows(path,direction).filter(row=>!needle||[row.path,row.pointer,row.value,...row.targets].some(value=>value.toLowerCase().includes(needle))),pages=Math.max(1,Math.ceil(rows.length/32));page=Math.min(page,pages-1);return{rows:rows.slice(page*32,page*32+32),total:rows.length,page,pages};
  }
}
export async function captureReferences(rows,read,{current=()=>true,onProgress=()=>{},limits}={}){
  const alive=()=>{if(!current())throw new DOMException('Reference inputs changed. Reopen the inspection.','AbortError');},index=new ReferenceIndex(rows,{limits}),sources=[...new Map(rows.filter(row=>/\.json$/i.test(row.path)).map(row=>[row.path,row])).values()].sort((a,b)=>a.path.localeCompare(b.path));let attempted=0;
  for(const row of sources){alive();if(attempted++>=index.limits.files||index.stats.textBytes>=index.limits.textBytes||index.stats.nodes>=index.limits.nodes||index.stats.strings>=index.limits.strings||index.stats.links>=index.limits.links){index.warn(row.path,'Capture budget reached; remaining JSON sources were not inspected.');break;}
    if(row.readOnly){index.warn(row.path,'Read-only link/source omitted.');continue;}if(row.size>index.limits.fileBytes){index.warn(row.path,'JSON source exceeds the reference inspector file budget.');continue;}
    try{const path=resourcePath(row.path),result=await read(path);alive();index.stats.filesRead++;if(typeof result.text!=='string')throw new Error('JSON source text is unavailable.');if(result.text.length>index.limits.fileBytes)throw new Error('JSON source exceeds the reference inspector file budget.');const bytes=new TextEncoder().encode(result.text).byteLength,cost=result.text.length*2;
      if(bytes>index.limits.fileBytes)throw new Error('JSON source exceeds the reference inspector file budget.');if(index.stats.textBytes+cost>index.limits.textBytes){index.warn(path,'Capture text budget reached; remaining sources were not inspected.');break;}
      index.stats.textBytes+=cost;index.add(path,result.text,{etag:result.etag,owner:result.owner});
    }catch(error){alive();index.warn(row.path,error.message||String(error));}
    onProgress({done:attempted,total:sources.length,indexed:index.stats.filesIndexed});
  }
  alive();return index;
}
