import{checkedShaderModule}from'./gpu-validation.mjs';
import{categoryColor}from'./field-data.mjs';
const pipelines=new WeakMap(),shader=`
struct Vertex{@builtin(position) position:vec4f,@location(0) color:vec4f};
@vertex fn vertex(@location(0) uv:vec2f,@location(1) color:vec4f)->Vertex{var result:Vertex;result.position=vec4f(uv.x*2.-1.,1.-uv.y*2.,0.,1.);result.color=color;return result;}
@fragment fn fragment(in:Vertex)->@location(0) vec4f{return in.color;}`;
export function prepareHydrologyPipelines(device,format){let formats=pipelines.get(device);if(!formats){formats=new Map();pipelines.set(device,formats);}if(!formats.has(format)){const module=checkedShaderModule(device,{label:'Retained native hydrology graph',code:shader}),vertex={module,entryPoint:'vertex',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,offset:0,format:'float32x2'},{shaderLocation:1,offset:8,format:'float32x4'}]}]},fragment={module,entryPoint:'fragment',targets:[{format}]};formats.set(format,{lines:device.createRenderPipeline({label:'Hydrology centerlines',layout:'auto',vertex,fragment,primitive:{topology:'line-list'}}),markers:device.createRenderPipeline({label:'Hydrology graph markers',layout:'auto',vertex,fragment,primitive:{topology:'triangle-list'}})});}return formats.get(format);}
export function hydrologyLineVertices(data,index){const count=index.segments.reduce((n,row)=>n+Math.max(0,row.segment.points.length-1)*2,0),vertices=new Float32Array(count*6),left=data.x-data.span/2,top=data.z-data.depth/2;let at=0;
  for(const{segment}of index.segments){const color=categoryColor(segment.type);for(let i=1;i<segment.points.length;i++){const a=segment.points[i-1],b=segment.points[i],delta=[b[0]-a[0],b[2]-a[2]],start=[a[0],a[2]],minimum=[left,top],maximum=[left+data.span,top+data.depth];let low=0,high=1;
    for(let axis=0;axis<2;axis++){if(delta[axis]===0){if(start[axis]<minimum[axis]||start[axis]>maximum[axis]){high=-1;break;}}else{const p=(minimum[axis]-start[axis])/delta[axis],q=(maximum[axis]-start[axis])/delta[axis];low=Math.max(low,Math.min(p,q));high=Math.min(high,Math.max(p,q));}}if(high<low)continue;
    for(const t of[low,high]){vertices.set([Math.max(0,Math.min(1,(a[0]+t*delta[0]-left)/data.span)),Math.max(0,Math.min(1,(a[2]+t*delta[1]-top)/data.depth)),...color],at);at+=6;}
  }}return vertices.slice(0,at);
}
export function hydrologyMarkerVertices(data,index,width,height){const vertices=new Float32Array(index.markers.length*6*6),left=data.x-data.span/2,top=data.z-data.depth/2,dx=3/width,dz=3/height;let at=0;
  for(const marker of index.markers){const color=categoryColor(marker.type),u=(marker.point[0]-left)/data.span,v=(marker.point[2]-top)/data.depth;if(u<-dx||u>1+dx||v<-dz||v>1+dz)continue;for(const[x,y]of[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){vertices.set([u+x*dx,v+y*dz,...color],at);at+=6;}}return vertices.slice(0,at);
}
export class HydrologyOverlay{
  constructor(device,format,data,index){this.device=device;this.data=data;this.index=index;this.pipelines=prepareHydrologyPipelines(device,format);try{const vertices=hydrologyLineVertices(data,index);this.lines=this.upload(vertices);this.lineCount=vertices.length/6;}catch(error){this.dispose();throw error;}}
  upload(vertices){if(!vertices.length)return null;if(vertices.byteLength>this.device.limits.maxBufferSize)throw new Error('Hydrology overlay exceeds the GPU vertex-buffer limit.');const buffer=this.device.createBuffer({label:'Native hydrology diagnostic vertices',size:vertices.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});try{this.device.queue.writeBuffer(buffer,0,vertices);return buffer;}catch(error){buffer.destroy();throw error;}}
  draw(pass,width,height){if(this.disposed)return;if(this.width!==width||this.height!==height){const vertices=hydrologyMarkerVertices(this.data,this.index,width,height),next=this.upload(vertices);this.markers?.destroy();this.markers=next;this.markerCount=vertices.length/6;this.width=width;this.height=height;}if(this.lineCount){pass.setPipeline(this.pipelines.lines);pass.setVertexBuffer(0,this.lines);pass.draw(this.lineCount);}if(this.markerCount){pass.setPipeline(this.pipelines.markers);pass.setVertexBuffer(0,this.markers);pass.draw(this.markerCount);}}
  dispose(){if(this.disposed)return;this.disposed=true;this.lines?.destroy();this.markers?.destroy();this.lines=null;this.markers=null;this.data=null;this.index=null;}
}
