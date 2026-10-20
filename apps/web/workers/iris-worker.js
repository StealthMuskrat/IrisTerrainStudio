let runtime, active = 0;
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
async function engine() {
  if (!runtime) runtime = (async()=>{
    const base = '/app/engine/iris-generated/', response = await fetch(base+'manifest.json',{cache:'no-cache'});
    if (!response.ok) throw new Error('The Iris browser engine is not installed. Build it locally with npm run engine:build.');
    const manifest = await response.json();
    if (manifest.scope !== 'iris-browser-engine-development' || manifest.irisCommit !== 'c3a9449a026078c44a87c9776766f54a67779392') throw new Error('The browser module does not identify the pinned Iris source.');
    const files = await Promise.all(['iris.wasm','iris.wasm-runtime.js'].map(async name=>{
      const file = await fetch(base+name,{cache:'no-cache'}); if (!file.ok) throw new Error(`Missing browser engine file: ${name}`); return file.arrayBuffer();
    }));
    if (await digest(files[0]) !== manifest.wasmSha256 || await digest(files[1]) !== manifest.runtimeSha256) throw new Error('An Iris browser engine file differs from its build manifest.');
    // Execute exactly the runtime bytes that were checked, and compile exactly
    // the checked Wasm bytes. The script URL is revoked after instantiation.
    const runtimeUrl=URL.createObjectURL(new Blob([files[1]],{type:'text/javascript'}));
    let loaded; try { importScripts(runtimeUrl); loaded=await TeaVM.wasmGC.load(files[0]); } finally { URL.revokeObjectURL(runtimeUrl); }
    for (const name of manifest.exports) if (typeof loaded.exports[name] !== 'function') throw new Error(`Missing Iris export: ${name}`);
    return { api:loaded.exports, manifest };
  })().catch(error=>{runtime=null;throw error;});
  return runtime;
}
const bits=new DataView(new ArrayBuffer(8));
function decode(hex) { if (!/^[a-f0-9]{16}$/.test(hex)) throw new Error('Iris returned invalid double bits.');bits.setBigUint64(0,BigInt('0x'+hex));const value=bits.getFloat64(0);if(!Number.isFinite(value))throw new Error('Iris returned a non-finite value.');return value; }
self.onmessage=async({data})=>{
  if(data.kind==='cancel'){if(active===data.id)active=0;return;}
  if(data.kind!=='generate'&&data.kind!=='info')return;
  const id=data.id; if(data.kind==='generate')active=id;
  try {
    const {api,manifest}=await engine();
    if(data.kind==='info'){self.postMessage({kind:'info',id,info:{styles:JSON.parse(api.noiseStyles()),manifest}});return;}
    if(active!==id)return;
    const started=performance.now(),options=data.options,{width,height,x,y,z,span,seed}=options,depth=span*height/width;
    const dimensions=options.field==='iris-style3d'?3:2;
    api.clear();
    if(options.nativeConfig){for(const resource of options.nativeConfig.snippets||[])api.registerSnippet(resource.path,resource.text);api[{generator:'loadGeneratorJson',style:'loadStyleJson',dimension:'loadDimensionJson'}[options.nativeConfig.kind]](options.nativeConfig.id,options.nativeConfig.text);}
    if(options.configured){for(const d of options.configured.definitions)api.defineStyle(d.id,d.style,d.zoom,d.exponent,d.frequency,d.cellularZoom,d.fracture,d.multiplier,d.octaves);}
    if(options.generator){
      for(const d of options.generator.styles)api.defineStyle(d.id,d.style,d.zoom,d.exponent,d.frequency,d.cellularZoom,d.fracture,d.multiplier,d.octaves);
      for(const d of options.generator.layers)api.defineLayer(d.id,d.style,d.seed,d.zoom,d.opacity,d.offsetX,d.offsetY,d.offsetZ,d.exponent,d.negative,d.enabled,d.parametric,d.bezier,d.sinCentered,d.octaves,d.children.join(','));
      const d=options.generator.generator;if(d)api.defineGenerator(d.id,d.children.join(','),d.seed,d.zoom,d.opacity,d.surfaceDetail,d.multiplicitive,d.offsetX,d.offsetZ,d.cellZoom,d.cellShuffle,d.cellHeight,d.cellPercent,d.cliffMin,d.cliffMax,d.cliffLayer||'',d.interpolation,d.interpolationScale);
    }
    const sample=options.nativeConfig?(options.nativeConfig.kind==='dimension'?(px,pz)=>api.sampleDimensionControl(options.nativeConfig.id,seed,options.field,px,pz):options.nativeConfig.kind==='generator'?(px,pz)=>api.sampleGenerator(options.nativeConfig.id,seed,px,pz):(px,pz)=>api.sampleLoadedStyle(options.nativeConfig.id,seed,px,y,pz,dimensions)):options.generator?(px,pz)=>api[options.generator.kind==='layer'?'sampleLayer':'sampleGenerator'](options.generator.root,seed,px,pz):options.configured?(px,pz)=>api.sampleConfigured(options.configured.root,seed,px,y,pz,dimensions):(px,pz)=>api.sampleStyle(options.style,seed,px,y,pz,dimensions);
    const values=new Float64Array(width*height);let min=Infinity,max=-Infinity;
    for(let row=0;row<height;row++){
      for(let column=0;column<width;column++){
        const px=x-span/2+(column+.5)*span/width,pz=z-depth/2+(row+.5)*depth/height,value=decode(sample(px,pz));
        values[row*width+column]=value;min=Math.min(min,value);max=Math.max(max,value);
      }
      if((row&7)===0){self.postMessage({kind:'progress',id,progress:(row+1)/height});await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;}
    }
    if(active!==id)return;
    self.postMessage({kind:'result',id,result:{values:values.buffer,width,height,x,y,z,span,depth,seed,min,max,field:options.field,style:options.style,configuredPointer:options.configured?.pointer,scope:options.nativeConfig?.kind==='dimension'?'iris-dimension-control-development':options.generator||options.nativeConfig?.kind==='generator'?'iris-generator-development':'iris-noise-style-development',sourceCommit:manifest.irisCommit,generationMs:performance.now()-started}},[values.buffer]);
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
