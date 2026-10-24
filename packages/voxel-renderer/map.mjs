import{checkedShaderModule}from'./gpu-validation.mjs';
import{FieldIndex,displayRange,categoryColor}from'./field-data.mjs';
import{HydrologyOverlay,prepareHydrologyPipelines}from'./hydrology-overlay.mjs';
const shader = `
struct Settings { dimensions:vec4f, range:vec4f, world:vec4f, options:vec4f };
@group(0) @binding(0) var<storage, read> values:array<f32>;
@group(0) @binding(1) var<uniform> settings:Settings;
@group(0) @binding(2) var<storage, read> categories:array<vec4f>;
struct Vertex { @builtin(position) position:vec4f, @location(0) uv:vec2f };
@vertex fn vertex(@builtin(vertex_index) index:u32)->Vertex {
  let positions=array<vec2f,3>(vec2f(-1.,-1.),vec2f(3.,-1.),vec2f(-1.,3.)); var result:Vertex;
  result.position=vec4f(positions[index],0.,1.); result.uv=vec2f((positions[index].x+1.)*.5,1.-(positions[index].y+1.)*.5); return result;
}
fn heat(t:f32)->vec3f { let a=vec3f(.10,.16,.39);let b=vec3f(.15,.64,.68);let c=vec3f(.93,.86,.40);let d=vec3f(.86,.28,.20);if(t<.33){return mix(a,b,t/.33);}if(t<.67){return mix(b,c,(t-.33)/.34);}return mix(c,d,(t-.67)/.33); }
@fragment fn fragment(in:Vertex)->@location(0) vec4f {
  let size=vec2u(settings.dimensions.xy);let pixel=min(vec2u(in.uv*vec2f(size)),size-vec2u(1));let value=values[pixel.y*size.x+pixel.x];
  let t=clamp(value,0.,1.);var color:vec3f;
  if(settings.options.x<.5){if(t<.40){color=mix(vec3f(.10,.23,.30),vec3f(.25,.49,.48),t/.40);}else if(t<.74){color=mix(vec3f(.34,.47,.31),vec3f(.62,.63,.40),(t-.40)/.34);}else{color=mix(vec3f(.62,.63,.40),vec3f(.88,.88,.78),(t-.74)/.26);}}
  else if(settings.options.x<1.5){color=vec3f(t);}else{color=heat(t);}
  if(settings.options.z>.5){color=categories[u32(value)].rgb;}
  if(settings.options.y>.5){let world=settings.world.xy+in.uv*settings.world.zw;let cell=abs(fract(world/16.+.5)-.5);let edge=min(cell.x,cell.y);let width=min(settings.world.z/settings.dimensions.z,settings.world.w/settings.dimensions.w)/16.;let grid=1.-smoothstep(0.,max(width*.8,.00001),edge);color=mix(color,vec3f(.08,.14,.13),grid*.38);}
  return vec4f(color,1.);
}`;
export async function createGpuDevice() {
  if (!globalThis.isSecureContext) throw new Error('WebGPU requires HTTPS or localhost. Pack editing remains available.');
  if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser. Pack editing remains available.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); if (!adapter) throw new Error('No WebGPU adapter is available.');
  const device = await adapter.requestDevice(); return { adapter, device, format: navigator.gpu.getPreferredCanvasFormat() };
}
export class MapRenderer {
  constructor(canvas, gpu) {
    this.canvas = canvas; this.gpu = gpu; this.data = null; this.settings = { palette: 'terrain', grid: true,network:true };
    this.context = canvas.getContext('webgpu'); if (!this.context) throw new Error('A WebGPU canvas could not be created.');
    try{this.context.configure({ device: gpu.device, format: gpu.format, alphaMode: 'opaque' });
    const module = checkedShaderModule(gpu.device,{ label: 'Native noise field display', code: shader });
    this.pipeline = gpu.device.createRenderPipeline({ label: '2D field display', layout: 'auto', vertex: { module, entryPoint: 'vertex' }, fragment: { module, entryPoint: 'fragment', targets: [{ format: gpu.format }] }, primitive: { topology: 'triangle-list' } });
    prepareHydrologyPipelines(gpu.device,gpu.format);
    this.uniforms = gpu.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.observer = new ResizeObserver(() => this.draw()); this.observer.observe(canvas);
    }catch(error){this.dispose();throw error;}
  }
  setData(data) {
    if(this.disposed)throw new DOMException('Map renderer disposed.','AbortError');
    const index=new FieldIndex(data),values=index.display(this.settings.range),colors=new Float32Array(data.categories?data.categories.flatMap(categoryColor):[0,0,0,1]),device=this.gpu.device;
    const limit=Math.min(device.limits.maxBufferSize,device.limits.maxStorageBufferBindingSize);if(values.byteLength>limit||colors.byteLength>limit)throw new Error('Map resources exceed the GPU storage-buffer limit.');
    let storage,categoryStorage,bindGroup,networkOverlay;
    try{storage=device.createBuffer({size:values.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});categoryStorage=device.createBuffer({size:colors.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(storage,0,values);device.queue.writeBuffer(categoryStorage,0,colors);bindGroup=device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:storage}},{binding:1,resource:{buffer:this.uniforms}},{binding:2,resource:{buffer:categoryStorage}}]});}
    catch(error){storage?.destroy();categoryStorage?.destroy();throw error;}
    try{networkOverlay=index.network?new HydrologyOverlay(device,this.gpu.format,data,index.network):null;}catch(error){storage.destroy();categoryStorage.destroy();throw error;}
    this.storage?.destroy();this.categoryStorage?.destroy();this.networkOverlay?.dispose();this.networkOverlay=networkOverlay;this.storage=storage;this.categoryStorage=categoryStorage;this.bindGroup=bindGroup;this.data=data;this.index=index;this.draw();this.onData?.(data);
  }
  configure(settings) {
    if(this.disposed)throw new DOMException('Map renderer disposed.','AbortError');
    const next={network:true,...this.settings,...settings};next.range=displayRange(next.range);if(!['terrain','grayscale','heat'].includes(next.palette)||typeof next.grid!=='boolean'||typeof next.network!=='boolean')throw new Error('Choose supported map palette, grid and route-overlay settings.');
    if(this.index&&!this.index.categories&&JSON.stringify(next.range)!==JSON.stringify(this.settings.range))this.gpu.device.queue.writeBuffer(this.storage,0,this.index.display(next.range));
    this.settings=next;this.draw();
  }
  clear() { if(this.disposed)return;this.storage?.destroy();this.categoryStorage?.destroy();this.networkOverlay?.dispose();this.networkOverlay=null;this.categoryStorage=null;this.storage=null; this.bindGroup=null;this.index=null; this.data=null; this.draw();this.onData?.(null); }
  draw() {
    if(this.disposed||this.gpu.ready===false)return;
    const rect = this.canvas.getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) return;
    const ratio = Math.min(devicePixelRatio || 1, 2), width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio)); if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const encoder = this.gpu.device.createCommandEncoder(), pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: .061, g: .089, b: .092, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    if (this.data && this.bindGroup) { const d = this.data, start=[d.x-d.span/2,d.z-d.depth/2],grid=start.map(value=>value-Math.floor(value/16)*16); const parameters = new Float32Array([d.width,d.height,width,height,0,1,0,0,...grid,d.span,d.depth,['terrain','grayscale','heat'].indexOf(this.settings.palette),this.settings.grid ? 1 : 0,d.categories?1:0,0]); this.gpu.device.queue.writeBuffer(this.uniforms, 0, parameters); pass.setPipeline(this.pipeline); pass.setBindGroup(0, this.bindGroup); pass.draw(3); }
    if(this.data&&this.settings.network)this.networkOverlay?.draw(pass,width,height);pass.end(); this.gpu.device.queue.submit([encoder.finish()]);
  }
  inspect(clientX, clientY) { if (this.disposed||!this.index) return null; const r = this.canvas.getBoundingClientRect(), d = this.data, u = (clientX-r.left)/r.width, v = (clientY-r.top)/r.height; if (![u,v].every(Number.isFinite)||u<0||v<0||u>=1||v>=1) return null; return this.index.sample(Math.floor(v*d.height),Math.floor(u*d.width)); }
  dispose() { if(this.disposed)return;this.disposed=true;this.observer?.disconnect();this.storage?.destroy();this.categoryStorage?.destroy();this.networkOverlay?.dispose();this.networkOverlay=null;this.uniforms?.destroy();this.context?.unconfigure();this.storage=null;this.categoryStorage=null;this.bindGroup=null;this.index=null;this.data=null;this.onData=null;this.onError=null; }
}
