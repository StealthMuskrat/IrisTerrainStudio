import{sourceTransparency,spriteTransparency,transparencyName,MATERIAL_SCAN_LIMIT}from'./face-materials.mjs';
import{textureMipmaps,spriteMipLevel,textureMipmapMetadata}from'./texture-mipmaps.mjs';
import{textureAnimation,animationState}from'./texture-animation.mjs';
import{textureFramePixels}from'./texture-pixels.mjs';
export class TextureAtlas {
  constructor(device,size=2048,{mipLevels=0}={}){
    if(!Number.isInteger(mipLevels)||mipLevels<0||mipLevels>4)throw new Error('Atlas mip level must be an integer from zero to four.');
    this.device=device;this.requestedMipLevel=this.mipmapLevel=mipLevels;this.padding=2**mipLevels;this.mipBytes=0;this.materialWork=0;this.size=Math.floor(Math.min(size,device.limits.maxTextureDimension2D)/this.padding)*this.padding;
    if(!Number.isSafeInteger(this.size)||this.size<Math.max(4,this.padding*3))throw new Error('Invalid texture atlas dimensions.');
    this.alpha=new Uint8Array(this.size*this.size);this.entries=new Map();this.pending=new Map();this.x=this.padding;this.y=this.padding;this.rowHeight=0;this.disposed=false;this.epoch=null;this.tick=-1;
    try{this.texture=device.createTexture({size:[this.size,this.size,1],mipLevelCount:mipLevels+1,format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});this.sampler=this.createSampler(this.mipmapLevel);}catch(error){this.texture?.destroy();throw error;}
  }
  createSampler(level){return this.device.createSampler({magFilter:'nearest',minFilter:'nearest',mipmapFilter:this.requestedMipLevel?'linear':'nearest',lodMinClamp:0,lodMaxClamp:level});}
  async add(name,stack){
    if(this.disposed)throw new DOMException('Texture atlas disposed.','AbortError');
    if(this.entries.has(name))return this.entries.get(name);if(this.pending.has(name))return this.pending.get(name);
    const pending=this.load(name,stack);this.pending.set(name,pending);
    try{return await pending;}finally{if(this.pending.get(name)===pending)this.pending.delete(name);}
  }
  async load(name,stack){
    const raster=await stack.bitmap(name);if(this.disposed)throw new DOMException('Texture atlas disposed.','AbortError');
    const plan=textureAnimation(raster.width,raster.height,raster.animation,this.size),width=plan.width,height=plan.height;
    const padding=this.padding,slotWidth=Math.ceil(width/padding)*padding+2*padding,slotHeight=Math.ceil(height/padding)*padding+2*padding;let x=this.x,y=this.y,rowHeight=this.rowHeight;
    if(x+slotWidth-padding>this.size){x=padding;y+=rowHeight;rowHeight=0;}if(y+slotHeight-padding>this.size)throw new Error('The texture atlas is full. Use a smaller resource pack.');
    const entry={name,pixels:raster.pixels,sourceWidth:raster.width,sourceHeight:raster.height,x,y,...plan,frame:0,progress:0,renderKey:plan.frames[0].index+'/static',uv:[x/this.size,y/this.size,(x+width)/this.size,(y+height)/this.size]};
    let charge=0;const level=spriteMipLevel(width,height,this.requestedMipLevel);if(this.requestedMipLevel){for(let i=0;i<=level;i++)charge+=(raster.width/2**i)*(raster.height/2**i)*4;if(charge>64*1024*1024-this.mipBytes)throw new Error('Texture atlas exceeds its 64 MiB retained mipmap budget.');entry.mipmaps=textureMipmaps(name,raster,level,raster.texture??textureMipmapMetadata());entry.pixels=entry.mipmaps[0].pixels;}
    const nextLevel=Math.min(this.mipmapLevel,level),sampler=nextLevel===this.mipmapLevel?this.sampler:this.createSampler(nextLevel);
    entry.sourceTransparency=sourceTransparency(entry,amount=>this.chargeMaterial(amount));entry.transparency=transparencyName(entry.sourceTransparency);this.upload(entry,plan.frames[0].index);
    this.entries.set(name,entry);this.x=x+slotWidth;this.y=y;this.rowHeight=Math.max(rowHeight,slotHeight);this.mipmapLevel=nextLevel;this.sampler=sampler;this.mipBytes+=charge;return entry;
  }
  chargeMaterial(amount){if(!Number.isSafeInteger(amount)||amount<0||amount>MATERIAL_SCAN_LIMIT-this.materialWork)throw new Error('Texture material inspection exceeds its bounded 32 Mi-pixel work budget.');this.materialWork+=amount;}
  transparencyAt(entry,uv){if(this.disposed||this.entries.get(entry.name)!==entry)throw new Error('Face material requires the current owned atlas entry.');return spriteTransparency(entry,uv,amount=>this.chargeMaterial(amount));}
  upload(entry,index,next=index,progress=0){
    let base;const count=entry.mipmaps?.length??1;for(let level=0;level<count;level++){const scale=2**level,border=this.padding/scale,image=entry.mipmaps?.[level],source=image?{...entry,pixels:image.pixels,sourceWidth:image.width,sourceHeight:image.height,width:entry.width/scale,height:entry.height/scale}:entry,pixels=textureFramePixels(source,index,next,progress,border),width=source.width+2*border,height=source.height+2*border,x=entry.x/scale-border,y=entry.y/scale-border;
      this.device.queue.writeTexture({texture:this.texture,mipLevel:level,origin:[x,y]},pixels,{bytesPerRow:width*4,rowsPerImage:height},[width,height]);if(level===0)base={pixels,width,height,x,y};
    }const{pixels,width,height,x,y}=base;for(let row=0;row<height;row++)for(let column=0;column<width;column++)this.alpha[(y+row)*this.size+x+column]=pixels[(row*width+column)*4+3];
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
  dispose(){if(this.disposed)return;this.disposed=true;this.texture.destroy();this.entries.clear();this.pending.clear();this.alpha=null;this.mipBytes=0;}
}
