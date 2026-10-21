// Tiny controlled canvas/device fixtures. No browser/GPU parity claim, terrain or registry checks.
import assert from'node:assert/strict';
import fs from'node:fs/promises';
import vm from'node:vm';
import{createHash}from'node:crypto';
import{textureAnimation,animationFrame}from'../../packages/resource-packs/texture-animation.mjs';
import{TextureAtlas}from'../../packages/resource-packs/atlas.mjs';
import{ResourcePackStack,MinecraftResourcePack}from'../../packages/resource-packs/pack.mjs';
import{WorldRenderer}from'../../packages/voxel-renderer/world.mjs';
import{bakeBlock}from'../../packages/voxel-renderer/models.mjs';

const rgba=(...rows)=>new Uint8ClampedArray(rows.flat()),opaque=[10,20,30,255],cutout=[0,0,0,0],partial=[80,90,100,127];
class Canvas{
 constructor(width,height){this.width=width;this.height=height;this.pixels=new Uint8ClampedArray(width*height*4);this.context=new Context(this);}
 getContext(){return this.context;}
}
class Context{
 constructor(canvas){this.canvas=canvas;}
 clearRect(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)this.canvas.pixels.fill(0,(yy*this.canvas.width+xx)*4,(yy*this.canvas.width+xx+1)*4);}
 drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh){
  if(source.closed)throw Error('Closed bitmap used');assert.equal(sw,dw);assert.equal(sh,dh);
  const snapshot=source.pixels.slice();
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
   const from=((sy+y)*source.width+sx+x)*4,to=((dy+y)*this.canvas.width+dx+x)*4,a=snapshot[from+3]/255,b=this.canvas.pixels[to+3]/255,out=a+b*(1-a);
   for(let band=0;band<3;band++)this.canvas.pixels[to+band]=out?(snapshot[from+band]*a+this.canvas.pixels[to+band]*b*(1-a))/out:0;
   this.canvas.pixels[to+3]=out*255;
  }
 }
 getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let row=0;row<h;row++)data.set(this.canvas.pixels.subarray(((y+row)*this.canvas.width+x)*4,((y+row)*this.canvas.width+x+w)*4),row*w*4);return{data};}
}
globalThis.OffscreenCanvas=Canvas;globalThis.GPUTextureUsage={TEXTURE_BINDING:1,COPY_DST:2,RENDER_ATTACHMENT:4};
const uploads=[],device={limits:{maxTextureDimension2D:16},createTexture(){return{destroy(){this.destroyed=true;}};},createSampler(){return{};},queue:{copyExternalImageToTexture(source,destination,size){const[x,y]=source.origin;uploads.push({origin:[x,y],size:[...size],pixels:Array.from(source.source.context.getImageData(x,y,...size).data)});}}};
const bitmap=(width,height,pixels)=>({width,height,pixels,closed:0,close(){this.closed++;}});
const plan=textureAnimation(4,2,{width:2,height:2,frametime:2,frames:[0,{index:1,time:1},1]});
assert.deepEqual([0,99,100,149,150,249,250].map(t=>animationFrame(plan,t)),[0,0,1,1,2,2,0]);
for(const animation of[{frametime:0},{width:0},{height:1.5},{frames:[{index:0,time:0}]},{frames:[3]},{frames:'0'},{interpolate:'false'},{interpolate:true}])assert.throws(()=>textureAnimation(2,4,animation));
assert.throws(()=>textureAnimation(1,8192,{width:1,height:1}),/frame budget/);assert.throws(()=>textureAnimation(1,1,{frametime:Number.MAX_SAFE_INTEGER}),/timer/);
const frames=bitmap(4,2,rgba(opaque,opaque,partial,opaque,opaque,opaque,cutout,opaque)),atlas=new TextureAtlas(device,16);let loads=0;
const stack={async bitmap(){loads++;return{bitmap:frames,animation:{width:2,height:2,frames:[0,1]}};}};
const[a,b]=await Promise.all([atlas.add('animated',stack),atlas.add('animated',stack)]);assert.equal(a,b);assert.equal(loads,1);assert.equal(a.transparency,'blend');
function gutter(upload,content){assert.deepEqual(upload.size,[4,4]);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const source=(Math.min(1,Math.max(0,y-1))*2+Math.min(1,Math.max(0,x-1)))*4;assert.deepEqual(upload.pixels.slice((y*4+x)*4,(y*4+x+1)*4),content.slice(source,source+4));}}
gutter(uploads.at(-1),Array(4).fill(opaque).flat());atlas.update(50);gutter(uploads.at(-1),[...partial,...opaque,...cutout,...opaque]);
const firstPixels=uploads.at(-1).pixels.slice(),other=bitmap(1,1,rgba([200,0,0,255]));await atlas.add('other',{async bitmap(){return{bitmap:other,animation:null};}});const oldOther=Array.from(atlas.context.getImageData(6,1,1,1).data);atlas.update(100);assert.deepEqual(Array.from(atlas.context.getImageData(6,1,1,1).data),oldOther);gutter(uploads.at(-1),Array(4).fill(opaque).flat());assert.notDeepEqual(firstPixels,uploads.at(-1).pixels);
const onlyOpaque=await atlas.add('only-used',{async bitmap(){return{bitmap:frames,animation:{width:2,height:2,frames:[0]}};}});assert.equal(onlyOpaque.transparency,'opaque');
const quads=await bakeBlock({id:'check:block'},{blockModels(){return[{model:{id:'check:model',elements:[{from:[0,0,0],to:[16,16,16],faces:{north:{texture:'check:animated'}}}]},x:0,y:0}];},texture(){return'animated';}},atlas);assert.equal(quads[0].transparency,'blend');
const messages=[],context=vm.createContext({self:{postMessage:data=>messages.push(data)},Float32Array,setTimeout});vm.runInContext(await fs.readFile(new URL('../../packages/voxel-renderer/mesh-worker.mjs',import.meta.url),'utf8'),context);await context.self.onmessage({data:{id:1,width:1,height:1,depth:1,blocks:new Uint32Array([0]),palette:[{id:'check:block'}],models:[quads]}});assert.equal(messages.at(-1).opaque.byteLength,0);assert.equal(messages.at(-1).transparent.byteLength,6*12*4);
const before={x:atlas.x,y:atlas.y,rowHeight:atlas.rowHeight,size:atlas.entries.size};await assert.rejects(atlas.add('invalid',{async bitmap(){return{bitmap:other,animation:{frametime:0}};}}),/frametime/);assert.deepEqual({x:atlas.x,y:atlas.y,rowHeight:atlas.rowHeight,size:atlas.entries.size},before);await atlas.add('invalid',{async bitmap(){return{bitmap:other,animation:null};}});
let resolveLate;const late=atlas.add('late',{bitmap(){return new Promise(resolve=>resolveLate=resolve);}});atlas.dispose();const lateRejected=assert.rejects(late,e=>e.name==='AbortError');resolveLate({bitmap:other,animation:null});await lateRejected;
// The renderer pauses old atlas uploads before closing any source bitmaps.
let cancelled=0,paused=0;WorldRenderer.prototype.suspendTextures.call({cancelMesh(){cancelled++;},atlas:{pause(){paused++;}}});assert.equal(cancelled,1);assert.equal(paused,1);
const pausedAtlas=new TextureAtlas(device,16),pausedEntry=await pausedAtlas.add('pause',stack);pausedAtlas.pause();frames.closed=1;const uploadCount=uploads.length;pausedAtlas.update(50);assert.equal(uploads.length,uploadCount);frames.closed=0;pausedAtlas.dispose();
function header(width,height){const bytes=new Uint8Array(33),view=new DataView(bytes.buffer);bytes.set([137,80,78,71,13,10,26,10]);view.setUint32(8,13);bytes.set([73,72,68,82],12);view.setUint32(16,width);view.setUint32(20,height);return bytes;}
function resourceStack(rows){const entries=new Map();for(const[name,bytes,metadata]of rows){entries.set(`assets/check/textures/${name}.png`,bytes);if(metadata!==undefined)entries.set(`assets/check/textures/${name}.png.mcmeta`,new TextEncoder().encode(metadata));}return new ResourcePackStack([new MinecraftResourcePack('controlled headers',entries,{pack:{}},'controlled-fixture')]);}
let decodeCalls=0,decodeMode='ok';const waiting=[];
globalThis.createImageBitmap=async(blob,options)=>{
 decodeCalls++;assert.equal(options.premultiplyAlpha,'none');const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),width=view.getUint32(16),height=view.getUint32(20);
 if(decodeMode==='defer')return new Promise(resolve=>waiting.push(()=>{const value=bitmap(width,height,new Uint8ClampedArray());resolve(value);return value;}));
 if(decodeMode==='fail')throw Error('controlled decode failure');
 return bitmap(decodeMode==='mismatch'?width+1:width,height,new Uint8ClampedArray());
};
const cached=resourceStack([['small',header(2,2)]]),[one,two]=await Promise.all([cached.bitmap('check:small'),cached.bitmap('check:small')]);assert.equal(one,two);assert.equal(cached.bitmapBytes,16);assert.equal(decodeCalls,1);await cached.dispose();await cached.dispose();assert.equal(one.bitmap.closed,1);assert.equal(cached.bitmapBytes,0);await assert.rejects(cached.bitmap('check:small'),e=>e.name==='AbortError');
const malformed=resourceStack([['bad',header(2,2),'{'],['oversize',header(4096,4096)],['null',header(2,2),'{"animation":null}']]);const beforeDecode=decodeCalls;await assert.rejects(malformed.bitmap('check:bad'),/JSON/);await assert.rejects(malformed.bitmap('check:oversize'),/pixel/);await assert.rejects(malformed.bitmap('check:null'),/object/);assert.equal(decodeCalls,beforeDecode);assert.equal(malformed.bitmapBytes,0);assert.equal(malformed.bitmaps.size,0);await malformed.dispose();
const retry=resourceStack([['retry',header(2,2)]]);decodeMode='fail';await assert.rejects(retry.bitmap('check:retry'),/controlled decode failure/);assert.equal(retry.bitmapBytes,0);assert.equal(retry.bitmaps.size,0);decodeMode='mismatch';await assert.rejects(retry.bitmap('check:retry'),/dimensions differ/);assert.equal(retry.bitmapBytes,0);decodeMode='ok';await retry.bitmap('check:retry');await retry.dispose();
const budget=resourceStack(Array.from({length:5},(_,i)=>['large'+i,header(2048,2048)]));decodeMode='defer';const large=Array.from({length:4},(_,i)=>budget.bitmap('check:large'+i));const allLarge=Promise.allSettled(large);await assert.rejects(budget.bitmap('check:large4'),/64 MiB/);assert.equal(budget.bitmapBytes,64*1024*1024);while(waiting.length<4)await new Promise(r=>setTimeout(r,0));const disposal=budget.dispose(),lateBitmaps=waiting.splice(0).map(resolve=>resolve());await disposal;assert.ok((await allLarge).every(r=>r.status==='rejected'&&r.reason.name==='AbortError'));assert.ok(lateBitmaps.every(bitmap=>bitmap.closed===1));assert.equal(budget.bitmapBytes,0);
const failedAtlas=new TextureAtlas(device,8);await assert.rejects(failedAtlas.add('full',{async bitmap(){return{bitmap:bitmap(7,7,new Uint8ClampedArray()),animation:null};}}),/atlas dimensions/);assert.equal(failedAtlas.entries.size,0);failedAtlas.dispose();
const files=['packages/resource-packs/atlas.mjs','packages/resource-packs/pack.mjs','packages/resource-packs/texture-animation.mjs','packages/voxel-renderer/world.mjs','apps/web/main.mjs','tools/checks/texture-pipeline-smoke.mjs'],hashes=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await fs.readFile(new URL('../../'+file,import.meta.url))).digest('hex')])));
await fs.writeFile(new URL('../../.local-tools/texture-pipeline-smoke-results.json',import.meta.url),JSON.stringify({scope:'texture-rendering-resource-lifecycle-development-targeted',result:'pass',controlledFixtures:{animationPixels:8,staticPixels:1,gutterExtent:[4,4],meshQuads:1,budgetHeaderAdmissions:5,largePixelArraysAllocated:false},checks:['Explicit animation timing, repeated frames, exact boundary and cycle wrap','Malformed metadata/frame/duration/budget and interpolation boundaries','All referenced frames classify alpha; unreferenced alpha excluded','Each upload includes copied one-pixel edges/corners and preserves neighboring atlas entries','Later animated partial alpha reaches the mesh blend buffer','Concurrent atlas adds deduplicate; failed allocation does not consume space; disposed atlas rejects delayed add','Bitmap header admission precedes decoding; owned pending decodes share the 64 MiB budget','Decode/metadata failures evict cached promises and free admission; retries work','Bitmap disposal is idempotent and closes delayed decodes exactly once','Renderer texture-source handoff pauses old uploads before bitmap disposal'],workspaceSha256:hashes,realCanvasVerified:false,browserVerified:false,webGpuVerified:false,minecraftClientParityVerified:false,terrainParityVerified:false,source:'controlled canvas/device/bitmap doubles; no production assets'},null,2)+'\n');
console.log('Texture pipeline passed: tiny animation/gutter/mesh fixtures, header-only memory admission, cancellation/disposal and failed-load recovery. No real browser/GPU or Minecraft parity claim.');
