import{validateGpuOperation}from'./gpu-validation.mjs';
// One WebGPU device and both canvas renderers share one disposable owner.
// Factories keep device acquisition and construction failure independently recoverable.
export class GpuSession {
  constructor({createGpu,createMap,createWorld,onLost,onError}){Object.assign(this,{createGpu,createMap,createWorld,onLost,onError});this.disposed=false;this.lost=false;}
  async open(){
    if(this.opened||this.disposed)throw new DOMException('GPU session is already used.','AbortError');this.opened=true;
    try{
      const gpu=await this.createGpu();
      if(this.disposed){gpu.device.destroy();throw new DOMException('GPU session disposed.','AbortError');}
      this.gpu=gpu;gpu.ready=false;
      gpu.device.lost.then(info=>{
        if(this.disposed||this.lost)return;this.lost=true;
        this.lossError=new Error('WebGPU device lost: '+(info.message||info.reason||'Unknown reason')+'. Recover WebGPU to restore retained previews. Pack editing remains available.');
        this.onLost?.(this.lossError);
      });
      this.uncaptured=event=>{if(!this.disposed&&!this.lost)this.onError?.(new Error('WebGPU: '+(event.error?.message||'Uncaptured rendering error.')));};
      gpu.device.addEventListener('uncapturederror',this.uncaptured);
      const checked=await validateGpuOperation(gpu.device,'WebGPU startup',()=>{this.map=this.createMap(gpu);this.world=this.createWorld(gpu);});
      if(this.disposed||this.lost)throw new DOMException('GPU startup was interrupted.','AbortError');
      this.diagnostics=checked.diagnostics;gpu.ready=true;return this;
    }catch(error){this.dispose();throw error;}
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    const map=this.map,world=this.world,gpu=this.gpu;if(gpu)gpu.ready=false;this.map=null;this.world=null;this.gpu=null;
    const errors=[];
    for(const release of[()=>map?.dispose(),()=>world?.dispose(),()=>gpu?.device.removeEventListener('uncapturederror',this.uncaptured),()=>gpu?.device.destroy()])try{release();}catch(error){errors.push(error);}
    if(errors.length)this.onError?.(new AggregateError(errors,'WebGPU resource cleanup reported an error.'));
  }
}
