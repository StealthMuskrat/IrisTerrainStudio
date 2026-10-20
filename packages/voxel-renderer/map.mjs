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
  let t=clamp((value-settings.range.x)/max(settings.range.y-settings.range.x,.00000001),0.,1.);var color:vec3f;
  if(settings.options.x<.5){if(t<.40){color=mix(vec3f(.10,.23,.30),vec3f(.25,.49,.48),t/.40);}else if(t<.74){color=mix(vec3f(.34,.47,.31),vec3f(.62,.63,.40),(t-.40)/.34);}else{color=mix(vec3f(.62,.63,.40),vec3f(.88,.88,.78),(t-.74)/.26);}}
  else if(settings.options.x<1.5){color=vec3f(t);}else{color=heat(t);}
  if(settings.options.z>.5){color=categories[u32(value)].rgb;}
  if(settings.options.y>.5){let world=settings.world.xy+in.uv*settings.world.zw;let cell=abs(fract(world/16.+.5)-.5);let edge=min(cell.x,cell.y);let width=min(settings.world.z/settings.dimensions.z,settings.world.w/settings.dimensions.w)/16.;let grid=1.-smoothstep(0.,max(width*.8,.00001),edge);color=mix(color,vec3f(.08,.14,.13),grid*.38);}
  return vec4f(color,1.);
}`;
// Colors encode category identity only; they are not terrain or material colors.
function categoryColor(key){let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);const hue=(hash>>>0)%360/60,c=.55,x=c*(1-Math.abs(hue%2-1)),m=.24,parts=hue<1?[c,x,0]:hue<2?[x,c,0]:hue<3?[0,c,x]:hue<4?[0,x,c]:hue<5?[x,0,c]:[c,0,x];return [...parts.map(value=>value+m),1];}
export async function createGpuDevice() {
  if (!globalThis.isSecureContext) throw new Error('WebGPU requires HTTPS or localhost. Pack editing remains available.');
  if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser. Pack editing remains available.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); if (!adapter) throw new Error('No WebGPU adapter is available.');
  const device = await adapter.requestDevice(); return { adapter, device, format: navigator.gpu.getPreferredCanvasFormat() };
}
export class MapRenderer {
  constructor(canvas, gpu) {
    this.canvas = canvas; this.gpu = gpu; this.data = null; this.settings = { palette: 'terrain', grid: true };
    this.context = canvas.getContext('webgpu'); if (!this.context) throw new Error('A WebGPU canvas could not be created.');
    this.context.configure({ device: gpu.device, format: gpu.format, alphaMode: 'opaque' });
    const module = gpu.device.createShaderModule({ label: 'Native noise field display', code: shader });
    this.pipeline = gpu.device.createRenderPipeline({ label: '2D field display', layout: 'auto', vertex: { module, entryPoint: 'vertex' }, fragment: { module, entryPoint: 'fragment', targets: [{ format: gpu.format }] }, primitive: { topology: 'triangle-list' } });
    this.uniforms = gpu.device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.observer = new ResizeObserver(() => this.draw()); this.observer.observe(canvas);
    gpu.device.lost.then(info => this.onError?.(new Error('WebGPU device lost: ' + info.message)));
  }
  setData(data) {
    if (!(data.values instanceof Float64Array) || data.values.length !== data.width * data.height) throw new Error('Field data is incomplete.');
    if(data.categories&&(!Array.isArray(data.categories)||!data.categories.length||data.categories.length>65536||data.categories.some(key=>typeof key!=='string')||data.values.some(value=>!Number.isInteger(value)||value<0||value>=data.categories.length)))throw new Error('Categorical field identities are invalid.');
    this.storage?.destroy();this.categoryStorage?.destroy();this.data = data; const values = new Float32Array(data.values),colors=new Float32Array(data.categories?data.categories.flatMap(categoryColor):[0,0,0,1]);
    this.storage = this.gpu.device.createBuffer({ size: Math.max(values.byteLength, 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); this.gpu.device.queue.writeBuffer(this.storage, 0, values);
    this.categoryStorage=this.gpu.device.createBuffer({size:colors.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});this.gpu.device.queue.writeBuffer(this.categoryStorage,0,colors);
    this.bindGroup = this.gpu.device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.storage } }, { binding: 1, resource: { buffer: this.uniforms } },{binding:2,resource:{buffer:this.categoryStorage}}] }); this.draw();
  }
  configure(settings) { Object.assign(this.settings, settings); this.draw(); }
  clear() { this.storage?.destroy();this.categoryStorage?.destroy();this.categoryStorage=null;this.storage=null; this.bindGroup=null; this.data=null; this.draw(); }
  draw() {
    const rect = this.canvas.getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) return;
    const ratio = Math.min(devicePixelRatio || 1, 2), width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio)); if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const encoder = this.gpu.device.createCommandEncoder(), pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: .061, g: .089, b: .092, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    if (this.data && this.bindGroup) { const d = this.data, range = this.settings.range || [d.min, d.max]; const parameters = new Float32Array([d.width,d.height,width,height,range[0],range[1],0,0,d.x-d.span/2,d.z-d.depth/2,d.span,d.depth,['terrain','grayscale','heat'].indexOf(this.settings.palette),this.settings.grid ? 1 : 0,d.categories?1:0,0]); this.gpu.device.queue.writeBuffer(this.uniforms, 0, parameters); pass.setPipeline(this.pipeline); pass.setBindGroup(0, this.bindGroup); pass.draw(3); }
    pass.end(); this.gpu.device.queue.submit([encoder.finish()]);
  }
  inspect(clientX, clientY) { if (!this.data) return null; const r = this.canvas.getBoundingClientRect(), d = this.data, u = (clientX-r.left)/r.width, v = (clientY-r.top)/r.height; if (u<0||v<0||u>=1||v>=1) return null; const column = Math.min(d.width-1,Math.floor(u*d.width)), row = Math.min(d.height-1,Math.floor(v*d.height)); return { x:d.x-d.span/2+(column+.5)*d.span/d.width,z:d.z-d.depth/2+(row+.5)*d.depth/d.height,value:d.values[row*d.width+column],row,column }; }
  dispose() { this.observer.disconnect(); this.storage?.destroy();this.categoryStorage?.destroy();this.uniforms.destroy(); this.context.unconfigure(); }
}
