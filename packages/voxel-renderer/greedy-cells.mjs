import{CELL_FACES}from'./cell-geometry.mjs';
// The high owner bit denotes a rectangle of diagnostic cells. Volume admission caps
// owners at 2^24; no additional per-face transport buffers or cell-owner arrays are needed.
export const MERGED_CELL_OWNER=0x80000000;
export function emitGreedyCells(input,minimum,maximum,sectionMin,sectionMax,center,emit){
  const{width,depth,blocks,palette,cellColors}=input,mask=new Uint32Array(256);
  const inside=p=>p.every((value,axis)=>value>=minimum[axis]&&value<maximum[axis]);
  const owner=p=>p[0]+width*(p[2]+depth*p[1]);
  const occupied=p=>palette[blocks[owner(p)]]?.solid===true;
  for(const[cull,normal,corners]of CELL_FACES){
    const axis=normal.findIndex(value=>value!==0),[u,v]=[0,1,2].filter(value=>value!==axis),columns=sectionMax[u]-sectionMin[u],rows=sectionMax[v]-sectionMin[v];
    for(let slice=sectionMin[axis];slice<sectionMax[axis];slice++){
      mask.fill(0);
      for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
        const p=[];p[axis]=slice;p[u]=sectionMin[u]+i;p[v]=sectionMin[v]+j;if(!occupied(p))continue;
        const neighbor=p.map((value,a)=>value+normal[a]);if(inside(neighbor)&&occupied(neighbor))continue;
        const cell=owner(p),colorIndex=cellColors.indices?.[cell]??cellColors.columnIndices?.[cell%(width*depth)]??blocks[cell];if((colorIndex+1)*4>cellColors.palette.length)throw new Error('A visible cell references a missing identity color.');mask[i+j*columns]=colorIndex+1;
      }
      for(let j=0;j<rows;j++)for(let i=0;i<columns;){
        const key=mask[i+j*columns];if(!key){i++;continue;}
        let w=1,h=1;while(i+w<columns&&mask[i+w+j*columns]===key)w++;
        outer:while(j+h<rows){for(let dx=0;dx<w;dx++)if(mask[i+dx+(j+h)*columns]!==key)break outer;h++;}
        for(let dy=0;dy<h;dy++)mask.fill(0,i+(j+dy)*columns,i+w+(j+dy)*columns);
        const p=[];p[axis]=slice;p[u]=sectionMin[u]+i;p[v]=sectionMin[v]+j;
        const positions=corners.map(corner=>corner.map((value,a)=>a===u?value*w:a===v?value*h:value)),color=Array.from(cellColors.palette.subarray((key-1)*4,key*4));
        emit({cull,normal,positions,uv:[[.5,.5],[.5,.5],[.5,.5],[.5,.5]],color,transparency:'opaque'},owner(p),p.map((value,a)=>value-center[a]),color,w*h,w*h>1);i+=w;
      }
    }
  }
}
// Resolve only the chosen merged face. Ordinary models retain their exact owner/quad.
export function pickGreedyCell(volume,owner,points,normal,point){
  const dimensions=[volume.width,volume.height,volume.depth],center=dimensions.map(value=>value/2),axis=normal.findIndex(value=>Math.abs(value)===1);
  if(axis<0||normal.some((value,a)=>a!==axis&&value!==0))throw new Error('Merged cell picking requires an axis-aligned face.');
  const cell=[owner%volume.width,Math.floor(owner/(volume.width*volume.depth)),Math.floor(owner/volume.width)%volume.depth],min=[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))+center[a]),max=[0,1,2].map(a=>Math.max(...points.map(p=>p[a]))+center[a]);
  if(owner>=volume.blocks.length)throw new Error('Merged cell picking owner is invalid.');
  for(let a=0;a<3;a++){
    if(!Number.isInteger(min[a])||!Number.isInteger(max[a])||min[a]<0||max[a]>dimensions[a]||a===axis&&(min[a]!==max[a]||min[a]!==cell[a]+(normal[a]>0?1:0))||a!==axis&&(max[a]<=min[a]||cell[a]!==min[a]))throw new Error('Merged cell picking bounds are invalid.');
    if(a!==axis)cell[a]=Math.max(min[a],Math.min(max[a]-1,Math.floor(point[a]+center[a])));
  }
  const quad=points.map(p=>p.map((value,a)=>a===axis?value:cell[a]-center[a]+(value+center[a]===max[a]?1:0)));
  return{owner:cell[0]+volume.width*(cell[2]+volume.depth*cell[1]),quad};
}
