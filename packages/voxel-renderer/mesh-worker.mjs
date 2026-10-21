import{localClip,emptyClip}from'./clip.mjs';
const directions={north:[0,0,-1],south:[0,0,1],west:[-1,0,0],east:[1,0,0],up:[0,1,0],down:[0,-1,0]};
// Typed pages avoid retaining millions of boxed numbers while building a mesh.
class Vertices {
  constructor(){this.pages=[];this.page=null;this.used=0;this.length=0;}
  write(position,normal,color,uv,x,y,z){
    if(!this.page||this.used+12>this.page.length){this.page=new Float32Array(12*6*1024);this.pages.push(this.page);this.used=0;}
    const out=this.page,at=this.used;
    out[at]=position[0]+x;out[at+1]=position[1]+y;out[at+2]=position[2]+z;
    out.set(normal,at+3);out.set(color,at+6);out.set(uv,at+10);this.used+=12;this.length+=12;
  }
  finish(){const out=new Float32Array(this.length);let offset=0;for(let i=0;i<this.pages.length;i++){const page=this.pages[i],count=i===this.pages.length-1?this.used:page.length;out.set(page.subarray(0,count),offset);offset+=count;}this.pages=[];this.page=null;return out;}
}
let revision=0;
self.onmessage=async({data})=>{
  if(data.kind==='cancel'){revision++;return;}const job=++revision;
  try{
    const{width,height,depth,blocks,palette,models,id}=data,clip=localClip(data,data.clip),opaque=new Vertices(),transparent=new Vertices(),center=[width/2,height/2,depth/2],origin=data.origin??[0,0,0],ranges=[];let faces=0;
    if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isSafeInteger))throw new Error('Mesh origin requires three exact world coordinates.');
    const inside=(x,y,z)=>x>=0&&y>=0&&z>=0&&x<width&&y<height&&z<depth&&(!clip||x>=clip.min[0]&&y>=clip.min[1]&&z>=clip.min[2]&&x<clip.max[0]&&y<clip.max[1]&&z<clip.max[2]);
    const minimum=clip?.min??[0,0,0],maximum=clip?.max??[width,height,depth],start=minimum.map((value,axis)=>Math.floor((value+origin[axis])/16)*16-origin[axis]);
    const sectionTotal=start.reduce((total,value,axis)=>total*Math.ceil((maximum[axis]-value)/16),1);let sections=0;
    const range=first=>({first,count:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
    if(!emptyClip(clip))for(let sy=start[1];sy<maximum[1];sy+=16)for(let sz=start[2];sz<maximum[2];sz+=16)for(let sx=start[0];sx<maximum[0];sx+=16){
      const section={section:[sx,sy,sz].map((value,axis)=>(value+origin[axis])/16),opaque:range(opaque.length/12),transparent:range(transparent.length/12)};
      for(let y=Math.max(sy,minimum[1]);y<Math.min(sy+16,maximum[1]);y++)for(let z=Math.max(sz,minimum[2]);z<Math.min(sz+16,maximum[2]);z++)for(let x=Math.max(sx,minimum[0]);x<Math.min(sx+16,maximum[0]);x++){
        const index=blocks[x+width*(z+depth*y)],block=palette[index];if(!models[index]?.length)continue;
        for(const quad of models[index]){
          if(quad.cull){const d=directions[quad.cull],nx=x+d[0],ny=y+d[1],nz=z+d[2];if(inside(nx,ny,nz)){const neighbor=palette[blocks[nx+width*(nz+depth*ny)]];if(neighbor.solid===true||block.cullSameMaterial===true&&neighbor.id===block.id)continue;}}
          if(++faces>250000)throw new Error('Visible geometry exceeds the preview mesh budget. Reduce the area or use clipping.');
          const blend=quad.transparency==='blend',target=blend?transparent:opaque,bounds=blend?section.transparent:section.opaque,offset=[x-center[0],y-center[1],z-center[2]];bounds.count+=6;
          for(const point of quad.positions)for(let axis=0;axis<3;axis++){const value=Math.fround(point[axis]+offset[axis]);if(!Number.isFinite(value))throw new Error('Model mesh contains a nonfinite vertex.');bounds.min[axis]=Math.min(bounds.min[axis],value);bounds.max[axis]=Math.max(bounds.max[axis],value);}
          for(const vertex of[0,1,2,0,2,3])target.write(quad.positions[vertex],quad.normal,quad.color,quad.uv[vertex],...offset);
        }
      }
      if(section.opaque.count||section.transparent.count)ranges.push(section);
      if((++sections&7)===0){self.postMessage({kind:'progress',id,progress:sections/Math.max(1,sectionTotal)});await new Promise(resolve=>setTimeout(resolve,0));if(job!==revision)return;}
    }
    const a=opaque.finish(),b=transparent.finish();self.postMessage({kind:'mesh',id,opaque:a.buffer,transparent:b.buffer,faces,ranges},[a.buffer,b.buffer]);
  }catch(error){self.postMessage({id:data.id,error:error.message||String(error)});}
};
