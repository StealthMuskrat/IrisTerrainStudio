import {regionColumns} from '../shared/region-columns.mjs';

export const CHUNK_AREA_FIELDS=Object.freeze(['terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode']);
const MAX_CELLS=4_194_304,MAX_METADATA=2*1024*1024;
const cancelled=()=>new DOMException('Chunk area generation cancelled.','AbortError');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
export function chunkAreaPlan(options){
  const area=options.chunkArea??{width:1,depth:1};
  if(!area||!Number.isInteger(area.width)||!Number.isInteger(area.depth)||area.width<1||area.depth<1||area.width>4||area.depth>4)throw Error('Choose a chunk area from 1 to 4 chunks per axis.');
  const count=area.width*area.depth;
  if(count>1&&!CHUNK_AREA_FIELDS.includes(options.field))throw Error('Chunk areas require a registered terrain mode.');
  if(![options.x,options.z].every(Number.isFinite))throw Error('Chunk area coordinates must be finite.');
  const x=(Math.floor(options.x/16)-Math.floor(area.width/2))*16,z=(Math.floor(options.z/16)-Math.floor(area.depth/2))*16;
  if(![x,z,x+(area.width-1)*16,z+(area.depth-1)*16].every(value=>Number.isSafeInteger(value)&&Math.abs(value)<=29_999_936))throw Error('Chunk area exceeds the native generation coordinate bounds.');
  return {x,z,width:area.width,depth:area.depth,count};
}
export function admitChunkAreaHeight(plan,height){
  if(!Number.isInteger(plan.count)||plan.count<1||plan.count>16||!Number.isInteger(height)||height<1||height>4096||plan.count*256*height>MAX_CELLS)throw Error('Chunk area exceeds its 4,194,304-cell budget. Reduce the area or dimension height.');
}
export function validateChunkAreaMetadata(volume){
  const area=volume.metadata?.chunkArea;if(!area)return null;
  if(!Number.isInteger(area.width)||!Number.isInteger(area.depth)||area.width<1||area.depth<1||area.width>4||area.depth>4||volume.width!==area.width*16||volume.depth!==area.depth*16||!Array.isArray(area.chunks)||area.chunks.length!==area.width*area.depth)throw Error('Stored chunk area metadata has invalid coverage.');
  for(let i=0;i<area.chunks.length;i++){
    const chunk=area.chunks[i],x=volume.origin[0]+(i%area.width)*16,z=volume.origin[2]+Math.floor(i/area.width)*16;
    if(!chunk||!Array.isArray(chunk.origin)||chunk.origin.length!==3||chunk.origin[0]!==x||chunk.origin[1]!==volume.origin[1]||chunk.origin[2]!==z||!chunk.metadata||typeof chunk.metadata!=='object'||Array.isArray(chunk.metadata)||chunk.metadata.chunkArea!==undefined)throw Error('Stored chunk area has invalid destination metadata.');
  }
  return area;
}
export function chunkAreaMetadataCharge(volume){
  const area=validateChunkAreaMetadata(volume);if(!area)return 0;
  const bytes=512+4*JSON.stringify(area).length;
  if(bytes>MAX_METADATA)throw Error('Chunk area metadata exceeds its 2 MiB retention budget.');
  return bytes;
}
export function chunkMetadataAt(metadata,area,x,z){
  if(!area)return metadata;
  const chunk=area.chunks[Math.floor(x/16)+area.width*Math.floor(z/16)];
  return {...metadata,...chunk.metadata,chunkOrigin:chunk.origin,chunkArea:{width:area.width,depth:area.depth}};
}
function paletteEntry(entries,ids,key,value){
  if(ids.has(key))return ids.get(key);
  if(entries.length>=65536)throw Error('Chunk area exceeds its 65,536-entry palette budget.');
  const index=entries.length;ids.set(key,index);entries.push(value);return index;
}
const blockKey=block=>JSON.stringify({...block,properties:Object.fromEntries(Object.entries(block.properties??{}).sort(([a],[b])=>a.localeCompare(b)))});

