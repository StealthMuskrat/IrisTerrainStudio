import{lookAt,perspective,multiply,inverse,transform,normalize,subtract,cross}from'./math.mjs';
import{VoxelVolume}from'./volume.mjs';
import{localClip,clipBounds,clipCenter,emptyClip}from'./clip.mjs';
import{bakeBlock}from'./models.mjs';
import{TextureAtlas}from'../resource-packs/atlas.mjs';
const source=`
struct Camera{matrix:mat4x4f,eye:vec4f};@group(0) @binding(0)var<uniform> camera:Camera;@group(0) @binding(1)var atlas:texture_2d<f32>;@group(0) @binding(2)var nearest:sampler;
struct Output{@builtin(position) position:vec4f,@location(0) normal:vec3f,@location(1) color:vec4f,@location(2) uv:vec2f,@location(3) distance:f32};
@vertex fn vertex(@location(0) position:vec3f,@location(1) normal:vec3f,@location(2) color:vec4f,@location(3) uv:vec2f)->Output{var out:Output;out.position=camera.matrix*vec4f(position,1.);out.normal=normal;out.color=color;out.uv=uv;out.distance=distance(position,camera.eye.xyz);return out;}
@fragment fn fragment(in:Output)->@location(0) vec4f{var color=textureSample(atlas,nearest,in.uv)*in.color;if(color.a<.01){discard;}let light=.48+.52*max(dot(normalize(in.normal),normalize(vec3f(.35,.85,.45))),0.);color=vec4f(color.rgb*light,color.a);let fog=smoothstep(220.,700.,in.distance);return vec4f(mix(color.rgb,vec3f(.061,.089,.092),fog),color.a);}
`;
// Only fully covered opaque unit-cube models can occlude a neighboring face here.
// Other model shapes retain their faces until the exact Minecraft shape adapter is connected.
function opaqueUnitCube(quads){
  const covered=new Set();for(const quad of quads){if(quad.transparency!=='opaque'||quad.positions.length!==4)continue;
    for(let axis=0;axis<3;axis++)for(const side of [0,1]){
      const rest=[0,1,2].filter(value=>value!==axis),corners=new Set();let valid=true;
      for(const point of quad.positions){if(point[axis]!==side||!rest.every(index=>point[index]===0||point[index]===1)){valid=false;break;}corners.add(point[rest[0]]+','+point[rest[1]]);}
      if(valid&&corners.size===4)covered.add(axis+':'+side);
    }
  }return covered.size===6;
}
export class WorldRenderer{
  constructor(canvas,gpu){this.canvas=canvas;this.gpu=gpu;this.context=canvas.getContext('webgpu');if(!this.context)throw new Error('A WebGPU world canvas could not be created.');this.context.configure({device:gpu.device,format:gpu.format,alphaMode:'opaque'});this.camera={yaw:Math.PI*.25,pitch:.55,distance:90,target:[0,0,0]};this.volume=null;this.atlas=new TextureAtlas(gpu.device);this.uniform=gpu.device.createBuffer({size:80,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const module=gpu.device.createShaderModule({code:source,label:'Voxel block model shader'}),vertex={module,entryPoint:'vertex',buffers:[{arrayStride:48,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'float32x4'},{shaderLocation:3,offset:40,format:'float32x2'}]}]};
    this.pipeline=gpu.device.createRenderPipeline({layout:'auto',vertex,fragment:{module,entryPoint:'fragment',targets:[{format:gpu.format}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
    this.transparentPipeline=gpu.device.createRenderPipeline({layout:this.pipeline.getBindGroupLayout(0)?gpu.device.createPipelineLayout({bindGroupLayouts:[this.pipeline.getBindGroupLayout(0)]}):'auto',vertex,fragment:{module,entryPoint:'fragment',targets:[{format:gpu.format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}}]},primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less'}});
    this.bind();this.controls();this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);this.frame=0;this.animate=time=>{if(this.disposed)return;if(this.volume){this.atlas.update(time);this.draw();}this.frame=requestAnimationFrame(this.animate);};this.frame=requestAnimationFrame(this.animate);
  }
  bind(){this.bindGroup=this.gpu.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniform}},{binding:1,resource:this.atlas.texture.createView()},{binding:2,resource:this.atlas.sampler}]});}
  cancelMesh(){this.job=(this.job||0)+1;this.worker?.terminate();this.worker=null;this.meshReject?.(new DOMException('Voxel meshing cancelled.','AbortError'));this.meshReject=null;}
  suspendTextures(){this.cancelMesh();this.atlas.pause();}
  async setVolume(input,stack,{clip}={}){
    const volume=input instanceof VoxelVolume?input:new VoxelVolume(input);clip=localClip(volume,clip);this.cancelMesh();const id=this.job,atlas=new TextureAtlas(this.gpu.device),models=[],diagnostics=[];
    try{
      for(let i=0;i<volume.palette.length;i++){
        try{if(volume.palette[i].air===true){models[i]=[];continue;}models[i]=await bakeBlock(volume.palette[i],stack,atlas,{tints:volume.palette[i].tints,choices:volume.palette[i].modelChoices});}
        catch(error){models[i]=[];diagnostics.push({block:volume.palette[i].id,message:error.message});}
        if(this.job!==id||this.disposed)throw new DOMException('Voxel meshing cancelled.','AbortError');
      }
      const meshPalette=volume.palette.map((block,index)=>({...block,solid:opaqueUnitCube(models[index])}));
      const mesh=await this.buildMesh(volume,models,clip,id,meshPalette);
      if(this.job!==id||this.disposed)throw new DOMException('Voxel meshing cancelled.','AbortError');
      this.atlas.dispose();this.atlas=atlas;this.bind();this.volume=volume;this.models=models;this.meshPalette=meshPalette;this.clip=clip;this.diagnostics=diagnostics;
      this.upload('opaque',new Float32Array(mesh.opaque));this.upload('transparent',new Float32Array(mesh.transparent));
      this.faces=mesh.faces;this.reset();this.onDiagnostics?.(diagnostics);return diagnostics;
    }catch(error){atlas.dispose();if(this.job===id){this.worker?.terminate();this.worker=null;this.meshReject=null;}throw error;}
  }
  async buildMesh(volume,models,clip,id,palette){
    const worker=this.worker=new Worker('/packages/voxel-renderer/mesh-worker.mjs',{type:'module'});let rejectMesh;
    try{return await new Promise((resolve,reject)=>{
      rejectMesh=reject;this.meshReject=reject;
      worker.onmessage=({data})=>{if(id!==this.job||data.id!==id)return;if(data.error){reject(new Error(data.error));return;}if(data.kind==='progress'){this.onProgress?.(data.progress);return;}if(data.kind==='mesh')resolve(data);};
      worker.onerror=event=>reject(new Error(event.message));
      worker.postMessage({id,width:volume.width,height:volume.height,depth:volume.depth,blocks:volume.blocks,palette,models,clip});
    });}finally{worker.terminate();if(this.worker===worker)this.worker=null;if(this.meshReject===rejectMesh)this.meshReject=null;}
  }
  async setClip(input){
    if(!this.volume||!this.models)throw new Error('Generate a stored voxel volume before selecting a cross-section.');
    const volume=this.volume,models=this.models,clip=localClip(volume,input);this.cancelMesh();const id=this.job;
    const mesh=await this.buildMesh(volume,models,clip,id,this.meshPalette);
    if(this.job!==id||this.disposed||this.volume!==volume)throw new DOMException('Voxel meshing cancelled.','AbortError');
    this.upload('opaque',new Float32Array(mesh.opaque));this.upload('transparent',new Float32Array(mesh.transparent));this.faces=mesh.faces;this.clip=clip;this.draw();return mesh.faces;
  }
  focus(world){
    if(!this.volume)throw new Error('Generate a stored voxel volume before focusing the camera.');
    const bounds=clipBounds(this.volume,this.clip);
    if(!Array.isArray(world)||world.length!==3||!world.every(Number.isFinite)||emptyClip(bounds)||world.some((value,axis)=>value<this.volume.origin[axis]+bounds.min[axis]||value>=this.volume.origin[axis]+bounds.max[axis]))throw new Error('Choose a point inside the visible stored cross-section.');
    const dimensions=[this.volume.width,this.volume.height,this.volume.depth];this.camera.target=world.map((value,axis)=>value-this.volume.origin[axis]-dimensions[axis]/2);this.camera.distance=Math.min(this.camera.distance,48);this.draw();
  }
  clear(){this.cancelMesh();this.volume=null;this.models=null;this.meshPalette=null;this.clip=null;this.diagnostics=[];this.faces=0;this.upload('opaque',new Float32Array());this.upload('transparent',new Float32Array());this.draw();}
  upload(name,data){
    this[name]?.destroy();this[name+'Count']=data.length/12;
    if(name==='transparent'){
      this.transparentIndices?.destroy();this.transparentIndices=null;this.transparentCenters=null;this.sortEye=null;
      if(data.length){
        const count=data.length/72;this.transparentCenters=new Float32Array(count*3);this.transparentOrder=new Uint32Array(count);this.sortedIndices=new Uint32Array(count*6);
        for(let i=0;i<count;i++){this.transparentOrder[i]=i;for(let axis=0;axis<3;axis++){let sum=0;for(let vertex=0;vertex<6;vertex++)sum+=data[i*72+vertex*12+axis];this.transparentCenters[i*3+axis]=sum/6;}}
        this.transparentIndices=this.gpu.device.createBuffer({size:this.sortedIndices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});
      }
    }
    if(!data.length){this[name]=null;return;}
    this[name]=this.gpu.device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});this.gpu.device.queue.writeBuffer(this[name],0,data);
  }
  sortTransparent(eye){
    if(!this.transparentCenters||this.sortEye?.every((value,index)=>value===eye[index]))return;
    const centers=this.transparentCenters,distance=index=>{const offset=index*3;return(centers[offset]-eye[0])**2+(centers[offset+1]-eye[1])**2+(centers[offset+2]-eye[2])**2;};
    this.transparentOrder.sort((a,b)=>distance(b)-distance(a)||a-b);
    for(let i=0;i<this.transparentOrder.length;i++)for(let vertex=0;vertex<6;vertex++)this.sortedIndices[i*6+vertex]=this.transparentOrder[i]*6+vertex;
    this.gpu.device.queue.writeBuffer(this.transparentIndices,0,this.sortedIndices);this.sortEye=eye.slice();
  }
  reset(){
    let target=[0,0,0],distance=90;
    if(this.volume){const bounds=clipBounds(this.volume,this.clip);if(!emptyClip(bounds)){const center=clipCenter(this.volume,this.clip),dimensions=[this.volume.width,this.volume.height,this.volume.depth];target=center.map((value,axis)=>value-this.volume.origin[axis]-dimensions[axis]/2);distance=Math.min(4096,Math.max(2,...bounds.max.map((value,axis)=>(value-bounds.min[axis])*1.65)));}}
    this.camera={yaw:Math.PI*.25,pitch:.55,distance,target};this.draw();
  }
  matrices(){const c=this.camera,eye=[c.target[0]+Math.sin(c.yaw)*Math.cos(c.pitch)*c.distance,c.target[1]+Math.sin(c.pitch)*c.distance,c.target[2]+Math.cos(c.yaw)*Math.cos(c.pitch)*c.distance],matrix=multiply(perspective(Math.PI/3,this.canvas.width/Math.max(this.canvas.height,1),.1,8192),lookAt(eye,c.target));return{eye,matrix};}
  draw(){const rect=this.canvas.getBoundingClientRect();if(rect.width<1||rect.height<1||this.disposed)return;const ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));if(this.canvas.width!==w||this.canvas.height!==h||!this.depth){this.canvas.width=w;this.canvas.height=h;this.depth?.destroy();this.depth=this.gpu.device.createTexture({size:[w,h,1],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});}const{eye,matrix}=this.matrices();this.sortTransparent(eye);const uniforms=new Float32Array(20);uniforms.set(matrix);uniforms.set([...eye,1],16);this.gpu.device.queue.writeBuffer(this.uniform,0,uniforms);const encoder=this.gpu.device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:.061,g:.089,b:.092,a:1},loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:this.depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});pass.setBindGroup(0,this.bindGroup);if(this.opaque){pass.setPipeline(this.pipeline);pass.setVertexBuffer(0,this.opaque);pass.draw(this.opaqueCount);}if(this.transparent){pass.setPipeline(this.transparentPipeline);pass.setVertexBuffer(0,this.transparent);pass.setIndexBuffer(this.transparentIndices,'uint32');pass.drawIndexed(this.transparentCount);}pass.end();this.gpu.device.queue.submit([encoder.finish()]);}
  inspect(clientX,clientY){if(!this.volume)return null;const rect=this.canvas.getBoundingClientRect(),{matrix}=this.matrices(),inv=inverse(matrix),x=(clientX-rect.left)/rect.width*2-1,y=1-(clientY-rect.top)/rect.height*2,near=transform(inv,[x,y,0,1]),far=transform(inv,[x,y,1,1]),offset=[this.volume.origin[0]+this.volume.width/2,this.volume.origin[1]+this.volume.height/2,this.volume.origin[2]+this.volume.depth/2];return this.volume.raycast(near.slice(0,3).map((v,i)=>v+offset[i]),normalize(subtract(far.slice(0,3),near.slice(0,3))),4096,{clip:this.clip,visible:(block,index)=>!!this.models?.[index]?.length});}
  controls(){let drag=null,moved=false;this.canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,shift:event.shiftKey||event.button===1};moved=false;this.canvas.setPointerCapture(event.pointerId);});this.canvas.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>1)moved=true;if(drag.shift){const{eye}=this.matrices(),forward=normalize(subtract(this.camera.target,eye)),right=normalize(cross(forward,[0,1,0])),up=cross(right,forward),scale=this.camera.distance/Math.max(this.canvas.clientHeight,1);this.camera.target=this.camera.target.map((v,i)=>v-right[i]*dx*scale+up[i]*dy*scale);}else{this.camera.yaw-=dx*.007;this.camera.pitch=Math.max(-1.5,Math.min(1.5,this.camera.pitch+dy*.007));}drag.x=event.clientX;drag.y=event.clientY;this.draw();});this.canvas.addEventListener('pointerup',event=>{if(!moved)this.onInspect?.(this.inspect(event.clientX,event.clientY));drag=null;});this.canvas.addEventListener('pointercancel',()=>{drag=null;});this.canvas.addEventListener('wheel',event=>{event.preventDefault();this.camera.distance=Math.max(1,Math.min(4096,this.camera.distance*Math.exp(event.deltaY*.001)));this.draw();},{passive:false});this.canvas.addEventListener('contextmenu',event=>event.preventDefault());}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.cancelMesh();this.observer.disconnect();this.opaque?.destroy();this.transparent?.destroy();this.transparentIndices?.destroy();this.uniform.destroy();this.depth?.destroy();this.atlas.dispose();this.context.unconfigure();}
}
