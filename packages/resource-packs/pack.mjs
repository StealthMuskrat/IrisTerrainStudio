import { readZip } from '../shared/zip.mjs';
import { BUNDLE_MANIFEST, readRenderingBundle, assetDigest, assetJson } from './bundle.mjs';
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
    const input = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
    const entries = await readZip(input, { maxBytes: 64 * 1024 * 1024 });
    if(entries.has(BUNDLE_MANIFEST))return new MinecraftResourcePack(name,entries,{studioRenderingBundle:await readRenderingBundle(entries)},await assetDigest(input));
    if (!entries.has('pack.mcmeta')) throw new Error('The ZIP must contain pack.mcmeta at its root. Choose a Minecraft resource pack.');
    const metadata=assetJson(entries.get('pack.mcmeta'),'pack.mcmeta');
    if (!metadata.pack||typeof metadata.pack!=='object'||Array.isArray(metadata.pack)) throw new Error('Resource-pack metadata has no pack definition.');
    const digest = await assetDigest(input);
    return new MinecraftResourcePack(name, entries, metadata, digest);
  }
  constructor(name, entries, metadata, digest) { this.name = name; this.entries = entries; this.metadata = metadata; this.digest = digest; this.jsonCache = new Map(); }
  json(path) { if (!this.entries.has(path)) return null; if (!this.jsonCache.has(path)) { const bytes = this.entries.get(path); if (bytes.length > 2 * 1024 * 1024) throw new Error(`Model definition is too large: ${path}`); try { this.jsonCache.set(path, JSON.parse(new TextDecoder().decode(bytes))); } catch { throw new Error(`Invalid resource-pack JSON: ${path}`); } } return this.jsonCache.get(path); }
}
function matchesWhen(condition, state) {
  if (!condition) return true;
  if (condition.OR) return condition.OR.some(c => matchesWhen(c, state));
  if (condition.AND) return condition.AND.every(c => matchesWhen(c, state));
  return Object.entries(condition).every(([key, value]) => String(value).split('|').includes(String(state[key])));
}
function variantMatches(key, state) { return !key || key.split(',').every(part => { const [name, value] = part.split('='); return value?.split('|').includes(String(state[name])); }); }
export class ResourcePackStack {
  constructor(packs = []) { this.packs = packs; this.models = new Map(); this.bitmaps = new Map(); this.diagnostics = new Map(); this.bitmapBytes=0; this.disposed=false; }
  requireOpen(){if(this.disposed)throw new DOMException('Resource-pack stack disposed.','AbortError');}
  find(path) { this.requireOpen();for (let i = this.packs.length - 1; i >= 0; i--){const pack=this.packs[i];if(pack.metadata.overlays!==undefined||pack.metadata.filter!==undefined)throw new Error(`Resource-pack overlays and filters require a target-format adapter: ${pack.name}`);if(pack.entries.has(path))return pack;} return null; }
  json(path) { return this.find(path)?.json(path) ?? null; }
  bytes(path) { return this.find(path)?.entries.get(path) ?? null; }
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
  texture(model, reference) {
    const seen = new Set(); let value = reference;
    while (typeof value === 'string' && value.startsWith('#')) { if (seen.has(value)) throw new Error(`Texture reference cycle in ${model.id}.`); seen.add(value); value = model.textures?.[value.slice(1)]; }
    if (!value) throw new Error(`Missing texture ${reference} in ${model.id}.`);
    return identifier(value).id;
  }
  blockModels(block, choices) {
    const id = identifier(block.id), state = block.properties || {};
    if (['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(id.id)) return [];
    const definition = this.json(`assets/${id.namespace}/blockstates/${id.path}.json`); if (!definition) throw new Error(`Missing blockstate ${id.id}.`);
    const applications = [];
    if (definition.variants) { const candidates = Object.entries(definition.variants).filter(([key]) => variantMatches(key,state)); if (candidates.length !== 1) throw new Error(`Blockstate ${id.id} has ${candidates.length} matching variants.`); applications.push(candidates[0][1]); }
    if (definition.multipart) for (const part of definition.multipart) if (matchesWhen(part.when,state)) applications.push(part.apply);
    return applications.map((application, index) => {
      let entry = application;
      if (Array.isArray(entry)) { if (entry.length !== 1 && choices?.[index] === undefined) throw new Error(`Weighted models for ${id.id} require the engine's exact model selection.`); entry = entry[choices?.[index] ?? 0]; }
      if (!entry?.model) throw new Error(`Blockstate ${id.id} has an invalid model application.`);
      if (![0,90,180,270].includes(entry.x || 0) || ![0,90,180,270].includes(entry.y || 0)) throw new Error(`Unsupported blockstate rotation for ${id.id}.`);
      return { model: this.resolveModel(entry.model), x: entry.x || 0, y: entry.y || 0, uvlock: !!entry.uvlock };
    });
  }
  async bitmap(name){
    this.requireOpen();const id=identifier(name);
    if(!this.bitmaps.has(id.id)){
      const pending=this.loadBitmap(id).catch(error=>{if(this.bitmaps.get(id.id)===pending)this.bitmaps.delete(id.id);throw error;});
      this.bitmaps.set(id.id,pending);
    }
    return this.bitmaps.get(id.id);
  }
  async loadBitmap(id){
    const path=`assets/${id.namespace}/textures/${id.path}.png`,bytes=this.bytes(path);
    if(!bytes)throw new Error(`Missing texture ${id.id}.`);
    const dimensions=textureDimensions(bytes,id.id),metadata=this.json(path+'.mcmeta');
    const animation=metadata&&Object.hasOwn(metadata,'animation')?metadata.animation:null;
    if(metadata&&Object.hasOwn(metadata,'animation')&&(animation===null||typeof animation!=='object'||Array.isArray(animation)))throw new Error(`Texture ${id.id} animation metadata must be an object.`);
    if(this.bitmapBytes+dimensions.bytes>MAX_BITMAP_BYTES)throw new Error('Resource-pack textures exceed the 64 MiB decoded bitmap budget.');
    // Admission includes pending decodes so concurrent texture requests cannot bypass the limit.
    this.bitmapBytes+=dimensions.bytes;let bitmap;
    try{
      bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{premultiplyAlpha:'none'});
      if(this.disposed)throw new DOMException('Resource-pack stack disposed during image decoding.','AbortError');
      if(bitmap.width!==dimensions.width||bitmap.height!==dimensions.height)throw new Error(`Texture ${id.id} decoded dimensions differ from its PNG header.`);
      return{bitmap,animation,decodedBytes:dimensions.bytes};
    }catch(error){bitmap?.close();this.bitmapBytes-=dimensions.bytes;throw error;}
  }
  dispose(){
    if(this.disposal)return this.disposal;
    this.disposed=true;const pending=[...this.bitmaps.values()];this.bitmaps.clear();this.models.clear();
    this.disposal=Promise.allSettled(pending.map(async promise=>{const entry=await promise;entry.bitmap.close();this.bitmapBytes-=entry.decodedBytes;})).then(()=>{});
    return this.disposal;
  }
}
