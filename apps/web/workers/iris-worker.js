let runtime, registryRuntime, terrainContext, active = 0;
function clearContext(api){terrainContext=null;api.clear();}
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
function physicalBiomeVolume(chunk,required=false){
  const physical=chunk.biomes;if(!physical){if(required)throw new Error('Native physical biome coverage is missing.');return undefined;}
  if(!Array.isArray(physical.palette)||physical.palette.length<1||physical.palette.length>65536||physical.palette.some(key=>typeof key!=='string'||!key.length)||new Set(physical.palette).size!==physical.palette.length||!Array.isArray(physical.cells)||physical.cells.length!==256*chunk.height||physical.cells.some(cell=>!Number.isInteger(cell)||cell<0||cell>=physical.palette.length))throw new Error('Native physical biome coverage is incomplete.');
  return {palette:physical.palette,cells:Uint16Array.from(physical.cells).buffer};
}
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
    if(engineManifest.platformSourceServerJarSha256&&manifest.sourceServerJarSha256!==engineManifest.platformSourceServerJarSha256)throw new Error('The registry and engine use different native server class inputs. Rebuild their inputs together.');
    const record=manifest.files?.['browser-registry.json'];if(!record||!Number.isSafeInteger(record.bytes)||record.bytes>16*1024*1024)throw new Error('Re-export the native registry to install its browser input.');
    const file=await fetch(base+'browser-registry.json',{cache:'no-cache'});if(!file.ok)throw new Error('The browser registry input is missing.');const bytes=await file.arrayBuffer();if(bytes.byteLength!==record.bytes||await digest(bytes)!==record.sha256)throw new Error('Native registry bytes differ from the export manifest.');
    const installed=JSON.parse(api.installRegistry(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));if(installed.blocks!==manifest.blocks||installed.states!==manifest.states)throw new Error('Native registry state coverage differs from the export manifest.');return {...installed,sourceSha256:record.sha256};
  })().catch(error=>{registryRuntime=null;throw error;});return registryRuntime;
}
async function registerSnapshot(api,snapshot,isCurrent=()=>true){
  if(!snapshot||!Array.isArray(snapshot.resources)||snapshot.resources.length>4096)throw new Error('Invalid native pack snapshot.');
  const paths=new Set();let budget=0;
  for(const resource of snapshot.resources){
    if(!isCurrent())return false;
    if(paths.has(resource.path))throw new Error('Duplicate native pack resource.');paths.add(resource.path);
    if(resource.bytes!==undefined){
      const bytes=resource.bytes;if(!ArrayBuffer.isView(bytes)||Object.prototype.toString.call(bytes)!=='[object Uint8Array]'||bytes.byteLength>8*1024*1024||(budget+=bytes.byteLength)>64*1024*1024)throw new Error('Native binary asset transport exceeds its byte budget.');
      let payload=bytes,image;if(/^images\/.+\.png$/.test(resource.path)){const{decodeNativePng}=await import('/packages/iris-engine/png.mjs');image=await decodeNativePng(bytes);if(!isCurrent())return false;payload=image.samples;}
      const parts=[];for(let i=0;i<payload.length;i+=16384)parts.push(String.fromCharCode(...payload.subarray(i,i+16384)));if(image?.palette)api.registerPackIndexedImage(resource.path,image.width,image.height,image.bitDepth,parts.join(''),String.fromCharCode(...image.palette));else if(image)api.registerPackImage(resource.path,image.width,image.height,image.channels,image.bitDepth,parts.join(''));else api.registerPackObject(resource.path,parts.join(''));
    }else{
      if(typeof resource.text!=='string'||resource.text.length>4*1024*1024||(budget+=resource.text.length*2)>64*1024*1024)throw new Error('Native pack transport exceeds its text budget.');api.registerPackResource(resource.path,resource.text);
    }
  }return true;
}
// Hash bounded resources separately so an unchanged snapshot can retain one native terrain context.
async function terrainContextKey(options,manifest){
  const snapshot=options.packSnapshot;if(!snapshot||!Array.isArray(snapshot.resources)||snapshot.resources.length>4096)throw new Error('Invalid native pack snapshot.');
  const resources=[],paths=new Set();let budget=0;
  for(const resource of snapshot.resources){
    if(typeof resource.path!=='string'||paths.has(resource.path))throw new Error('Invalid or duplicate native pack resource.');paths.add(resource.path);
    if(resource.bytes!==undefined){const bytes=resource.bytes;if(!ArrayBuffer.isView(bytes)||Object.prototype.toString.call(bytes)!=='[object Uint8Array]'||bytes.byteLength>8*1024*1024||(budget+=bytes.byteLength)>64*1024*1024)throw new Error('Native binary asset transport exceeds its byte budget.');resources.push([resource.path,'bytes',bytes.byteLength,await digest(bytes)]);}
    else{if(typeof resource.text!=='string'||resource.text.length>4*1024*1024||(budget+=resource.text.length*2)>64*1024*1024)throw new Error('Native pack transport exceeds its text budget.');resources.push([resource.path,'text',await digest(new TextEncoder().encode(resource.text))]);}
  }
  return digest(new TextEncoder().encode(JSON.stringify([manifest.wasmSha256,options.dimensionKey,options.seed,options.buffet===true,resources])));
}
const bits=new DataView(new ArrayBuffer(8));
function decode(hex) { if (!/^[a-f0-9]{16}$/.test(hex)) throw new Error('Iris returned invalid double bits.');bits.setBigUint64(0,BigInt('0x'+hex));const value=bits.getFloat64(0);if(!Number.isFinite(value))throw new Error('Iris returned a non-finite value.');return value; }
self.onmessage=async({data})=>{
  if(data.kind==='release-context'){active=0;const loaded=runtime&&await runtime.catch(()=>null);if(loaded&&active===0)clearContext(loaded.api);return;}
  if(data.kind==='cancel'){if(active===data.id)active=0;return;}
  if(data.kind!=='generate'&&data.kind!=='info'&&data.kind!=='inspect-pack'&&data.kind!=='sample-image-map')return;
  const id=data.id; if(data.kind==='generate'||data.kind==='inspect-pack'||data.kind==='sample-image-map')active=id;
  let apiForCleanup;
  try {
    const {api,manifest}=await engine();apiForCleanup=api;
    if(data.kind==='info'){self.postMessage({kind:'info',id,info:{styles:JSON.parse(api.noiseStyles()),manifest}});return;}
    if(data.kind==='sample-image-map'){
      if(active!==id)return;
      if(typeof data.name!=='string'||!data.name||!Array.isArray(data.points)||data.points.length<1||data.points.length>16||data.points.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)))throw new Error('Supply one to sixteen finite X, Z coordinate pairs.');
      if(typeof api.inspectPackImageMapSample!=='function')throw new Error('Rebuild the local Iris engine to enable native image-map sampling.');
      await registry(api,manifest);if(active!==id)return;clearContext(api);
      try{
        if(!await registerSnapshot(api,data.snapshot,()=>active===id))return;
        const snapshot=JSON.parse(api.openPack()),resource=JSON.parse(api.inspectPackResource('image-maps',data.name));
        if(!resource.found)throw new Error('The native image map could not be resolved.');
        const samples=data.points.map(([x,z])=>{try{return JSON.parse(api.inspectPackImageMapSample(data.name,x,z));}catch(error){return{x,z,error:error.message||String(error)};}});
        if(active===id)self.postMessage({kind:'info',id,info:{...snapshot,resource,samples,scope:'native-image-map-authoring-samples',terrainParityVerified:false}});
      }finally{if(active===id)clearContext(api);}return;
    }
    if(data.kind==='inspect-pack'){
      if(active!==id)return;if(typeof api.installRegistry!=='function')throw new Error('Rebuild the local Iris engine to enable native compatibility checks.');await registry(api,manifest);if(active!==id)return;clearContext(api);try{if(!await registerSnapshot(api,data.snapshot,()=>active===id))return;const snapshot=JSON.parse(api.openPack()),resource=JSON.parse(api.inspectPackResource(data.folder,data.name));self.postMessage({kind:'info',id,info:{...snapshot,resource,scope:'native-authoring-resource-load',terrainParityVerified:false}});}finally{if(active===id)clearContext(api);}return;
    }
    if(active!==id)return;
    const started=performance.now(),options=data.options,{width,height,x,y,z,span,seed}=options,depth=span*height/width;
    const dimensions=options.field==='iris-style3d'?3:2;
    const registryInfo=options.packSnapshot?await registry(api,manifest):null;if(active!==id)return;
    const retain=['procedural-neighborhood','overworld-mode'].includes(options.field),contextKey=retain?await terrainContextKey(options,manifest):null;
    if(active!==id)return;const contextReused=retain&&terrainContext?.key===contextKey;
    let terrainInfo=contextReused?terrainContext.info:undefined;
    if(!contextReused)clearContext(api);
    if(options.packSnapshot&&!contextReused){if(!await registerSnapshot(api,options.packSnapshot,()=>active===id))return;api.openPack();}
    let persistence,persistenceKey,persistentNoise;
    if(typeof indexedDB!=='undefined'&&typeof api.restoreNoiseCacheTile==='function'&&/^[a-f0-9]{64}$/.test(manifest.wasmSha256||'')){
      try{const cacheModule=await import('/packages/iris-engine/noise-cache-store.mjs');if(active!==id)return;if(cacheModule.usesPersistentNoiseCache(options,manifest)){persistence=cacheModule.noiseTilePersistence;persistenceKey=await cacheModule.noiseCacheNamespace(options,{...manifest,registrySha256:registryInfo?.sourceSha256});if(active!==id)return;persistentNoise=contextReused?{status:'context-reused',restoredFiles:0}:await persistence.restore(api,persistenceKey,()=>active===id);if(active!==id)return;}}catch{persistentNoise={status:'unavailable'};}
    }
    if(active!==id)return;
    // Capture native diagnostics/bytes before the first async save; a newer request may own api after it.
    const publishResult=async(result,transfers)=>{
      if(active!==id)return;
      let noiseCache=(options.packSnapshot||persistentNoise)&&typeof api.noiseCacheStatistics==='function'?{...JSON.parse(api.noiseCacheStatistics()),implementationFingerprint:manifest.noiseCacheIdentity?.implementationFingerprint}:undefined;
      if(persistence){
        const saved=await persistence.save(api,persistenceKey,()=>active===id);if(active!==id)return;
        persistentNoise={...persistentNoise,saveStatus:saved.status,savedFiles:saved.savedFiles,savedBytes:saved.savedBytes};
      }
      if(active!==id)return;
      if(persistentNoise)noiseCache={...noiseCache,durablePersistence:persistentNoise.status==='restored'||persistentNoise.saveStatus==='saved',persistence:persistentNoise};
      if(noiseCache){result.noiseCache=noiseCache;if(result.volume)result.volume.metadata={...result.volume.metadata,noiseCache};}
      if(['procedural-object','procedural-source','procedural-placement'].includes(options.field))clearContext(api);
      self.postMessage({kind:'result',id,result},transfers);
    };
    if(options.packSnapshot&&!contextReused){if(options.field==='regions')api.prepareRegionSelection(options.dimensionKey,seed,options.buffet===true);else if(['terrain','biomes','density','terrain-stage','terrain-mode-stage','terrain-mode','overworld-terrain','overworld-mode','biome-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','subterrain-finish-stage','procedural-source','procedural-neighborhood','procedural-placement','caves'].includes(options.field)){if(options.buffet===true)throw new Error('Studio buffet terrain is not connected yet. Disable Studio layout for native biome and height maps.');terrainInfo=JSON.parse(api.prepareTerrain(options.dimensionKey,seed));}if(retain)terrainContext={key:contextKey,info:terrainInfo};}
    if(['procedural-placement','procedural-source','procedural-neighborhood'].includes(options.field)){
      const neighbors=options.field==='procedural-neighborhood',scatter=neighbors||options.field==='procedural-source',p=options.procedural,chunk=JSON.parse(neighbors?api.paintProceduralNeighborhoodChunk(Math.floor(x/16)*16,Math.floor(z/16)*16):scatter?api.paintProceduralSourceChunk(Math.floor(x/16)*16,Math.floor(z/16)*16):api.paintProceduralPlacementChunk(Math.floor(x/16)*16,Math.floor(z/16)*16,p.folder,p.key,p.family,p.index,p.variant,seed));
      if(chunk.scope!==(neighbors?'native-procedural-neighborhood-development':scatter?'native-procedural-source-scatter-development':'native-procedural-placement-development')||!Number.isInteger(chunk.height)||chunk.height<16||chunk.height>4096||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>65536||!Array.isArray(chunk.cells)||chunk.cells.length!==256*chunk.height||chunk.cells.some(value=>!Number.isInteger(value)||value<0||value>=chunk.palette.length)||(!neighbors&&!Number.isInteger(chunk.placedY))||(!scatter&&(!chunk.placement||chunk.placement.automaticScatter!==false||chunk.placement.crossSourceCollisionReplay!==false)))throw new Error('Native procedural placement output is incomplete.');
      const plan=chunk.sourcePlan,window=chunk.journalWindow,cx=chunk.x>>4,cz=chunk.z>>4;
      if((!neighbors&&(!plan||!Number.isInteger(plan.destinations)||plan.destinations<0||plan.destinations>9||plan.replayedDestinations!==plan.destinations||!Number.isSafeInteger(plan.retainedBytes)||plan.retainedBytes<0))||!Array.isArray(window)||window.length>(neighbors?1:9)||window.some(row=>!Array.isArray(row)||row.length!==3||!row.every(Number.isSafeInteger)||Math.abs(row[0]-cx)>(neighbors?0:1)||Math.abs(row[1]-cz)>(neighbors?0:1)||row[2]<1||row[2]>256*chunk.height)||new Set(window.map(row=>row[0]+','+row[1])).size!==window.length)throw new Error('Native source-plan metadata is incomplete.');
      const neighborhood=chunk.neighborhood;
      if(neighbors&&(!neighborhood||!['sourceChunks','contributingSources','placementRadius','inputChunkRadius','sourceChunkRadius','builtPlanBytes'].every(key=>Number.isSafeInteger(neighborhood[key]))||![1,9].includes(neighborhood.sourceChunks)||neighborhood.contributingSources<0||neighborhood.contributingSources>neighborhood.sourceChunks||neighborhood.placementRadius<0||neighborhood.placementRadius>16||neighborhood.inputChunkRadius<1||neighborhood.inputChunkRadius>3||neighborhood.sourceChunkRadius<0||neighborhood.sourceChunkRadius>1||neighborhood.builtPlanBytes<0))throw new Error('Native procedural neighborhood metadata is incomplete.');
      const cache=chunk.cache;
      if(neighbors&&(!cache||!['lookups','builds','replays','drained','retired','retained','retainedBytes','budgetBytes','continuationChunks','continuationBytes'].every(key=>Number.isSafeInteger(cache[key])&&cache[key]>=0)||cache.budgetBytes<1||cache.budgetBytes>8*1024*1024||cache.retainedBytes>cache.budgetBytes||cache.continuationChunks>64||cache.continuationBytes>4*1024*1024))throw new Error('Native source-plan cache metadata is incomplete.');
      const palette=chunk.palette.map(key=>JSON.parse(api.registryRenderingState(key))),blocks=Uint32Array.from(chunk.cells),biomes=physicalBiomeVolume(chunk);await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
      await publishResult({field:options.field,scope:neighbors?'iris-procedural-neighborhood-development':scatter?'iris-procedural-source-development':'iris-procedural-placement-development',sourceCommit:manifest.irisCommit,seed,generationMs:performance.now()-started,volume:{width:16,height:chunk.height,depth:16,origin:[chunk.x,chunk.minY,chunk.z],palette,blocks:blocks.buffer,...(biomes?{biomes}:{}),metadata:{scope:chunk.scope,seed,sourceCommit:manifest.irisCommit,physicalBiomeVolume:!!biomes,completePipeline:false,coordinateSpace:'world',manualPlacement:!scatter,nativeDestinationTransaction:true,prerequisiteJournal:true,subterrain:chunk.subterrain,journaledCells:chunk.journaledCells,journalWindow:chunk.journalWindow,sourcePlan:chunk.sourcePlan,nativeSourcePlanReplay:true,continuationPersistence:false,markerWindowChunks:neighbors?(2*neighborhood.inputChunkRadius+1)**2:9,matterInsertion:true,...(scatter?{nativeSourceScatter:true,sourceChunks:neighbors?neighborhood.sourceChunks:1,neighboringSources:neighbors,sourcePlanCache:neighbors,...(neighbors?{cacheScope:'worker-dimension-snapshot',contextReused,cache,workerContinuationStorage:true}:{}),objectTags:chunk.objectTags,caveSearch:chunk.caveSearch,...(neighbors?{neighborhood,completeSourceNeighborhood:true}:{} )}:{placement:chunk.placement,placedY:chunk.placedY,placedWorldY:chunk.placedY<0?null:chunk.placedY+chunk.minY,accepted:chunk.placedY>=0}),automaticScatter:false,crossSourceCollisionReplay:false,nativeStructureVolumesAvailable:false}}},[blocks.buffer,...(biomes?[biomes.cells]:[])]);return;
    }
    if(options.field==='procedural-object'){
      const p=options.procedural,chunk=JSON.parse(api.previewProceduralObject(p.folder,p.key,p.family,p.index,p.variant));
      if(chunk.scope!=='native-procedural-variant-development'||!Array.isArray(chunk.size)||chunk.size.length!==3||!chunk.size.every(value=>Number.isInteger(value)&&value>0&&value<=256)||chunk.size.reduce((a,b)=>a*b,1)>1048576||!Array.isArray(chunk.origin)||chunk.origin.length!==3||!chunk.origin.every(Number.isSafeInteger)||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>65536||!Array.isArray(chunk.cells)||chunk.cells.length!==chunk.size.reduce((a,b)=>a*b,1)||chunk.cells.some(value=>!Number.isInteger(value)||value<0||value>=chunk.palette.length))throw new Error('Native procedural variant output is incomplete.');
      const palette=chunk.palette.map(key=>JSON.parse(api.registryRenderingState(key))),blocks=Uint32Array.from(chunk.cells);await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
      await publishResult({field:options.field,scope:'iris-procedural-variant-development',sourceCommit:manifest.irisCommit,seed:chunk.seed,generationMs:performance.now()-started,volume:{width:chunk.size[0],height:chunk.size[1],depth:chunk.size[2],origin:chunk.origin,palette,blocks:blocks.buffer,metadata:{scope:chunk.scope,key:chunk.key,family:chunk.family,entryIndex:chunk.index,variant:chunk.variant,poolSize:chunk.poolSize,seed:chunk.seed,blockCount:chunk.blockCount,coordinateSpace:'native-object-local',placementConnected:false,completePipeline:false,sourceCommit:manifest.irisCommit}}},[blocks.buffer]);return;
    }
    if(['overworld-terrain','overworld-mode'].includes(options.field)){
      const full=options.field==='overworld-mode',scope=full?'native-overworld-mode-generation-development':'native-overworld-registered-terrain-development',bx=Math.floor(x/16)*16,bz=Math.floor(z/16)*16,chunk=JSON.parse((full?api.generateOverworldChunk:api.paintRegisteredOverworldTerrainChunk)(bx,bz));
      const inWindow=row=>Number.isInteger(row[0])&&Number.isInteger(row[1])&&Math.abs(row[0]-(bx>>4))<=3&&Math.abs(row[1]-(bz>>4))<=3;
      if(chunk.scope!==scope||chunk.x!==bx||chunk.z!==bz||!Number.isInteger(chunk.height)||chunk.height<16||chunk.height>4096||!Number.isInteger(chunk.minY)||chunk.registeredTerrainStages!==4||chunk.registeredContentStages!==9||chunk.executedTerrainStages!==4||chunk.executedContentStages!==(full?9:0)||chunk.nativeContentPhase!==full||chunk.activeLeasesAfter!==0||!Number.isInteger(chunk.maximumWriterAccess)||chunk.maximumWriterAccess<0||chunk.maximumWriterAccess>6||!Array.isArray(chunk.matterWindow)||chunk.matterWindow.length>49||chunk.matterWindow.some(row=>!Array.isArray(row)||row.length!==4||!inWindow(row)||typeof row[2]!=='boolean'||typeof row[3]!=='boolean'||!full&&row[3])||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>65536||!Array.isArray(chunk.cells)||chunk.cells.length!==256*chunk.height||chunk.cells.some(cell=>!Number.isInteger(cell)||cell<0||cell>=chunk.palette.length))throw new Error('Native registered Overworld output is incomplete.');
      if(full&&(!Array.isArray(chunk.componentFlags)||chunk.componentFlags.length>49||chunk.componentFlags.some(row=>!Array.isArray(row)||row.length!==7||!inWindow(row)||row.slice(2).some(value=>typeof value!=='boolean'))||!Number.isInteger(chunk.journaledCells)||chunk.journaledCells<0||!chunk.cache||!chunk.objectTags||!chunk.caveSearch))throw new Error('Native Overworld content diagnostics are incomplete.');
      const palette=chunk.palette.map(key=>JSON.parse(api.registryRenderingState(key))),blocks=Uint32Array.from(chunk.cells),biomes=physicalBiomeVolume(chunk,true);await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
      await publishResult({field:options.field,scope:full?'iris-overworld-mode-generation-development':'iris-overworld-registered-terrain-development',sourceCommit:manifest.irisCommit,seed,generationMs:performance.now()-started,volume:{width:16,height:chunk.height,depth:16,origin:[bx,chunk.minY,bz],palette,blocks:blocks.buffer,biomes,metadata:{scope:chunk.scope,mode:'OVERWORLD',seed,sourceCommit:manifest.irisCommit,nativeStageRegistration:true,registeredTerrainStages:4,registeredContentStages:9,executedTerrainStages:chunk.executedTerrainStages,executedContentStages:chunk.executedContentStages,nativeContentPhase:chunk.nativeContentPhase,nativeModeGeneration:full,nativeTerrainMatterScheduler:true,nativeContentMatterScheduler:full,nativePassPlanning:true,matterWindow:chunk.matterWindow,componentFlagNames:full?['CARVED','OBJECT','FLOATING_OBJECT','JIGSAW','PLANNED']:undefined,componentFlags:chunk.componentFlags,objectCacheDomain:full?'registered-mode':undefined,journaledCells:chunk.journaledCells,objectTags:chunk.objectTags,cache:chunk.cache,caveSearch:chunk.caveSearch,maximumWriterAccess:chunk.maximumWriterAccess,activeLeasesAfter:0,physicalBiomeVolume:true,contentGenerated:full,customBlocksSupported:false,historyRestored:false,fullEngineLifecycle:false,completePipeline:false}}},[blocks.buffer,biomes.cells]);return;
    }
    if(['terrain-mode-stage','terrain-mode'].includes(options.field)){
      const full=options.field==='terrain-mode',scope=full?'native-mode-generation-development':'native-terrain-mode-stage-development',bx=Math.floor(x/16)*16,bz=Math.floor(z/16)*16,chunk=JSON.parse((full?api.generateTerrainModeChunk:api.paintTerrainModeChunk)(bx,bz));
      if(chunk.scope!==scope||!['SUPERFLAT','ENCLOSURE','ISLANDS'].includes(chunk.mode)||chunk.x!==bx||chunk.z!==bz||!Number.isInteger(chunk.minY)||!Number.isInteger(chunk.height)||chunk.height<1||chunk.height>4096||chunk.registeredTerrainStages!==1||chunk.registeredContentStages!==0||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>65536||!Array.isArray(chunk.cells)||chunk.cells.length!==256*chunk.height||chunk.cells.some(cell=>!Number.isInteger(cell)||cell<0||cell>=chunk.palette.length))throw new Error('Native terrain-mode output is incomplete.');
      if(full&&(!chunk.modeGeneration||!chunk.nativeContentPhase||!chunk.scopeRestored||chunk.activeLeasesAfter!==0||typeof chunk.generationSessionId!=='string'||!/^[1-9][0-9]*$/.test(chunk.generationSessionId)||BigInt(chunk.generationSessionId)<=0n))throw new Error('Native mode context lifecycle is incomplete.');
      const palette=chunk.palette.map(key=>JSON.parse(api.registryRenderingState(key))),blocks=Uint32Array.from(chunk.cells),biomes=physicalBiomeVolume(chunk,true);
      await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
      await publishResult({field:options.field,scope:full?'iris-mode-generation-development':'iris-terrain-mode-stage-development',sourceCommit:manifest.irisCommit,seed,generationMs:performance.now()-started,volume:{width:16,height:chunk.height,depth:16,origin:[bx,chunk.minY,bz],palette,blocks:blocks.buffer,biomes,metadata:{scope:chunk.scope,mode:chunk.mode,seed,sourceCommit:manifest.irisCommit,nativeStageRegistration:true,nativeModeGeneration:full,nativeChunkContextPrefill:full,nativeContentPhase:full,generationSessionId:chunk.generationSessionId,scopeRestored:chunk.scopeRestored,activeLeasesAfter:chunk.activeLeasesAfter,registeredTerrainStages:chunk.registeredTerrainStages,registeredContentStages:chunk.registeredContentStages,physicalBiomeVolume:true,fullEngineLifecycle:false,completePipeline:false}}},[blocks.buffer,biomes.cells]);return;
    }
    if(options.field==='biome-stage'){
      const bx=Math.floor(x/16)*16,bz=Math.floor(z/16)*16,worldY=Math.floor(y),chunk=JSON.parse(api.samplePhysicalBiomeChunk(bx,worldY,bz));
      if(chunk.scope!=='native-physical-biome-stage-development'||chunk.x!==bx||chunk.z!==bz||chunk.y!==worldY||!Number.isInteger(chunk.minY)||!Number.isInteger(chunk.worldHeight)||chunk.worldHeight<1||chunk.worldHeight>4096||worldY<chunk.minY||worldY>=chunk.minY+chunk.worldHeight||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>256||chunk.palette.some(key=>typeof key!=='string'||!key.length)||new Set(chunk.palette).size!==chunk.palette.length||!Array.isArray(chunk.cells)||chunk.cells.length!==256||chunk.cells.some(cell=>!Number.isInteger(cell)||cell<0||cell>=chunk.palette.length))throw new Error('Native physical biome stage output is incomplete.');
      const values=Float64Array.from(chunk.cells);await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
    await publishResult({values:values.buffer,width:16,height:16,x:bx+8,y:worldY,z:bz+8,span:16,depth:16,seed,min:Math.min(...chunk.cells),max:Math.max(...chunk.cells),field:options.field,categories:chunk.palette,terrainInfo,scope:'iris-physical-biome-stage-development',sourceCommit:manifest.irisCommit,generationMs:performance.now()-started,completePipeline:false,nativeBiomeActuator:true,customBiomeRegistryContributions:false},[values.buffer]);return;
    }
    if(options.field==='caves'){
      const chunk=JSON.parse(api.carveDimensionChunk(Math.floor(x/16)*16,Math.floor(z/16)*16));
      if(chunk.scope!=='native-dimension-cave-markers-development'||!Number.isInteger(chunk.height)||chunk.height<1||chunk.height>4096||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>65536||chunk.palette[0]!==null||!Array.isArray(chunk.cells)||chunk.cells.length!==256*chunk.height)throw new Error('Native cave marker output is incomplete.');
      const categories=['No cave marker','Air marker','Fluid palette marker','Lava marker','Forced air marker'],ids=chunk.palette.map(marker=>{if(marker===null)return 0;if(marker.cavern!==true||marker.customBiome!==''||!Number.isInteger(marker.liquid)||marker.liquid<0||marker.liquid>3)throw new Error('Unsupported native cave marker.');return marker.liquid+1;});
      for(const cell of chunk.cells)if(!Number.isInteger(cell)||cell<0||cell>=ids.length)throw new Error('Native cave marker referenced a missing palette value.');
      const values=new Float64Array(256),localY=Math.floor(y)-chunk.minY;let min=Infinity,max=-Infinity;
      for(let index=0;index<256;index++){const value=localY<0||localY>=chunk.height?0:ids[chunk.cells[localY*256+index]];values[index]=value;min=Math.min(min,value);max=Math.max(max,value);}
      await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
      await publishResult({values:values.buffer,width:16,height:16,x:chunk.x+8,y:Math.floor(y),z:chunk.z+8,span:16,depth:16,seed,min,max,field:options.field,categories,terrainInfo,scope:'iris-dimension-cave-markers-development',sourceCommit:manifest.irisCommit,generationMs:performance.now()-started,carved:chunk.carved,completePipeline:false},[values.buffer]);return;
    }
    if(['terrain-stage','cave-stage','carving-stage','post-stage','floating-stage','cave-decoration-stage','deposit-stage','material-finish-stage','subterrain-finish-stage'].includes(options.field)){
      const preserving=options.field==='subterrain-finish-stage',finishing=preserving||options.field==='material-finish-stage',deposits=options.field==='deposit-stage'||finishing,decorate=options.field==='cave-decoration-stage'||deposits,floating=options.field==='floating-stage'||decorate,post=options.field==='post-stage'||floating,component=options.field==='carving-stage'||post,cave=options.field==='cave-stage',scope=preserving?'native-overworld-subterrain-finish-development':finishing?'native-overworld-material-finish-development':deposits?'native-overworld-deposit-material-stage-development':decorate?'native-overworld-cave-decoration-stage-development':floating?'native-overworld-floating-material-stage-development':post?'native-overworld-post-material-stage-development':component?'native-carving-component-material-stage-development':cave?'native-dimension-cave-material-stage-development':'native-terrain-paint-stage-development';
      const chunk=JSON.parse(api[preserving?'paintSubterrainFinishChunk':finishing?'paintMaterialFinishChunk':deposits?'paintDepositChunk':decorate?'paintCaveDecorationChunk':floating?'paintFloatingChunk':post?'paintPostChunk':component?'paintCaveComponentChunk':cave?'paintDimensionCaveChunk':'paintTerrainChunk'](Math.floor(x/16)*16,Math.floor(z/16)*16));
      if(chunk.scope!==scope||!Number.isInteger(chunk.height)||chunk.height<1||chunk.height>4096||!Array.isArray(chunk.palette)||chunk.palette.length<1||chunk.palette.length>65536||!Array.isArray(chunk.cells)||chunk.cells.length!==256*chunk.height)throw new Error('Native terrain stage output is incomplete.');
      if(decorate&&(!Array.isArray(chunk.markers)||chunk.markers.length>256*chunk.height||chunk.markers.some(marker=>!Array.isArray(marker)||marker.length!==4||!marker.slice(0,3).every(Number.isInteger)||marker[0]<0||marker[0]>=16||marker[1]<0||marker[1]>=chunk.height||marker[2]<0||marker[2]>=16||!['cave_floor','cave_ceiling'].includes(marker[3]))))throw new Error('Native cave-decoration markers are incomplete.');
      const palette=chunk.palette.map(key=>JSON.parse(api.registryRenderingState(key)));for(const cell of chunk.cells)if(!Number.isInteger(cell)||cell<0||cell>=palette.length)throw new Error('Native terrain stage referenced a missing palette state.');
      const blocks=Uint32Array.from(chunk.cells),biomes=physicalBiomeVolume(chunk);await new Promise(resolve=>setTimeout(resolve,0));if(active!==id)return;
      await publishResult({field:options.field,scope:preserving?'iris-overworld-subterrain-finish-development':finishing?'iris-overworld-material-finish-development':deposits?'iris-overworld-deposit-material-stage-development':decorate?'iris-overworld-cave-decoration-stage-development':floating?'iris-overworld-floating-material-stage-development':post?'iris-overworld-post-material-stage-development':component?'iris-carving-component-material-stage-development':cave?'iris-dimension-cave-material-stage-development':'iris-terrain-paint-stage-development',sourceCommit:manifest.irisCommit,seed,generationMs:performance.now()-started,volume:{width:16,height:chunk.height,depth:16,origin:[chunk.x,chunk.minY,chunk.z],palette,blocks:blocks.buffer,...(biomes?{biomes}:{}),metadata:{scope:chunk.scope,seed,sourceCommit:manifest.irisCommit,physicalBiomeVolume:!!biomes,completePipeline:false,...(component||cave?{markerSource:component?'native-mantle-carving-component':'dimension-profile',markerWindowChunks:5,...(component?{subterrain:chunk.subterrain}:{}),...(post?{mode:'OVERWORLD',postProcessing:true,...(floating?{floatingSolids:true,...(decorate?{naturalCaveDecoration:true,caveMarkers:chunk.markers.length,...(deposits?{depositProcessing:true,matterInsertion:true,contentMatterGenerated:false,...(finishing?{surfaceDecoration:true,floatingDecoration:true,perfection:true,subterrainPreservation:preserving,customBlockProcessing:false}:{})}:{})}:{})}:{})}:{})}:{})}}},[blocks.buffer,...(biomes?[biomes.cells]:[])]);return;
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
    await publishResult({values:values.buffer,width,height,x,y,z,span,depth,seed,min,max,field:options.field,categories:categorical?categories:undefined,terrainInfo,style:options.style,configuredPointer:options.configured?.pointer,expressions:options.packSnapshot&&typeof api.expressionStatistics==='function'?JSON.parse(api.expressionStatistics()):undefined,scope:['terrain','biomes','density','terrain-stage'].includes(options.field)?'iris-native-terrain-scalar-development':options.field==='regions'?'iris-region-selection-development':options.nativeConfig?.kind==='dimension'?'iris-dimension-control-development':options.generator||options.nativeConfig?.kind==='generator'?'iris-generator-development':'iris-noise-style-development',sourceCommit:manifest.irisCommit,generationMs:performance.now()-started},[values.buffer]);
  }catch(error){let detail=error.message||String(error);if(active===id&&apiForCleanup){try{clearContext(apiForCleanup);}catch(cleanup){detail+=' Context cleanup failed: '+(cleanup.message||String(cleanup));}}self.postMessage({id,error:detail});}
};
