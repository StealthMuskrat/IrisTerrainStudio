import {JsonDocument} from '../iris-config/document.mjs';
import {resourcePath} from '../shared/paths.mjs';

/** Resolve only the snippet-bearing fields of the four native reader types. */
export async function nativePackInputs(kind,text,read,{current=()=>true,inventory=null}={}){
  const resources=new Map(),loading=new Set();let bytes=0,nodes=0;
  const alive=()=>{if(!current())throw new DOMException('Preview input changed.','AbortError');};
  const parse=source=>{const document=new JsonDocument(source);if(document.issues.length)throw new Error('Correct duplicate JSON properties before previewing.');return document.value;};
  async function visit(type,value,depth=0){
    alive();if(++nodes>4096||depth>100)throw new Error('Native configuration graph exceeds the preview budget.');
    if(typeof value==='string'&&['style','generator'].includes(type)){
      if(!value.startsWith('snippet/'))return;
      const prefix='snippet/'+type+'/',name=resourcePath((value.startsWith(prefix)?value:prefix+value.slice(8))+'.json');
      if(loading.has(name))throw new Error('Snippet reference cycle: '+[...loading,name].join(' → '));
      if(resources.has(name))return;
      if(resources.size>=512)throw new Error('Preview depends on more than 512 snippets.');
      loading.add(name);try{
        const result=await read(name);alive();bytes+=result.text.length*2;if(result.text.length>4*1024*1024||bytes>32*1024*1024)throw new Error('Native snippet inputs exceed the preview memory budget.');
        const object=parse(result.text);if(!object||typeof object!=='object'||Array.isArray(object))throw new Error('Snippet must contain a native configuration object: '+name);
        await visit(type,object,depth+1);resources.set(name,result.text);
      }finally{loading.delete(name);}return;
    }
    if(!value||typeof value!=='object'||Array.isArray(value))return;
    if(type==='style'){if(value.fracture!==undefined)await visit('style',value.fracture,depth+1);}
    else if(type==='generator'){
      if(value.style!==undefined)await visit('style',value.style,depth+1);
      if(Array.isArray(value.fracture))for(const child of value.fracture)await visit('generator',child,depth+1);
    }else if(type==='resource'){
      if(Array.isArray(value.composite))for(const child of value.composite)await visit('generator',child,depth+1);
      if(value.cliffHeightGenerator!==undefined)await visit('generator',value.cliffHeightGenerator,depth+1);
    }
  }
  async function metadataVisit(descriptor,value,depth=0){
    alive();if(++nodes>4096||depth>100)throw new Error('Native configuration graph exceeds the preview budget.');
    const definition=descriptor.definition?inventory.definitions[descriptor.definition]:null;
    if(typeof value==='string'&&definition?.snippet){
      if(!value.startsWith('snippet/'))return;
      const prefix='snippet/'+definition.snippet+'/',name=resourcePath((value.startsWith(prefix)?value:prefix+value.slice(8))+'.json');
      if(loading.has(name))throw new Error('Snippet reference cycle: '+[...loading,name].join(' → '));if(resources.has(name))return;
      if(resources.size>=512)throw new Error('Preview depends on more than 512 snippets.');loading.add(name);
      try{const result=await read(name);alive();bytes+=result.text.length*2;if(result.text.length>4*1024*1024||bytes>32*1024*1024)throw new Error('Native snippet inputs exceed the preview memory budget.');const object=parse(result.text);if(!object||typeof object!=='object'||Array.isArray(object))throw new Error('Snippet must contain a native object: '+name);await metadataVisit(descriptor,object,depth+1);resources.set(name,result.text);}finally{loading.delete(name);}return;
    }
    if(descriptor.kind==='array'&&Array.isArray(value)){for(const child of value)await metadataVisit(descriptor.items||{},child,depth+1);return;}
    if(descriptor.kind==='map'&&value&&typeof value==='object'&&!Array.isArray(value)){for(const child of Object.values(value))await metadataVisit(descriptor.values||{},child,depth+1);return;}
    if(definition&&value&&typeof value==='object'&&!Array.isArray(value))for(const[key,child]of Object.entries(value)){const property=definition.properties[key];if(property)await metadataVisit(property,child,depth+1);}
  }
  const root=inventory?.roots[{generator:'generators',style:'style',dimension:'dimensions'}[kind]];
  if(root)await metadataVisit({definition:root},parse(text));
  else if(kind==='dimension')throw new Error('Dimension inputs require the pinned native field inventory. Rebuild the local engine.');
  else await visit(kind==='generator'?'resource':'style',parse(text));alive();
  return [...resources].map(([path,text])=>({path,text}));
}

/** Routing only: inspect decoded property names; the original JSON text remains the native input. */
export function referencesNativeImageMap(text){let found=false;JSON.parse(text,(key,value)=>{if(key==='imageMap'&&typeof value==='string'&&value.length)found=true;return value;});return found;}
