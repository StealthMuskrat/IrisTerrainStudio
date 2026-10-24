// One stored cell and a controlled raw upload; no browser/GPU execution claim.
import assert from'node:assert/strict';
import fs from'node:fs/promises';
import{CellAtlas,prepareCellView}from'../../packages/voxel-renderer/cell-view.mjs';
import{VoxelVolume}from'../../packages/voxel-renderer/volume.mjs';
const previous=globalThis.GPUTextureUsage,uploads=[];globalThis.GPUTextureUsage={TEXTURE_BINDING:1,COPY_DST:2};
try{
  const device={limits:{maxTextureDimension2D:16},createTexture(){return{destroy(){}};},createSampler(){return{};},queue:{writeTexture(destination,bytes,layout,size){uploads.push({pixels:[...bytes],layout,size});}}},atlas=new CellAtlas(device);
  assert.equal(uploads.length,1);assert.equal(uploads[0].pixels.length,64);assert.ok(uploads[0].pixels.every(v=>v===255));assert.equal(atlas.sampleAlpha(.5,.5),1);
  const volume=new VoxelVolume({width:1,height:1,depth:1,origin:[0,0,0],blocks:new Uint32Array([0]),palette:[{id:'minecraft:stone'}],biomes:{palette:['minecraft:plains'],cells:new Uint16Array([0])}});
  for(const mode of['blocks','biomes']){const view=prepareCellView(volume,mode);assert.equal(view.models[0].length,6);assert.equal(view.cellColors.palette[3],1);}atlas.dispose();
  await fs.writeFile(new URL('../../.local-tools/cell-atlas-raw-upload-results.json',import.meta.url),JSON.stringify({scope:'raw-cell-atlas-upload-targeted',result:'pass',cells:1,views:['blocks','biomes'],whiteCarrierPixels:16,controlledUploadDevice:true,browserVerified:false,webGpuVerified:false},null,2)+'\n');
  console.log('Raw cell atlas: one stored cell, both identity views and the 16-pixel white carrier pass.');
}finally{globalThis.GPUTextureUsage=previous;}
