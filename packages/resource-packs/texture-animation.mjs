// Pinned client frame sizing and integer-tick animation state; bounded resource admission.
const MAX_FRAMES=4096;
export function textureAnimation(width,height,animation,maximumFrameSize=2048){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw new Error('Invalid texture dimensions.');
  if(animation!==null&&(typeof animation!=='object'||Array.isArray(animation)))throw new Error('Texture animation metadata must be an object.');
  const animated=animation!==null,meta=animation??{};
  if(meta.interpolate!==undefined&&typeof meta.interpolate!=='boolean')throw new Error('Texture animation interpolation must be a boolean.');
  const frameWidth=meta.width??(animated&&meta.height===undefined?Math.min(width,height):width),frameHeight=meta.height??(animated&&meta.width===undefined?Math.min(width,height):height);
  if(!Number.isSafeInteger(frameWidth)||!Number.isSafeInteger(frameHeight)||frameWidth<1||frameHeight<1||width%frameWidth||height%frameHeight)throw new Error('Texture has invalid animation frame dimensions.');
  if(frameWidth+2>maximumFrameSize||frameHeight+2>maximumFrameSize)throw new Error('Texture frame exceeds atlas dimensions.');
  const defaultTime=meta.frametime??1;
  if(!Number.isSafeInteger(defaultTime)||defaultTime<1||defaultTime>2147483647)throw new Error('Texture animation frametime must be a positive integer.');
  if(meta.frames!==undefined&&!Array.isArray(meta.frames))throw new Error('Texture animation frames must be an array.');
  const count=width/frameWidth*(height/frameHeight),explicit=meta.frames!==undefined;
  if((explicit?meta.frames.length:count)>MAX_FRAMES)throw new Error('Texture animation exceeds its 4,096-frame budget.');
  let frames=(explicit?meta.frames:Array.from({length:count},(_,index)=>index)).map(frame=>{
    if(typeof frame!=='number'&&(frame===null||typeof frame!=='object'||Array.isArray(frame)))throw new Error('Texture has an invalid animation frame.');
    const index=typeof frame==='number'?frame:frame.index,time=typeof frame==='number'?defaultTime:frame.time??defaultTime;
    if(!Number.isSafeInteger(index)||index<0||index>=count||!Number.isSafeInteger(time)||time<1||time>2147483647)throw new Error('Texture has invalid animation frame indices or durations.');
    return{index,time};
  });
  // Original SpriteContents disables animation for zero/one valid sequence entries and uses frame zero.
  if(frames.length<=1)frames=[{index:0,time:defaultTime}];
  let ticks=0;const ends=frames.map(frame=>{ticks+=frame.time;if(!Number.isSafeInteger(ticks*50))throw new Error('Texture animation duration exceeds the supported timer range.');return ticks*50;});
  return{width:frameWidth,height:frameHeight,frames,ends,cycle:ticks*50,interpolate:meta.interpolate===true};
}
export function animationFrame(plan,time){
  if(!Number.isFinite(time)||time<0)throw new Error('Texture animation time must be finite and nonnegative.');
  const tick=(Math.floor(time/50)*50)%plan.cycle;let low=0,high=plan.ends.length-1;
  while(low<high){const middle=(low+high)>>>1;if(tick<plan.ends[middle])high=middle;else low=middle+1;}return low;
}

export function animationState(plan,time){
  const frame=animationFrame(plan,time),start=frame?plan.ends[frame-1]:0,tick=(Math.floor(time/50)*50)%plan.cycle,subFrame=(tick-start)/50;
  const progress=plan.interpolate?Math.trunc(Math.fround(Math.fround(Math.fround(subFrame)/Math.fround(plan.frames[frame].time))*1000)):0;
  return{frame,index:plan.frames[frame].index,next:plan.frames[(frame+1)%plan.frames.length].index,progress};
}
