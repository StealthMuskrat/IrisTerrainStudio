const source=`
struct Camera{matrix:mat4x4f,eye:vec4f};@group(0) @binding(0)var<uniform> camera:Camera;
@vertex fn vertex(@location(0) position:vec3f)->@builtin(position) vec4f{return camera.matrix*vec4f(position,1.);}
@fragment fn fragment()->@location(0) vec4f{return vec4f(1.,.76,.22,1.);}
`;
export function createSelectionPipeline(device,layout,format){
  const module=device.createShaderModule({code:source,label:'Selected model face outline'});
  // WebGPU requires zero depth bias for line topology: https://www.w3.org/TR/webgpu/#depth-stencil-state
  return device.createRenderPipeline({layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:'float32x3'}]}]},fragment:{module,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'line-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal',depthBias:0,depthBiasSlopeScale:0,depthBiasClamp:0}});
}
