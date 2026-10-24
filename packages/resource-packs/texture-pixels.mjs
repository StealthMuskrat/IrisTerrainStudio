import{decodeNativePng}from'../iris-engine/png.mjs';
// PNG raster channels go directly to RGBA8; no canvas color conversion or premultiplied alpha.
export async function decodeTexturePng(bytes){
  const image=await decodeNativePng(bytes,{packedGrayTransparency:'png',metadataPolicy:'minecraft'}),{width,height,channels,samples,palette,bitDepth}=image,pixels=new Uint8Array(width*height*4),step=bitDepth===16?2:1;
  for(let i=0;i<width*height;i++){
    const out=i*4,at=i*channels*step;
    if(palette){pixels.set(palette.subarray(samples[i]*4,samples[i]*4+4),out);continue;}
    if(channels<3){pixels[out]=pixels[out+1]=pixels[out+2]=samples[at];pixels[out+3]=channels===2?samples[at+step]:255;}
    else{pixels[out]=samples[at];pixels[out+1]=samples[at+step];pixels[out+2]=samples[at+2*step];pixels[out+3]=channels===4?samples[at+3*step]:255;}
  }
  return{width,height,pixels};
}
// The pinned shader mixes all RGBA channels; progress is quantized by AnimationState to 1/1000.
export function textureFramePixels(entry,index,next=index,progress=0,border=1){
  const{sourceWidth,sourceHeight,width,height,pixels}=entry;
  if(!Number.isInteger(border)||border<1||border>16)throw new Error('Invalid texture frame gutter.');
  if(!(pixels instanceof Uint8Array)||pixels.length!==sourceWidth*sourceHeight*4||!Number.isInteger(progress)||progress<0||progress>999)throw new Error('Invalid owned texture animation pixels.');
  const columns=sourceWidth/width,count=columns*(sourceHeight/height);if(!Number.isInteger(index)||!Number.isInteger(next)||index<0||next<0||index>=count||next>=count)throw new Error('Invalid texture frame index.');
  const out=new Uint8Array((width+2*border)*(height+2*border)*4),mix=Math.fround(progress/1000);
  for(let y=-border;y<height+border;y++)for(let x=-border;x<width+border;x++){
    const px=Math.max(0,Math.min(width-1,x)),py=Math.max(0,Math.min(height-1,y)),from=((Math.floor(index/columns)*height+py)*sourceWidth+index%columns*width+px)*4,to=((Math.floor(next/columns)*height+py)*sourceWidth+next%columns*width+px)*4,at=((y+border)*(width+2*border)+x+border)*4;
    for(let channel=0;channel<4;channel++)out[at+channel]=progress===0?pixels[from+channel]:Math.round(Math.fround(Math.fround(pixels[from+channel]*Math.fround(1-mix))+Math.fround(pixels[to+channel]*mix)));
  }
  return out;
}
