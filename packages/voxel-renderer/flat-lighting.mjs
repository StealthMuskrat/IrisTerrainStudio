// Minecraft 26.3 CardinalLighting / BlockModelLighter / ARGB flat color operations.
// This deliberately does not supply a world lightmap, ambient occlusion or emission light.
const F=Math.fround;
const directions=['down','up','north','south','west','east'];
const vectors=[[0,-1,0],[0,1,0],[0,0,-1],[0,0,1],[-1,0,0],[1,0,0]];
const profiles={default:[.5,1,.8,.8,.6,.6].map(F),nether:[.9,.9,.8,.8,.6,.6].map(F)};
export function prepareFlatLighting(volume){
  const environment=volume.metadata?.terrainInfo?.environment??null,profile=environment==='NORMAL'||environment==='THE_END'?'default':environment==='NETHER'?'nether':null;
  return{environment,profile,mode:profile?'native-flat-cardinal':'unshaded',reason:profile?null:'Native world environment is missing or custom; cardinal lighting is unavailable.'};
}
export function closestShadeDirection(normal){
  if(!Array.isArray(normal)||normal.length!==3||!normal.every(Number.isFinite))throw new Error('Flat lighting requires a finite face normal.');
  const n=normal.map(F);let closest=0,result=null;
  for(let i=0;i<vectors.length;i++){const v=vectors[i],dot=F(F(F(n[0]*v[0])+F(n[1]*v[1]))+F(n[2]*v[2]));if(dot>=0&&dot>closest){closest=dot;result=directions[i];}}
  if(!result)throw new Error('Flat lighting cannot classify a degenerate face normal.');return result;
}
export function shadeFlatColor(color,quad,input){
  if(!input?.profile)return color;const profile=profiles[input.profile];if(!profile)throw new Error('Unknown native cardinal lighting profile.');
  const direction=quad.fluid?quad.fluidFace:quad.shadeDirectionOverride??closestShadeDirection(quad.normal),index=directions.indexOf(direction);if(index<0)throw new Error('Missing native flat face direction.');
  // Fluid side normals are always up in the original tesselator. Its side shade is
  // up * north/west; model gray is first packed to bytes, then multiplied by tint.
  const shade=quad.fluid&&index>=2?F(profile[1]*profile[index<4?2:4]):profile[index];
  if(!Array.isArray(color)||color.length!==4||!color.every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new Error('Flat lighting requires four bounded color components.');
  const bytes=color.map(v=>Math.round(v*255)),gray=Math.floor(F(shade*255));
  return bytes.map((value,i)=>i===3?value/255:(quad.fluid?Math.trunc(F(value*shade)):Math.trunc(value*gray/255))/255);
}
export function describeFlatLighting(input){return input?.profile?`Native ${input.profile} flat cardinal colors and model shade overrides; world lightmap, ambient occlusion and emission lighting unavailable.`:input?.reason??'Cardinal lighting unavailable; unshaded colors.';}
