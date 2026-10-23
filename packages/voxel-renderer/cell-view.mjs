import{CELL_CUBE}from'./cell-geometry.mjs';
import{categoryColor}from'./field-data.mjs';
import{TextureAtlas}from'../resource-packs/atlas.mjs';

export function voxelViewMode(value='textured'){if(!['textured','blocks','biomes','regions'].includes(value))throw new Error('Choose a supported voxel view.');return value;}
const air=block=>block.air===true||['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(block.id);
// Diagnostic cell extents, deliberately independent of Minecraft block models.
function keysFor(volume,mode){
  voxelViewMode(mode);if(mode==='textured')throw new Error('Textured models have no cell identity palette.');
  if(mode==='biomes'&&!volume.biomes)throw new Error('This stored volume has no physical biome data. Choose block ID cells or textured models.');
  if(mode==='regions'&&!volume.regions)throw new Error(volume.metadata?.regionColumnsUnavailable??'This stored volume has no native region columns. Regenerate an unstacked dimension preview.');
  const keys=mode==='regions'?volume.regions.palette:mode==='biomes'?volume.biomes.palette:volume.palette.map(block=>block.id);let text=0;
  if(keys.length>65536||keys.some(key=>typeof key!=='string'||!key.length||key.length>1024||(text+=key.length)>8*1024*1024))throw new Error('Cell identity palette exceeds its key budget.');return keys;
}
export function prepareCellView(volume,mode){
  const keys=keysFor(volume,mode),colors=new Float32Array(keys.length*4),known=new Map();
  keys.forEach((key,index)=>{if(!known.has(key))known.set(key,categoryColor(key));colors.set(known.get(key),index*4);});
  return{models:volume.palette.map(block=>air(block)?[]:CELL_CUBE),palette:volume.palette.map(block=>({...block,solid:!air(block)})),cellColors:{greedy:true,palette:colors,indices:mode==='biomes'?volume.biomes.cells:null,columnIndices:mode==='regions'?volume.regions.cells:null}};
}
export class CellPalette{
  constructor(volume,mode){const keys=keysFor(volume,mode),visible=mode!=='blocks'?keys:keys.filter((key,index)=>!air(volume.palette[index]));this.keys=[...new Set(visible)].sort();}
  page(query='',page=0){
    if(typeof query!=='string'||query.length>1024||!Number.isSafeInteger(page)||page<0)throw new Error('Invalid cell legend search or page.');
    const needle=query.trim().toLowerCase(),filtered=this.keys.filter(key=>key.toLowerCase().includes(needle)),pages=Math.max(1,Math.ceil(filtered.length/64));page=Math.min(page,pages-1);
    return{page,pages,total:filtered.length,rows:filtered.slice(page*64,page*64+64).map(key=>({key,color:categoryColor(key)}))};
  }
}
// A constant white carrier lets vertex identity colors use the existing textured pipeline.
export class CellAtlas extends TextureAtlas{
  constructor(device){super(device,4);try{const pixels=new Uint8Array(4*4*4).fill(255);device.queue.writeTexture({texture:this.texture},pixels,{bytesPerRow:16,rowsPerImage:4},[4,4]);this.alpha.fill(255);}catch(error){this.dispose();throw error;}}
}
