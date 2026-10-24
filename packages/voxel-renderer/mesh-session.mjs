// One worker owns one immutable voxel/model/atlas snapshot and its section cache.
// Clip requests send only bounds; cancelling work keeps reusable geometry alive.
export class MeshSession {
  constructor(volume,models,palette,{onProgress,cacheByteLimit,cellColors,tintInput,fluidMaterials,lightingInput,greedyTextured=true}={}){this.volume=volume;this.models=models;this.palette=palette;this.onProgress=onProgress;this.cacheByteLimit=cacheByteLimit;this.cellColors=cellColors;this.tintInput=tintInput;this.fluidMaterials=fluidMaterials;this.lightingInput=lightingInput;this.greedyTextured=greedyTextured;this.initialized=false;this.disposed=false;}
  cancel(){
    const pending=this.pending;this.pending=null;
    if(pending){this.worker?.postMessage({kind:'cancel'});pending.reject(new DOMException('Voxel meshing cancelled.','AbortError'));}
  }
  build(clip,id){
    if(this.disposed)return Promise.reject(new DOMException('Mesh session disposed.','AbortError'));
    this.cancel();
    if(!this.worker){
      const worker=this.worker=new Worker('/packages/voxel-renderer/mesh-worker.mjs',{type:'module'});
      worker.onmessage=({data})=>{
        const pending=this.pending;if(this.worker!==worker||!pending||data.id!==pending.id)return;
        if(data.kind==='progress'){this.onProgress?.(data.progress);return;}
        if(data.error||data.kind==='mesh'){this.pending=null;if(data.error)pending.reject(new Error(data.error));else pending.resolve(data);}
      };
      worker.onerror=event=>{if(this.worker!==worker)return;const pending=this.pending;this.pending=null;worker.terminate();this.worker=null;this.initialized=false;pending?.reject(new Error(event.message||'Section mesh worker failed.'));};
    }
    return new Promise((resolve,reject)=>{
      this.pending={id,resolve,reject};
      const data={kind:'mesh',id,clip};
      if(!this.initialized){const volume=this.volume;Object.assign(data,{width:volume.width,height:volume.height,depth:volume.depth,blocks:volume.blocks,origin:volume.origin,biomes:volume.biomes,models:this.models,palette:this.palette,cacheByteLimit:this.cacheByteLimit,cellColors:this.cellColors,tintInput:this.tintInput,fluidMaterials:this.fluidMaterials,lightingInput:this.lightingInput,greedyTextured:this.greedyTextured});}
      try{this.worker.postMessage(data);this.initialized=true;}
      catch(error){this.pending=null;this.worker.terminate();this.worker=null;this.initialized=false;reject(error);}
    });
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.cancel();this.worker?.terminate();this.worker=null;this.volume=null;this.models=null;this.palette=null;this.cellColors=null;this.tintInput=null;this.fluidMaterials=null;this.lightingInput=null;}
}