function combineRegions(chunks,plan,height){
  if(chunks.some(chunk=>!chunk))return {reason:'Some destination chunks have no retained native region coverage. Inspect a smaller area for region cells.'};
  const palette=[],ids=new Map(),maps=chunks.map(chunk=>chunk.palette.map(key=>paletteEntry(palette,ids,key,key)));
  if(chunks.some(chunk=>chunk.dimension!==chunks[0].dimension))throw Error('Chunk area mixes native region dimensions.');
  const width=plan.width*16,depth=plan.depth*16,spans=chunks.some(chunk=>chunk.offsets),offsets=spans?new Uint32Array(width*depth+1):null,starts=[],cells=[];
  for(let z=0;z<depth;z++)for(let x=0;x<width;x++){
    const destination=x+width*z,index=Math.floor(x/16)+plan.width*Math.floor(z/16),chunk=chunks[index],column=(x&15)+16*(z&15);
    if(spans)offsets[destination]=cells.length;
    if(chunk.offsets){for(let i=chunk.offsets[column];i<chunk.offsets[column+1];i++){starts.push(chunk.starts[i]);cells.push(maps[index][chunk.cells[i]]);}}
    else{if(spans)starts.push(0);cells.push(maps[index][chunk.cells[column]]);}
    if(cells.length>65536)return {reason:'Combined native region spans exceed their bounded metadata budget. Inspect a smaller area for region cells.'};
  }
  if(palette.length>(spans?4096:256))return {reason:'Combined native regions exceed their palette budget. Inspect a smaller area for region cells.'};
  const result={scope:spans?'native-engine-region-spans':'native-engine-region-columns',dimension:chunks[0].dimension,palette,cells:Uint16Array.from(cells).buffer};
  if(spans){offsets[width*depth]=cells.length;Object.assign(result,{height,offsets:offsets.buffer,starts:Uint16Array.from(starts).buffer});if(chunks.every(chunk=>Number.isSafeInteger(chunk.nativeQueries)&&chunk.nativeQueries>=0))result.nativeQueries=chunks.reduce((sum,chunk)=>sum+chunk.nativeQueries,0);}
  return {regions:result};
}

