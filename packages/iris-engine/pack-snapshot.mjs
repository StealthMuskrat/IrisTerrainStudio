import {JsonDocument} from '../iris-config/document.mjs';
import {resourcePath} from '../shared/paths.mjs';

const folders=new Set(['dimensions','regions','biomes','generators','blocks','expressions','imagemaps','snippet']);
/** Capture raw authoring JSON; numbers are never round-tripped through JS Number. */
export async function captureNativePack(rows,read,{current=()=>true,override=null,onProgress=()=>{}}={}){
  const alive=()=>{if(!current())throw new DOMException('Pack inputs changed.','AbortError');};
  const paths=rows.map(row=>resourcePath(row.path)).filter(path=>path.endsWith('.json')&&folders.has(path.split('/')[0])).sort();
  if(new Set(paths).size!==paths.length||paths.length>4096)throw new Error('Native pack resource count is invalid or exceeds 4,096 JSON resources.');
  const resources=[];let bytes=0;
  for(const path of paths){
    alive();const result=override?.path===path?override:await read(path);alive();const text=result.text;
    if(typeof text!=='string'||text.length>4*1024*1024||(bytes+=text.length*2)>64*1024*1024)throw new Error('Native pack snapshot exceeds its text or memory budget.');
    const document=new JsonDocument(text);if(document.issues.length)throw new Error(`Correct duplicate JSON properties in ${path} before loading the native pack.`);
    resources.push({path,text});onProgress(resources.length/paths.length);
  }
  alive();return {resources,bytes};
}
