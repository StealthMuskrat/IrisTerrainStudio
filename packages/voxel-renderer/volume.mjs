import{regionColumns,regionIndex}from'../shared/region-columns.mjs';
import{clipBounds,emptyClip}from'./clip.mjs';
export class VoxelVolume {
  constructor(data) {
    const { width,height,depth,origin,palette,blocks,biomes }=data;
    if(![width,depth].every(n=>Number.isInteger(n)&&n>0&&n<=256)||!Number.isInteger(height)||height<1||height>4096||width*height*depth>16_777_216)throw new Error('Voxel dimensions exceed the preview memory limit.');
    if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isSafeInteger))throw new Error('Voxel origin must contain exact integer world coordinates.');
    if(!Array.isArray(palette)||!palette.length||palette.length>65536||palette.some(block=>typeof block.id!=='string'))throw new Error('Voxel block palette is invalid.');
    if(!(blocks instanceof Uint16Array||blocks instanceof Uint32Array)||blocks.length!==width*height*depth)throw new Error('Voxel block coverage is incomplete.');
    for(const index of blocks)if(index>=palette.length)throw new Error('A voxel references a missing block state.');
    if(biomes){
      if(!Array.isArray(biomes.palette)||!biomes.palette.length||biomes.palette.length>65536||biomes.palette.some(key=>typeof key!=='string'||!key.length)||new Set(biomes.palette).size!==biomes.palette.length)throw new Error('Voxel physical biome palette is invalid.');
      if(!(biomes.cells instanceof Uint16Array)||biomes.cells.length!==blocks.length)throw new Error('Voxel physical biome coverage is incomplete.');
      for(const index of biomes.cells)if(index>=biomes.palette.length)throw new Error('A voxel references a missing physical biome.');
    }
    this.regions=regionColumns(data.regions,width,depth,height);
    this.biomes=biomes||null;
    this.width=width;this.height=height;this.depth=depth;this.origin=origin.slice();this.palette=palette;this.blocks=blocks;this.metadata=data.metadata||{};
  }
  index(x,y,z){return x+this.width*(z+this.depth*y);}
  block(x,y,z){if(x<0||y<0||z<0||x>=this.width||y>=this.height||z>=this.depth)return null;return this.palette[this.blocks[this.index(x,y,z)]];}
  biome(x,y,z){if(!this.biomes||!Number.isInteger(x)||!Number.isInteger(y)||!Number.isInteger(z)||x<0||y<0||z<0||x>=this.width||y>=this.height||z>=this.depth)return null;return this.biomes.palette[this.biomes.cells[this.index(x,y,z)]];}
  region(x,y,z){if(!this.regions||![x,y,z].every(Number.isInteger)||x<0||y<0||z<0||x>=this.width||y>=this.height||z>=this.depth)return null;return this.regions.palette[regionIndex(this.regions,x+this.width*z,y)];}
  worldBiome(x,y,z){return this.biome(x-this.origin[0],y-this.origin[1],z-this.origin[2]);}
  worldBlock(x,y,z){return this.block(x-this.origin[0],y-this.origin[1],z-this.origin[2]);}
  raycast(origin,direction,maxDistance=4096,{clip=null,visible}={}){
    if(!Array.isArray(origin)||!Array.isArray(direction)||origin.length!==3||direction.length!==3||![...origin,...direction,maxDistance].every(Number.isFinite)||maxDistance<=0||direction.every(value=>Math.abs(value)<1e-12))throw new Error('Voxel picking requires a finite ray, nonzero direction and positive distance.');
    const bounds=clipBounds(this,clip);if(emptyClip(bounds))return null;
    const local=origin.map((n,i)=>n-this.origin[i]);let enter=0,exit=maxDistance;
    for(let axis=0;axis<3;axis++){
      if(Math.abs(direction[axis])<1e-12){if(local[axis]<bounds.min[axis]||local[axis]>=bounds.max[axis])return null;continue;}
      let a=(bounds.min[axis]-local[axis])/direction[axis],b=(bounds.max[axis]-local[axis])/direction[axis];if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);
    }
    if(enter>=exit)return null;
    const at=local.map((n,i)=>n+direction[i]*(enter+1e-7)),cell=at.map(Math.floor),step=direction.map(n=>n<0?-1:1),delta=direction.map(n=>Math.abs(n)<1e-12?Infinity:Math.abs(1/n));let t=enter;
    const next=direction.map((n,i)=>Math.abs(n)<1e-12?Infinity:enter+((step[i]>0?cell[i]+1:cell[i])-at[i])/n);
    while(t<exit&&cell.every((value,axis)=>value>=bounds.min[axis]&&value<bounds.max[axis])){
      const index=this.blocks[this.index(...cell)],block=this.palette[index];
      if(!['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(block.id)&&(!visible||visible(block,index)))return{x:cell[0]+this.origin[0],y:cell[1]+this.origin[1],z:cell[2]+this.origin[2],block,biome:this.biome(...cell),region:this.region(...cell),regionDimension:this.regions?.dimension??null,distance:t,metadata:this.metadata};
      const axis=next[0]<next[1]?(next[0]<next[2]?0:2):(next[1]<next[2]?1:2);t=next[axis];next[axis]+=delta[axis];cell[axis]+=step[axis];
    }
    return null;
  }
}
