import { identifier } from './pack.mjs';
import { ASSET_LIMITS, BUNDLE_MANIFEST, assetCurrent, assetJson } from './bundle.mjs';
import { resourcePath, isPlainObject } from '../shared/paths.mjs';
import { blockRenderingInputs } from './render-inputs.mjs';
import { parseMaterial } from './material.mjs';
import { MISSING_SPRITE } from './builtin-textures.mjs';

const air=new Set(['minecraft:air','minecraft:cave_air','minecraft:void_air']);
const notice=/(?:^|\/)(?:(?:licen[cs]es?|legal|notices?)\/|(?:licen[cs]e|copying|notice|credits|copyright|authors|readme)(?:[._-][^/]*)?$)/i;
const MAX_REFERENCES=32768;
function idPath(name,kind,extension){const id=identifier(name);return resourcePath(`assets/${id.namespace}/${kind}/${id.path}${extension}`);}
function object(value,label){if(!isPlainObject(value))throw new Error(`Invalid ${label}.`);return value;}
export function blockDefinitionPaths(packs){
  const paths=new Set();for(const pack of packs)for(const sourcePath of pack.entries.keys()){
    let path=sourcePath;for(const directory of pack.overlayDirectories)if(path.startsWith(directory+'/')){path=path.slice(directory.length+1);break;}
    if(/^assets\/[^/]+\/(?:blockstates\/.+|models\/block\/.+)\.json$/.test(path))paths.add(path);
  }
  return [...paths].sort();
}