/** Copies already-generated destinations; never synthesizes, interpolates or regenerates cells. */
export async function generateChunkArea(plan,generate,{isCurrent=()=>true,onProgress=()=>{}}={}){
  if(![plan.width,plan.depth].every(value=>Number.isInteger(value)&&value>=1&&value<=4)||plan.count!==plan.width*plan.depth||![plan.x,plan.z,plan.x+(plan.width-1)*16,plan.z+(plan.depth-1)*16].every(value=>Number.isSafeInteger(value)&&value%16===0&&Math.abs(value)<=29_999_936))throw Error('Invalid native chunk area plan.');
  const started=performance.now();
  let first,blocks,biomeCells,hasBiomes,height,minY,metadataBytes=512,infoKey,lastNoise;
  const palette=[],blockIds=new Map(),biomePalette=[],biomeIds=new Map(),chunks=[],regions=[];
  const width=plan.width*16,depth=plan.depth*16;
  for(let i=0;i<plan.count;i++){
    if(!isCurrent())throw cancelled();
    const x=plan.x+(i%plan.width)*16,z=plan.z+Math.floor(i/plan.width)*16,result=await generate(x,z,i);
    if(!isCurrent())throw cancelled();
    const volume=result?.volume;
    if(!volume||volume.width!==16||volume.depth!==16||!Array.isArray(volume.origin)||volume.origin.length!==3||volume.origin[0]!==x||volume.origin[2]!==z||!Number.isSafeInteger(volume.origin[1])||!Array.isArray(volume.palette)||!volume.palette.length||volume.palette.length>65536)throw Error('Native chunk area received an incomplete destination.');
    if(!first){
      first=result;height=volume.height;minY=volume.origin[1];admitChunkAreaHeight(plan,height);
      blocks=new Uint32Array(width*depth*height);hasBiomes=!!volume.biomes;if(hasBiomes)biomeCells=new Uint16Array(blocks.length);
      infoKey=JSON.stringify(volume.metadata?.terrainInfo);
    }else if(volume.height!==height||volume.origin[1]!==minY||result.field!==first.field||result.seed!==first.seed||result.sourceCommit!==first.sourceCommit||volume.metadata?.mode!==first.volume.metadata?.mode||volume.metadata?.terrainInfo!==first.volume.metadata?.terrainInfo&&JSON.stringify(volume.metadata?.terrainInfo)!==infoKey)throw Error('Native chunk area mixes generation contexts.');
    if(!!volume.biomes!==hasBiomes)throw Error('Chunk area crosses a boundary without complete native physical biomes. Reduce the area or disable Studio layout.');
    const source=new Uint32Array(volume.blocks);if(source.length!==256*height)throw Error('Native chunk area block coverage is incomplete.');
    const blockMap=volume.palette.map(block=>{if(!block||typeof block.id!=='string')throw Error('Native chunk area has an invalid block descriptor.');return paletteEntry(palette,blockIds,blockKey(block),block);});
    let biomeMap,sourceBiomes;
    if(hasBiomes){
      if(!Array.isArray(volume.biomes.palette)||!volume.biomes.palette.length||volume.biomes.palette.some(key=>typeof key!=='string'||!key.length))throw Error('Native chunk area biome palette is incomplete.');
      sourceBiomes=new Uint16Array(volume.biomes.cells);if(sourceBiomes.length!==source.length)throw Error('Native chunk area physical biome coverage is incomplete.');
      biomeMap=volume.biomes.palette.map(key=>paletteEntry(biomePalette,biomeIds,key,key));
    }
    const {terrainInfo,chunkArea,...metadata}=volume.metadata??{};
    metadataBytes+=128+4*JSON.stringify(metadata).length;if(metadataBytes>MAX_METADATA)throw Error('Chunk area metadata exceeds its 2 MiB retention budget.');
    chunks.push({origin:[x,minY,z],metadata});
    regions.push(regionColumns(volume.regions,16,16,height));
    const dx=(i%plan.width)*16,dz=Math.floor(i/plan.width)*16;
    for(let y=0;y<height;y++){
      for(let rz=0;rz<16;rz++){
        const start=16*(rz+16*y),destination=dx+width*(dz+rz+depth*y);
        for(let rx=0;rx<16;rx++){
          const at=start+rx,mapped=blockMap[source[at]];if(mapped===undefined)throw Error('Native chunk area references a missing block.');blocks[destination+rx]=mapped;
          if(hasBiomes){const biome=biomeMap[sourceBiomes[at]];if(biome===undefined)throw Error('Native chunk area references a missing biome.');biomeCells[destination+rx]=biome;}
        }
      }
      if((y&31)===31){await tick();if(!isCurrent())throw cancelled();}
    }
    lastNoise=result.noiseCache;onProgress((i+1)/plan.count);await tick();
  }
  if(!isCurrent())throw cancelled();
  const joined=combineRegions(regions,plan,height),common={};
  for(const key of ['scope','mode','seed','sourceCommit','terrainInfo','nativeStageRegistration','nativeModeGeneration','nativeChunkContextPrefill','nativeContentPhase','registeredTerrainStages','registeredContentStages','executedTerrainStages','executedContentStages','physicalBiomeVolume','contentGenerated','customBlocksSupported','historyRestored','fullEngineLifecycle','completePipeline','studioOutsideLayout'])if(first.volume.metadata?.[key]!==undefined)common[key]=first.volume.metadata[key];
  const volume={width,height,depth,origin:[plan.x,minY,plan.z],palette,blocks:blocks.buffer,...(hasBiomes?{biomes:{palette:biomePalette,cells:biomeCells.buffer}}:{}),...(joined.regions?{regions:joined.regions}:{}),metadata:{...common,chunkArea:{width:plan.width,depth:plan.depth,chunks},...(joined.reason?{regionColumnsUnavailable:joined.reason}:{}),...(lastNoise?{noiseCache:lastNoise}:{})}};
  chunkAreaMetadataCharge(volume);
  return {...first,volume,...(lastNoise?{noiseCache:lastNoise}:{}),generationMs:performance.now()-started};
}
export function chunkAreaTransfers(result){
  const volume=result.volume,transfers=[volume.blocks];if(volume.biomes)transfers.push(volume.biomes.cells);
  if(volume.regions){transfers.push(volume.regions.cells);if(volume.regions.starts)transfers.push(volume.regions.starts,volume.regions.offsets);}
  return transfers;
}
