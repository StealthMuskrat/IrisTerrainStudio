import{localClip,emptyClip}from'./clip.mjs';import{selectedModelParts}from'../resource-packs/model-selection.mjs';import{blockModelOffset}from'../resource-packs/model-offset.mjs';import{blockTint,biomeTint,rgbaTint}from'../resource-packs/biome-tints.mjs';import{emptyRenderProfile}from'../resource-packs/render-inputs.mjs';import{fluidQuads}from'./fluids.mjs';import{shouldRenderBlockFace}from'../resource-packs/face-culling.mjs';import{faceParameters}from'../resource-packs/face-materials.mjs';
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
class Materials{
  constructor(){this.pages=[];this.count=0;}
  write(quad){const slot=this.count%1024;if(!slot)this.pages.push(new Float32Array(4*1024));this.pages.at(-1).set(faceParameters(quad),slot*4);this.count++;}
  finish(){const out=new Float32Array(this.count*4);for(let i=0;i<this.pages.length;i++)out.set(this.pages[i].subarray(0,Math.min(1024,this.count-i*1024)*4),i*4096);this.pages=[];return out;}
}
// Four float32 xyz/uv corners plus tint alpha, and one stored voxel owner per emitted quad.
class PickRecords {
  constructor(){this.pages=[];this.ownerPages=[];this.count=0;}
  write(quad,owner,offset,color=quad.color){
    const slot=this.count%1024;if(!slot){this.pages.push(new Float32Array(21*1024));this.ownerPages.push(new Uint32Array(1024));}
    const page=this.pages.at(-1),at=slot*21;for(let i=0;i<4;i++){for(let axis=0;axis<3;axis++)page[at+i*5+axis]=quad.positions[i][axis]+offset[axis];page.set(quad.uv[i],at+i*5+3);}page[at+20]=color[3];this.ownerPages.at(-1)[slot]=owner;this.count++;
  }
  finish(){
    const quads=new Float32Array(this.count*21),owners=new Uint32Array(this.count);for(let i=0;i<this.pages.length;i++){const count=Math.min(1024,this.count-i*1024);quads.set(this.pages[i].subarray(0,count*21),i*1024*21);owners.set(this.ownerPages[i].subarray(0,count),i*1024);}this.pages=[];this.ownerPages=[];return{quads:quads.buffer,owners:owners.buffer};
  }
}
// Cache only one immutable voxel/model/atlas snapshot. A one-cell clip halo is part of
// each key: removing an adjacent section must expose the newly visible boundary faces.
const CACHE_BYTES=64*1024*1024,CACHE_ENTRIES=4096;
class SectionCache {
  constructor(limit=CACHE_BYTES){if(!Number.isSafeInteger(limit)||limit<0||limit>CACHE_BYTES)throw new Error('Invalid section mesh cache budget.');this.limit=limit;this.entries=new Map();this.bytes=0;}
  get(key){const entry=this.entries.get(key);if(entry){this.entries.delete(key);this.entries.set(key,entry);}return entry;}
  put(key,mesh){
    const bytes=256+(mesh.diagnostics?.length??0)*1024+mesh.opaque.byteLength+mesh.transparent.byteLength+mesh.materials.opaque.byteLength+mesh.materials.transparent.byteLength+Object.values(mesh.picking).reduce((sum,pick)=>sum+pick.quads.byteLength+pick.owners.byteLength,0);
    if(bytes>this.limit)return;
    while(this.entries.size&&(this.bytes+bytes>this.limit||this.entries.size>=CACHE_ENTRIES)){const oldest=this.entries.keys().next().value;this.bytes-=this.entries.get(oldest).bytes;this.entries.delete(oldest);}
    this.entries.set(key,{mesh,bytes});this.bytes+=bytes;
  }
}
let revision=0,snapshot=null,sectionCache=null;
self.onmessage=async({data})=>{
  if(data.kind==='cancel'){revision++;return;}const job=++revision;
  try{
    if(data.blocks){
      const origin=data.origin??[0,0,0];
      if(!Array.isArray(origin)||origin.length!==3||!origin.every(Number.isSafeInteger))throw new Error('Mesh origin requires three exact world coordinates.');
      const cellColors=data.cellColors;
      if(cellColors){
        const {palette:colors,indices}=cellColors;
        if(!(colors instanceof Float32Array)||!colors.length||colors.length%4||colors.length>65536*4||indices!=null&&(!(indices instanceof Uint16Array)||indices.length!==data.blocks.length))throw new Error('Cell color coverage is invalid.');
        if(!indices&&colors.length!==data.palette.length*4)throw new Error('Block identity colors require complete palette coverage.');
        for(let i=0;i<colors.length;i++)if(!Number.isFinite(colors[i])||colors[i]<0||colors[i]>1||i%4===3&&colors[i]!==1)throw new Error('Cell identity colors must be finite and opaque.');
      }
      const nextCache=new SectionCache(data.cacheByteLimit);snapshot={width:data.width,height:data.height,depth:data.depth,blocks:data.blocks,palette:data.palette,models:data.models,origin,cellColors,colorRows:new Map(),biomes:data.biomes,tintInput:data.tintInput,fluidMaterials:data.fluidMaterials};sectionCache=nextCache;
    }
    if(!snapshot)throw new Error('Initialize a stored voxel snapshot before meshing sections.');
    const input=snapshot,cache=sectionCache,{width,height,depth,blocks,palette,models,origin}=input,{id}=data,clip=localClip(input,data.clip),center=[width/2,height/2,depth/2],parts=[];
    const minimum=clip?.min??[0,0,0],maximum=clip?.max??[width,height,depth],start=minimum.map((value,axis)=>Math.floor((value+origin[axis])/16)*16-origin[axis]);
    const inside=(x,y,z)=>x>=minimum[0]&&y>=minimum[1]&&z>=minimum[2]&&x<maximum[0]&&y<maximum[1]&&z<maximum[2];
    const stored=(x,y,z)=>x>=0&&y>=0&&z>=0&&x<width&&y<height&&z<depth,biomeAt=(x,y,z)=>{x-=origin[0];y-=origin[1];z-=origin[2];return stored(x,y,z)&&input.biomes?input.biomes.palette[input.biomes.cells[x+width*(z+depth*y)]]:null;};
    const sectionTotal=start.reduce((total,value,axis)=>total*Math.ceil((maximum[axis]-value)/16),1),stats={reused:0,rebuilt:0,cells:0};let sections=0,faces=0;
    const range=()=>({first:0,count:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
    if(!emptyClip(clip))for(let sy=start[1];sy<maximum[1];sy+=16)for(let sz=start[2];sz<maximum[2];sz+=16)for(let sx=start[0];sx<maximum[0];sx+=16){
      const base=[sx,sy,sz],haloMin=base.map((value,axis)=>Math.max(value-1,minimum[axis])),haloMax=base.map((value,axis)=>Math.min(value+17,maximum[axis]));
      const key=[...base,...haloMin,...haloMax].join(','),cached=cache.get(key);let part=cached?.mesh;
      if(part)stats.reused++;
      else{
        stats.rebuilt++;
        const opaque=new Vertices(),transparent=new Vertices(),pickOpaque=new PickRecords(),pickTransparent=new PickRecords(),materialOpaque=new Materials(),materialTransparent=new Materials(),section={section:base.map((value,axis)=>(value+origin[axis])/16),opaque:range(),transparent:range()},diagnosticRows=new Map(),report=(block,error)=>{const key=block.id+':'+error.message;if(diagnosticRows.size<32&&!diagnosticRows.has(key))diagnosticRows.set(key,{block:block.id,message:error.message.slice(0,512)});};let count=0;
        for(let y=Math.max(sy,minimum[1]);y<Math.min(sy+16,maximum[1]);y++)for(let z=Math.max(sz,minimum[2]);z<Math.min(sz+16,maximum[2]);z++)for(let x=Math.max(sx,minimum[0]);x<Math.min(sx+16,maximum[0]);x++){
          stats.cells++;const owner=x+width*(z+depth*y),index=blocks[owner],block=palette[index],model=models[index],position=[x+origin[0],y+origin[1],z+origin[2]],parts=!model?[]:Array.isArray(model)?[model]:selectedModelParts(model,block,position),hasFluid=block.renderProfile?.fluid!=='empty'&&input.fluidMaterials?.[block.renderProfile?.fluid];if(!parts.some(p=>p.length)&&!hasFluid)continue;const displacement=block.modelOffset?blockModelOffset(block.modelOffset,position):[0,0,0],tintCache=new Map();
          let cellColor;
          if(input.cellColors){const colorIndex=input.cellColors.indices?.[owner]??index,at=colorIndex*4;if(at+4>input.cellColors.palette.length)throw new Error('A visible cell references a missing identity color.');cellColor=input.colorRows.get(colorIndex);if(!cellColor){cellColor=Array.from(input.cellColors.palette.subarray(at,at+4));input.colorRows.set(colorIndex,cellColor);}}
          if(hasFluid){try{const sample=(dx,dy,dz)=>{const a=x+dx,b=y+dy,c=z+dz;if(!stored(a,b,c))return emptyRenderProfile;const neighbor=palette[blocks[a+width*(c+depth*b)]];if(!neighbor.renderProfile)throw new Error(`Adjacent ${neighbor.id} needs native fluid rendering metadata.`);return neighbor.renderProfile;},color=block.renderProfile.fluid==='water'?rgbaTint(biomeTint('water',biomeAt(...position),position,input.tintInput?.maps??{})):[1,1,1,1];parts.push(fluidQuads(block.renderProfile,sample,input.fluidMaterials[block.renderProfile.fluid],position,color,(dx,dy,dz)=>inside(x+dx,y+dy,z+dz)));}catch(error){report(block,error);}}
          for(const part of parts)for(const quad of part){
            if(quad.cull){const d=directions[quad.cull],nx=x+d[0],ny=y+d[1],nz=z+d[2];if(inside(nx,ny,nz)){const neighbor=palette[blocks[nx+width*(nz+depth*ny)]];if(block.renderProfile&&neighbor.renderProfile?!shouldRenderBlockFace(block,neighbor,quad.cull):neighbor.solid===true||block.cullSameMaterial===true&&neighbor.id===block.id)continue;}}
            let color=cellColor??quad.color;if(!cellColor&&quad.tintIndex!=null){try{if(!tintCache.has(quad.tintIndex))tintCache.set(quad.tintIndex,blockTint(block,quad.tintIndex,position,biomeAt,input.tintInput));color=tintCache.get(quad.tintIndex);}catch(error){report(block,error);continue;}}
            if(++count+faces>250000)throw new Error('Visible geometry exceeds the preview mesh budget. Reduce the area or use clipping.');
            const blend=quad.transparency==='blend',target=blend?transparent:opaque,bounds=blend?section.transparent:section.opaque,offset=[x,y,z].map((value,axis)=>Math.fround(value-center[axis]+(quad.fluid?0:Math.fround(displacement[axis]))));bounds.count+=6;
            for(const point of quad.positions)for(let axis=0;axis<3;axis++){const value=Math.fround(point[axis]+offset[axis]);if(!Number.isFinite(value))throw new Error('Model mesh contains a nonfinite vertex.');bounds.min[axis]=Math.min(bounds.min[axis],value);bounds.max[axis]=Math.max(bounds.max[axis],value);}
            (blend?pickTransparent:pickOpaque).write(quad,owner,offset,color);(blend?materialTransparent:materialOpaque).write(quad);
            for(const vertex of[0,1,2,0,2,3])target.write(quad.positions[vertex],quad.normal,color,quad.uv[vertex],...offset);
          }
        }
        part={section,faces:count,diagnostics:[...diagnosticRows.values()],opaque:opaque.finish(),transparent:transparent.finish(),materials:{opaque:materialOpaque.finish(),transparent:materialTransparent.finish()},picking:{opaque:pickOpaque.finish(),transparent:pickTransparent.finish()}};cache.put(key,part);
      }
      faces+=part.faces;if(faces>250000)throw new Error('Visible geometry exceeds the preview mesh budget. Reduce the area or use clipping.');parts.push(part);
      if((++sections&7)===0){self.postMessage({kind:'progress',id,progress:sections/Math.max(1,sectionTotal)});await new Promise(resolve=>setTimeout(resolve,0));if(job!==revision)return;}
    }
    if(job!==revision)return;
    // Flatten for the existing GPU/picker ABI. Cached section buffers remain owned by
    // this worker; only fresh combined buffers are transferred to the renderer.
    const diagnostics=[...new Map(parts.flatMap(p=>p.diagnostics??[]).map(row=>[row.block+':'+row.message,row])).values()].slice(0,128),output={kind:'mesh',id,faces,ranges:[],picking:{},materials:{},diagnostics,stats:{...stats,entries:cache.entries.size,bytes:cache.bytes,byteLimit:cache.limit}};
    for(const kind of['opaque','transparent']){
      const count=parts.reduce((sum,part)=>sum+part.section[kind].count,0),vertices=new Float32Array(count*12),quads=new Float32Array(count/6*21),owners=new Uint32Array(count/6),materials=new Float32Array(count/6*4);let first=0;
      for(const part of parts){vertices.set(part[kind],first*12);materials.set(part.materials[kind],first/6*4);quads.set(new Float32Array(part.picking[kind].quads),first/6*21);owners.set(new Uint32Array(part.picking[kind].owners),first/6);first+=part.section[kind].count;}
      output[kind]=vertices.buffer;output.materials[kind]=materials.buffer;output.picking[kind]={quads:quads.buffer,owners:owners.buffer};
    }
    let opaqueFirst=0,transparentFirst=0;
    for(const part of parts){if(part.faces)output.ranges.push({section:part.section.section,opaque:{...part.section.opaque,first:opaqueFirst},transparent:{...part.section.transparent,first:transparentFirst}});opaqueFirst+=part.section.opaque.count;transparentFirst+=part.section.transparent.count;}
    self.postMessage(output,[output.opaque,output.transparent,output.materials.opaque,output.materials.transparent,output.picking.opaque.quads,output.picking.opaque.owners,output.picking.transparent.quads,output.picking.transparent.owners]);
  }catch(error){if(job===revision)self.postMessage({id:data.id,error:error.message||String(error)});}
};
