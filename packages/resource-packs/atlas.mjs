import{textureAnimation,animationState}from'./texture-animation.mjs';
import{textureFramePixels}from'./texture-pixels.mjs';
export class TextureAtlas {
  constructor(device,size=2048){
    this.device=device;this.size=Math.min(size,device.limits.maxTextureDimension2D);
    if(!Number.isSafeInteger(this.size)||this.size<4)throw new Error('Invalid texture atlas dimensions.');
    this.alpha=new Uint8Array(this.size*this.size);this.entries=new Map();this.pending=new Map();this.x=1;this.y=1;this.rowHeight=0;this.disposed=false;this.epoch=null;this.tick=-1;
    this.texture=device.createTexture({size:[this.size,this.size,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
    this.sampler=device.createSampler({magFilter:'nearest',minFilter:'nearest',mipmapFilter:'nearest'});
  }
  async add(name,stack){
    if(this.disposed)throw new DOMException('Texture atlas disposed.','AbortError');
    if(this.entries.has(name))return this.entries.get(name);if(this.pending.has(name))return this.pending.get(name);
    const pending=this.load(name,stack);this.pending.set(name,pending);
    try{return await pending;}finally{if(this.pending.get(name)===pending)this.pending.delete(name);}
  }
  async load(name,stack){
    const raster=await stack.bitmap(name);if(this.disposed)throw new DOMException('Texture atlas disposed.','AbortError');
    const plan=textureAnimation(raster.width,raster.height,raster.animation,this.size),width=plan.width,height=plan.height;
    let x=this.x,y=this.y,rowHeight=this.rowHeight;
    if(x+width+1>this.size){x=1;y+=rowHeight;rowHeight=0;}if(y+height+1>this.size)throw new Error('The texture atlas is full. Use a smaller resource pack.');
    const entry={name,pixels:raster.pixels,sourceWidth:raster.width,sourceHeight:raster.height,x,y,...plan,frame:0,progress:0,renderKey:plan.frames[0].index+'/static',uv:[x/this.size,y/this.size,(x+width)/this.size,(y+height)/this.size]};
    let transparent=false,partial=false;
    for(const index of new Set(plan.frames.map(frame=>frame.index))){const pixels=textureFramePixels(entry,index);for(let at=3;at<pixels.length;at+=4){transparent||=pixels[at]<255;partial||=pixels[at]>0&&pixels[at]<255;}if(partial)break;}
    if(plan.interpolate&&transparent&&plan.frames.some(frame=>frame.time>1))partial=true;
    entry.transparency=partial?'blend':transparent?'cutout':'opaque';this.upload(entry,plan.frames[0].index);
    this.entries.set(name,entry);this.x=x+width+2;this.y=y;this.rowHeight=Math.max(rowHeight,height+2);return entry;
  }
  upload(entry,index,next=index,progress=0){
    const pixels=textureFramePixels(entry,index,next,progress),width=entry.width+2,height=entry.height+2,x=entry.x-1,y=entry.y-1;
    this.device.queue.writeTexture({texture:this.texture,origin:[x,y]},pixels,{bytesPerRow:width*4,rowsPerImage:height},[width,height]);
    for(let row=0;row<height;row++)for(let column=0;column<width;column++)this.alpha[(y+row)*this.size+x+column]=pixels[(row*width+column)*4+3];
  }
  pause(){this.paused=true;}
  sampleAlpha(u,v,cache){
    if(this.disposed)throw new DOMException('Texture atlas disposed.','AbortError');if(!Number.isFinite(u)||!Number.isFinite(v))throw new Error('Picking requires finite atlas coordinates.');
    const x=Math.min(this.size-1,Math.max(0,Math.floor(u*this.size))),y=Math.min(this.size-1,Math.max(0,Math.floor(v*this.size))),key=x+y*this.size;if(cache?.has(key))return cache.get(key);const value=this.alpha[key]/255;cache?.set(key,value);return value;
  }
  update(time){
    if(this.disposed||this.paused)return false;if(!Number.isFinite(time)||time<0)throw new Error('Texture animation time must be finite and nonnegative.');
    this.epoch??=time;const elapsed=Math.max(0,time-this.epoch),tick=Math.floor(elapsed/50);if(tick===this.tick)return false;this.tick=tick;let changed=false;
    for(const entry of this.entries.values())if(entry.frames.length>1){const state=animationState(entry,elapsed),key=state.index+'/'+(state.progress>0&&state.index!==state.next?state.next+':'+state.progress:'static');if(key!==entry.renderKey){this.upload(entry,state.index,state.next,state.progress);entry.renderKey=key;changed=true;}entry.frame=state.frame;entry.progress=state.progress;}return changed;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.texture.destroy();this.entries.clear();this.pending.clear();this.alpha=null;}
}
