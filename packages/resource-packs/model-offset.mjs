import data from'./client-model-data.json' with{type:'json'};
import{positionModelSeed}from'./model-selection.mjs';
if(!data.modelOffsets||data.defaultStateOffsetMetadataReads!==data.classifiedBlockTypes)throw new Error('Rebuild the pinned client model inputs for native offsets.');
const view=new DataView(new ArrayBuffer(4)),float=hex=>{view.setUint32(0,parseInt(hex,16));return view.getFloat32(0);},known=new Set(data.blockTypes),profiles=new Map(Object.entries(data.modelOffsets).map(([key,row])=>[key,{kind:row.kind,horizontal:float(row.horizontal),vertical:float(row.vertical)}]));
export function modelOffsetProfile(id){if(!known.has(id))throw new Error(`Block ${id} needs an authoritative client model offset profile.`);return profiles.get(id)??null;}
export function blockModelOffset(profile,position){
  if(!profile)return[0,0,0];if(!['xz','xyz'].includes(profile.kind))throw new Error('Unknown native model offset kind.');
  const seed=positionModelSeed([position[0],0,position[2]]),fraction=shift=>Math.fround(Number(seed>>BigInt(shift)&15n)/15),limit=profile.horizontal,clamp=value=>Math.max(-limit,Math.min(limit,value));
  return[clamp((fraction(0)-.5)*.5),profile.kind==='xyz'?(fraction(4)-1)*profile.vertical:0,clamp((fraction(8)-.5)*.5)];
}
