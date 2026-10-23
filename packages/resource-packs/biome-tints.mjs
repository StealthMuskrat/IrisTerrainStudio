import{tintRules,biomeInputs}from'./render-inputs.mjs';
import{biomeInfoNoise}from'./client-math.mjs';
const mapKinds=new Set(['grass','foliage','dry_foliage']),clamp=value=>Math.max(0,Math.min(1,Math.fround(value)));
export const rgbaTint=color=>[(color>>>16&255)/255,(color>>>8&255)/255,(color&255)/255,(color>>>24)/255];
function packed(value){if(typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value))return(0xff000000|parseInt(value.slice(1),16))>>>0;if(Number.isInteger(value))return(0xff000000|value)>>>0;throw new Error('Invalid native biome color.');}
export function biomeTint(kind,key,position,maps){
  const biome=biomeInputs[key];if(!biome)throw new Error(`Biome ${key??'(missing)'} needs authoritative tint metadata.`);const effects=biome.effects;
  let color;if(effects[kind+'_color']!==undefined)color=packed(effects[kind+'_color']);else{
    if(!mapKinds.has(kind)||!maps[kind])throw new Error(`Missing ${kind} colormap for biome ${key}.`);const temperature=clamp(biome.temperature),rain=clamp(biome.downfall)*temperature,index=(Math.trunc((1-rain)*255)<<8)|Math.trunc((1-temperature)*255);color=maps[kind][index];
  }
  if(kind==='grass'){const modifier=effects.grass_color_modifier??'none';if(modifier==='dark_forest')color=(0xff000000|(((color&0xfefefe)+0x28340a)>>1))>>>0;else if(modifier==='swamp')color=(biomeInfoNoise(position[0]*.0225,position[2]*.0225)<-.1?-11766212:-9801671)>>>0;else if(modifier!=='none')throw new Error('Unsupported native grass modifier: '+modifier);}
  return color>>>0;
}
// Stored physical biomes are an explicit preview source, not client quart/Voronoi sampling.
// It never substitutes an arbitrary biome at an unknown edge or missing native key.
export async function prepareBiomeTints(stack,volume,{blendRadius=0}={}){
  blendRadius=biomeBlendRadius(blendRadius);
  const needed=new Set();for(const block of volume.palette)for(const rule of tintRules[block.id]??[]){const kind=rule.kind==='lower-grass'?'grass':rule.kind;if(mapKinds.has(kind)&&volume.biomes?.palette.some(key=>biomeInputs[key]&&biomeInputs[key].effects[kind+'_color']===undefined))needed.add(kind);}
  const maps={},errors={};for(const kind of needed){try{const raster=await stack.bitmap('minecraft:colormap/'+kind);if(raster.width!==256||raster.height!==256||raster.animation)throw new Error('Biome colormaps require a static 256 × 256 PNG.');const colors=new Uint32Array(65536);for(let i=0;i<colors.length;i++){const at=i*4;colors[i]=((raster.pixels[at+3]<<24)|(raster.pixels[at]<<16)|(raster.pixels[at+1]<<8)|raster.pixels[at+2])>>>0;}maps[kind]=colors;}catch(error){errors[kind]=error.message;}}
  return{maps,errors,mode:'stored-physical-biome',blendRadius};
}
export function blockTint(block,index,position,biomeAt,input,tintAt){
  if(!tintAt&&input?.blendRadius)tintAt=createBiomeBlendSampler(biomeAt,input);
  if(block.tints?.[index])return block.tints[index];const rule=tintRules[block.id]?.[index];if(!rule)return[1,1,1,1];let color;
  if(rule.kind==='constant')color=rule.color;else if(rule.kind==='property'){color=rule.values[block.properties?.[rule.property]];if(color===undefined)throw new Error(`Missing ${rule.property} tint value for ${block.id}.`);}
  else{const at=position.slice(),kind=rule.kind==='lower-grass'?'grass':rule.kind;if(rule.kind==='lower-grass'&&block.properties?.half==='upper')at[1]--;if(input?.errors?.[kind])throw new Error(input.errors[kind]);color=tintAt?tintAt(kind,at):biomeTint(kind,biomeAt(...at),at,input?.maps??{});}
  return rgbaTint(color>>>0);
}

export function biomeBlendRadius(value=0){if(!Number.isInteger(value)||value<0||value>7)throw new Error('Stored biome blend radius must be an integer from zero to seven.');return value;}
// Original ClientLevel.calculateBlockTint integer box average, supplied with an explicit
// color resolver. No edge clamping, interpolation, fabricated biome or alpha averaging.
export function blendBiomeColor(position,radius,resolve){
  radius=biomeBlendRadius(radius);if(!Array.isArray(position)||position.length!==3||!position.every(Number.isSafeInteger))throw new Error('Biome blending requires exact block coordinates.');
  const[x,y,z]=position;if(![x-radius,x+radius,z-radius,z+radius].every(Number.isSafeInteger))throw new Error('Biome blend neighborhood exceeds exact block coordinates.');if(!radius)return resolve(position)>>>0;let r=0,g=0,b=0;
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){const color=resolve([x+dx,y,z+dz]);r+=color>>>16&255;g+=color>>>8&255;b+=color&255;}
  const count=(radius*2+1)**2;return(0xff000000|Math.trunc(r/count)<<16|Math.trunc(g/count)<<8|Math.trunc(b/count))>>>0;
}
export function createBiomeBlendSampler(biomeAt,input,{sampleLimit=4000000,cacheLimit=32768}={}){
  const radius=biomeBlendRadius(input?.blendRadius??0),cache=new Map();let samples=0;
  if(!Number.isSafeInteger(sampleLimit)||sampleLimit<1||sampleLimit>4000000||!Number.isSafeInteger(cacheLimit)||cacheLimit<1||cacheLimit>32768)throw new Error('Invalid biome blend work budget.');
  return(kind,position)=>{
    const key=kind+':'+position.join(',');if(cache.has(key)){const row=cache.get(key);cache.delete(key);cache.set(key,row);if(row.error)throw new Error(row.error);return row.color;}
    let row;try{if(input?.errors?.[kind])throw new Error(input.errors[kind]);const color=blendBiomeColor(position,radius,at=>{if(++samples>sampleLimit){const error=new Error('Stored biome blend work budget exceeded. Reduce the visible area or blend radius.');error.name='BiomeBlendBudgetError';throw error;}const biome=biomeAt(...at);if(!biome)throw new Error('Stored biome blend needs additional biome samples outside this volume; reduce its radius or use an interior section.');return biomeTint(kind,biome,at,input?.maps??{});});row={color};}
    catch(error){if(error.name==='BiomeBlendBudgetError')throw error;row={error:error.message};}
    if(cache.size>=cacheLimit)cache.delete(cache.keys().next().value);cache.set(key,row);if(row.error)throw new Error(row.error);return row.color;
  };
}
