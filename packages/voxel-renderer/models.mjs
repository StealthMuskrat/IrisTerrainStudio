import{modelRotation,rotateModelPoint,rotateModelVector,faceUv,quadrant}from'../resource-packs/model-transform.mjs';
import{visualSeedRule}from'../resource-packs/model-selection.mjs';
const faces={north:{normal:[0,0,-1],points:(a,b)=>[[b[0],b[1],a[2]],[b[0],a[1],a[2]],[a[0],a[1],a[2]],[a[0],b[1],a[2]]]},south:{normal:[0,0,1],points:(a,b)=>[[a[0],b[1],b[2]],[a[0],a[1],b[2]],[b[0],a[1],b[2]],[b[0],b[1],b[2]]]},east:{normal:[1,0,0],points:(a,b)=>[[b[0],b[1],b[2]],[b[0],a[1],b[2]],[b[0],a[1],a[2]],[b[0],b[1],a[2]]]},west:{normal:[-1,0,0],points:(a,b)=>[[a[0],b[1],a[2]],[a[0],a[1],a[2]],[a[0],a[1],b[2]],[a[0],b[1],b[2]]]},up:{normal:[0,1,0],points:(a,b)=>[[a[0],b[1],a[2]],[a[0],b[1],b[2]],[b[0],b[1],b[2]],[b[0],b[1],a[2]]]},down:{normal:[0,-1,0],points:(a,b)=>[[a[0],a[1],b[2]],[a[0],a[1],a[2]],[b[0],a[1],a[2]],[b[0],a[1],b[2]]]}};
function rotate(point,axis,degrees,origin=[.5,.5,.5],rescale=false){const p=point.map((v,i)=>v-origin[i]),r=degrees*Math.PI/180,c=Math.cos(r),s=Math.sin(r);let out;if(axis==='x')out=[p[0],p[1]*c-p[2]*s,p[1]*s+p[2]*c];else if(axis==='y')out=[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];else if(axis==='z')out=[p[0]*c-p[1]*s,p[0]*s+p[1]*c,p[2]];else throw new Error('Invalid element rotation axis.');if(rescale){const fixed={x:0,y:1,z:2}[axis];out=out.map((v,i)=>i===fixed?v:v/Math.cos(r));}return out.map((v,i)=>v+origin[i]);}
function normal(points){const a=points[1].map((v,i)=>v-points[0][i]),b=points[2].map((v,i)=>v-points[0][i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);if(length<1e-9)throw new Error('Model contains a degenerate face.');return n.map(v=>v/length);}
function defaultUv(face,a,b){switch(face){case'down':return[a[0],16-b[2],b[0],16-a[2]];case'up':return[a[0],a[2],b[0],b[2]];case'north':return[16-b[0],16-b[1],16-a[0],16-a[1]];case'south':return[a[0],16-b[1],b[0],16-a[1]];case'west':return[a[2],16-b[1],b[2],16-a[1]];case'east':return[16-b[2],16-b[1],16-a[2],16-a[1]];}}
function direction(vector){const axis=vector.map(Math.abs).indexOf(Math.max(...vector.map(Math.abs)));if(Math.abs(vector[axis])<.99999)return null;return axis===0?(vector[0]>0?'east':'west'):axis===1?(vector[1]>0?'up':'down'):(vector[2]>0?'south':'north');}
export async function bakeBlock(block,stack,atlas,{choices,tints}={}){return bakeApplications(block,stack,atlas,stack.blockModels(block,choices),tints);}
async function bakeApplications(block,stack,atlas,applications,tints){
  const quads=[];
  for(const application of applications)for(const part of application.model.elements){
    const a=part.from,b=part.to;if(!Array.isArray(a)||!Array.isArray(b)||a.length!==3||b.length!==3||![...a,...b].every(Number.isFinite))throw new Error(`Invalid model element in ${application.model.id}.`);
    for(const[name,face]of Object.entries(part.faces||{})){const definition=faces[name];if(!definition)throw new Error('Unknown model face: '+name);const material=stack.material?.(application.model,face.texture)??{sprite:stack.texture(application.model,face.texture),forceTranslucent:false},texture=await atlas.add(material.sprite,stack);let points=definition.points(a,b).map(point=>point.map(v=>v/16));
      if(part.rotation){const r=part.rotation;if(![-45,-22.5,0,22.5,45].includes(r.angle)||!Array.isArray(r.origin))throw new Error(`Unsupported element rotation in ${application.model.id}.`);points=points.map(p=>rotate(p,r.axis,r.angle,r.origin.map(n=>n/16),!!r.rescale));}
      const rotation=modelRotation(application.x,application.y,application.z);points=points.map(p=>rotateModelPoint(p,rotation));const n=normal(points);
      const uv=face.uv||defaultUv(name,a,b);if(!Array.isArray(uv)||uv.length!==4||!uv.every(Number.isFinite))throw new Error(`Invalid face UV in ${application.model.id}.`);
      const turns=quadrant(face.rotation)/90;const corners=[[uv[0],uv[1]],[uv[0],uv[3]],[uv[2],uv[3]],[uv[2],uv[1]]],mapped=Array.from({length:4},(_,i)=>{const c=corners[(i+turns)%4],locked=faceUv(name,c[0],c[1],rotation,application.uvlock);return[texture.uv[0]+locked[0]*(texture.uv[2]-texture.uv[0]),texture.uv[1]+locked[1]*(texture.uv[3]-texture.uv[1])];});
      let color=[1,1,1,1],tintIndex=null;if(face.tintindex!==undefined&&face.tintindex>=0){if(!Number.isInteger(face.tintindex))throw new Error('Model tint index must be a whole number.');if(tints?.[face.tintindex])color=tints[face.tintindex];else tintIndex=face.tintindex;}
      let cull=null;if(face.cullface&&faces[face.cullface]){let v=faces[face.cullface].normal;v=rotateModelVector(v,rotation);cull=direction(v);}
      quads.push({positions:points,normal:n,uv:mapped,color,tintIndex,cull,transparency:material.forceTranslucent?'blend':texture.transparency,modelId:application.model.id});
    }
  }
  return quads;
}

/** Bake every referenced candidate once; the mesh worker chooses per stored world position. */
export async function bakeBlockPlan(block,stack,atlas,{choices,tints}={}){
  if(choices)return bakeBlock(block,stack,atlas,{choices,tints});const source=stack.blockModelGroups(block);
  if(source.groups.every(group=>group.variants.length===1))return bakeApplications(block,stack,atlas,source.groups.map(group=>group.variants[0]),tints);
  const plan={kind:'minecraft-model-plan',multipart:source.multipart,seedRule:visualSeedRule(block.id),groups:[]};let faces=0;
  for(const group of source.groups){const variants=[];for(const variant of group.variants){const quads=await bakeApplications(block,stack,atlas,[variant],tints);if((faces+=quads.length)>8192)throw new Error('Block model candidates exceed their 8,192-face budget.');variants.push({weight:variant.weight,quads});}plan.groups.push({weighted:group.weighted,totalWeight:group.totalWeight,variants});}return plan;
}
