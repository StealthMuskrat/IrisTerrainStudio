import{cubeFaces,elementPosition,elementRotation,transformCuboidPoint,cuboidNormal,cuboidFacing,cuboidWinding}from'./cuboid-geometry.mjs';
import{elementMaterial,materialLayer}from'../resource-packs/face-materials.mjs';
import{modelRotation,rotateModelPoint,rotateModelVector,faceUv,quadrant}from'../resource-packs/model-transform.mjs';
import{visualSeedRule}from'../resource-packs/model-selection.mjs';
const faceNormals={north:[0,0,-1],south:[0,0,1],east:[1,0,0],west:[-1,0,0],up:[0,1,0],down:[0,-1,0]},faces=Object.fromEntries(Object.entries(cubeFaces).map(([name,points])=>[name,{points,normal:faceNormals[name]}]));
function defaultUv(face,a,b){switch(face){case'down':return[a[0],16-b[2],b[0],16-a[2]];case'up':return[a[0],a[2],b[0],b[2]];case'north':return[16-b[0],16-b[1],16-a[0],16-a[1]];case'south':return[a[0],16-b[1],b[0],16-a[1]];case'west':return[a[2],16-b[1],b[2],16-a[1]];case'east':return[16-b[2],16-b[1],16-a[2],16-a[1]];}}
function direction(vector){const axis=vector.map(Math.abs).indexOf(Math.max(...vector.map(Math.abs)));if(Math.abs(vector[axis])<.99999)return null;return axis===0?(vector[0]>0?'east':'west'):axis===1?(vector[1]>0?'up':'down'):(vector[2]>0?'south':'north');}
export async function bakeBlock(block,stack,atlas,{choices,tints}={}){return bakeApplications(block,stack,atlas,stack.blockModels(block,choices),tints);}
export function hasModelGeometry(model){
  if(Array.isArray(model))return model.length>0;
  return model?.kind==='minecraft-model-plan'&&model.groups.some(group=>group.variants.some(variant=>(!group.weighted||variant.weight>0)&&variant.quads.length>0));
}
async function bakeApplications(block,stack,atlas,applications,tints){
  const quads=[];let admittedFaces=0;
  for(const application of applications){const rotation=modelRotation(application.x,application.y,application.z);if(!Array.isArray(application.model.elements))throw new Error('Model elements must be an array.');for(const part of application.model.elements){
    const a=elementPosition(part.from,'Model from'),b=elementPosition(part.to,'Model to'),elementFlags=elementMaterial(part),elementTransform=elementRotation(part.rotation);if(!part.faces||typeof part.faces!=='object'||Array.isArray(part.faces)||!Object.keys(part.faces).length)throw new Error('Model element requires at least one native face.');
    for(const[name,face]of Object.entries(part.faces||{})){const definition=faces[name];if(!definition)throw new Error('Unknown model face: '+name);if(++admittedFaces>8192)throw new Error('Block models exceed their 8,192-face budget.');const material=stack.material?.(application.model,face.texture)??{sprite:stack.texture(application.model,face.texture),forceTranslucent:false},texture=await atlas.add(material.sprite,stack);let points=definition.points(a,b).map(point=>point.map(v=>Math.fround(v/16)));
      if(elementTransform)points=points.map(p=>transformCuboidPoint(p,elementTransform));
      points=points.map(p=>rotateModelPoint(p,rotation));if(points.some(p=>p.some(v=>!Number.isFinite(v))))throw new Error('Cuboid transform produced a nonfinite position.');const geometricNormal=cuboidNormal(points),facing=cuboidFacing(geometricNormal),n=facing?geometricNormal:[0,1,0];
      const rawUv=Object.hasOwn(face,'uv')?face.uv:defaultUv(name,a,b),uv=Array.isArray(rawUv)?rawUv.map(Math.fround):null;if(!Array.isArray(uv)||uv.length!==4||!uv.every(Number.isFinite))throw new Error(`Invalid face UV in ${application.model.id}.`);
      const turns=quadrant(face.rotation)/90;const corners=[[uv[0],uv[1]],[uv[0],uv[3]],[uv[2],uv[3]],[uv[2],uv[1]]],mapped=Array.from({length:4},(_,i)=>{const c=corners[(i+turns)%4],locked=faceUv(name,c[0],c[1],rotation,application.uvlock);return[Math.fround(texture.uv[0]+Math.fround(locked[0]*Math.fround(texture.uv[2]-texture.uv[0]))),Math.fround(texture.uv[1]+Math.fround(locked[1]*Math.fround(texture.uv[3]-texture.uv[1])))];});
      if(!elementTransform&&facing)cuboidWinding(points,mapped,facing);
      let color=[1,1,1,1],tintIndex=null;if(face.tintindex!==undefined&&face.tintindex>=0){if(!Number.isInteger(face.tintindex))throw new Error('Model tint index must be a whole number.');if(tints?.[face.tintindex])color=tints[face.tintindex];else tintIndex=face.tintindex;}
      let cull=null;if(face.cullface&&faces[face.cullface]){let v=faces[face.cullface].normal;v=rotateModelVector(v,rotation);cull=direction(v);}
      const transparency=material.forceTranslucent?'blend':atlas.transparencyAt?.(texture,uv)??texture.transparency;quads.push({positions:points,spriteUv:texture.uv.slice(),normal:n,shadeDirection:facing??'up',uv:mapped,color,tintIndex,cull,transparency,...elementFlags,alphaCutoff:materialLayer(transparency).alphaCutoff,modelId:application.model.id});
    }
  }}
  return quads;
}

/** Bake every referenced candidate once; the mesh worker chooses per stored world position. */
export async function bakeBlockPlan(block,stack,atlas,{choices,tints}={}){
  if(choices)return bakeBlock(block,stack,atlas,{choices,tints});const source=stack.blockModelGroups(block);
  if(source.groups.every(group=>group.variants.length===1))return bakeApplications(block,stack,atlas,source.groups.map(group=>group.variants[0]),tints);
  const plan={kind:'minecraft-model-plan',multipart:source.multipart,seedRule:visualSeedRule(block.id),groups:[]};let faces=0;
  for(const group of source.groups){const variants=[];for(const variant of group.variants){const quads=await bakeApplications(block,stack,atlas,[variant],tints);if((faces+=quads.length)>8192)throw new Error('Block model candidates exceed their 8,192-face budget.');variants.push({weight:variant.weight,quads});}plan.groups.push({weighted:group.weighted,totalWeight:group.totalWeight,variants});}return plan;
}
