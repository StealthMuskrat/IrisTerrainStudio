let runtime, registryRuntime, active = 0;
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
async function registry(api,engineManifest){
  if(!registryRuntime)registryRuntime=(async()=>{
    const base='/app/engine/registry-generated/',response=await fetch(base+'manifest.json',{cache:'no-cache'});if(!response.ok)throw new Error('Install the native registry with npm run engine:registry before loading native packs.');
    const manifest=await response.json();if(manifest.scope!=='minecraft-development-registry-export'||manifest.minecraft?.id!=='26.3'||!manifest.minecraft.stable||manifest.volmLibCandidate!==engineManifest.volmLibCandidate)throw new Error('The native registry does not match the engine build inputs.');
    const record=manifest.files?.['browser-registry.json'];if(!record||!Number.isSafeInteger(record.bytes)||record.bytes>16*1024*1024)throw new Error('Re-export the native registry to install its browser input.');
    const file=await fetch(base+'browser-registry.json',{cache:'no-cache'});if(!file.ok)throw new Error('The browser registry input is missing.');const bytes=await file.arrayBuffer();if(bytes.byteLength!==record.bytes||await digest(bytes)!==record.sha256)throw new Error('Native registry bytes differ from the export manifest.');
    const installed=JSON.parse(api.installRegistry(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));if(installed.blocks!==manifest.blocks||installed.states!==manifest.states)throw new Error('Native registry state coverage differs from the export manifest.');return installed;
  })().catch(error=>{registryRuntime=null;throw error;});return registryRuntime;
}
const bits=new DataView(new ArrayBuffer(8));
function decode(hex) { if (!/^[a-f0-9]{16}$/.test(hex)) throw new Error('Iris returned invalid double bits.');bits.setBigUint64(0,BigInt('0x'+hex));const value=bits.getFloat64(0);if(!Number.isFinite(value))throw new Error('Iris returned a non-finite value.');return value; }
self.onmessage=async({data})=>{
  if(data.kind==='cancel'){if(active===data.id)active=0;return;}
  if(data.kind!=='generate'&&data.kind!=='info'&&data.kind!=='inspect-pack')return;
  const id=data.id; if(data.kind==='generate'||data.kind==='inspect-pack')active=id;
  try {
    const {api,manifest}=await engine();
    if(data.kind==='info'){self.postMessage({kind:'info',id,info:{styles:JSON.parse(api.noiseStyles()),manifest}});return;}
    if(data.kind==='inspect-pack'){
      if(active!==id)return;if(typeof api.installRegistry!=='function')throw new Error('Rebuild the local Iris engine to enable native compatibility checks.');await registry(api,manifest);if(active!==id)return;api.clear();try{for(const resource of data.snapshot.resources)api.registerPackResource(resource.path,resource.text);const snapshot=JSON.parse(api.openPack()),resource=JSON.parse(api.inspectPackResource(data.folder,data.name));self.postMessage({kind:'info',id,info:{...snapshot,resource,scope:'native-authoring-resource-load',terrainParityVerified:false}});}finally{api.clear();}return;
    }
    if(active!==id)return;
    const started=performance.now(),options=data.options,{width,height,x,y,z,span,seed}=options,depth=span*height/width;
    const dimensions=options.field==='iris-style3d'?3:2;
    if(options.packSnapshot){await registry(api,manifest);if(active!==id)return;}
    api.clear();
    let terrainInfo;
    if(options.packSnapshot){for(const resource of options.packSnapshot.resources)api.registerPackResource(resource.path,resource.text);api.openPack();if(options.field==='regions')api.prepareRegionSelection(options.dimensionKey,seed,options.buffet===true);else if(['terrain','biomes','density','terrain-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','caves'].includes(options.field)){if(options.buffet===true)throw new Error('Studio buffet terrain is not connected yet. Disable Studio layout for native biome and height maps.');terrainInfo=JSON.parse(api.prepareTerrain(options.dimensionKey,seed));}}
    if(options.field==='caves'){
      const chunk=JSON.parse(api.carveDimensionChunk(Math.floor(x/16)*16,Math.floor(z/16)*16));
      if(chunk.scope!=='native-dimension-cave-markers-development'||!Number.isInteger(chunk.height)||chunk.height<1||chunk.height>4096||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>65536||chunk.palette[0]!==null||!Array.isArray(chunk.cells)||chunk.cells.length!==256*chunk.height)throw new Error('Native cave marker output is incomplete.');
      const categories=['No cave marker','Air marker','Fluid palette marker','Lava marker','Forced air marker'],ids=chunk.palette.map(marker=>{if(marker===null)return 0;if(marker.cavern!==true||marker.customBiome!==''||!Number.isInteger(marker.liquid)||marker.liquid<0||marker.liquid>3)throw new Error('Unsupported native cave marker.');return marker.liquid+1;});
      for(const cell of chunk.cells)if(!Number.isInteger(cell)||cell<0||cell>=ids.length)throw new Error('Native cave marker referenced a missing palette value.');
      const values=new Float64Array(256),localY=Math.floor(y)-chunk.minY;let min=Infinity,max=-Infinity;
      for(let index=0;index<256;index++){const value=localY<0||localY>=chunk.height?0:ids[chunk.cells[localY*256+index]];values[index]=value;min=Math.min(min,value);max=Math.max(max,value);}
      await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
      self.postMessage({kind:'result',id,result:{values:values.buffer,width:16,height:16,x:chunk.x+8,y:Math.floor(y),z:chunk.z+8,span:16,depth:16,seed,min,max,field:options.field,categories,terrainInfo,scope:'iris-dimension-cave-markers-development',sourceCommit:manifest.irisCommit,generationMs:performance.now()-started,carved:chunk.carved,completePipeline:false}},[values.buffer]);return;
    }
    if(['terrain-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage'].includes(options.field)){
      const decorate=options.field==='cave-decoration-stage',floating=options.field==='floating-stage'||decorate,post=options.field==='post-stage'||floating,component=options.field==='carving-stage'||post,cave=options.field==='cave-stage',scope=decorate?'native-overworld-cave-decoration-stage-development':floating?'native-overworld-floating-material-stage-development':post?'native-overworld-post-material-stage-development':component?'native-carving-component-material-stage-development':cave?'native-dimension-cave-material-stage-development':'native-terrain-paint-stage-development';
      const chunk=JSON.parse(api[decorate?'paintCaveDecorationChunk':floating?'paintFloatingChunk':post?'paintPostChunk':component?'paintCaveComponentChunk':cave?'paintDimensionCaveChunk':'paintTerrainChunk'](Math.floor(x/16)*16,Math.floor(z/16)*16));
      if(chunk.scope!==scope||!Number.isInteger(chunk.height)||chunk.height<1||chunk.height>4096||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>65536||!Array.isArray(chunk.cells)||chunk.cells.length!==256*chunk.height)throw new Error('Native terrain stage output is incomplete.');
      if(decorate&&(!Array.isArray(chunk.markers)||chunk.markers.length>256*chunk.height||chunk.markers.some(marker=>!Array.isArray(marker)||marker.length!==4||!marker.slice(0,3).every(Number.isInteger)||marker[0]<0||marker[0]>=16||marker[1]<0||marker[1]>=chunk.height||marker[2]<0||marker[2]>=16||!['cave_floor','cave_ceiling'].includes(marker[3]))))throw new Error('Native cave-decoration markers are incomplete.');
      const palette=chunk.palette.map(key=>JSON.parse(api.registryRenderingState(key)));for(const cell of chunk.cells)if(!Number.isInteger(cell)||cell<0||cell>=palette.length)throw new Error('Native terrain stage referenced a missing palette state.');
      const blocks=Uint32Array.from(chunk.cells);await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
      self.postMessage({kind:'result',id,result:{field:options.field,scope:decorate?'iris-overworld-cave-decoration-stage-development':floating?'iris-overworld-floating-material-stage-development':post?'iris-overworld-post-material-stage-development':component?'iris-carving-component-material-stage-development':cave?'iris-dimension-cave-material-stage-development':'iris-terrain-paint-stage-development',sourceCommit:manifest.irisCommit,seed,generationMs:performance.now()-started,volume:{width:16,height:chunk.height,depth:16,origin:[chunk.x,chunk.minY,chunk.z],palette,blocks:blocks.buffer,metadata:{scope:chunk.scope,seed,sourceCommit:manifest.irisCommit,completePipeline:false,...(component||cave?{markerSource:component?'native-mantle-carving-component':'dimension-profile',markerWindowChunks:5,...(post?{mode:'OVERWORLD',postProcessing:true,...(floating?{floatingSolids:true,...(decorate?{naturalCaveDecoration:true,caveMarkers:chunk.markers.length}:{})}:{})}:{})}:{})}}}},[blocks.buffer]);return;
    }
    if(options.nativeConfig){for(const resource of options.nativeConfig.snippets||[])api.registerSnippet(resource.path,resource.text);api[{generator:'loadGeneratorJson',style:'loadStyleJson',dimension:'loadDimensionJson'}[options.nativeConfig.kind]](options.nativeConfig.id,options.nativeConfig.text);}
    if(options.configured){for(const d of options.configured.definitions)api.defineStyle(d.id,d.style,d.zoom,d.exponent,d.frequency,d.cellularZoom,d.fracture,d.multiplier,d.octaves);}
    if(options.generator){
      for(const d of options.generator.styles)api.defineStyle(d.id,d.style,d.zoom,d.exponent,d.frequency,d.cellularZoom,d.fracture,d.multiplier,d.octaves);
      for(const d of options.generator.layers)api.defineLayer(d.id,d.style,d.seed,d.zoom,d.opacity,d.offsetX,d.offsetY,d.offsetZ,d.exponent,d.negative,d.enabled,d.parametric,d.bezier,d.sinCentered,d.octaves,d.children.join(','));
      const d=options.generator.generator;if(d)api.defineGenerator(d.id,d.children.join(','),d.seed,d.zoom,d.opacity,d.surfaceDetail,d.multiplicitive,d.offsetX,d.offsetZ,d.cellZoom,d.cellShuffle,d.cellHeight,d.cellPercent,d.cliffMin,d.cliffMax,d.cliffLayer||'',d.interpolation,d.interpolationScale);
    }
    const categories=options.field==='density'?['Unshaped column','Empty','Solid']:[],categoryIds=new Map();
    const categorical=['regions','biomes','density'].includes(options.field);
    const sample=categorical?(px,pz)=>{if(options.field==='density')return api.sampleTerrainOccupancy(px,y,pz);const key=api[options.field==='regions'?'sampleRegion':'sampleTerrainBiome'](px,pz);if(!categoryIds.has(key)){categoryIds.set(key,categories.length);categories.push(key);}return categoryIds.get(key);}:options.field==='terrain'?(px,pz)=>api.sampleTerrainHeight(px,pz):options.nativeConfig?(options.nativeConfig.kind==='dimension'?(px,pz)=>api.sampleDimensionControl(options.nativeConfig.id,seed,options.field,px,pz):options.nativeConfig.kind==='generator'?(px,pz)=>api.sampleGenerator(options.nativeConfig.id,seed,px,pz):(px,pz)=>api.sampleLoadedStyle(options.nativeConfig.id,seed,px,y,pz,dimensions)):options.generator?(px,pz)=>api[options.generator.kind==='layer'?'sampleLayer':'sampleGenerator'](options.generator.root,seed,px,pz):options.configured?(px,pz)=>api.sampleConfigured(options.configured.root,seed,px,y,pz,dimensions):(px,pz)=>api.sampleStyle(options.style,seed,px,y,pz,dimensions);
    const values=new Float64Array(width*height);let min=Infinity,max=-Infinity;
    for(let row=0;row<height;row++){
      for(let column=0;column<width;column++){
        const px=x-span/2+(column+.5)*span/width,pz=z-depth/2+(row+.5)*depth/height,value=categorical?sample(px,pz):decode(sample(px,pz))+(options.field==='terrain'?terrainInfo.minHeight:0);
        values[row*width+column]=value;min=Math.min(min,value);max=Math.max(max,value);
      }
      if((row&7)===0){self.postMessage({kind:'progress',id,progress:(row+1)/height});await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;}
    }
    if(active!==id)return;
    self.postMessage({kind:'result',id,result:{values:values.buffer,width,height,x,y,z,span,depth,seed,min,max,field:options.field,categories:categorical?categories:undefined,terrainInfo,style:options.style,configuredPointer:options.configured?.pointer,scope:['terrain','biomes','density','terrain-stage'].includes(options.field)?'iris-native-terrain-scalar-development':options.field==='regions'?'iris-region-selection-development':options.nativeConfig?.kind==='dimension'?'iris-dimension-control-development':options.generator||options.nativeConfig?.kind==='generator'?'iris-generator-development':'iris-noise-style-development',sourceCommit:manifest.irisCommit,generationMs:performance.now()-started}},[values.buffer]);
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
