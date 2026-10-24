import {VoxelVolume} from './volume.mjs';

/** Slice already validated native output. No engine calls, interpolation, or missing-biome defaults. */
export function volumeBiomeSlice(volume,worldY){
  if(!(volume instanceof VoxelVolume)||!volume.biomes)throw new Error('This generated volume has no physical biome data.');
  const y=worldY-volume.origin[1];
  if(!Number.isSafeInteger(worldY)||y<0||y>=volume.height)throw new Error(`Biome Slice Y must be within ${volume.origin[1]}..${volume.origin[1]+volume.height-1}.`);
  const length=volume.width*volume.depth,start=y*length,values=Float64Array.from(volume.biomes.cells.subarray(start,start+length));
  let min=Infinity,max=-Infinity;for(const value of values){min=Math.min(min,value);max=Math.max(max,value);}
  return {field:'voxel-biome-slice',scope:'iris-generated-volume-biomes-development',values,width:volume.width,height:volume.depth,x:volume.origin[0]+volume.width/2,y:worldY,z:volume.origin[2]+volume.depth/2,span:volume.width,depth:volume.depth,min,max,categories:volume.biomes.palette.slice(),seed:volume.metadata.seed,sourceCommit:volume.metadata.sourceCommit,completePipeline:volume.metadata.completePipeline===true,sourceScope:volume.metadata.scope};
}
