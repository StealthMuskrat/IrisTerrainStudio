// Native Engine.getRegion column metadata. It is not a physical biome or feature-source attribution.
export function regionColumns(value,width,depth){
  if(value==null)return null;
  if(value.scope!=='native-engine-region-columns'||typeof value.dimension!=='string'||!value.dimension.length||value.dimension.length>1024||!Array.isArray(value.palette)||!value.palette.length||value.palette.length>256||value.palette.some(key=>typeof key!=='string'||!key.length||key.length>1024)||new Set(value.palette).size!==value.palette.length)throw new Error('Stored region columns have invalid native metadata.');
  const cells=value.cells instanceof ArrayBuffer?new Uint16Array(value.cells):value.cells;
  if(!(cells instanceof Uint16Array)||cells.length!==width*depth||cells.length>65536)throw new Error('Stored region column coverage is incomplete.');
  for(const index of cells)if(index>=value.palette.length)throw new Error('A stored region column references a missing region.');
  return cells===value.cells?value:{...value,cells};
}
export function regionColumnCharge(value){return value?512+2*(value.dimension.length+value.palette.reduce((sum,key)=>sum+key.length,0)):0;}
