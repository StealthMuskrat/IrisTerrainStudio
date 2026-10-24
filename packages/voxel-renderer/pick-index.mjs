// Spatial buckets contain emitted quads exactly once. Actual corner bounds retain
// arbitrary rotations and model overhangs; this index never infers voxel occupancy.
const STRIDE=21,BINS=4,MAX_BYTES=10*1024*1024;
export function buildPickIndex(quads,ranges){
  const faces=quads.length/STRIDE;if(faces<64)return null;
  const capacity=Math.min(faces,ranges.length*64),bytes=capacity*32+faces*4+ranges.length*8;
  if(bytes>MAX_BYTES)throw new Error('Mesh picking spatial index exceeds its 10 MiB budget.');
  const bounds=new Float32Array(capacity*6),spans=new Uint32Array(capacity*2),order=new Uint32Array(faces),sections=new Uint32Array(ranges.length*2);let used=0,cursor=0;
  for(let section=0;section<ranges.length;section++){
    const range=ranges[section];sections[section*2]=used;
    const first=range.first/6,count=range.count/6;if(!count)continue;
    const counts=new Uint32Array(64),bins=new Uint8Array(count),starts=new Uint32Array(64),buckets=new Uint32Array(64),positions=new Uint32Array(64);
    for(let i=0;i<count;i++){
      let bin=0;for(let axis=0;axis<3;axis++){
        let center=0;for(let corner=0;corner<4;corner++)center+=quads[(first+i)*STRIDE+corner*5+axis]*.25;
        const span=range.max[axis]-range.min[axis],coordinate=count<=32||span===0?0:Math.max(0,Math.min(3,Math.floor((center-range.min[axis])*BINS/span)));bin|=coordinate<<(axis*2);
      }bins[i]=bin;counts[bin]++;
    }
    for(let bin=0;bin<64;bin++)if(counts[bin]){
      if(used>=capacity||cursor+counts[bin]>faces)throw new Error('Mesh picking ranges exceed their indexed coverage.');
      buckets[bin]=used;starts[bin]=cursor;spans[used*2]=cursor;spans[used*2+1]=counts[bin];bounds.fill(Infinity,used*6,used*6+3);bounds.fill(-Infinity,used*6+3,used*6+6);cursor+=counts[bin];used++;
    }
    sections[section*2+1]=used-sections[section*2];
    for(let i=0;i<count;i++){
      const bin=bins[i],face=first+i,bucket=buckets[bin],at=bucket*6;order[starts[bin]+positions[bin]++]=face;
      for(let corner=0;corner<4;corner++)for(let axis=0;axis<3;axis++){const value=quads[face*STRIDE+corner*5+axis];if(!Number.isFinite(value))throw new Error('Picking geometry contains a nonfinite vertex.');bounds[at+axis]=Math.min(bounds[at+axis],value);bounds[at+3+axis]=Math.max(bounds[at+3+axis],value);}
    }
  }
  if(cursor!==faces)throw new Error('Mesh picking ranges do not cover their indexed geometry.');
  return{bounds,spans,order,sections,count:used,bytes};
}
export function indexedBoundsEntry(origin,direction,bounds,at,limit){
  let near=0,far=limit;
  for(let axis=0;axis<3;axis++){
    if(Math.abs(direction[axis])<1e-15){if(origin[axis]<bounds[at+axis]||origin[axis]>bounds[at+axis+3])return null;continue;}
    let a=(bounds[at+axis]-origin[axis])/direction[axis],b=(bounds[at+axis+3]-origin[axis])/direction[axis];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
  }return near;
}
