// Whole-voxel, half-open bounds. Sections only select stored cells; they never edit generation data.
export function localClip(volume,clip){
  if(clip==null)return null;const dimensions=[volume.width,volume.height,volume.depth];
  if(!Array.isArray(clip.min)||!Array.isArray(clip.max)||clip.min.length!==3||clip.max.length!==3||![...clip.min,...clip.max].every(Number.isSafeInteger))throw new Error('Cross-section bounds must contain integer voxel coordinates.');
  const min=clip.min.slice(),max=clip.max.slice();
  if(dimensions.some((size,axis)=>min[axis]<0||max[axis]>size||min[axis]>max[axis]))throw new Error('Cross-section bounds exceed the stored volume.');
  return{min,max};
}
export function sectionSettings(value={}){
  const axis=value.axis??'off',mode=value.mode??'slice',position=value.position??0;
  if(!['off','x','y','z'].includes(axis)||!['slice','lower','upper'].includes(mode)||!Number.isSafeInteger(position))throw new Error('Choose an X, Y or Z section, an integer world position and a supported section mode.');
  return{axis,mode,position};
}
export function sectionClip(volume,value){
  const section=sectionSettings(value);if(section.axis==='off')return null;
  const axis={x:0,y:1,z:2}[section.axis],dimensions=[volume.width,volume.height,volume.depth],size=dimensions[axis],coordinate=section.position-volume.origin[axis];
  const min=[0,0,0],max=dimensions.slice(),clamp=value=>Math.min(size,Math.max(0,value));
  if(section.mode==='slice'){min[axis]=clamp(coordinate);max[axis]=clamp(coordinate+1);}
  else if(section.mode==='lower')max[axis]=clamp(coordinate+1);else min[axis]=clamp(coordinate);
  return{min,max};
}
export function clipBounds(volume,clip){return localClip(volume,clip)??{min:[0,0,0],max:[volume.width,volume.height,volume.depth]};}
export function emptyClip(clip){return !!clip&&clip.min.some((value,axis)=>value===clip.max[axis]);}
export function clipCenter(volume,clip){const bounds=clipBounds(volume,clip);if(emptyClip(bounds))throw new Error('This cross-section contains no stored cells.');return bounds.min.map((value,axis)=>volume.origin[axis]+(value+bounds.max[axis])/2);}
