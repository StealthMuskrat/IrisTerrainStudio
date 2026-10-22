import{emptyRenderProfile}from'../resource-packs/render-inputs.mjs';
import{clientSin,clientCos,clientAtan2}from'../resource-packs/client-math.mjs';
import{rectangleCovered}from'../resource-packs/face-shapes.mjs';
const F=Math.fround,EPS=1e-7,OFFS=F(.001),MAX=F(8/9),steps=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0],[0,1,0],[0,-1,0]],opposite=[2,3,0,1,5,4];
export const fluidTextureNames=kind=>kind==='water'?['minecraft:block/water_still','minecraft:block/water_flow','minecraft:block/water_overlay']:kind==='lava'?['minecraft:block/lava_still','minecraft:block/lava_flow']:[];
export async function prepareFluidMaterials(stack,atlas,kinds){const result={};for(const kind of new Set(kinds)){if(kind==='empty')continue;const names=fluidTextureNames(kind);if(!names.length)throw new Error('Unknown fluid model '+kind);const textures=await Promise.all(names.map(name=>atlas.add(name,stack)));result[kind]={still:textures[0],flow:textures[1],overlay:textures[2]??null,transparency:textures.some(t=>t.transparency==='blend')?'blend':textures.some(t=>t.transparency==='cutout')?'cutout':'opaque'};}return result;}
export function fluidFaceOccluded(profile,direction,height){
  const rects=profile.faces[opposite[direction]];if(!rects.length)return false;
  // The original full-cube fast path also occludes sub-full upward surfaces only at height 1.
  if(direction===4&&height<1-EPS)return false;return rectangleCovered([0,0,1,direction>=4?1:height],rects);
}
export function fluidFlow(self,sample){
  let x=0,z=0;for(let d=0;d<4;d++){const[dx,,dz]=steps[d],neighbor=sample(dx,0,dz);if(neighbor.fluid!=='empty'&&neighbor.fluid!==self.fluid)continue;let height=neighbor.height,distance=0;
    if(height===0){if(!neighbor.blocksFlow){const below=sample(dx,-1,dz);if((below.fluid==='empty'||below.fluid===self.fluid)&&below.height>0)distance=F(self.height-F(below.height-MAX));}}
    else if(height>0)distance=F(self.height-height);if(distance!==0){x+=dx*distance;z+=dz*distance;}
  }
  const normalize=(x,y,z)=>{const length=Math.sqrt(x*x+y*y+z*z);return length<1e-5?[0,0,0]:[x/length,y/length,z/length];};let flow=[x,0,z];
  if(self.falling)for(let d=0;d<4;d++){const[dx,,dz]=steps[d],solid=p=>p.fluid!==self.fluid&&!p.ice&&(p.support&(1<<d));if(solid(sample(dx,0,dz))||solid(sample(dx,1,dz))){flow=normalize(...flow);flow[1]-=6;break;}}
  return normalize(...flow);
}
export function fluidHeights(self,sample){
  const height=(x,z)=>{const state=sample(x,0,z);return state.fluid===self.fluid?(sample(x,1,z).fluid===self.fluid?1:state.height):state.solid?-1:0;},center=height(0,0);if(center>=1)return[1,1,1,1];
  const n=height(0,-1),s=height(0,1),e=height(1,0),w=height(-1,0),average=(a,b,x,z)=>{if(a>=1||b>=1)return 1;let sum=0,weight=0;const add=h=>{if(h>=F(.8)){sum=F(sum+F(h*10));weight=F(weight+10);}else if(h>=0){sum=F(sum+h);weight=F(weight+1);}};if(a>0||b>0){const corner=height(x,z);if(corner>=1)return 1;add(corner);}add(center);add(b);add(a);return F(sum/weight);};
  return[average(n,w,-1,-1),average(s,w,-1,1),average(s,e,1,1),average(n,e,1,-1)];
}
function uv(texture,u,v){const[a,b,c,d]=texture.uv;return[F(F(a)+F(F(c-a)*F(u))),F(F(b)+F(F(d-b)*F(v)))];}
// Neighbors are retained stored cells. visible() only exposes cut faces; it does not alter flow/height samples.
export function fluidQuads(self,sample,material,position,color=[1,1,1,1],visible=()=>true){
  if(!material||self.fluid==='empty')return[];const adjacent=steps.map(([x,y,z])=>sample(x,y,z)),faceNeighbor=d=>visible(...steps[d])?adjacent[d]:emptyRenderProfile,render=steps.map((_,d)=>{const n=faceNeighbor(d);return n.fluid!==self.fluid&&(d===4||!fluidFaceOccluded(self,opposite[d],1));});render[5]&&=!fluidFaceOccluded(faceNeighbor(5),5,MAX);if(!render.some(Boolean))return[];
  const out=[],heights=fluidHeights(self,sample),base=render[5]?OFFS:0,add=(positions,uvs,texture,back=false)=>{const section=position.map(v=>v&15),quad={positions:positions.map(p=>p.map((v,i)=>F(section[i]+v)-section[i])),normal:[0,1,0],uv:uvs.map(p=>uv(texture,...p)),color,transparency:material.transparency,cull:null,fluid:true,modelId:'minecraft:fluid/'+self.fluid};out.push(quad);if(back)out.push({...quad,positions:[quad.positions[0],quad.positions[3],quad.positions[2],quad.positions[1]],uv:[quad.uv[0],quad.uv[3],quad.uv[2],quad.uv[1]]});};
  if(render[4]&&!fluidFaceOccluded(faceNeighbor(4),4,Math.min(...heights))){
    for(let i=0;i<4;i++)heights[i]=F(heights[i]-OFFS);const flow=fluidFlow(self,sample);let texture=material.still,coords=[[0,0],[0,1],[1,1],[1,0]];
    if(flow[0]!==0||flow[2]!==0){texture=material.flow;const angle=F(F(clientAtan2(flow[2],flow[0]))-F(Math.PI/2)),s=F(clientSin(angle)*.25),c=F(clientCos(angle)*.25);coords=[[F(.5+F(-c-s)),F(.5+F(-c+s))],[F(.5+F(-c+s)),F(.5+F(c+s))],[F(.5+F(c+s)),F(.5+F(c-s))],[F(.5+F(c-s)),F(.5+F(-c-s))]];}
    let back=false;for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){const above=sample(x,1,z);if(above.fluid!==self.fluid&&!above.solidRender)back=true;}
    add([[0,heights[0],0],[0,heights[1],1],[1,heights[2],1],[1,heights[3],0]],coords,texture,back);
  }
  if(render[5])add([[0,base,0],[1,base,0],[1,base,1],[0,base,1]],[[0,0],[1,0],[1,1],[0,1]],material.still);
  const sides=[[0,3,0,OFFS,1,OFFS],[3,2,F(1-OFFS),0,F(1-OFFS),1],[2,1,1,F(1-OFFS),0,F(1-OFFS)],[1,0,OFFS,1,OFFS,0]];
  for(let d=0;d<4;d++){const[a,b,x0,z0,x1,z1]=sides[d],h0=heights[a],h1=heights[b];if(!render[d]||fluidFaceOccluded(faceNeighbor(d),d,Math.max(h0,h1)))continue;const overlay=material.overlay&&faceNeighbor(d).overlay,texture=overlay?material.overlay:material.flow;add([[x0,h0,z0],[x1,h1,z1],[x1,base,z1],[x0,base,z0]],[[0,F(F(1-h0)*.5)],[.5,F(F(1-h1)*.5)],[.5,.5],[0,.5]],texture,!overlay);}
  return out;
}
