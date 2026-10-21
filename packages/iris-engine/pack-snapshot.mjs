import {JsonDocument} from '../iris-config/document.mjs';
import {resourcePath} from '../shared/paths.mjs';

const folders=new Set(['dimensions','regions','biomes','generators','blocks','expressions','imagemaps','snippet']);
/** Capture native JSON and object bytes without round-tripping JSON numbers. */
export async function captureNativePack(rows,read,{readBinary,current=()=>true,override=null,onProgress=()=>{}}={}){
  const alive=()=>{if(!current())throw new DOMException('Pack inputs changed.','AbortError');};
  const paths=rows.map(row=>resourcePath(row.path)).filter(path=>(path.endsWith('.json')&&folders.has(path.split('/')[0]))||(path.startsWith('objects/')&&path.endsWith('.iob'))).sort();
  if(new Set(paths).size!==paths.length||paths.length>4096)throw new Error('Native pack resource count is invalid or exceeds 4,096 resources.');
  const resources=[];let bytes=0;
  for(const path of paths){
    alive();
    if(path.endsWith('.iob')){
      if(!readBinary)throw new Error('Native object resources require a binary reader.');
      const result=await readBinary(path);alive();const data=result.bytes;
      if(!(data instanceof Uint8Array)||data.byteLength>8*1024*1024||(bytes+=data.byteLength)>64*1024*1024)throw new Error('Native object exceeds its 8 MiB file or 64 MiB snapshot budget.');
      resources.push({path,bytes:data.slice()});
    }else{
      const result=override?.path===path?override:await read(path);alive();const text=result.text;
      if(typeof text!=='string'||text.length>4*1024*1024||(bytes+=text.length*2)>64*1024*1024)throw new Error('Native pack snapshot exceeds its text or memory budget.');
      const document=new JsonDocument(text);if(document.issues.length)throw new Error(`Correct duplicate JSON properties in ${path} before loading the native pack.`);
      resources.push({path,text});
    }
    onProgress(resources.length/paths.length);
  }
  alive();return {resources,bytes};
}
