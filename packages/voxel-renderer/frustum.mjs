// Column-major matrices with WebGPU clip depth 0 <= z <= w. Bounds are mesh-local,
// including actual emitted model vertices rather than assumed unit cubes.
export function frustumPlanes(matrix){
  if(matrix.length!==16||![...matrix].every(Number.isFinite))throw new Error('A finite camera matrix is required for mesh culling.');
  const row=r=>[matrix[r],matrix[4+r],matrix[8+r],matrix[12+r]],rows=[0,1,2,3].map(row),combine=(a,b,sign)=>a.map((value,i)=>value+sign*b[i]);
  return[combine(rows[3],rows[0],1),combine(rows[3],rows[0],-1),combine(rows[3],rows[1],1),combine(rows[3],rows[1],-1),rows[2],combine(rows[3],rows[2],-1)].map(plane=>{
    const length=Math.hypot(...plane.slice(0,3));return length?plane.map(value=>value/length):plane;
  });
}
export function boundsVisible(bounds,planes){
  return planes.every(plane=>plane[3]+plane.slice(0,3).reduce((sum,value,axis)=>sum+value*(value>=0?bounds.max[axis]:bounds.min[axis]),0)>=-1e-5);
}
export function visibleMeshRanges(ranges,matrix){
  const planes=frustumPlanes(matrix),opaque=[],transparent=[];
  for(const range of ranges){if(range.opaque?.count&&boundsVisible(range.opaque,planes))opaque.push(range.opaque);if(range.transparent?.count&&boundsVisible(range.transparent,planes))transparent.push(range.transparent);}
  return{opaque,transparent};
}
