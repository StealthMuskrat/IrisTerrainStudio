// One owned worker isolates synchronous parsing/schema patterns from the editor UI.
export class ProblemClient{
  constructor({create=()=>new Worker(new URL('./problem-worker.mjs',import.meta.url),{type:'module'}),timeout=1500,setTimer=setTimeout,clearTimer=clearTimeout}={}){this.create=create;this.timeout=timeout;this.setTimer=setTimer;this.clearTimer=clearTimer;this.sequence=0;this.pending=null;this.worker=null;}
  check(text,schemaText){
    if(this.pending)return Promise.reject(new Error('A pack source check is already in progress.'));const worker=this.worker??=this.create(),id=++this.sequence;
    return new Promise((resolve,reject)=>{
      const finish=(error,result,terminate=false)=>{if(this.pending?.id!==id)return;this.clearTimer(this.pending.timer);this.pending=null;if(terminate){worker.terminate();if(this.worker===worker)this.worker=null;}if(error)reject(error);else resolve(result);};
      this.pending={id,reject:error=>finish(error,undefined,true),timer:null};this.pending.timer=this.setTimer(()=>finish(new Error('Source/schema worker exceeded its 1.5-second response limit; this file was not fully checked.'),undefined,true),this.timeout);
      worker.onmessage=({data})=>{if(data.id!==id)return;if(data.error)finish(new Error(data.error));else finish(null,data.result);};worker.onerror=event=>finish(new Error(event.message||'Pack check worker failed.'),undefined,true);worker.onmessageerror=()=>finish(new Error('Pack check worker response could not be read.'),undefined,true);
      try{worker.postMessage({id,text,schemaText});}catch(error){finish(error,undefined,true);}
    });
  }
  close(){this.pending?.reject(new DOMException('Pack check worker cancelled.','AbortError'));this.worker?.terminate();this.worker=null;}
}
