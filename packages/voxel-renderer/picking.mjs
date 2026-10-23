import{buildPickIndex,indexedBoundsEntry}from'./pick-index.mjs';
import{MERGED_CELL_OWNER,pickGreedyCell}from'./greedy-cells.mjs';
import{meshMaterialRows,meshTilingRows}from'./mesh-materials.mjs';
import{repeatedSpriteUv}from'./greedy-textured.mjs';
import{describeFaceParameters}from'../resource-packs/face-materials.mjs';
const STRIDE=21,MAX_BYTES=24*1024*1024;
const sub=(a,b)=>a.map((value,i)=>value-b[i]),dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function boundsEntry(origin,direction,bounds,limit){
  let near=0,far=limit;
  for(let axis=0;axis<3;axis++){
    if(Math.abs(direction[axis])<1e-15){if(origin[axis]<bounds.min[axis]||origin[axis]>bounds.max[axis])return null;continue;}
    let a=(bounds.min[axis]-origin[axis])/direction[axis],b=(bounds.max[axis]-origin[axis])/direction[axis];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
  }
  return near;
}
function triangle(origin,direction,vertices,twoSided,limit){
  const [a,b,c]=vertices,e1=sub(b,a),e2=sub(c,a),h=cross(direction,e2),det=dot(e1,h);
  if(twoSided?Math.abs(det)<1e-12:det<1e-12)return null;
  const inverse=1/det,s=sub(origin,a),u=dot(s,h)*inverse;if(u<0||u>1)return null;
  const q=cross(s,e1),v=dot(direction,q)*inverse;if(v<0||u+v>1)return null;
  const distance=dot(e2,q)*inverse;if(distance<0||distance>=limit)return null;
  const n=cross(e1,e2),length=Math.hypot(...n);return{distance,weights:[1-u-v,u,v],normal:n.map(value=>value/length),frontFace:det>0};
}

