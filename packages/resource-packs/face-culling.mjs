import data from'./client-culling-data.json' with{type:'json'};
import{rectangleCovered,fullFaceShape}from'./face-shapes.mjs';
const owners=new Map(Object.entries(data.owners).flatMap(([owner,ids])=>ids.map(id=>[id,owner.split('.').at(-1)]))),bars=new Set(data.bars),names=['north','east','south','west','up','down'],opposite=[2,3,0,1,5,4];
const shapeIds=new WeakMap(),cache=new Map();let nextShape=0;
function identity(shape){let id=shapeIds.get(shape);if(id===undefined){id=nextShape++;shapeIds.set(shape,id);}return id;}
function uncovered(shape,occluder){const key=identity(shape)+','+identity(occluder);if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}const result=shape.some(rect=>!rectangleCovered(rect,occluder));if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,result);return result;}
export function skipBlockFace(block,neighbor,direction,{cutoutLeaves=true}={}){
  const owner=owners.get(block.id);if(!owner)throw new Error(`Block ${block.id} needs native face-culling metadata.`);
  switch(owner){
    case'BlockBehaviour':return false;
    case'HalfTransparentBlock':case'PowderSnowBlock':return block.id===neighbor.id;
    case'LeavesBlock':return!cutoutLeaves&&owners.get(neighbor.id)==='LeavesBlock';
    case'MangroveRootsBlock':return neighbor.id==='minecraft:mangrove_roots'&&direction>=4;
    case'LiquidBlock':return neighbor.renderProfile?.fluid===block.renderProfile?.fluid;
    case'IronBarsBlock':{const reverse=names[opposite[direction]],same=block.id===neighbor.id||bars.has(block.id)&&bars.has(neighbor.id)&&Object.hasOwn(neighbor.properties??{},reverse);return same&&(direction>=4||String(block.properties?.[names[direction]])==='true'&&String(neighbor.properties?.[reverse])==='true');}
    default:throw new Error('Unadapted native face-culling method owner '+owner);
  }
}
export function shouldRenderBlockFace(block,neighbor,direction,options){
  const d=typeof direction==='string'?names.indexOf(direction):direction;if(!Number.isInteger(d)||d<0||d>5)throw new Error('Unknown block culling direction.');
  const own=block.renderProfile,other=neighbor.renderProfile;if(!own||!other)throw new Error('Native face shapes are unavailable for a stored block.');const occluder=other.faces[opposite[d]];
  if(fullFaceShape(occluder)||skipBlockFace(block,neighbor,d,options))return false;
  const shape=own.faces[d];if(!occluder.length||!shape.length)return true;return uncovered(shape,occluder);
}
