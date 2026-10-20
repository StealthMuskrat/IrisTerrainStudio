export class VoxelVolume {
  constructor(data) {
    const { width,height,depth,origin,palette,blocks }=data;
    if(![width,height,depth].every(n=>Number.isInteger(n)&&n>0&&n<=256)||width*height*depth>16_777_216)throw new Error('Voxel dimensions exceed the preview memory limit.');
    if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isSafeInteger))throw new Error('Voxel origin must contain exact integer world coordinates.');
    if(!Array.isArray(palette)||!palette.length||palette.length>65536||palette.some(block=>typeof block.id!=='string'))throw new Error('Voxel block palette is invalid.');
    if(!(blocks instanceof Uint16Array||blocks instanceof Uint32Array)||blocks.length!==width*height*depth)throw new Error('Voxel block coverage is incomplete.');
    for(const index of blocks)if(index>=palette.length)throw new Error('A voxel references a missing block state.');
    this.width=width;this.height=height;this.depth=depth;this.origin=origin.slice();this.palette=palette;this.blocks=blocks;this.metadata=data.metadata||{};
  }
  index(x,y,z){return x+this.width*(z+this.depth*y);}
  block(x,y,z){if(x<0||y<0||z<0||x>=this.width||y>=this.height||z>=this.depth)return null;return this.palette[this.blocks[this.index(x,y,z)]];}
  worldBlock(x,y,z){return this.block(x-this.origin[0],y-this.origin[1],z-this.origin[2]);}
  raycast(origin,direction,maxDistance=4096){
    const local=origin.map((n,i)=>n-this.origin[i]),dims=[this.width,this.height,this.depth];let enter=0,exit=maxDistance;
    for(let axis=0;axis<3;axis++){if(Math.abs(direction[axis])<1e-12){if(local[axis]<0||local[axis]>=dims[axis])return null;continue;}let a=-local[axis]/direction[axis],b=(dims[axis]-local[axis])/direction[axis];if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);}
    if(enter>exit)return null;const at=local.map((n,i)=>n+direction[i]*(enter+1e-7)),cell=at.map(Math.floor),step=direction.map(n=>n<0?-1:1),delta=direction.map(n=>Math.abs(n)<1e-12?Infinity:Math.abs(1/n));let t=enter;
    const next=direction.map((n,i)=>Math.abs(n)<1e-12?Infinity:enter+((step[i]>0?cell[i]+1:cell[i])-at[i])/n);
    while(t<=exit){const block=this.block(...cell);if(block&&!['minecraft:air','minecraft:cave_air','minecraft:void_air'].includes(block.id))return{x:cell[0]+this.origin[0],y:cell[1]+this.origin[1],z:cell[2]+this.origin[2],block,distance:t,metadata:this.metadata};const axis=next[0]<next[1]?(next[0]<next[2]?0:2):(next[1]<next[2]?1:2);t=next[axis];next[axis]+=delta[axis];cell[axis]+=step[axis];}
    return null;
  }
}
