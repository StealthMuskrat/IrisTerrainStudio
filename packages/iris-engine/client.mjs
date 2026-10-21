export class UnsupportedGenerationError extends Error { constructor(message, feature) { super(message); this.name='UnsupportedGenerationError';this.feature=feature; } }
export function numericSeed(value) { const text=String(value).trim();if(!/^-?(?:0|[1-9]\d*)$/.test(text))throw new Error('The native engine needs a signed 64-bit decimal seed.');const number=BigInt(text);if(number<-(1n<<63n)||number>(1n<<63n)-1n)throw new Error('Seed is outside the signed Java long range.');return number.toString(); }
const laboratory=new Set(['lab-white2d','lab-perlin2d','lab-perlin3d']),irisStyles=new Set(['procedural-object','iris-style2d','iris-style3d','iris-generator','iris-continent','iris-region-control','regions','terrain','biomes','density','terrain-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','procedural-placement','caves']);
export class GenerationClient extends EventTarget {
  constructor(){super();this.workers=new Map();this.revision=0;this.sequence=0;this.pending=null;this.requests=new Map();this.cache=new Map();this.cacheBytes=0;this.maxCacheBytes=48*1024*1024;}
  worker(kind){
    if(this.workers.has(kind))return this.workers.get(kind);
    const worker=new Worker(`/app/workers/${kind==='iris'?'iris':'noise'}-worker.js`);
    worker.onmessage=({data})=>{
      const info=this.requests.get(data.id);
      if(info){this.requests.delete(data.id);if(data.error)info.reject(new Error(data.error));else info.resolve(data.info);return;}
      if(!this.pending||data.id!==this.pending.id)return;
      if(data.kind==='progress'){this.dispatchEvent(new CustomEvent('progress',{detail:data.progress}));return;}
      const pending=this.pending;this.pending=null;
      if(data.error){pending.reject(new Error(data.error));return;}
      const result={...data.result};if(result.volume)result.volume={...result.volume,blocks:new Uint32Array(result.volume.blocks)};else result.values=new Float64Array(result.values);
      this.cache.set(pending.key,result);this.cacheBytes+=(result.volume?.blocks.byteLength??result.values.byteLength);
      while((this.cacheBytes>this.maxCacheBytes||this.cache.size>64)&&this.cache.size>1){const oldest=this.cache.keys().next().value;this.cacheBytes-=(this.cache.get(oldest).volume?.blocks.byteLength??this.cache.get(oldest).values.byteLength);this.cache.delete(oldest);}
      pending.resolve(result);
    };
    worker.onerror=event=>{
      const error=new Error(event.message||'Generation worker failed.');
      if(this.pending?.worker===worker){this.pending.reject(error);this.pending=null;}
      for(const[id,request]of this.requests)if(request.worker===worker){request.reject(error);this.requests.delete(id);}
      worker.terminate();this.workers.delete(kind);
    };
    this.workers.set(kind,worker);return worker;
  }
  info(){const worker=this.worker('iris'),id=++this.sequence;return new Promise((resolve,reject)=>{this.requests.set(id,{worker,resolve,reject});worker.postMessage({kind:'info',id});});}
  inspectPack(snapshot,folder,name){this.cancel();const worker=this.worker('iris'),id=++this.sequence;return new Promise((resolve,reject)=>{this.requests.set(id,{worker,resolve,reject,kind:'inspect-pack'});worker.postMessage({kind:'inspect-pack',id,snapshot,folder,name});});}
  cancel(){
    this.revision++;
    if(this.pending){
      const pending=this.pending;this.pending=null;const error=new DOMException('Preview cancelled.','AbortError');
      if(pending.interruptible){
        // A synchronous native generator cannot receive a cancel message until it returns.
        pending.worker.terminate();for(const[kind,worker]of this.workers)if(worker===pending.worker)this.workers.delete(kind);
        for(const[id,request]of this.requests)if(request.worker===pending.worker){request.reject(error);this.requests.delete(id);}
      }else pending.worker.postMessage({kind:'cancel',id:pending.id});
      pending.reject(error);
    }
    for(const[id,request]of this.requests)if(request.kind==='inspect-pack'){request.worker.postMessage({kind:'cancel',id});request.reject(new DOMException('Resource inspection cancelled.','AbortError'));this.requests.delete(id);}
  }
  async generate(request){
    this.cancel();const revision=this.revision;
    if(!laboratory.has(request.field)&&!irisStyles.has(request.field))throw new UnsupportedGenerationError('Pack terrain generation is not yet connected. No approximate terrain is substituted.',request.field);
    const options={...request,seed:numericSeed(request.seed)};
    for(const key of ['x','z','y','span','width','height'])if(!Number.isFinite(options[key]))throw new Error('Preview coordinates and dimensions must be finite.');
    if(!Number.isInteger(options.width)||!Number.isInteger(options.height)||options.width<1||options.height<1||options.width>512||options.height>512||options.span<=0||options.span>4096||Math.abs(options.x)+options.span/2>30_000_000||Math.abs(options.z)+options.span*options.height/options.width/2>30_000_000||Math.abs(options.y)>30_000_000)throw new Error('Preview exceeds the supported coordinate, resolution or memory limits.');
    if(['regions','terrain','biomes','density','terrain-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','procedural-placement','caves'].includes(request.field)&&(!options.packSnapshot||typeof options.dimensionKey!=='string'||!options.dimensionKey))throw new Error('Choose a dimension and capture its native pack resources before generating native dimension fields.');
    if(request.field!=='procedural-object'&&!['regions','terrain','biomes','density','terrain-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','procedural-placement','caves'].includes(request.field)&&irisStyles.has(request.field)&&!options.configured&&!options.generator&&!options.nativeConfig&&(typeof options.style!=='string'||!/^[A-Z][A-Z0-9_]*$/.test(options.style)))throw new Error('Choose an Iris noise style.');
    if(['procedural-object','procedural-placement'].includes(request.field)){
      const p=options.procedural;if(!options.packSnapshot||!p||!['biomes','regions'].includes(p.folder)||typeof p.key!=='string'||!p.key||!['trees','formations','coral','fungi','crystals'].includes(p.family)||!Number.isSafeInteger(p.index)||p.index<0||p.index>=4096||!Number.isInteger(p.variant)||p.variant<0||p.variant>=8)throw new Error('Choose a native procedural entry and baked variant from a biome or region.');
    }
    // Hash byte content directly; JSON.stringify(Uint8Array) expands each byte into an object property.
    let cacheOptions=options;
    if(options.packSnapshot){
      if(!Array.isArray(options.packSnapshot.resources)||options.packSnapshot.resources.length>4096)throw new Error('Invalid native pack snapshot.');
      const resources=[];let budget=0;
      for(const resource of options.packSnapshot.resources){
        if(resource.bytes!==undefined){
          if(!(resource.bytes instanceof Uint8Array)||resource.bytes.byteLength>8*1024*1024||(budget+=resource.bytes.byteLength)>64*1024*1024)throw new Error('Native object exceeds its snapshot byte budget.');
          // Own the input throughout hashing and worker dispatch, even if a caller edits its buffer.
          const bytes=resource.bytes.slice();resources.push({path:resource.path,bytes,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('')});
        }else{if(typeof resource.text!=='string'||(budget+=resource.text.length*2)>64*1024*1024)throw new Error('Native pack exceeds its text budget.');resources.push({...resource});}
      }
      options.packSnapshot={...options.packSnapshot,resources};
      cacheOptions={...options,packSnapshot:{...options.packSnapshot,resources:resources.map(resource=>resource.bytes?{path:resource.path,byteLength:resource.bytes.byteLength,sha256:resource.sha256}:resource)}};
    }
    const encoded=new TextEncoder().encode(JSON.stringify(cacheOptions)),key=[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))].map(value=>value.toString(16).padStart(2,'0')).join('');if(revision!==this.revision)throw new DOMException('Preview cancelled.','AbortError');
    if(this.cache.has(key)){const result=this.cache.get(key);this.cache.delete(key);this.cache.set(key,result);return result;}
    const worker=this.worker(irisStyles.has(request.field)?'iris':'lab'),id=++this.sequence;
    return new Promise((resolve,reject)=>{this.pending={id,key,worker,resolve,reject,interruptible:['procedural-object','procedural-placement'].includes(request.field)};worker.postMessage({kind:'generate',id,options});});
  }
  invalidate(){this.cancel();this.cache.clear();this.cacheBytes=0;}
  dispose(){this.cancel();for(const worker of this.workers.values())worker.terminate();this.workers.clear();for(const request of this.requests.values())request.reject(new DOMException('Engine disposed.','AbortError'));this.requests.clear();this.cache.clear();this.cacheBytes=0;}
}
