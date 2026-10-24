import{jsonPath,JSON_LIMIT}from'../shared/paths.mjs';
import{JsonDocument}from'../iris-config/document.mjs';
import{validateSchema}from'../iris-config/schema.mjs';
export const SEARCH_LIMITS=Object.freeze({files:2048,fileBytes:1024*1024,textBytes:16*1024*1024,matches:32768,metadataUnits:4*1024*1024});
export function literalPattern(query,{caseSensitive=true}={}){
  if(typeof query!=='string'||!query.length||query.length>1024)throw new Error('Enter 1–1,024 characters of literal source text.');
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),caseSensitive?'gu':'giu');
}
// Matches are non-overlapping source spans. Escaped JSON text is searched as written.
export function findLiteral(text,query,{caseSensitive=true,limit=4096,metadataUnits=4*1024*1024}={}){
  if(typeof text!=='string'||!Number.isSafeInteger(limit)||limit<1||limit>32768||!Number.isSafeInteger(metadataUnits)||metadataUnits<1||metadataUnits>SEARCH_LIMITS.metadataUnits)throw new Error('Invalid source search limits.');
  if(text.length>JSON_LIMIT)throw new Error('Source exceeds the current-buffer search limit (8,388,608 UTF-16 units).');
  const pattern=literalPattern(query,{caseSensitive}),matches=[];let cursor=0,line=1,column=1,units=0,complete=true;
  for(let hit;(hit=pattern.exec(text));){
    if(matches.length===limit){complete=false;break;}
    const start=hit.index,end=start+hit[0].length,from=Math.max(0,start-48),excerpt=text.slice(from,Math.min(text.length,end+80,from+200)),cost=hit[0].length+excerpt.length+64;
    if(units+cost>metadataUnits){complete=false;break;}
    for(;cursor<start;cursor++){if(text.charCodeAt(cursor)===10){line++;column=1;}else column++;}
    matches.push({start,end,value:hit[0],line,column,excerpt,excerptStart:from});units+=cost;
  }
  return{matches,complete,metadataUnits:units};
}
export async function captureTextSearch(rows,read,query,{caseSensitive=true,filter='',current=()=>true,onProgress=()=>{},limits:input={}}={}){
  literalPattern(query,{caseSensitive});if(typeof filter!=='string'||filter.length>256)throw new Error('Resource path filter is too long.');
  const limits={...SEARCH_LIMITS,...input};for(const [key,value]of Object.entries(limits))if(!(key in SEARCH_LIMITS)||!Number.isSafeInteger(value)||value<1||value>SEARCH_LIMITS[key])throw new Error('Invalid source capture budget.');
  const result={matches:[],diagnostics:[],complete:true,stats:{filesRead:0,filesSearched:0,textBytes:0,metadataUnits:0}},seen=new Set(),warn=(path,message)=>{result.complete=false;if(result.diagnostics.length<32)result.diagnostics.push({path,message:String(message).slice(0,1024)});},check=()=>{if(!current())throw new DOMException('Source search was cancelled or its inputs changed.','AbortError');};
  for(const row of rows){
    check();if(!/\.json$/i.test(row.path)||!row.path.toLowerCase().includes(filter.toLowerCase())||seen.has(row.path))continue;
    try{jsonPath(row.path);}catch(error){warn(String(row.path).slice(0,1024),error.message);continue;}
    if(seen.size===limits.files){warn(row.path,'JSON source count limit reached; later resources were omitted.');break;}seen.add(row.path);
    if(row.readOnly){warn(row.path,'Unreadable/symbolic resource omitted.');continue;}
    // Saved sizes are only an early admission hint; actual open text is checked after reading.
    if(Number.isFinite(row.size)&&row.size>limits.fileBytes){warn(row.path,'Source exceeds the per-file search budget.');continue;}
    if(result.matches.length===limits.matches||result.stats.metadataUnits>=limits.metadataUnits){warn(row.path,'Match/metadata limit reached; later resources were omitted.');break;}
    let source;try{result.stats.filesRead++;source=await read(row.path);}catch(error){check();warn(row.path,error.message);continue;}check();
    if(typeof source?.text!=='string'){warn(row.path,'Source text is unavailable.');continue;}
    const bytes=source.text.length*2;if(bytes>limits.fileBytes){warn(row.path,'Source exceeds the per-file UTF-16 payload budget.');continue;}
    if(result.stats.textBytes+bytes>limits.textBytes){warn(row.path,'Cumulative source payload limit reached; later resources were omitted.');break;}result.stats.textBytes+=bytes;
    const found=findLiteral(source.text,query,{caseSensitive,limit:limits.matches-result.matches.length,metadataUnits:limits.metadataUnits-result.stats.metadataUnits});
    result.stats.filesSearched++;result.stats.metadataUnits+=found.metadataUnits;
    for(const match of found.matches)result.matches.push({...match,path:row.path,etag:source.etag??null,owner:source.owner??null});
    if(!found.complete){warn(row.path,'Match/metadata limit reached; remaining text and resources were omitted.');break;}onProgress({...result.stats,matches:result.matches.length});
  }
  check();return result;
}
export function replaceSourceMatches(text,matches,replacement,{schema}={}){
  if(typeof text!=='string'||typeof replacement!=='string'||replacement.length>65536||!Array.isArray(matches)||!matches.length||matches.length>4096)throw new Error('Choose 1–4,096 matches and at most 65,536 replacement characters.');
  const ordered=matches.slice().sort((a,b)=>a.start-b.start);let cursor=0,length=text.length;
  for(const match of ordered){if(!Number.isSafeInteger(match.start)||!Number.isSafeInteger(match.end)||match.start<cursor||match.end<=match.start||match.end>text.length||text.slice(match.start,match.end)!==match.value)throw new Error('The selected source spans changed or overlap. Search again.');cursor=match.end;length+=replacement.length-(match.end-match.start);}
  if(length>JSON_LIMIT)throw new Error('Replacement exceeds the 8 MiB JSON limit.');
  const parts=[];cursor=0;for(const match of ordered){parts.push(text.slice(cursor,match.start),replacement);cursor=match.end;}parts.push(text.slice(cursor));const updated=parts.join(''),bytes=new TextEncoder().encode(updated).byteLength;
  if(bytes>JSON_LIMIT)throw new Error('Replacement exceeds the 8 MiB JSON limit.');
  const document=new JsonDocument(updated,{maxNodes:32768});if(document.root.type!=='object'||document.issues.length)throw new Error('Replacement must produce a JSON object without duplicate properties.');
  if(schema!==undefined&&schema!==null){const errors=validateSchema(document,schema).filter(issue=>issue.severity!=='warning');if(errors.length)throw new Error('Replacement fails the attached schema: '+errors[0].message+' '+(errors[0].pointer??''));}
  return{text:updated,count:ordered.length,bytes,first:{start:ordered[0].start,end:ordered[0].start+replacement.length}};
}
