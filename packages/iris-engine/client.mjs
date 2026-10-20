export class UnsupportedGenerationError extends Error { constructor(message, feature) { super(message); this.name='UnsupportedGenerationError';this.feature=feature; } }
export function numericSeed(value) { const text=String(value).trim();if(!/^-?(?:0|[1-9]\d*)$/.test(text))throw new Error('This noise engine needs a signed 64-bit decimal seed.');const number=BigInt(text);if(number<-(1n<<63n)||number>(1n<<63n)-1n)throw new Error('Seed is outside the signed Java long range.');return number.toString(); }
const laboratory=new Set(['lab-white2d','lab-perlin2d','lab-perlin3d']),irisStyles=new Set(['iris-style2d','iris-style3d','iris-generator','iris-continent','iris-region-control','regions']);
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
      const result={...data.result,values:new Float64Array(data.result.values)};
      this.cache.set(pending.key,result);this.cacheBytes+=result.values.byteLength;
      while((this.cacheBytes>this.maxCacheBytes||this.cache.size>64)&&this.cache.size>1){const oldest=this.cache.keys().next().value;this.cacheBytes-=this.cache.get(oldest).values.byteLength;this.cache.delete(oldest);}
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
  cancel(){this.revision++;if(this.pending){this.pending.worker.postMessage({kind:'cancel',id:this.pending.id});this.pending.reject(new DOMException('Preview cancelled.','AbortError'));this.pending=null;}for(const[id,request]of this.requests)if(request.kind==='inspect-pack'){request.worker.postMessage({kind:'cancel',id});request.reject(new DOMException('Resource inspection cancelled.','AbortError'));this.requests.delete(id);}}
  async generate(request){
    this.cancel();const revision=this.revision;
    if(!laboratory.has(request.field)&&!irisStyles.has(request.field))throw new UnsupportedGenerationError('Pack terrain generation is not yet connected. No approximate terrain is substituted.',request.field);
    const options={...request,seed:numericSeed(request.seed)};
    for(const key of ['x','z','y','span','width','height'])if(!Number.isFinite(options[key]))throw new Error('Preview coordinates and dimensions must be finite.');
    if(!Number.isInteger(options.width)||!Number.isInteger(options.height)||options.width<1||options.height<1||options.width>512||options.height>512||options.span<=0||options.span>4096||Math.abs(options.x)+options.span/2>30_000_000||Math.abs(options.z)+options.span*options.height/options.width/2>30_000_000||Math.abs(options.y)>30_000_000)throw new Error('Preview exceeds the supported coordinate, resolution or memory limits.');
    if(request.field==='regions'&&(!options.packSnapshot||typeof options.dimensionKey!=='string'||!options.dimensionKey))throw new Error('Choose a dimension and capture its native pack resources before selecting regions.');
    if(request.field!=='regions'&&irisStyles.has(request.field)&&!options.configured&&!options.generator&&!options.nativeConfig&&(typeof options.style!=='string'||!/^[A-Z][A-Z0-9_]*$/.test(options.style)))throw new Error('Choose an Iris noise style.');
    const encoded=new TextEncoder().encode(JSON.stringify(options)),key=[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))].map(value=>value.toString(16).padStart(2,'0')).join('');if(revision!==this.revision)throw new DOMException('Preview cancelled.','AbortError');
    if(this.cache.has(key)){const result=this.cache.get(key);this.cache.delete(key);this.cache.set(key,result);return result;}
    const worker=this.worker(irisStyles.has(request.field)?'iris':'lab'),id=++this.sequence;
    return new Promise((resolve,reject)=>{this.pending={id,key,worker,resolve,reject};worker.postMessage({kind:'generate',id,options});});
  }
  invalidate(){this.cancel();this.cache.clear();this.cacheBytes=0;}
  dispose(){this.cancel();for(const worker of this.workers.values())worker.terminate();this.workers.clear();for(const request of this.requests.values())request.reject(new DOMException('Engine disposed.','AbortError'));this.requests.clear();this.cache.clear();this.cacheBytes=0;}
}
