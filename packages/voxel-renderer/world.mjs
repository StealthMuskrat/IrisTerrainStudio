import{meshMaterialRows}from'./mesh-materials.mjs';
import{modelOffsetProfile,blockModelOffset}from'../resource-packs/model-offset.mjs';
import{selectedModelParts}from'../resource-packs/model-selection.mjs';
import{lookAt,perspective,multiply,inverse,transform,normalize,subtract}from'./math.mjs';
import{VoxelVolume}from'./volume.mjs';
import{localClip,clipBounds,clipCenter,emptyClip}from'./clip.mjs';
import{bakeBlockPlan}from'./models.mjs';
import{blockRenderProfile}from'../resource-packs/render-inputs.mjs';
import{prepareFlatLighting,describeFlatLighting}from'./flat-lighting.mjs';
import{prepareBiomeTints}from'../resource-packs/biome-tints.mjs';
import{prepareFluidMaterials}from'./fluids.mjs';
import{TextureAtlas}from'../resource-packs/atlas.mjs';
import{visibleMeshRanges}from'./frustum.mjs';
import{MeshBufferStore}from'./mesh-buffers.mjs';
import{MeshPicker}from'./picking.mjs';
import{MeshSession}from'./mesh-session.mjs';
import{createSelectionPipeline}from'./selection.mjs';
import{voxelViewMode,prepareCellView,CellAtlas}from'./cell-view.mjs';
import{navigationSettings,cameraEye,zoomCamera,cameraBasis,rotateCamera,translateCamera,advanceCamera,MOTION_CODES,cameraView,cameraFromView}from'./navigation.mjs';
const source=`
struct Camera{matrix:mat4x4f,eye:vec4f};@group(0) @binding(0)var<uniform> camera:Camera;@group(0) @binding(1)var atlas:texture_2d<f32>;@group(0) @binding(2)var nearest:sampler;@group(0) @binding(3)var<storage,read> materials:array<vec4f>;
struct Output{@builtin(position) position:vec4f,@location(0) normal:vec3f,@location(1) color:vec4f,@location(2) uv:vec2f,@location(3) distance:f32,@location(4) @interpolate(flat) material:vec4f};
@vertex fn vertex(@builtin(vertex_index) index:u32,@location(0) position:vec3f,@location(1) normal:vec3f,@location(2) color:vec4f,@location(3) uv:vec2f)->Output{var out:Output;out.position=camera.matrix*vec4f(position,1.);out.normal=normal;out.color=color;out.uv=uv;out.material=materials[index/6u];out.distance=distance(position,camera.eye.xyz);return out;}
@fragment fn fragment(in:Output)->@location(0) vec4f{var color=textureSample(atlas,nearest,in.uv)*in.color;if(color.a<in.material.x){discard;}if(camera.eye.w<.5){return color;}let fog=smoothstep(220.,700.,in.distance);return vec4f(mix(color.rgb,vec3f(.061,.089,.092),fog),color.a);}
`;
// Only fully covered opaque unit-cube models can occlude a neighboring face here.
// Other model shapes retain their faces until the exact Minecraft shape adapter is connected.
function opaqueUnitCube(quads){
  if(!Array.isArray(quads))return quads?.kind==='minecraft-model-plan'&&quads.groups.some(group=>group.variants.filter(row=>!group.weighted||row.weight>0).every(row=>opaqueUnitCube(row.quads)));
  const covered=new Set();for(const quad of quads){if(quad.transparency!=='opaque'||quad.positions.length!==4)continue;
    for(let axis=0;axis<3;axis++)for(const side of [0,1]){
      const rest=[0,1,2].filter(value=>value!==axis),corners=new Set();let valid=true;
      for(const point of quad.positions){if(point[axis]!==side||!rest.every(index=>point[index]===0||point[index]===1)){valid=false;break;}corners.add(point[rest[0]]+','+point[rest[1]]);}
      if(valid&&corners.size===4)covered.add(axis+':'+side);
    }
  }return covered.size===6;
}
function sameVoxelData(a,b){return !!a&&!!b&&a.blocks===b.blocks&&a.palette===b.palette&&a.width===b.width&&a.height===b.height&&a.depth===b.depth&&Array.isArray(b.origin)&&b.origin.length===3&&a.origin.every((value,axis)=>value===b.origin[axis]);}
export class WorldRenderer{
  constructor(canvas,gpu){this.canvas=canvas;this.gpu=gpu;this.context=canvas.getContext('webgpu');if(!this.context)throw new Error('A WebGPU world canvas could not be created.');try{this.context.configure({device:gpu.device,format:gpu.format,alphaMode:'opaque'});this.camera={yaw:Math.PI*.25,pitch:.55,distance:90,target:[0,0,0]};this.volume=null;this.mode='textured';this.atlas=new TextureAtlas(gpu.device);this.uniform=gpu.device.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});this.defaultMaterials=gpu.device.createBuffer({size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});gpu.device.queue.writeBuffer(this.defaultMaterials,0,new Float32Array([0,0,0,1]));const module=gpu.device.createShaderModule({code:source,label:'Voxel block model shader'}),vertex={module,entryPoint:'vertex',buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x4'},{shaderLocation:3,offset:40,format:'float32x2'}]}]};
    this.pipeline=gpu.device.createRenderPipeline({layout:'auto',vertex,fragment:{module,entryPoint:'fragment',targets:[{format:gpu.format}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less-equal'}});
    this.transparentPipeline=gpu.device.createRenderPipeline({layout:this.pipeline.getBindGroupLayout(0)?gpu.device.createPipelineLayout({bindGroupLayouts:[this.pipeline.getBindGroupLayout(0)]}):'auto',vertex,fragment:{module,entryPoint:'fragment',targets:[{format:gpu.format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal'}});
    this.selectionPipeline=createSelectionPipeline(gpu.device,this.pipeline.getBindGroupLayout(0),gpu.format);
    this.navigation=navigationSettings();this.motionKeys=new Set();this.bind();this.controls();this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);this.frame=0;this.animate=time=>{if(this.disposed)return;const moved=this.stepNavigation(time),animated=this.volume&&this.atlas.update(time);if(moved||animated)this.draw();this.frame=requestAnimationFrame(this.animate);};this.frame=requestAnimationFrame(this.animate);
    }catch(error){this.dispose();throw error;}
  }
  bind(){this.bindGroups={};for(const name of['opaque','transparent'])this.bindGroups[name]=this.gpu.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.atlas.texture.createView()},{binding:2,resource:this.atlas.sampler},{binding:3,resource:{buffer:this[name+'Materials']??this.defaultMaterials}}]});this.bindGroup=this.bindGroups.opaque;}
  cancelMesh(){this.job=(this.job||0)+1;this.meshSession?.cancel();this.pendingMesh?.dispose();this.pendingMesh=null;}
  suspendTextures(){if(this.disposed)return;this.cancelMesh();this.atlas.pause();}
  async setVolume(input,stack,{clip,mode='textured',blendRadius=0,biomeSampling='stored'}={}){
    if(this.disposed)throw new DOMException('World renderer disposed.','AbortError');
    // Generated inputs are immutable. Reusing the exact committed input avoids another
    // complete block/biome validation scan during an appearance-only replacement.
    const reuse=input===this.volumeInput&&sameVoxelData(this.volume,input)&&this.volume.biomes===(input.biomes||null)&&this.volume.regions===(input.regions||null)&&this.volume.metadata===input.metadata;
    const volume=input instanceof VoxelVolume?input:reuse?this.volume:new VoxelVolume(input);clip=localClip(volume,clip);mode=voxelViewMode(mode);const cells=mode==='textured'?null:prepareCellView(volume,mode);this.cancelMesh();const id=this.job,atlas=cells?new CellAtlas(this.gpu.device):new TextureAtlas(this.gpu.device,2048,{mipLevels:4}),models=cells?.models??[],diagnostics=[],offsetProfiles=[],renderProfiles=[];const lightingInput=cells?null:prepareFlatLighting(volume);if(lightingInput?.reason)diagnostics.push({block:'Lighting',message:lightingInput.reason});let session,tintInput,fluidMaterials;
    try{
      if(!cells)for(let i=0;i<volume.palette.length;i++){
        try{renderProfiles[i]=blockRenderProfile(volume.palette[i]);if(volume.palette[i].air===true||renderProfiles[i].renderShape==='INVISIBLE'){models[i]=[];continue;}offsetProfiles[i]=modelOffsetProfile(volume.palette[i].id);models[i]=await bakeBlockPlan(volume.palette[i],stack,atlas,{tints:volume.palette[i].tints,choices:volume.palette[i].modelChoices});}
        catch(error){models[i]=[];diagnostics.push({block:volume.palette[i].id,message:error.message});}
        if(this.job!==id||this.disposed)throw new DOMException('Voxel meshing cancelled.','AbortError');
      }
      if(!cells){tintInput=await prepareBiomeTints(stack,volume,{blendRadius,samplingMode:biomeSampling});fluidMaterials={};for(const kind of new Set(renderProfiles.filter(Boolean).map(p=>p.fluid).filter(kind=>kind!=='empty'))){try{Object.assign(fluidMaterials,await prepareFluidMaterials(stack,atlas,[kind]));}catch(error){diagnostics.push({block:'minecraft:fluid/'+kind,message:error.message});}}}
      if(this.job!==id||this.disposed)throw new DOMException('Voxel meshing cancelled.','AbortError');
      const meshPalette=cells?.palette??volume.palette.map((block,index)=>({...block,renderProfile:renderProfiles[index]??null,modelOffset:offsetProfiles[index]??null,solid:!offsetProfiles[index]&&opaqueUnitCube(models[index])}));
      session=this.pendingMesh=new MeshSession(volume,models,meshPalette,{cellColors:cells?.cellColors,tintInput,fluidMaterials,lightingInput,onProgress:progress=>this.onProgress?.(progress)});
      const mesh=await session.build(clip,id);
      if(this.job!==id||this.disposed)throw new DOMException('Voxel meshing cancelled.','AbortError');
      const picker=new MeshPicker(volume,mesh);this.uploadMesh(mesh);this.picker=picker;
      const sameVolume=sameVoxelData(this.volume,volume);
      this.meshSession?.dispose();this.meshSession=session;this.pendingMesh=null;
      diagnostics.push(...(mesh.diagnostics??[]));this.atlas.dispose();this.atlas=atlas;this.bind();this.volume=volume;this.volumeInput=input;this.models=models;this.meshPalette=meshPalette;this.mode=mode;this.cellColors=cells?.cellColors;this.clip=clip;this.diagnostics=diagnostics;this.assetDiagnostics=diagnostics.slice(0,diagnostics.length-(mesh.diagnostics?.length??0));this.tintInput=tintInput;this.fluidMaterials=fluidMaterials;this.lightingInput=lightingInput;
      this.faces=mesh.faces;this.meshStats=mesh.stats;if(sameVolume)this.draw();else this.reset();this.onDiagnostics?.(diagnostics);return diagnostics;
    }catch(error){atlas.dispose();session?.dispose();if(this.pendingMesh===session)this.pendingMesh=null;throw error;}
  }
  async setClip(input){
    if(this.disposed)throw new DOMException('World renderer disposed.','AbortError');
    if(!this.volume||!this.models)throw new Error('Generate a stored voxel volume before selecting a cross-section.');
    const volume=this.volume,clip=localClip(volume,input);this.cancelMesh();const id=this.job;
    const before=clipBounds(volume,this.clip),after=clipBounds(volume,clip);
    if(before.min.every((value,axis)=>value===after.min[axis]&&before.max[axis]===after.max[axis]))return this.faces;
    const session=this.meshSession??=new MeshSession(volume,this.models,this.meshPalette,{cellColors:this.cellColors,tintInput:this.tintInput,fluidMaterials:this.fluidMaterials,lightingInput:this.lightingInput,onProgress:progress=>this.onProgress?.(progress)});
    const mesh=await session.build(clip,id);
    if(this.job!==id||this.disposed||this.volume!==volume)throw new DOMException('Voxel meshing cancelled.','AbortError');
    const picker=new MeshPicker(volume,mesh);this.uploadMesh(mesh);this.picker=picker;this.faces=mesh.faces;this.meshStats=mesh.stats;this.clip=clip;this.diagnostics=[...(this.assetDiagnostics??[]),...(mesh.diagnostics??[])];this.onDiagnostics?.(this.diagnostics);this.draw();return mesh.faces;
  }
  focus(world){
    this.stopNavigation();
    if(!this.volume)throw new Error('Generate a stored voxel volume before focusing the camera.');
    const bounds=clipBounds(this.volume,this.clip);
    if(!Array.isArray(world)||world.length!==3||!world.every(Number.isFinite)||emptyClip(bounds)||world.some((value,axis)=>value<this.volume.origin[axis]+bounds.min[axis]||value>=this.volume.origin[axis]+bounds.max[axis]))throw new Error('Choose a point inside the visible stored cross-section.');
    const dimensions=[this.volume.width,this.volume.height,this.volume.depth];this.camera.target=world.map((value,axis)=>value-this.volume.origin[axis]-dimensions[axis]/2);this.camera.distance=Math.min(this.camera.distance,48);this.draw();
  }
  clear(){if(this.disposed)return;this.stopNavigation();this.cancelMesh();this.meshSession?.dispose();this.meshSession=null;this.meshStats=null;this.volume=null;this.volumeInput=null;this.picker=null;this.clearSelection(false);this.models=null;this.meshPalette=null;this.cellColors=null;this.tintInput=null;this.fluidMaterials=null;this.lightingInput=null;this.assetDiagnostics=null;this.mode='textured';this.clip=null;this.ranges=[];this.diagnostics=[];this.faces=0;this.upload('opaque',new Float32Array());this.upload('transparent',new Float32Array());this.draw();}
  uploadMesh(mesh){
    if(this.disposed)throw new DOMException('World renderer disposed.','AbortError');
    const materials=meshMaterialRows(mesh);for(const row of Object.values(materials))if(row.byteLength>(this.gpu.device.limits.maxStorageBufferBindingSize??Infinity))throw new Error('Mesh material data exceeds the GPU storage binding limit.');this.buffers??=new MeshBufferStore(this.gpu.device);
    this.buffers.reserveMany([{name:'opaque',bytes:mesh.opaque.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST},{name:'transparent',bytes:mesh.transparent.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST},{name:'transparentIndices',bytes:mesh.transparent.byteLength/12,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST},...['opaque','transparent'].map(name=>({name:name+'Materials',bytes:materials[name].byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}))]);
    for(const name of['opaque','transparent'])this[name+'Materials']=materials[name].length?this.buffers.write(name+'Materials',materials[name],GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST):null;
    this.upload('opaque',new Float32Array(mesh.opaque));this.upload('transparent',new Float32Array(mesh.transparent));this.ranges=mesh.ranges;this.bind();this.clearSelection(false);
  }
  clearSelection(redraw=true){this.selection=null;this.selectionCount=0;if(redraw)this.draw();}
  select(hit){
    if(this.disposed)throw new DOMException('World renderer disposed.','AbortError');
    if(!hit){this.clearSelection();return;}
    if(hit.meshOwner!==this.picker)throw new Error('The displayed mesh changed. Select a face again.');
    const data=new Float32Array([0,1,1,2,2,3,3,0].flatMap(index=>hit.quad[index]));this.buffers??=new MeshBufferStore(this.gpu.device);
    this.selectionBuffer=this.buffers.write('selection',data,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST);this.selectionCount=8;this.selection=hit;this.draw();
  }
  upload(name,data){
    if(this.disposed)throw new DOMException('World renderer disposed.','AbortError');
    this.buffers??=new MeshBufferStore(this.gpu.device);
    this[name]=this.buffers.write(name,data,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST);this[name+'Count']=data.length/12;
    if(name==='transparent'){
      this.transparentCenters=null;this.transparentIndices=null;this.transparentOrder=null;this.sortedIndices=null;this.sortEye=null;this.sortRanges=null;this.transparentDrawCount=0;
      if(data.length){
        const count=data.length/72;this.transparentCenters=new Float32Array(count*3);this.sortedIndices=new Uint32Array(count*6);
        for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++){let sum=0;for(let vertex=0;vertex<6;vertex++)sum+=data[i*72+vertex*12+axis];this.transparentCenters[i*3+axis]=sum/6;}
        this.transparentIndices=this.buffers.reserve('transparentIndices',this.sortedIndices.byteLength,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST);
      }
    }
  }
  sortTransparent(eye,ranges){
    if(!this.transparentCenters)return;
    const key=ranges.map(range=>range.first+':'+range.count).join(','),sameRanges=this.sortRanges===key;
    if(sameRanges&&this.sortEye?.every((value,index)=>value===eye[index]))return;
    if(!sameRanges){
      const count=ranges.reduce((sum,range)=>sum+range.count/6,0);this.transparentOrder=new Uint32Array(count);let at=0;
      for(const range of ranges)for(let index=range.first/6;index<(range.first+range.count)/6;index++)this.transparentOrder[at++]=index;
    }
    const centers=this.transparentCenters,distance=index=>{const offset=index*3;return(centers[offset]-eye[0])**2+(centers[offset+1]-eye[1])**2+(centers[offset+2]-eye[2])**2;};
    this.transparentOrder.sort((a,b)=>distance(b)-distance(a)||a-b);
    for(let i=0;i<this.transparentOrder.length;i++)for(let vertex=0;vertex<6;vertex++)this.sortedIndices[i*6+vertex]=this.transparentOrder[i]*6+vertex;
    this.transparentDrawCount=this.transparentOrder.length*6;
    if(this.transparentDrawCount)this.gpu.device.queue.writeBuffer(this.transparentIndices,0,this.sortedIndices.subarray(0,this.transparentDrawCount));
    this.sortEye=eye.slice();this.sortRanges=key;
  }
  reset(){
    this.stopNavigation();
    let target=[0,0,0],distance=90;
    if(this.volume){const bounds=clipBounds(this.volume,this.clip);if(!emptyClip(bounds)){const center=clipCenter(this.volume,this.clip),dimensions=[this.volume.width,this.volume.height,this.volume.depth];target=center.map((value,axis)=>value-this.volume.origin[axis]-dimensions[axis]/2);distance=Math.min(4096,Math.max(2,...bounds.max.map((value,axis)=>(value-bounds.min[axis])*1.65)));}}
    this.camera={yaw:Math.PI*.25,pitch:.55,distance,target};this.draw();
  }
  matrices(){const c=this.camera,eye=cameraEye(c),matrix=multiply(perspective(Math.PI/3,this.canvas.width/Math.max(this.canvas.height,1),.1,8192),lookAt(eye,c.target));return{eye,matrix};}
  draw(){
    if(this.disposed)return;
    const rect=this.canvas.getBoundingClientRect();if(rect.width<1||rect.height<1||this.disposed)return;
    const ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
    if(this.canvas.width!==w||this.canvas.height!==h||!this.depth){this.canvas.width=w;this.canvas.height=h;this.depth?.destroy();this.depth=this.gpu.device.createTexture({size:[w,h,1],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});}
    const{eye,matrix}=this.matrices(),visible=visibleMeshRanges(this.ranges??[],matrix);
    this.visibility={opaqueSections:visible.opaque.length,transparentSections:visible.transparent.length,totalSections:this.ranges?.length??0};this.sortTransparent(eye,visible.transparent);
    const uniforms=new Float32Array(20);uniforms.set(matrix);uniforms.set([...eye,this.mode==='textured'||this.mode===undefined?1:0],16);this.gpu.device.queue.writeBuffer(this.uniform,0,uniforms);
    const encoder=this.gpu.device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.061,g:.089,b:.092,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
    pass.setBindGroup(0,this.bindGroup);
    if(this.opaque&&this.opaqueCount&&visible.opaque.length){pass.setPipeline(this.pipeline);pass.setVertexBuffer(0,this.opaque);for(const range of visible.opaque)pass.draw(range.count,1,range.first);}
    if(this.transparent&&this.transparentDrawCount){pass.setPipeline(this.transparentPipeline);pass.setBindGroup(0,this.bindGroups.transparent);pass.setVertexBuffer(0,this.transparent);pass.setIndexBuffer(this.transparentIndices,'uint32');pass.drawIndexed(this.transparentDrawCount);}
    if(this.selectionCount){pass.setPipeline(this.selectionPipeline);pass.setVertexBuffer(0,this.selectionBuffer);pass.draw(this.selectionCount);}
    pass.end();this.gpu.device.queue.submit([encoder.finish()]);
  }
  inspect(clientX,clientY){if(this.disposed||!this.volume||!this.picker)return null;const rect=this.canvas.getBoundingClientRect(),{matrix}=this.matrices(),inv=inverse(matrix),x=(clientX-rect.left)/rect.width*2-1,y=1-(clientY-rect.top)/rect.height*2,near=transform(inv,[x,y,0,1]),far=transform(inv,[x,y,1,1]),offset=[this.volume.origin[0]+this.volume.width/2,this.volume.origin[1]+this.volume.height/2,this.volume.origin[2]+this.volume.depth/2];const alphaCache=new Map();const hit=this.picker.raycast(near.slice(0,3).map((v,i)=>v+offset[i]),normalize(subtract(far.slice(0,3),near.slice(0,3))),4096,{alpha:(u,v)=>this.atlas.sampleAlpha(u,v,alphaCache)});if(hit){const[x,y,z]=[hit.x,hit.y,hit.z].map((value,axis)=>value-this.volume.origin[axis]),model=this.models[this.volume.blocks[x+this.volume.width*(z+this.volume.depth*y)]],parts=Array.isArray(model)?[model]:selectedModelParts(model,hit.block,[hit.x,hit.y,hit.z]);hit.modelApplications=[...new Set(parts.flatMap(part=>part.map(quad=>quad.modelId)).filter(Boolean))];const profile=this.meshPalette[this.volume.blocks[x+this.volume.width*(z+this.volume.depth*y)]].renderProfile;if(profile?.fluid&&profile.fluid!=='empty'&&this.fluidMaterials?.[profile.fluid]){hit.fluid=profile.fluid;hit.modelApplications.push('minecraft:fluid/'+profile.fluid);}hit.tintMode=this.tintInput?.mode??null;hit.blendRadius=this.tintInput?.blendRadius??0;hit.lighting=this.mode==='textured'?describeFlatLighting(this.lightingInput):'Unlit identity colors.';hit.modelOffset=blockModelOffset(this.meshPalette[this.volume.blocks[x+this.volume.width*(z+this.volume.depth*y)]].modelOffset,[hit.x,hit.y,hit.z]);}return hit;}
  configureNavigation(input){
    if(this.disposed)throw new DOMException('World renderer disposed.','AbortError');
    const next=navigationSettings({...this.navigation,...input});this.stopNavigation();this.navigation=next;return{...next};
  }
  stopNavigation(){this.motionKeys?.clear();this.navigationTime=null;this.cancelNavigationDrag?.();}
  stepNavigation(time){
    if(!this.volume||!this.motionKeys?.size){this.navigationTime=null;return false;}
    const rect=this.canvas.getBoundingClientRect();if(rect.width<1||rect.height<1){this.stopNavigation();return false;}
    const previous=this.navigationTime;this.navigationTime=time;
    return previous==null?false:advanceCamera(this.camera,this.motionKeys,(time-previous)/1000,this.navigation??navigationSettings());
  }
  cameraView(){if(!this.volume||this.disposed)throw new Error('Display stored voxels before editing the camera.');return cameraView(this.volume,this.camera);}
  setCameraView(view){
    if(!this.volume||this.disposed)throw new Error('Display stored voxels before editing the camera.');
    const camera=cameraFromView(this.volume,view);this.stopNavigation();this.camera=camera;this.draw();
  }
  controls(){
    this.inputAbort?.abort();this.inputAbort=new AbortController();this.motionKeys??=new Set();let drag=null,moved=false;
    const listen=(name,callback,options={})=>this.canvas.addEventListener(name,callback,{...options,signal:this.inputAbort.signal});
    this.cancelNavigationDrag=()=>{if(drag&&this.canvas.hasPointerCapture?.(drag.pointerId))this.canvas.releasePointerCapture(drag.pointerId);drag=null;};
    this.inputAbort.signal.addEventListener('abort',()=>this.stopNavigation(),{once:true});
    listen('pointerdown',event=>{if(drag||event.isPrimary===false||event.button>1)return;drag={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,pointerId:event.pointerId,shift:event.shiftKey||event.button===1};this.canvas.focus({preventScroll:true});moved=false;this.canvas.setPointerCapture(event.pointerId);});
    listen('pointermove',event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>3)moved=true;
      if(drag.shift){const{right,up}=cameraBasis(this.camera),scale=this.camera.distance/Math.max(this.canvas.clientHeight,1);translateCamera(this.camera,right.map((value,axis)=>-value*dx*scale+up[axis]*dy*scale));}
      else rotateCamera(this.camera,-dx*.007,dy*.007,this.navigation?.mode);
      drag.x=event.clientX;drag.y=event.clientY;this.draw();
    });
    listen('pointerup',event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      try{if(!moved&&event.button===0){const hit=this.inspect(event.clientX,event.clientY);this.select(hit);this.onInspect?.(hit);}}
      catch(error){this.onError?.(error);}finally{this.cancelNavigationDrag();}
    });
    listen('pointercancel',()=>this.cancelNavigationDrag());listen('lostpointercapture',()=>{drag=null;});
    listen('wheel',event=>{event.preventDefault();zoomCamera(this.camera,Math.exp(Math.max(-1000,Math.min(1000,event.deltaY))*.001),this.navigation?.mode,this.navigation?.speed);this.draw();},{passive:false});
    listen('keydown',event=>{
      if(event.key==='Escape'){const active=this.motionKeys.size>0||!!drag||!!this.selection;this.stopNavigation();if(active){event.preventDefault();event.stopPropagation();this.clearSelection();}return;}
      if(event.ctrlKey||event.metaKey||event.altKey){this.stopNavigation();return;}if(event.target&&event.target!==this.canvas||!this.volume)return;
      const code=event.code;if(MOTION_CODES.has(code)&&(this.navigation?.mode==='fly'||code.startsWith('Arrow'))){event.preventDefault();this.motionKeys.add(code);}
      else if(code==='Home'){event.preventDefault();this.stopNavigation();this.reset();}
      else if(event.key==='+'||event.key==='-'||event.key==='='){event.preventDefault();zoomCamera(this.camera,event.key==='-'?1.1:1/1.1,this.navigation?.mode,this.navigation?.speed);this.draw();}
    });
    listen('keyup',event=>{this.motionKeys.delete(event.code);if(!this.motionKeys.size)this.navigationTime=null;});
    listen('blur',()=>this.stopNavigation());
    const host=this.canvas.ownerDocument?.defaultView,doc=this.canvas.ownerDocument;
    host?.addEventListener('keyup',event=>{this.motionKeys.delete(event.code);if(!this.motionKeys.size)this.navigationTime=null;},{signal:this.inputAbort.signal});
    host?.addEventListener('blur',()=>this.stopNavigation(),{signal:this.inputAbort.signal});
    doc?.addEventListener('visibilitychange',()=>{if(doc.hidden)this.stopNavigation();},{signal:this.inputAbort.signal});
    listen('contextmenu',event=>event.preventDefault());
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.stopNavigation();this.inputAbort?.abort();this.picker=null;this.clearSelection(false);cancelAnimationFrame(this.frame);this.cancelMesh();this.meshSession?.dispose();this.meshSession=null;this.models=null;this.meshPalette=null;this.cellColors=null;this.tintInput=null;this.fluidMaterials=null;this.lightingInput=null;this.assetDiagnostics=null;this.volume=null;this.volumeInput=null;this.meshStats=null;this.observer?.disconnect();this.buffers?.dispose();this.uniform?.destroy();this.defaultMaterials?.destroy();this.depth?.destroy();this.atlas?.dispose();this.context?.unconfigure();this.ranges=[];this.transparentCenters=null;this.transparentOrder=null;this.sortedIndices=null;this.transparentIndices=null;this.opaque=null;this.transparent=null;this.onInspect=null;this.onError=null;this.onProgress=null;this.onDiagnostics=null;}
}
