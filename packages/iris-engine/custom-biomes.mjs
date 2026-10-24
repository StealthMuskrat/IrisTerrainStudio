// Retained native authoring definitions; no live registry installation or inferred colors.
const keyPattern=/^iris:biomes\/[a-f0-9]{64}$/;
const color=value=>typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value)||Number.isInteger(value)&&value>=0&&value<=0xffffff;
export function customBiomeDefinitions(terrainInfo){
  const rows=terrainInfo?.customBiomes;if(rows===undefined)return{rows:[],biomes:Object.create(null),bytes:0};
  if(!Array.isArray(rows)||rows.length>1024)throw new Error('Custom biome metadata exceeds its 1024-definition budget.');
  if(rows.length&&(terrainInfo.customBiomeBinding!=='content-addressed-authoring'||terrainInfo.nativeRegistryEpoch!==false))throw new Error('Custom biome metadata has no explicit authoring registry scope.');
  const biomes=Object.create(null);let characters=0,bytes=0;
  for(const row of rows){
    if(!row||typeof row!=='object'||typeof row.key!=='string'||!keyPattern.test(row.key)||Object.hasOwn(biomes,row.key)||typeof row.id!=='string'||row.id.length>256||typeof row.dimension!=='string'||row.dimension.length>1024||typeof row.readableKey!=='string'||row.readableKey.length>2048||typeof row.definitionJson!=='string'||row.definitionJson.length>65536||(characters+=row.definitionJson.length)>8388608)throw new Error('Custom biome metadata has invalid, duplicate or over-budget definitions.');
    let definition;try{definition=JSON.parse(row.definitionJson);}catch{throw new Error('Custom biome definition JSON is invalid.');}
    if(!definition||Array.isArray(definition)||typeof definition.temperature!=='number'||!Number.isFinite(Math.fround(definition.temperature))||typeof definition.downfall!=='number'||!Number.isFinite(Math.fround(definition.downfall))||!definition.effects||typeof definition.effects!=='object'||Array.isArray(definition.effects)||!color(definition.effects.water_color))throw new Error('Custom biome definition has incomplete native climate/color data.');
    const effects={water_color:definition.effects.water_color};for(const kind of['grass','foliage','dry_foliage']){const name=kind+'_color';if(Object.hasOwn(definition.effects,name)){if(!color(definition.effects[name]))throw new Error('Custom biome definition has an invalid native color.');effects[name]=definition.effects[name];}}
    if(Object.hasOwn(definition.effects,'grass_color_modifier')){const modifier=definition.effects.grass_color_modifier;if(!['none','dark_forest','swamp'].includes(modifier))throw new Error('Custom biome definition has an unknown native grass modifier.');effects.grass_color_modifier=modifier;}
    biomes[row.key]={temperature:Math.fround(definition.temperature),downfall:Math.fround(definition.downfall),effects};
    bytes+=512+2*(row.definitionJson.length+row.id.length+row.dimension.length+row.readableKey.length+row.key.length);
  }return{rows,biomes,bytes};
}

export function customBiomeLabel(terrainInfo,key){
  const rows=terrainInfo?.customBiomes;if(!Array.isArray(rows))return '';const row=rows.find(value=>value.key===key);return row?`${row.dimension} / ${row.id} · ${row.readableKey}`:'';
}
