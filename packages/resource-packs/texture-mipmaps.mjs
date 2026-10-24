import data from'./client-mipmap-data.json' with{type:'json'};
const F=Math.fround,clamp=value=>Math.max(0,Math.min(1,value)),strategies=new Set(['auto','mean','cutout','strict_cutout','dark_cutout']);
export const MAX_MIPMAP_PIXELS=1048576;
export const mipmapIdentity={clientSha256:data.clientSha256,nativeClassSha256:data.nativeClassSha256};
export function textureMipmapMetadata(value){
  if(value===undefined)return{blur:false,clamp:false,strategy:'auto',bias:0};
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Texture metadata must be an object.');
  const blur=value.blur??false,edge=value.clamp??false,strategy=value.mipmap_strategy??'auto',bias=value.alpha_cutoff_bias??0;
  if(typeof blur!=='boolean'||typeof edge!=='boolean'||!strategies.has(strategy)||typeof bias!=='number'||!Number.isFinite(F(bias))||Object.entries(value).some(([key,v])=>['blur','clamp','mipmap_strategy','alpha_cutoff_bias'].includes(key)&&v===null))throw new Error('Texture mipmap metadata has an unsupported strategy, bias or flag.');
  return{blur,clamp:edge,strategy,bias:F(bias)};
}
export function spriteMipLevel(width,height,maximum){
  if(![width,height,maximum].every(Number.isSafeInteger)||width<1||height<1||maximum<0||maximum>4)throw new Error('Texture mipmaps require positive integer dimensions and a level from zero to four.');
  let level=0;while(level<maximum&&width%2===0&&height%2===0){width/=2;height/=2;level++;}return level;
}
function fillTransparent(pixels,width,height,dark){
  if(dark){let darkest=[255,255,255],brightness=Infinity;for(let x=0;x<width;x++)for(let y=0;y<height;y++){const at=(x+y*width)*4,b=pixels[at]+pixels[at+1]+pixels[at+2];if(pixels[at+3]&&b<brightness){brightness=b;darkest=Array.from(pixels.subarray(at,at+3));}}for(let at=0;at<pixels.length;at+=4)if(!pixels[at+3])for(let c=0;c<3;c++)pixels[at+c]=Math.trunc(3*darkest[c]/4);return;}
  const count=width*height,nearest=new Uint32Array(count),distance=new Int32Array(count).fill(2147483647),queue=new Uint32Array(count);let head=0,tail=0;
  for(let x=0;x<width;x++)for(let y=0;y<height;y++){const i=x+y*width;if(pixels[i*4+3]){distance[i]=0;nearest[i]=i;queue[tail++]=i;}}
  while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);for(const[nx,ny]of[[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=nx+ny*width;if(distance[n]>distance[i]+1){distance[n]=distance[i]+1;nearest[n]=nearest[i];queue[tail++]=n;}}}
  for(let i=0;i<count;i++)if(!pixels[i*4+3])for(let c=0;c<3;c++)pixels[i*4+c]=tail?pixels[nearest[i]*4+c]:0;
}
function coverage({pixels,width,height},reference,scale){let covered=0;
  for(let y=0;y<height-1;y++)for(let x=0;x<width-1;x++){const at=(x+y*width)*4,a00=clamp(F(F(pixels[at+3]/255)*scale)),a10=clamp(F(F(pixels[at+7]/255)*scale)),a01=clamp(F(F(pixels[at+width*4+3]/255)*scale)),a11=clamp(F(F(pixels[at+width*4+7]/255)*scale));let texel=0;
    for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){const fx=(sx+.5)/4,fy=(sy+.5)/4,a=F(F(F(F(F(a00*F(1-fx))*F(1-fy))+F(F(a10*fx)*F(1-fy)))+F(F(a01*F(1-fx))*fy))+F(F(a11*fx)*fy));if(a>reference)texel++;}covered=F(covered+texel/16);
  }return F(covered/((width-1)*(height-1)));
}
function scaleCoverage(image,desired,reference,bias){let low=0,high=4,scale=1,best=1,error=Infinity;
  for(let i=0;i<5;i++){const current=coverage(image,reference,scale),difference=Math.abs(F(current-desired));if(difference<error){error=difference;best=scale;}if(current<desired)low=scale;else if(current>desired)high=scale;else break;scale=F(F(low+high)*.5);}
  for(let at=3;at<image.pixels.length;at+=4)image.pixels[at]=Math.floor(F(clamp(F(F(F(F(image.pixels[at]/255)*best)+bias)+F(.025)))*255));
}
function downsample(image,dark){const width=image.width>>1,height=image.height>>1,pixels=new Uint8Array(width*height*4),toLinear=data.SRGB_TO_LINEAR,fromLinear=data.LINEAR_TO_SRGB;
  for(let x=0;x<width;x++)for(let y=0;y<height;y++){const indices=[(x*2+y*2*image.width)*4,((x*2+1)+y*2*image.width)*4,(x*2+(y*2+1)*image.width)*4,((x*2+1)+(y*2+1)*image.width)*4],at=(x+y*width)*4;
    for(let c=0;c<4;c++){if(dark){let sum=0;for(const i of indices)if(image.pixels[i+3])sum=F(sum+F(toLinear[image.pixels[i+c]]/1023));pixels[at+c]=fromLinear[Math.floor(F(F(sum/4)*1023))];}else{const sum=indices.reduce((n,i)=>n+(c===3?image.pixels[i+c]:toLinear[image.pixels[i+c]]),0);pixels[at+c]=c===3?Math.trunc(sum/4):fromLinear[Math.trunc(sum/4)];}}
  }return{width,height,pixels};
}
// Original source-sheet preprocessing precedes native mip generation and animation frame extraction.
export function textureMipmaps(name,raster,maximum=4,metadata=textureMipmapMetadata()){
  const{width,height,pixels}=raster;if(![width,height].every(Number.isSafeInteger)||width<1||height<1||width*height>MAX_MIPMAP_PIXELS||!(pixels instanceof Uint8Array)||pixels.length!==width*height*4)throw new Error('Texture mipmap source exceeds the bounded 1,048,576-pixel input or has invalid RGBA pixels.');
  const level=spriteMipLevel(width,height,maximum);if(level!==maximum||typeof name!=='string'||!name.includes(':')||!strategies.has(metadata.strategy)||!Number.isFinite(metadata.bias))throw new Error('Texture mip levels must fit the complete source sheet and native metadata.');
  const transparent=pixels.some((value,i)=>i%4===3&&value===0),strategy=metadata.strategy==='auto'?(transparent?'cutout':'mean'):metadata.strategy,cutout=['cutout','strict_cutout','dark_cutout'].includes(strategy),base={width,height,pixels:pixels.slice()},result=[base];
  if(!name.slice(name.indexOf(':')+1).startsWith('item/')&&cutout)fillTransparent(base.pixels,width,height,strategy==='dark_cutout');
  const reference=strategy==='strict_cutout'?F(.3):.5,desired=cutout?coverage(base,reference,1):0;
  for(let i=1;i<=maximum;i++){const image=downsample(result[i-1],strategy==='dark_cutout');if(cutout)scaleCoverage(image,desired,reference,metadata.bias);result.push(image);}return result;
}
