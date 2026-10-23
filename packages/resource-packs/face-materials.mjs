import data from'./client-face-material-data.json' with{type:'json'};
if(data.formatVersion!==1||Object.values(data.layers).some(row=>row.cull!==true))throw new Error('Native terrain material policy requires a matching renderer adapter.');
const F=Math.fround,cutoffs=new Set(Object.values(data.layers).map(row=>Math.fround(row.alphaCutoff))),directions=['down','up','north','south','west','east'];
export const faceMaterialIdentity={clientSha256:data.clientSha256};
export const MATERIAL_SCAN_LIMIT=32*1024*1024;
export function materialLayer(transparency){const row=data.layers[transparency];if(!row)throw new Error('Unknown native face transparency.');return row;}
export function sourceTransparency(entry,charge=()=>{}){
  const{sourceWidth:width,sourceHeight:height,pixels}=entry;if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>1048576||!(pixels instanceof Uint8Array)||pixels.length!==width*height*4)throw new Error('Face material requires a bounded owned RGBA source sheet.');charge(width*height);let transparent=false,translucent=false;
  for(let at=3;at<pixels.length;at+=4){transparent||=pixels[at]===0;translucent||=pixels[at]>0&&pixels[at]<255;if(transparent&&translucent)break;}return{transparent,translucent};
}
export const transparencyName=flags=>flags.translucent?'blend':flags.transparent?'cutout':'opaque';
export function spriteTransparency(entry,uv,charge=()=>{}){
  if(!Array.isArray(uv)||uv.length!==4||!uv.every(Number.isFinite))throw new Error('Face material requires four finite source UV coordinates.');
  const bounds=[F(Math.min(F(uv[0]),F(uv[2]))/16),F(Math.min(F(uv[1]),F(uv[3]))/16),F(Math.max(F(uv[0]),F(uv[2]))/16),F(Math.max(F(uv[1]),F(uv[3]))/16)],all=(entry.sourceTransparency??=sourceTransparency(entry,charge));
  if(!all.transparent&&!all.translucent||bounds.every((value,i)=>value===[0,0,1,1][i]))return transparencyName(all);
  const key=bounds.join(','),cache=entry.faceTransparencyCache??=new Map();if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  const[x0,y0,x1,y1]=bounds.map((value,i)=>i<2?Math.floor(F(value*(i%2?entry.height:entry.width))):Math.ceil(F(value*(i%2?entry.height:entry.width)))),columns=entry.sourceWidth/entry.width,frames=[...new Set(entry.frames.map(frame=>frame.index))],rectangles=frames.map(frame=>[frame%columns*entry.width+x0,Math.floor(frame/columns)*entry.height+y0,frame%columns*entry.width+x1,Math.floor(frame/columns)*entry.height+y1]);
  for(const[a,b,c,d]of rectangles)if(a<0||b<0||c>entry.sourceWidth||d>entry.sourceHeight)throw new Error('Face transparency UV bounds lie outside the native source image.');
  charge(Math.max(0,x1-x0)*Math.max(0,y1-y0)*rectangles.length);let transparent=false,translucent=false;
  outer:for(const[a,b,c,d]of rectangles)for(let y=b;y<d;y++)for(let x=a;x<c;x++){const alpha=entry.pixels[(x+y*entry.sourceWidth)*4+3];transparent||=alpha===0;translucent||=alpha>0&&alpha<255;if(transparent&&translucent)break outer;}
  const result=transparencyName({transparent,translucent});if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
export function elementMaterial(element){
  let shadeDirectionOverride=null,lightEmission=0;if(Object.hasOwn(element,'shade_direction_override')){const value=element.shade_direction_override;if(typeof value!=='string'||!directions.includes(value))throw new Error('Model has an unsupported native shade direction override.');shadeDirectionOverride=value;}
  if(Object.hasOwn(element,'light_emission')){const value=element.light_emission;if(typeof value!=='number'||!Number.isFinite(value)||value<-2147483648||value>2147483647)throw new Error('Model light emission exceeds supported native numeric input.');lightEmission=Math.trunc(value)||0;if(lightEmission<0||lightEmission>15)throw new Error('Model light emission must resolve to an integer from zero to fifteen.');}
  return{shadeDirectionOverride,lightEmission};
}
export function faceParameters(quad){const layer=materialLayer(quad.transparency),direction=quad.shadeDirectionOverride??null,emission=quad.lightEmission??0;if(direction!==null&&!directions.includes(direction)||!Number.isInteger(emission)||emission<0||emission>15)throw new Error('Invalid native face material metadata.');return[F(layer.alphaCutoff),direction===null?0:directions.indexOf(direction)+1,emission,layer.cull?1:0];}
export function validateFaceParameters(values,count){if(!(values instanceof Float32Array)||values.length!==count*4)throw new Error('Mesh material coverage differs from rendered geometry.');for(let at=0;at<values.length;at+=4)if(!cutoffs.has(values[at])||!Number.isInteger(values[at+1])||values[at+1]<0||values[at+1]>6||!Number.isInteger(values[at+2])||values[at+2]<0||values[at+2]>15||values[at+3]!==1)throw new Error('Mesh contains invalid face material parameters.');return values;}
export function describeFaceParameters(values,index){const at=index*4;return{alphaCutoff:values[at],shadeDirectionOverride:values[at+1]?directions[values[at+1]-1]:null,lightEmission:values[at+2],cullBackFaces:values[at+3]===1,lighting:'Studio directional preview; native shade override/emission metadata retained, world lightmap/AO not applied'};}
