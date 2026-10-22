import{categoryColor}from'./field-data.mjs';
import{TextureAtlas}from'../resource-packs/atlas.mjs';

export function voxelViewMode(value='textured'){if(!['textured','blocks','biomes'].includes(value))throw new Error('Choose a supported voxel view.');return value;}
const air=block=>block.air===true||['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(block.id);
// Diagnostic cell extents, deliberately independent of Minecraft block models.
const definitions=[
  ['north',[0,0,-1],[[1,1,0],[1,0,0],[0,0,0],[0,1,0]]],['south',[0,0,1],[[0,1,1],[0,0,1],[1,0,1],[1,1,1]]],
  ['west',[-1,0,0],[[0,1,0],[0,0,0],[0,0,1],[0,1,1]]],['east',[1,0,0],[[1,1,1],[1,0,1],[1,0,0],[1,1,0]]],
  ['up',[0,1,0],[[0,1,0],[0,1,1],[1,1,1],[1,1,0]]],['down',[0,-1,0],[[0,0,1],[0,0,0],[1,0,0],[1,0,1]]]
];
const cube=definitions.map(([cull,normal,positions])=>({cull,normal,positions,uv:[[.5,.5],[.5,.5],[.5,.5],[.5,.5]],color:[1,1,1,1],transparency:'opaque'}));
function keysFor(volume,mode){
  voxelViewMode(mode);if(mode==='textured')throw new Error('Textured models have no cell identity palette.');
  if(mode==='biomes'&&!volume.biomes)throw new Error('This stored volume has no physical biome data. Choose block ID cells or textured models.');
  const keys=mode==='biomes'?volume.biomes.palette:volume.palette.map(block=>block.id);let text=0;
  if(keys.length>65536||keys.some(key=>typeof key!=='string'||!key.length||key.length>1024||(text+=key.length)>8*1024*1024))throw new Error('Cell identity palette exceeds its key budget.');return keys;
}
export function prepareCellView(volume,mode){
  const keys=keysFor(volume,mode),colors=new Float32Array(keys.length*4),known=new Map();
  keys.forEach((key,index)=>{if(!known.has(key))known.set(key,categoryColor(key));colors.set(known.get(key),index*4);});
  return{models:volume.palette.map(block=>air(block)?[]:cube),palette:volume.palette.map(block=>({...block,solid:!air(block)})),cellColors:{palette:colors,indices:mode==='biomes'?volume.biomes.cells:null}};
}
export class CellPalette{
  constructor(volume,mode){const keys=keysFor(volume,mode),visible=mode==='biomes'?keys:keys.filter((key,index)=>!air(volume.palette[index]));this.keys=[...new Set(visible)].sort();}
  page(query='',page=0){
    if(typeof query!=='string'||query.length>1024||!Number.isSafeInteger(page)||page<0)throw new Error('Invalid cell legend search or page.');
    const needle=query.trim().toLowerCase(),filtered=this.keys.filter(key=>key.toLowerCase().includes(needle)),pages=Math.max(1,Math.ceil(filtered.length/64));page=Math.min(page,pages-1);
    return{page,pages,total:filtered.length,rows:filtered.slice(page*64,page*64+64).map(key=>({key,color:categoryColor(key)}))};
  }
}
// A constant white carrier lets vertex identity colors use the existing textured pipeline.
export class CellAtlas extends TextureAtlas{
  constructor(device){super(device,4);try{this.context.fillStyle='#fff';this.context.fillRect(0,0,4,4);device.queue.copyExternalImageToTexture({source:this.canvas},{texture:this.texture},[4,4]);}catch(error){this.dispose();throw error;}}
}
