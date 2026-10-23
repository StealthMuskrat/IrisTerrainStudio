// Native Engine.getRegion column metadata. It is not a physical biome or feature-source attribution.
export function regionColumns(value,width,depth,height){
  if(value==null)return null;
  const spans=value.scope==='native-engine-region-spans';
  if(!spans&&value.scope!=='native-engine-region-columns'||typeof value.dimension!=='string'||!value.dimension.length||value.dimension.length>1024||!Array.isArray(value.palette)||!value.palette.length||value.palette.length>(spans?4096:256)||value.palette.some(key=>typeof key!=='string'||!key.length||key.length>1024)||new Set(value.palette).size!==value.palette.length)throw new Error('Stored region columns have invalid native metadata.');
  const cells=value.cells instanceof ArrayBuffer?new Uint16Array(value.cells):value.cells;
  if(spans){
    const offsets=value.offsets instanceof ArrayBuffer?new Uint32Array(value.offsets):value.offsets,starts=value.starts instanceof ArrayBuffer?new Uint16Array(value.starts):value.starts;
    if(!Number.isInteger(height)||height<1||height>4096||value.height!==height||!(cells instanceof Uint16Array)||!(offsets instanceof Uint32Array)||!(starts instanceof Uint16Array)||offsets.length!==width*depth+1||offsets[0]!==0||offsets.at(-1)!==cells.length||cells.length!==starts.length||cells.length>65536)throw new Error('Stored vertical region coverage is incomplete.');
    for(let column=0;column<width*depth;column++){
      const start=offsets[column],end=offsets[column+1];if(end<=start||end>cells.length||starts[start]!==0)throw new Error('Stored vertical region column is invalid.');
      for(let i=start;i<end;i++)if(starts[i]>=height||i>start&&starts[i]<=starts[i-1]||cells[i]>=value.palette.length)throw new Error('Stored vertical region span is invalid.');
    }
    return cells===value.cells&&offsets===value.offsets&&starts===value.starts?value:{...value,cells,offsets,starts};
  }
  if(!(cells instanceof Uint16Array)||cells.length!==width*depth||cells.length>65536)throw new Error('Stored region column coverage is incomplete.');
  for(const index of cells)if(index>=value.palette.length)throw new Error('A stored region column references a missing region.');
  return cells===value.cells?value:{...value,cells};
}
export function regionColumnCharge(value){return value?512+2*(value.dimension.length+value.palette.reduce((sum,key)=>sum+key.length,0)):0;}
export function regionBufferBytes(value){return value?value.cells.byteLength+(value.offsets?.byteLength??0)+(value.starts?.byteLength??0):0;}
export function regionIndex(value,column,y){
  if(!value.offsets)return value.cells[column];
  let lo=value.offsets[column],hi=value.offsets[column+1];while(lo+1<hi){const mid=(lo+hi)>>>1;if(value.starts[mid]<=y)lo=mid;else hi=mid;}return value.cells[lo];
}
