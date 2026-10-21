import{textureAnimation,animationFrame}from'./texture-animation.mjs';
export class TextureAtlas {
  constructor(device,size=2048){
    this.device=device;this.size=Math.min(size,device.limits.maxTextureDimension2D);
    if(!Number.isSafeInteger(this.size)||this.size<4)throw new Error('Invalid texture atlas dimensions.');
    this.canvas=new OffscreenCanvas(this.size,this.size);this.context=this.canvas.getContext('2d',{willReadFrequently:true});
    if(!this.context)throw new Error('A texture decoding canvas is unavailable.');this.context.imageSmoothingEnabled=false;
    this.entries=new Map();this.pending=new Map();this.x=1;this.y=1;this.rowHeight=0;this.disposed=false;
    this.texture=device.createTexture({size:[this.size,this.size,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});
    this.sampler=device.createSampler({magFilter:'nearest',minFilter:'nearest',mipmapFilter:'nearest'});
  }
  async add(name,stack){
    if(this.disposed)throw new DOMException('Texture atlas disposed.','AbortError');
    if(this.entries.has(name))return this.entries.get(name);if(this.pending.has(name))return this.pending.get(name);
    const pending=this.load(name,stack);this.pending.set(name,pending);
    try{return await pending;}finally{if(this.pending.get(name)===pending)this.pending.delete(name);}
  }
  async load(name,stack){
    const{bitmap,animation}=await stack.bitmap(name);if(this.disposed)throw new DOMException('Texture atlas disposed.','AbortError');
    const plan=textureAnimation(bitmap.width,bitmap.height,animation,this.size),width=plan.width,height=plan.height;
    let x=this.x,y=this.y,rowHeight=this.rowHeight;
    if(x+width+1>this.size){x=1;y+=rowHeight;rowHeight=0;}
    if(y+height+1>this.size)throw new Error('The texture atlas is full. Use a smaller resource pack.');
    const entry={name,bitmap,x,y,...plan,frame:0,uv:[x/this.size,y/this.size,(x+width)/this.size,(y+height)/this.size]};
    // Classify only referenced frames, once each. Later alpha changes must not require remeshing.
    let transparent=false,partial=false;
    for(const index of new Set(plan.frames.map(frame=>frame.index))){
      this.draw(entry,index);const pixels=this.context.getImageData(x,y,width,height).data;
      for(let at=3;at<pixels.length;at+=4){transparent||=pixels[at]<255;partial||=pixels[at]>0&&pixels[at]<255;}
      if(partial)break;
    }
    entry.transparency=partial?'blend':transparent?'cutout':'opaque';this.upload(entry,plan.frames[0].index);
    // Commit atlas space only after metadata, reads and initial upload succeed.
    this.entries.set(name,entry);this.x=x+width+2;this.y=y;this.rowHeight=Math.max(rowHeight,height+2);return entry;
  }
  draw(entry,index){
    const columns=entry.bitmap.width/entry.width,sx=index%columns*entry.width,sy=Math.floor(index/columns)*entry.height;
    this.context.clearRect(entry.x,entry.y,entry.width,entry.height);
    this.context.drawImage(entry.bitmap,sx,sy,entry.width,entry.height,entry.x,entry.y,entry.width,entry.height);
  }
  upload(entry,index){
    this.draw(entry,index);const{x,y,width:w,height:h}=entry,c=this.context;
    // Duplicate the four edge rows/columns and corners into the allocated one-pixel gutter.
    // Clear the old border first so transparent frames erase earlier opaque pixels.
    c.clearRect(x-1,y-1,w+2,1);c.clearRect(x-1,y+h,w+2,1);c.clearRect(x-1,y,1,h);c.clearRect(x+w,y,1,h);
    {
      for(const[sy,dy]of[[y,y-1],[y+h-1,y+h]])c.drawImage(this.canvas,x,sy,w,1,x,dy,w,1);
      for(const[sx,dx]of[[x,x-1],[x+w-1,x+w]])c.drawImage(this.canvas,sx,y,1,h,dx,y,1,h);
      for(const[sx,dx]of[[x,x-1],[x+w-1,x+w]])for(const[sy,dy]of[[y,y-1],[y+h-1,y+h]])c.drawImage(this.canvas,sx,sy,1,1,dx,dy,1,1);
    }
    this.device.queue.copyExternalImageToTexture({source:this.canvas,origin:[x-1,y-1]},{texture:this.texture,origin:[x-1,y-1]},[w+2,h+2]);
  }
  pause(){this.paused=true;}
  update(time){
    if(this.disposed||this.paused)return false;let changed=false;
    for(const entry of this.entries.values())if(entry.frames.length>1){const frame=animationFrame(entry,time);if(frame!==entry.frame){if(entry.frames[frame].index!==entry.frames[entry.frame].index){this.upload(entry,entry.frames[frame].index);changed=true;}entry.frame=frame;}}
    return changed;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.texture.destroy();this.entries.clear();this.pending.clear();this.canvas.width=1;this.canvas.height=1;}
}
