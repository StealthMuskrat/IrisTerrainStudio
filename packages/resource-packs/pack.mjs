import{textureMipmapMetadata}from'./texture-mipmaps.mjs';
import { quadrant } from './model-transform.mjs';
import { parseMaterial } from './material.mjs';
import { decodeTexturePng } from './texture-pixels.mjs';
import { resolvePackTarget } from './target-format.mjs';
import { resourceFilter } from './resource-filter.mjs';
import { readZip } from '../shared/zip.mjs';
import { BUNDLE_MANIFEST, readRenderingBundle, assetDigest, assetJson } from './bundle.mjs';
import { builtinTexture } from './builtin-textures.mjs';
const MAX_BITMAP_BYTES=64*1024*1024,MAX_TEXTURE_PIXELS=4_194_304;
function textureDimensions(bytes,name){
  const signature=[137,80,78,71,13,10,26,10];
  if(!(bytes instanceof Uint8Array)||bytes.length<33||bytes.length>8*1024*1024||signature.some((value,index)=>bytes[index]!==value))throw new Error(`Texture ${name} must be PNG within the 8 MiB input budget.`);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(8)!==13||String.fromCharCode(...bytes.subarray(12,16))!=='IHDR')throw new Error(`Texture ${name} has an invalid PNG header.`);
  const width=view.getUint32(16),height=view.getUint32(20);
  if(width<1||height<1||width>4096||height>16384||width*height>MAX_TEXTURE_PIXELS)throw new Error(`Texture ${name} exceeds the 4,194,304-pixel decode budget or dimension limit.`);
  return{width,height,bytes:width*height*4};
}
export function identifier(value, defaultNamespace = 'minecraft') { if (typeof value !== 'string') throw new Error('Expected a resource identifier.'); const parts = value.includes(':') ? value.split(':') : [defaultNamespace, value]; if (parts.length !== 2 || !/^[a-z0-9_.-]+$/.test(parts[0]) || !/^[a-z0-9_./-]+$/.test(parts[1]) || parts[1].split('/').some(p => p === '..' || p === '.')) throw new Error(`Invalid resource identifier: ${value}`); return { namespace: parts[0], path: parts[1], id: parts.join(':') }; }
export class MinecraftResourcePack {
  static async open(file, name = file.name || 'Resource pack') {
    if((file instanceof Uint8Array?file.byteLength:file.size)>64*1024*1024)throw new Error('Resource-pack input exceeds 64 MiB.');
    const input = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
    const entries = await readZip(input, { maxBytes: 64 * 1024 * 1024 });
    if(entries.has(BUNDLE_MANIFEST))return new MinecraftResourcePack(name,entries,{studioRenderingBundle:await readRenderingBundle(entries)},await assetDigest(input));
    if (!entries.has('pack.mcmeta')) throw new Error('The ZIP must contain pack.mcmeta at its root. Choose a Minecraft resource pack.');
    const metadata=assetJson(entries.get('pack.mcmeta'),'pack.mcmeta');
    if (!metadata.pack||typeof metadata.pack!=='object'||Array.isArray(metadata.pack)) throw new Error('Resource-pack metadata has no pack definition.');
    resolvePackTarget(metadata,{requireFormat:true});
    const digest = await assetDigest(input);
    return new MinecraftResourcePack(name, entries, metadata, digest);
  }
  constructor(name, entries, metadata, digest) { this.name = name; this.entries = entries; this.metadata = metadata; this.digest = digest; this.expandedBytes=[...entries.values()].reduce((sum,bytes)=>sum+bytes.byteLength,0); this.jsonCache = new Map(); this.target=resolvePackTarget(metadata); this.filter=resourceFilter(metadata.filter); this.overlayDirectories=this.target.overlays.filter(row=>row.applicable).map(row=>row.directory).reverse(); }
  assetPath(path){if(path.startsWith('assets/'))for(const directory of this.overlayDirectories){const candidate=directory+'/'+path;if(this.entries.has(candidate))return candidate;}return this.entries.has(path)?path:null;}
  assetBytes(path){const source=this.assetPath(path);return source===null?null:this.entries.get(source);}
  assetJson(path){const source=this.assetPath(path);return source===null?null:this.json(source);}
  json(path) { if (!this.entries.has(path)) return null; if (!this.jsonCache.has(path)) { const bytes = this.entries.get(path); if (bytes.length > 2 * 1024 * 1024) throw new Error(`Model definition is too large: ${path}`); try { this.jsonCache.set(path, JSON.parse(new TextDecoder().decode(bytes))); } catch { throw new Error(`Invalid resource-pack JSON: ${path}`); } } return this.jsonCache.get(path); }
}
function matchesWhen(condition, state) {
  if (!condition) return true;
  if (condition.OR) return condition.OR.some(c => matchesWhen(c, state));
  if (condition.AND) return condition.AND.every(c => matchesWhen(c, state));
  return Object.entries(condition).every(([key,value])=>{if(!Object.hasOwn(state,key))throw new Error(`Multipart condition references unknown state property ${key}.`);return String(value).split('|').some(term=>{if(!term||term==='!')throw new Error('Empty multipart condition term.');return term.startsWith('!')?String(state[key])!==term.slice(1):String(state[key])===term;});});
}
function variantMatches(key, state) { return !key || key.split(',').every(part => { const [name, value] = part.split('='); return value?.split('|').includes(String(state[name])); }); }
export class ResourcePackStack {
  constructor(packs = []) { this.packs = packs; this.models = new Map(); this.bitmaps = new Map(); this.diagnostics = new Map(); this.bitmapBytes=0; this.disposed=false; this.resolved=new Map(); }
  requireOpen(){if(this.disposed)throw new DOMException('Resource-pack stack disposed.','AbortError');}
  resolve(path){
    this.requireOpen();if(this.resolved.has(path))return this.resolved.get(path);
    const location=/^assets\/([a-z0-9_.-]+)\/(.+)$/.exec(path);let result=null;
    for(let index=this.packs.length-1;index>=0;index--){const pack=this.packs[index],sourcePath=pack.assetPath(path);if(sourcePath!==null){result={pack,sourcePath,index};break;}if(location&&pack.filter(location[1],location[2]))break;}
    this.resolved.set(path,result);return result;
  }
  find(path){return this.resolve(path)?.pack??null;}
  json(path){const source=this.resolve(path);return source?source.pack.json(source.sourcePath):null;}
  bytes(path){const source=this.resolve(path);return source?source.pack.entries.get(source.sourcePath):null;}
  metadataSource(path){
    const provider=this.resolve(path);if(!provider)return null;const metadata=path+'.mcmeta',location=/^assets\/([a-z0-9_.-]+)\/(.+)$/.exec(metadata);
    for(let index=this.packs.length-1;index>=provider.index;index--){const pack=this.packs[index],sourcePath=pack.assetPath(metadata);if(sourcePath!==null)return{pack,sourcePath,index};if(location&&pack.filter(location[1],location[2]))break;}return null;
  }
  metadata(path){const source=this.metadataSource(path);return source?source.pack.json(source.sourcePath):null;}
  resolveModel(name, stack = []) {
    this.requireOpen();const id = identifier(name); if (this.models.has(id.id)) return this.models.get(id.id);
    if (stack.includes(id.id) || stack.length > 32) throw new Error(`Model parent cycle: ${[...stack,id.id].join(' → ')}`);
    const json = this.json(`assets/${id.namespace}/models/${id.path}.json`); if (!json) throw new Error(`Missing model ${id.id}. Add its resource pack or the matching vanilla asset baseline.`);
    if(Object.hasOwn(json,'loader')||Object.hasOwn(json,'overrides'))throw new Error(`Model ${id.id} requires an unsupported custom loader or override adapter.`);
    if (json.parent?.startsWith('builtin/')||json.parent?.startsWith('minecraft:builtin/')) throw new Error(`Built-in model ${json.parent} needs a supported Minecraft model adapter.`);
    const parent = json.parent ? this.resolveModel(json.parent, [...stack,id.id]) : {};
    const model = { ...parent, ...json, textures: { ...parent.textures, ...json.textures }, id: id.id, elements: json.elements ?? parent.elements ?? [] };
    this.models.set(id.id, model); return model;
  }
  material(model, reference) {
    if(typeof reference!=='string'||!reference.length)throw new Error(`Invalid texture slot in ${model.id}.`);
    const seen = new Set(); let value = model.textures?.[reference.startsWith('#')?reference.slice(1):reference];
    while (typeof value === 'string' && value.startsWith('#')) { if (seen.has(value)) throw new Error(`Texture reference cycle in ${model.id}.`); seen.add(value); value = model.textures?.[value.slice(1)]; }
    if (!value) throw new Error(`Missing texture ${reference} in ${model.id}.`);
    return parseMaterial(value,identifier);
  }
  texture(model,reference){return this.material(model,reference).sprite;}
  blockModelGroups(block){
    const id=identifier(block.id),state=block.properties||{};if(['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(id.id))return{multipart:false,groups:[]};
    const definition=this.json(`assets/${id.namespace}/blockstates/${id.path}.json`);if(!definition)throw new Error(`Missing blockstate ${id.id}.`);let applications=[],multipart=false;
    if(definition.variants){const candidates=Object.entries(definition.variants).filter(([key])=>variantMatches(key,state));if(candidates.length>1)throw new Error(`Blockstate ${id.id} has overlapping matching variants.`);if(candidates.length)applications=[candidates[0][1]];else if(!definition.multipart)throw new Error(`Blockstate ${id.id} has no matching variants.`);}
    if(!applications.length&&definition.multipart){if(!Array.isArray(definition.multipart))throw new Error(`Invalid multipart blockstate ${id.id}.`);multipart=true;for(const part of definition.multipart)if(matchesWhen(part.when,state))applications.push(part.apply);}
    if(!definition.variants&&!definition.multipart)throw new Error(`Blockstate ${id.id} has no model definition.`);if(applications.length>128)throw new Error('Blockstate exceeds its 128-selector model budget.');
    let count=0;const groups=applications.map(application=>{const weighted=Array.isArray(application),entries=weighted?application:[application];if(!entries.length||entries.length>128||(count+=entries.length)>512)throw new Error('Blockstate exceeds its bounded model-candidate budget.');let totalWeight=0;const variants=entries.map(entry=>{if(!entry||typeof entry!=='object'||!entry.model)throw new Error(`Invalid model application in ${id.id}.`);const weight=weighted?(entry.weight??1):1;if(!Number.isInteger(weight)||weight<0||weight>2147483647||(totalWeight+=weight)>2147483647)throw new Error(`Invalid model weights in ${id.id}.`);if(entry.uvlock!==undefined&&typeof entry.uvlock!=='boolean')throw new Error('Model uvlock must be a boolean.');return{weight,model:this.resolveModel(entry.model),x:quadrant(entry.x),y:quadrant(entry.y),z:quadrant(entry.z),uvlock:entry.uvlock===true};});if(weighted&&totalWeight===0)throw new Error(`Blockstate ${id.id} has no positive model weight.`);return{weighted,totalWeight,variants};});return{multipart,groups};
  }
  blockModels(block,choices){return this.blockModelGroups(block).groups.map((group,index)=>{if(group.weighted&&group.variants.length!==1&&choices?.[index]===undefined)throw new Error(`Weighted models for ${block.id} require contextual client selection.`);const choice=choices?.[index]??0;if(!Number.isInteger(choice)||choice<0||choice>=group.variants.length)throw new Error('Invalid explicit model choice.');return group.variants[choice];});}
  async bitmap(name){
    this.requireOpen();const id=identifier(name);
    if(!this.bitmaps.has(id.id)){
      const pending=this.loadBitmap(id).catch(error=>{if(this.bitmaps.get(id.id)===pending)this.bitmaps.delete(id.id);throw error;});
      this.bitmaps.set(id.id,pending);
    }
    return this.bitmaps.get(id.id);
  }
  async loadBitmap(id){
    const builtin=builtinTexture(id.id);
    if(builtin){const decodedBytes=builtin.pixels.byteLength;if(this.bitmapBytes+decodedBytes>MAX_BITMAP_BYTES)throw new Error('Resource-pack textures exceed the 64 MiB decoded bitmap budget.');this.bitmapBytes+=decodedBytes;return{...builtin,animation:null,texture:textureMipmapMetadata(undefined),decodedBytes};}
    const path=`assets/${id.namespace}/textures/${id.path}.png`,bytes=this.bytes(path);
    if(!bytes)throw new Error(`Missing texture ${id.id}.`);
    const dimensions=textureDimensions(bytes,id.id),metadata=this.metadata(path);
    const animation=metadata&&Object.hasOwn(metadata,'animation')?metadata.animation:null,texture=textureMipmapMetadata(metadata&&Object.hasOwn(metadata,'texture')?metadata.texture:undefined);
    if(metadata&&Object.hasOwn(metadata,'animation')&&(animation===null||typeof animation!=='object'||Array.isArray(animation)))throw new Error(`Texture ${id.id} animation metadata must be an object.`);
    if(this.bitmapBytes+dimensions.bytes>MAX_BITMAP_BYTES)throw new Error('Resource-pack textures exceed the 64 MiB decoded bitmap budget.');
    // Admission includes pending decodes so concurrent texture requests cannot bypass the limit.
    this.bitmapBytes+=dimensions.bytes;
    try{
      const raster=await decodeTexturePng(bytes);
      if(this.disposed)throw new DOMException('Resource-pack stack disposed during image decoding.','AbortError');
      if(raster.width!==dimensions.width||raster.height!==dimensions.height)throw new Error(`Texture ${id.id} decoded dimensions differ from its PNG header.`);
      return{...raster,animation,texture,decodedBytes:dimensions.bytes};
    }catch(error){this.bitmapBytes-=dimensions.bytes;throw error;}
  }

  dispose(){
    if(this.disposal)return this.disposal;
    this.disposed=true;const pending=[...this.bitmaps.values()];this.bitmaps.clear();this.models.clear();this.resolved.clear();
    this.disposal=Promise.allSettled(pending.map(async promise=>{const entry=await promise;this.bitmapBytes-=entry.decodedBytes;entry.pixels=null;})).then(()=>{});
    return this.disposal;
  }
}