// Owned, compact records from exactly the faces emitted by the current mesh worker. No voxel
// occupancy approximation or registry traversal. Sections reject unrelated geometry before triangles.
export class MeshPicker{
  constructor(volume,mesh){
    this.materials=mesh.materials?meshMaterialRows(mesh):null;this.tiling=mesh.materials?meshTilingRows(mesh):null;this.volume=volume;this.cellGreedy=mesh.cellGreedy===true||mesh.texturedGreedy===true;this.ranges=mesh.ranges;this.offset=[volume.width/2,volume.height/2,volume.depth/2].map((value,axis)=>value+volume.origin[axis]);this.groups={};let bytes=0,faces=0;
    for(const name of ['opaque','transparent']){
      const input=mesh.picking?.[name];if(!input)throw new Error('Mesh picking records are missing.');
      const quads=new Float32Array(input.quads),owners=new Uint32Array(input.owners);bytes+=quads.byteLength+owners.byteLength;faces+=owners.length;
      if(quads.length!==owners.length*STRIDE||owners.length*288!==mesh[name].byteLength)throw new Error('Mesh picking coverage differs from rendered geometry.');
      this.groups[name]={quads,owners};
    }
    if(bytes>MAX_BYTES||faces>250000)throw new Error('Mesh picking exceeds its 24 MiB / 250000-face budget.');
    for(const range of this.ranges)for(const name of ['opaque','transparent']){const part=range[name];if(!Number.isSafeInteger(part.first)||!Number.isSafeInteger(part.count)||part.first<0||part.count<0||part.first%6||part.count%6||(part.first+part.count)/6>this.groups[name].owners.length)throw new Error('Invalid mesh picking range.');}
    this.indexBytes=0;for(const name of['opaque','transparent']){const group=this.groups[name];group.index=buildPickIndex(group.quads,this.ranges.map(row=>row[name]));this.indexBytes+=group.index?.bytes??0;}
    this.bytes=bytes;
  }
  raycast(origin,direction,maxDistance=4096,{alpha}={}){
    if(!Array.isArray(origin)||!Array.isArray(direction)||origin.length!==3||direction.length!==3||![...origin,...direction,maxDistance].every(Number.isFinite)||maxDistance<=0||!Math.hypot(...direction))throw new Error('Model picking requires a finite ray, nonzero direction and positive distance.');
    if(typeof alpha!=='function')throw new Error('Model picking requires the current atlas alpha sampler.');
    const length=Math.hypot(...direction);if(!Number.isFinite(length))throw new Error('Model picking direction length is not finite.');direction=direction.map(value=>value/length);origin=sub(origin,this.offset);
    const candidates=[];for(const name of['opaque','transparent']){
      const index=this.groups[name].index;
      if(index){for(let section=0;section<this.ranges.length;section++){const range=this.ranges[section][name];if(!range.count||boundsEntry(origin,direction,range,maxDistance)===null)continue;const first=index.sections[section*2],count=index.sections[section*2+1];for(let bucket=first;bucket<first+count;bucket++){const enter=indexedBoundsEntry(origin,direction,index.bounds,bucket*6,maxDistance);if(enter!==null)candidates.push({name,first:index.spans[bucket*2],count:index.spans[bucket*2+1],enter});}}}
      else for(const section of this.ranges){const range=section[name];if(!range.count)continue;const enter=boundsEntry(origin,direction,range,maxDistance);if(enter!==null)candidates.push({name,first:range.first/6,count:range.count/6,enter});}
    }
    candidates.sort((a,b)=>a.enter-b.enter);let nearest=maxDistance,result=null,quadsTested=0,trianglesTested=0,alphaSamples=0;
    for(const {name,first,count,enter}of candidates){
      if(enter>nearest)break;const {quads,owners,index:spatial}=this.groups[name];
      for(let slot=first;slot<first+count;slot++){
        const index=spatial?spatial.order[slot]:slot;
        if(++quadsTested>32768)throw new Error('Model picking exceeds the interactive face budget. Reduce the visible section.');const at=index*STRIDE,points=Array.from({length:4},(_,i)=>Array.from(quads.subarray(at+i*5,at+i*5+3)));
        for(const corners of [[0,1,2],[0,2,3]]){
          trianglesTested++;const material=this.materials?.[name],cutoff=material?.[index*4]??.01,twoSided=material?material[index*4+3]===0:name==='transparent',hit=triangle(origin,direction,corners.map(i=>points[i]),twoSided,nearest);if(!hit)continue;
          if(++alphaSamples>4096)throw new Error('Model picking exceeds the interactive alpha budget. Reduce the visible section.');
          const rawUv=[0,1].map(axis=>corners.reduce((sum,corner,i)=>sum+quads[at+corner*5+3+axis]*hit.weights[i],0)),uv=this.tiling&&material?.[index*4+3]===2?repeatedSpriteUv(rawUv,Array.from(this.tiling[name].subarray(index*4,index*4+4))):rawUv,coverage=Math.fround(Math.fround(alpha(...uv))*Math.fround(quads[at+20]));
          if(!Number.isFinite(coverage))throw new Error('The current atlas returned invalid alpha coverage.');if(coverage<cutoff)continue;
          let owner=owners[index],selectedQuad=points;if(owner&MERGED_CELL_OWNER){if(!this.cellGreedy)throw new Error('Merged cell owners require admitted unit-cube geometry.');const picked=pickGreedyCell(this.volume,owner&0x7fffffff,points,hit.normal,origin.map((value,axis)=>value+direction[axis]*hit.distance));owner=picked.owner;selectedQuad=picked.quad;}if(owner>=this.volume.blocks.length)throw new Error('Picked geometry references a missing stored voxel.');
          const x=owner%this.volume.width,z=Math.floor(owner/this.volume.width)%this.volume.depth,y=Math.floor(owner/(this.volume.width*this.volume.depth)),block=this.volume.palette[this.volume.blocks[owner]];
          nearest=hit.distance;result={x:x+this.volume.origin[0],y:y+this.volume.origin[1],z:z+this.volume.origin[2],block,biome:this.volume.biome(x,y,z),region:this.volume.region?.(x,y,z)??null,regionDimension:this.volume.regions?.dimension??null,metadata:this.volume.metadataAt?.(x,y,z)??this.volume.metadata,distance:nearest,point:origin.map((value,axis)=>value+direction[axis]*nearest+this.offset[axis]),normal:hit.normal,frontFace:hit.frontFace,quad:selectedQuad,uv,alpha:coverage,...(this.materials?{material:describeFaceParameters(this.materials[name],index)}:{})};
          Object.defineProperty(result,'meshOwner',{value:this});
        }
      }
    }
    this.lastWork={candidateRanges:candidates.length,indexBytes:this.indexBytes,quadsTested,trianglesTested,alphaSamples};return result;
  }
}