// Roots are palette type IDs, not combinations from a registry. Every candidate in a retained
// blockstate is followed so its unmodified definition cannot acquire dangling alternative models.
export async function inspectRenderingDependencies(stack,blockTypes,{isCurrent=()=>true,retainBlockDefinitions=false}={}){
  stack.requireOpen();assetCurrent(isCurrent);
  if(!Array.isArray(blockTypes)||blockTypes.length>65536)throw new Error('Expected a bounded stored voxel palette.');
  const roots=[...new Set(blockTypes.map(value=>identifier(typeof value==='string'?value:value.id).id))].filter(id=>!air.has(id)).sort();
  if(roots.length>ASSET_LIMITS.roots)throw new Error('Dependency inspection is limited to 4096 distinct block types.');
  if(stack.packs.length>128)throw new Error('Dependency inspection is limited to 128 resource packs.');
  const files=new Map(),records=new Map(),models=new Map(),chains=new Map(),textures=new Set(),blocks=[],errors=[],warnings=[],sourceIndices=new Map(stack.packs.map((pack,index)=>[pack,index]));
  const sources=stack.packs.map((pack,index)=>({index,name:pack.name,archiveSha256:pack.digest,kind:pack.metadata.studioRenderingBundle?'studio-bundle':'minecraft-resource-pack',pack:pack.metadata.pack??null,target:pack.target}));
  let bytes=0,references=0,applications=0;
  const candidates=new Map();
  function guard(count=true){stack.requireOpen();assetCurrent(isCurrent);if(count&&++references>MAX_REFERENCES)throw new Error('Rendering dependencies exceed the 32768-reference budget.');}
  function add(path,pack,sourcePath=path,kind='asset'){
    resourcePath(path);if(files.has(path))return;
    const input=pack.entries.get(sourcePath);if(!input)throw new Error(`Missing required asset: ${sourcePath}`);
    if(files.size>=ASSET_LIMITS.files||bytes+input.length>ASSET_LIMITS.bytes)throw new Error('Rendering dependencies exceed the 8192-file / 64 MiB budget.');
    files.set(path,input.slice());bytes+=input.length;records.set(path,{path,source:sourceIndices.get(pack),sourcePath,kind,bytes:input.length});
  }
  function required(path){guard(false);if(files.has(path))return files.get(path);guard();const source=stack.resolve(path);if(!source)throw new Error(`Missing required asset: ${path}`);add(path,source.pack,source.sourcePath);return files.get(path);}
  function json(path){return assetJson(required(path),path);}
  function texture(name){
    guard(false);if(identifier(name).id===MISSING_SPRITE)return;const path=idPath(name,'textures','.png');if(textures.has(path))return;required(path);
    const metadata=stack.metadataSource(path);if(metadata){add(path+'.mcmeta',metadata.pack,metadata.sourcePath);assetJson(files.get(path+'.mcmeta'),path+'.mcmeta');}
    textures.add(path);
  }
  function recordError(context,error){if(error.name==='AbortError')throw error;if(errors.length<128)errors.push({context,message:error.message});else throw new Error('Dependency inspection stopped after 128 errors.');}
  function directTexture(value,context){if(typeof value==='string'&&value.startsWith('#'))return;texture(parseMaterial(value,identifier).sprite);}
  function model(name,ancestors=[]){
    guard(false);const id=identifier(name).id;
    if(ancestors.includes(id)||ancestors.length>=32)throw new Error(`Model parent cycle or depth limit: ${[...ancestors,id].join(' → ')}`);
    if(models.has(id))return models.get(id);
    guard();
    const raw=json(idPath(id,'models','.json'));
    if(Object.hasOwn(raw,'loader')||Object.hasOwn(raw,'overrides'))throw new Error(`Model ${id} requires an unsupported custom loader or override adapter.`);
    let parent={};
    if(raw.parent!==undefined){if(typeof raw.parent!=='string'||raw.parent.startsWith('builtin/')||raw.parent.startsWith('minecraft:builtin/'))throw new Error(`Model ${id} requires an unsupported built-in model adapter.`);parent=model(raw.parent,[...ancestors,id]);}
    if(raw.textures!==undefined){object(raw.textures,`textures in ${id}`);for(const value of Object.values(raw.textures))directTexture(value,id);}
    if(raw.elements!==undefined&&!Array.isArray(raw.elements))throw new Error(`Invalid elements in ${id}.`);
    for(const element of raw.elements??[]){object(element,`element in ${id}`);for(const face of Object.values(object(element.faces??{},`faces in ${id}`))){object(face,`face in ${id}`);if(typeof face.texture!=='string'||!face.texture.length)throw new Error(`Invalid face texture slot in ${id}.`);}}
    // Parent variables can be supplied by children. Resolve aliases only in the complete root model.
    const merged={...parent,...raw,id,textures:{...parent.textures,...raw.textures},elements:raw.elements??parent.elements??[]};models.set(id,merged);chains.set(id,[id,...(parent.id?chains.get(parent.id):[])]);return merged;
  }
  function application(value,context,block){
    guard(false);const entries=Array.isArray(value)?value:[value];if(!entries.length)throw new Error(`Empty model application in ${context}.`);
    for(const entry of entries){
      guard(false);if(++applications>MAX_REFERENCES)throw new Error('Rendering dependencies exceed the 32768-model-application budget.');object(entry,`model application in ${context}`);if(typeof entry.model!=='string')throw new Error(`Missing model reference in ${context}.`);
      try{
        const id=identifier(entry.model).id;
        if(candidates.has(id)){block.candidates.push(candidates.get(id));continue;}
        const resolved=model(entry.model);
        const used=new Set();const use=reference=>{const name=stack.texture(resolved,reference);texture(name);used.add(name);};
        for(const key of Object.keys(resolved.textures))use('#'+key);
        for(const element of resolved.elements){object(element,`element in ${resolved.id}`);for(const face of Object.values(object(element.faces??{},`faces in ${resolved.id}`))){object(face,`face in ${resolved.id}`);use(face.texture);}}
        const candidate={model:resolved.id,parents:chains.get(resolved.id).slice(1),textures:[...used].sort()};candidates.set(id,candidate);block.candidates.push(candidate);
      }catch(error){recordError(entry.model,error);}
    }
  }
  if(retainBlockDefinitions){
    // Installation optimization preserves every block definition, including unused templates.
    // Follow their parents and direct textures; unresolved template slots belong to children.
    for(const path of blockDefinitionPaths(stack.packs))try{if(path.includes('/models/')){const match=/^assets\/([^/]+)\/models\/(.+)\.json$/.exec(path);model(match[1]+':'+match[2]);}else required(path);}catch(error){recordError(path,error);}
  }
  warnings.push('Target 26.3 / format 97.1 overlay/filter resolution is applied. Complete model semantics and client rendering parity remain unqualified. All model candidates are retained without weighted selection.');
  if(!errors.length)for(let index=0;index<roots.length;index++){
    const root=roots[index],block={id:root,candidates:[]};blocks.push(block);try{
      const rendering=blockRenderingInputs(root);block.fluids=rendering?.fluids??[];block.colormaps=[...new Set((rendering?.tints??[]).map(rule=>rule.kind==='lower-grass'?'grass':rule.kind).filter(kind=>['grass','foliage','dry_foliage'].includes(kind)))];
      for(const kind of block.colormaps)texture('minecraft:colormap/'+kind);
      for(const kind of block.fluids)for(const suffix of kind==='water'?['still','flow','overlay']:['still','flow'])texture(`minecraft:block/${kind}_${suffix}`);
      if(rendering?.invisible)continue;
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
    try{guard(false);for(const path of pack.entries.keys())if(path==='pack.mcmeta'||path===BUNDLE_MANIFEST||path==='studio-vanilla-source.json'||notice.test(path))add(`sources/${index}/${path}`,pack,path,path==='pack.mcmeta'||path===BUNDLE_MANIFEST||path==='studio-vanilla-source.json'?'source-metadata':'notice');}
    catch(error){recordError(pack.name,error);}
  }
  assetCurrent(isCurrent);
  return{files,report:{format:'iris-terrain-studio-dependency-report',version:1,roots,blocks,sources,files:[...records.values()].sort((a,b)=>a.path.localeCompare(b.path)),target:{minecraftVersion:'26.3',resourceFormat:[97,1],resolved:true},counts:{blockTypes:roots.length,models:models.size,textures:textures.size,files:files.size,bytes,applications,distinctModelDependencies:candidates.size},errors,warnings,complete:false}};
}
