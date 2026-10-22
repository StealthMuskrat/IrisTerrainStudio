// Tiny authored PNGs and a controlled upload device; no browser/GPU parity claim.
import assert from'node:assert/strict';
import{deflateSync}from'node:zlib';
import{crc32}from'../../packages/shared/zip.mjs';
import{TextureAtlas}from'../../packages/resource-packs/atlas.mjs';
import{textureAnimation}from'../../packages/resource-packs/texture-animation.mjs';
import{decodeTexturePng}from'../../packages/resource-packs/texture-pixels.mjs';
import{decodeNativePng}from'../../packages/iris-engine/png.mjs';
import{ResourcePackStack,MinecraftResourcePack}from'../../packages/resource-packs/pack.mjs';
export function tinyPng(width,height,rows,{depth=8,color=6,palette,transparency}={}){
  const chunk=(type,data)=>{const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);out.set(data,8);out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;},header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=depth;header[9]=color;
  return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),...(palette?[chunk('PLTE',Buffer.from(palette))]:[]),...(transparency?[chunk('tRNS',Buffer.from(transparency))]:[]),chunk('IDAT',deflateSync(Buffer.from(rows.flatMap(row=>[0,...row])))),chunk('IEND',Buffer.alloc(0))]));
}
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
export async function texturePipelineChecks(){
  const rgba=tinyPng(1,3,[[200,10,50,0],[20,240,100,255],[99,80,3,128]]),rgb=tinyPng(1,1,[[7,22,33]],{color:2}),indexed=tinyPng(2,1,[[64]],{color:3,depth:1,palette:[255,0,0,0,255,0],transparency:[0,255]}),gray=tinyPng(2,1,[[64]],{color:0,depth:2,transparency:[0,1]}),wide=tinyPng(1,1,[[17,3,34,4,51,5,68,6]],{depth:16});
  const raster=await decodeTexturePng(rgba);assert.deepEqual([...raster.pixels],[200,10,50,0,20,240,100,255,99,80,3,128]);assert.deepEqual([...(await decodeTexturePng(rgb)).pixels],[7,22,33,255]);assert.deepEqual([...(await decodeTexturePng(indexed)).pixels],[255,0,0,0,0,255,0,255]);assert.deepEqual([...(await decodeTexturePng(gray)).pixels],[85,85,85,0,0,0,0,255]);assert.deepEqual([...(await decodeTexturePng(wide)).pixels],[17,34,51,68]);assert.deepEqual([...(await decodeNativePng(gray)).samples],[85,255,0,255]);
  const texturePath='assets/demo/textures/block/pixel.png',entries=new Map([[texturePath,rgba],[texturePath+'.mcmeta',encode({animation:{frametime:2,interpolate:true,frames:[0,1,0]}})]]),pack=new MinecraftResourcePack('tiny pixels',entries,{pack:{min_format:97,max_format:97}},'authored-fixture'),stack=new ResourcePackStack([pack]);
  const[a,b]=await Promise.all([stack.bitmap('demo:block/pixel'),stack.bitmap('demo:block/pixel')]);assert.equal(a,b);assert.equal(stack.bitmapBytes,12);
  const previous=globalThis.GPUTextureUsage;globalThis.GPUTextureUsage={TEXTURE_BINDING:1,COPY_DST:2};const uploads=[],device={limits:{maxTextureDimension2D:16},createTexture(){return{destroy(){}};},createSampler(){return{};},queue:{writeTexture(destination,pixels,layout,size){uploads.push({origin:destination.origin,pixels:[...pixels],layout,size});}}};
  try{
    const atlas=new TextureAtlas(device,16),first=await atlas.add('demo:block/pixel',stack);assert.equal(first.transparency,'blend');assert.deepEqual(uploads[0].pixels.slice(16,20),[200,10,50,0]);assert.equal(atlas.update(100),false);assert.equal(atlas.update(150),true);assert.deepEqual(uploads.at(-1).pixels.slice(16,20),[110,125,75,128]);assert.ok(uploads.at(-1).pixels.every((v,i)=>v===[110,125,75,128][i%4]));assert.equal(atlas.sampleAlpha(first.uv[0],first.uv[1]),128/255);const count=uploads.length;assert.equal(atlas.update(151),false);assert.equal(uploads.length,count);assert.equal(atlas.update(200),true);assert.equal(atlas.update(250),true);assert.equal(atlas.update(300),true);assert.deepEqual(uploads.at(-1).pixels.slice(16,20),[200,10,50,0]);assert.equal(atlas.update(350),false);atlas.pause();assert.equal(atlas.update(450),false);
    const before={x:atlas.x,y:atlas.y,entries:atlas.entries.size};await assert.rejects(atlas.add('invalid',{async bitmap(){return{...raster,animation:{frametime:0}};}}),/frametime/);assert.deepEqual({x:atlas.x,y:atlas.y,entries:atlas.entries.size},before);
    let finish;const late=atlas.add('late',{bitmap(){return new Promise(resolve=>finish=resolve);}});atlas.dispose();const rejected=assert.rejects(late,{name:'AbortError'});finish({...raster,animation:null});await rejected;
  }finally{globalThis.GPUTextureUsage=previous;}
  for(const animation of[{frametime:0},{width:0},{height:1.5},{frames:[{index:0,time:0}]},{frames:[3]},{frames:'0'},{interpolate:'false'}])assert.throws(()=>textureAnimation(2,4,animation));
  const malformed=new ResourcePackStack([new MinecraftResourcePack('malformed',new Map([[texturePath,rgba],[texturePath+'.mcmeta',new TextEncoder().encode('{')]]),{pack:{min_format:97,max_format:97}},'malformed-fixture')]);await assert.rejects(malformed.bitmap('demo:block/pixel'),/JSON/);assert.equal(malformed.bitmapBytes,0);assert.equal(malformed.bitmaps.size,0);await malformed.dispose();
  // Controlled counter checks admission without allocating or decoding a large texture.
  stack.bitmapBytes=64*1024*1024;await assert.rejects(stack.bitmap('demo:block/other'),/Missing texture/);pack.entries.set('assets/demo/textures/block/other.png',rgb);stack.resolved.delete('assets/demo/textures/block/other.png');await assert.rejects(stack.bitmap('demo:block/other'),/64 MiB/);stack.bitmapBytes=12;
  await stack.dispose();await stack.dispose();assert.equal(a.pixels,null);assert.equal(stack.bitmapBytes,0);await assert.rejects(stack.bitmap('demo:block/pixel'),{name:'AbortError'});
  return{authoredPngs:5,decodedPixels:9,rawRgbaAndHiddenColor:true,paletteAndGrayTransparency:true,sixteenBitHighBytes:true,irisPackedGrayDefaultUnchanged:true,controlledUploadDevice:true,interpolatedAlphaAndGutters:true,tickOnlyUpdates:true,repeatedFramesAndRestore:true,ownedDecodeCache:true,metadataFailureRecovery:true,admissionWithoutLargeAllocation:true,disposedPendingAtlasRefused:true,browserVerified:false,webGpuVerified:false};
}
