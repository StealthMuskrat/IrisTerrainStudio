import { identifier } from './pack.mjs';
import { ASSET_LIMITS, BUNDLE_MANIFEST, assetCurrent, assetJson } from './bundle.mjs';
import { resourcePath, isPlainObject } from '../shared/paths.mjs';

const air=new Set(['minecraft:air','minecraft:cave_air','minecraft:void_air']);
const notice=/(?:^|\/)(?:(?:licen[cs]es?|legal|notices?)\/|(?:licen[cs]e|copying|notice|credits|copyright|authors|readme)(?:[._-][^/]*)?$)/i;
const MAX_REFERENCES=32768;
function idPath(name,kind,extension){const id=identifier(name);return resourcePath(`assets/${id.namespace}/${kind}/${id.path}${extension}`);}
function object(value,label){if(!isPlainObject(value))throw new Error(`Invalid ${label}.`);return value;}

// Roots are palette type IDs, not combinations from a registry. Every candidate in a retained
// blockstate is followed so its unmodified definition cannot acquire dangling alternative models.
export async function inspectRenderingDependencies(stack,blockTypes,{isCurrent=()=>true}={}){
  stack.requireOpen();assetCurrent(isCurrent);
  if(!Array.isArray(blockTypes)||blockTypes.length>65536)throw new Error('Expected a bounded stored voxel palette.');
  const roots=[...new Set(blockTypes.map(value=>identifier(typeof value==='string'?value:value.id).id))].filter(id=>!air.has(id)).sort();
  if(roots.length>ASSET_LIMITS.roots)throw new Error('Dependency inspection is limited to 4096 distinct block types.');
  if(stack.packs.length>128)throw new Error('Dependency inspection is limited to 128 resource packs.');
  const files=new Map(),records=new Map(),models=new Map(),chains=new Map(),textures=new Set(),blocks=[],errors=[],warnings=[],sourceIndices=new Map(stack.packs.map((pack,index)=>[pack,index]));
  const sources=stack.packs.map((pack,index)=>({index,name:pack.name,archiveSha256:pack.digest,kind:pack.metadata.studioRenderingBundle?'studio-bundle':'minecraft-resource-pack',pack:pack.metadata.pack??null,target:pack.target}));
  let bytes=0,references=0;
  function guard(){stack.requireOpen();assetCurrent(isCurrent);if(++references>MAX_REFERENCES)throw new Error('Rendering dependencies exceed the 32768-reference budget.');}
  function add(path,pack,sourcePath=path,kind='asset'){
    resourcePath(path);if(files.has(path))return;
    const input=pack.entries.get(sourcePath);if(!input)throw new Error(`Missing required asset: ${sourcePath}`);
    if(files.size>=ASSET_LIMITS.files||bytes+input.length>ASSET_LIMITS.bytes)throw new Error('Rendering dependencies exceed the 8192-file / 64 MiB budget.');
    files.set(path,input.slice());bytes+=input.length;records.set(path,{path,source:sourceIndices.get(pack),sourcePath,kind,bytes:input.length});
  }
  function required(path){guard();const source=stack.resolve(path);if(!source)throw new Error(`Missing required asset: ${path}`);add(path,source.pack,source.sourcePath);return files.get(path);}
  function json(path){return assetJson(required(path),path);}
  function texture(name){
    guard();const path=idPath(name,'textures','.png');if(textures.has(path))return;textures.add(path);required(path);
    const metadata=stack.metadataSource(path);if(metadata){add(path+'.mcmeta',metadata.pack,metadata.sourcePath);assetJson(files.get(path+'.mcmeta'),path+'.mcmeta');}
  }
  function recordError(context,error){if(error.name==='AbortError')throw error;if(errors.length<128)errors.push({context,message:error.message});else throw new Error('Dependency inspection stopped after 128 errors.');}
  function directTexture(value,context){if(typeof value!=='string')throw new Error(`Invalid texture reference in ${context}.`);if(!value.startsWith('#'))texture(value);}
  function model(name,ancestors=[]){
    guard();const id=identifier(name).id;
    if(ancestors.includes(id)||ancestors.length>=32)throw new Error(`Model parent cycle or depth limit: ${[...ancestors,id].join(' → ')}`);
    if(models.has(id))return models.get(id);
    const raw=json(idPath(id,'models','.json'));
    if(Object.hasOwn(raw,'loader')||Object.hasOwn(raw,'overrides'))throw new Error(`Model ${id} requires an unsupported custom loader or override adapter.`);
    let parent={};
    if(raw.parent!==undefined){if(typeof raw.parent!=='string'||raw.parent.startsWith('builtin/')||raw.parent.startsWith('minecraft:builtin/'))throw new Error(`Model ${id} requires an unsupported built-in model adapter.`);parent=model(raw.parent,[...ancestors,id]);}
    if(raw.textures!==undefined){object(raw.textures,`textures in ${id}`);for(const value of Object.values(raw.textures))directTexture(value,id);}
    if(raw.elements!==undefined&&!Array.isArray(raw.elements))throw new Error(`Invalid elements in ${id}.`);
    for(const element of raw.elements??[]){object(element,`element in ${id}`);for(const face of Object.values(object(element.faces??{},`faces in ${id}`))){object(face,`face in ${id}`);directTexture(face.texture,id);}}
    // Parent variables can be supplied by children. Resolve aliases only in the complete root model.
    const merged={...parent,...raw,id,textures:{...parent.textures,...raw.textures},elements:raw.elements??parent.elements??[]};models.set(id,merged);chains.set(id,[id,...(parent.id?chains.get(parent.id):[])]);return merged;
  }
  function application(value,context,block){
    guard();const candidates=Array.isArray(value)?value:[value];if(!candidates.length)throw new Error(`Empty model application in ${context}.`);
    for(const entry of candidates){
      guard();object(entry,`model application in ${context}`);if(typeof entry.model!=='string')throw new Error(`Missing model reference in ${context}.`);
      try{
        const resolved=model(entry.model);
        const used=new Set();const use=reference=>{const name=stack.texture(resolved,reference);texture(name);used.add(name);};
        for(const key of Object.keys(resolved.textures))use('#'+key);
        for(const element of resolved.elements){object(element,`element in ${resolved.id}`);for(const face of Object.values(object(element.faces??{},`faces in ${resolved.id}`))){object(face,`face in ${resolved.id}`);use(face.texture);}}
        block.candidates.push({model:resolved.id,parents:chains.get(resolved.id).slice(1),textures:[...used].sort()});
      }catch(error){recordError(entry.model,error);}
    }
  }
  warnings.push('Target 26.3 / format 97.1 overlay/filter resolution is applied. Complete model semantics and client rendering parity remain unqualified. All model candidates are retained without weighted selection.');
  if(!errors.length)for(let index=0;index<roots.length;index++){
    const root=roots[index],block={id:root,candidates:[]};blocks.push(block);try{
      const definition=json(idPath(root,'blockstates','.json'));let count=0;
      if(definition.variants!==undefined)for(const value of Object.values(object(definition.variants,`variants in ${root}`))){application(value,root,block);count++;}
      if(definition.multipart!==undefined){if(!Array.isArray(definition.multipart))throw new Error(`Invalid multipart in ${root}.`);for(const part of definition.multipart){application(object(part,`multipart in ${root}`).apply,root,block);count++;}}
      if(!count)throw new Error(`No model applications in blockstate ${root}.`);
    }catch(error){recordError(root,error);}
    // Yield to input/cancellation between small groups of block types, without scanning any cells.
    if(index%32===31){await new Promise(resolve=>setTimeout(resolve,0));assetCurrent(isCurrent);}
  }
  // Retain metadata and notices from every source, including packs contributing only overrides.
  for(const [index,pack]of stack.packs.entries()){
    try{for(const path of pack.entries.keys()){guard();if(path==='pack.mcmeta'||path===BUNDLE_MANIFEST||notice.test(path))add(`sources/${index}/${path}`,pack,path,path==='pack.mcmeta'||path===BUNDLE_MANIFEST?'source-metadata':'notice');}}
    catch(error){recordError(pack.name,error);}
  }
  assetCurrent(isCurrent);
  return{files,report:{format:'iris-terrain-studio-dependency-report',version:1,roots,blocks,sources,files:[...records.values()].sort((a,b)=>a.path.localeCompare(b.path)),target:{minecraftVersion:'26.3',resourceFormat:[97,1],resolved:true},counts:{blockTypes:roots.length,models:models.size,textures:textures.size,files:files.size,bytes},errors,warnings,complete:false}};
}
