// Pinned Minecraft 26.3 PackFormat/OverlayMetadataSection behavior. No format conversion.
export const RESOURCE_TARGET=Object.freeze({minecraftVersion:'26.3',format:Object.freeze([97,1])});
const MAX_INT=2147483647,own=(o,k)=>Object.hasOwn(o,k),object=(v,label)=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(`Invalid ${label}.`);return v;};
const integer=(v,label)=>{if(!Number.isInteger(v)||v<0||v>MAX_INT)throw new Error(`Invalid ${label}.`);return v;};
const compare=(a,b)=>a[0]-b[0]||a[1]-b[1];
function version(value,upper=false){const row=Array.isArray(value)?value:[value];if(!row.length||row.length>256)throw new Error('Invalid resource-pack format version.');row.forEach(v=>integer(v,'resource-pack format version'));return[row[0],row.length>1?row[1]:upper?MAX_INT:0];}
function oldRange(value){let a,b;if(Number.isInteger(value))a=b=value;else if(Array.isArray(value)&&value.length===2)[a,b]=value;else{object(value,'format range');a=value.min_inclusive;b=value.max_inclusive;}integer(a,'format minimum');integer(b,'format maximum');if(a>b)throw new Error('Reversed resource-pack format range.');return[a,b];}
function descriptor(raw,overlay){
  object(raw,'resource-pack format descriptor');const oldKey=overlay?'formats':'supported_formats';
  return{min:own(raw,'min_format')?version(raw.min_format):null,max:own(raw,'max_format')?version(raw.max_format,true):null,old:own(raw,oldKey)?oldRange(raw[oldKey]):null,main:overlay?null:own(raw,'pack_format')?integer(raw.pack_format,'pack_format'):null};
}
function range(d,pack,requireOld=false){
  if(!!d.min!==!!d.max)throw new Error('Declare both min_format and max_format.');
  if(requireOld&&!d.old)throw new Error('Every overlay needs formats when any overlay includes formats through 64.');
  const mainInRange=(lo,hi)=>{if(d.main===null||d.main<lo||d.main>hi||d.main<15)throw new Error('pack_format must be within the declared range and at least 15 for a ranged pack.');};
  if(d.min){
    if(compare(d.min,d.max)>0)throw new Error('min_format exceeds max_format.');
    if(d.min[0]>64&&!requireOld){if(d.old)throw new Error('formats/supported_formats is deprecated above resource format 64.');if(pack&&d.main!==null)mainInRange(d.min[0],d.max[0]);}
    else{if(!d.old||d.old[0]!==d.min[0]||d.old[1]!==d.max[0]&&d.old[1]!==64)throw new Error('Legacy and current resource-pack format declarations disagree.');if(pack)mainInRange(d.min[0],d.max[0]);}
    return[d.min,d.max];
  }
  if(d.old){if(d.old[1]>64)throw new Error('Formats above 64 require min_format and max_format.');if(pack)mainInRange(...d.old);return d.old.map(v=>[v,0]);}
  if(pack&&d.main!==null){if(d.main>64)throw new Error('Formats above 64 require min_format and max_format.');return[[d.main,0],[d.main,0]];}
  throw new Error('Resource-pack format information is missing.');
}
export function resolvePackTarget(metadata,{requireFormat=false}={}){
  object(metadata,'resource-pack metadata');let declared=null;
  if(metadata.pack&&['pack_format','min_format','max_format','supported_formats'].some(k=>own(metadata.pack,k)))declared=range(descriptor(metadata.pack,false),true);
  else if(requireFormat)throw new Error('Resource-pack format information is missing.');
  const overlays=[];
  if(own(metadata,'overlays')){
    const section=object(metadata.overlays,'overlays');if(!Array.isArray(section.entries)||section.entries.length>256)throw new Error('Expected at most 256 resource-pack overlay entries.');
    const rows=section.entries.map(raw=>{object(raw,'overlay');if(typeof raw.directory!=='string'||!/^[-_a-zA-Z0-9.]+$/.test(raw.directory)||raw.directory==='.'||raw.directory==='..')throw new Error('Invalid resource-pack overlay directory.');return{directory:raw.directory,d:descriptor(raw,true)};});
    const requireOld=rows.some(({d})=>Math.min(d.min?.[0]??MAX_INT,d.old?.[0]??MAX_INT)<=64);
    for(const{directory,d}of rows){if(!d.min&&!d.max&&!d.old)continue;const limits=range(d,false,requireOld),applicable=compare(limits[0],RESOURCE_TARGET.format)<=0&&compare(RESOURCE_TARGET.format,limits[1])<=0;overlays.push({directory,range:limits,applicable});}
  }
  return{...RESOURCE_TARGET,declaredRange:declared,compatible:declared?compare(declared[0],RESOURCE_TARGET.format)<=0&&compare(RESOURCE_TARGET.format,declared[1])<=0:null,overlays};
}
