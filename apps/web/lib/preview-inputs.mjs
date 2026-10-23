// Small descriptions of the inputs that produced retained data. Never retain pack
// snapshots/config text here, and never reconstruct generation from these labels.
export function capturePreviewInputs(options,{pack='',revision=0,request=0}={}){
  const result={pack,revision,request};
  for(const key of ['field','style','seed','x','y','z','span','width','height','dimensionKey']){
    const value=options[key];if(value!==undefined)result[key]=typeof value==='bigint'?String(value):value;
  }
  if(options.buffet!==undefined)result.studioLayout=options.buffet;
  if(options.chunkArea)result.chunkArea=Object.freeze({width:options.chunkArea.width,depth:options.chunkArea.depth});
  if(options.nativeConfig)result.resource=options.nativeConfig.id;
  if(options.procedural)result.procedural=Object.freeze({key:options.procedural.key,family:options.procedural.family,index:options.procedural.index,variant:options.procedural.variant});
  return Object.freeze(result);
}

export function previewDescription(data,inputs){
  if(!data)return['No retained data.'];
  const lines=[`Field: ${data.field??inputs?.field??'voxel volume'}`,`Scope: ${data.scope??data.metadata?.scope??'Not provided'}`];
  if(inputs){
    lines.push(`Pack: ${inputs.pack||'None'} · resource revision ${inputs.revision}`);
    if(inputs.seed!==undefined)lines.push(`Entered seed: ${inputs.seed}`);
    if(inputs.dimensionKey)lines.push(`Dimension: ${inputs.dimensionKey}`);
    if(inputs.resource)lines.push(`Resource: ${inputs.resource}`);
    if(inputs.style)lines.push(`Style: ${inputs.style}`);
    if(inputs.procedural)lines.push(`Procedural entry: ${inputs.procedural.key} · ${inputs.procedural.family} ${inputs.procedural.index} · variant ${inputs.procedural.variant}`);
    if(inputs.studioLayout!==undefined)lines.push(`Studio layout: ${inputs.studioLayout?'on':'off'}`);
  }
  const seed=data.seed??data.metadata?.seed;if(seed!==undefined)lines.push(`Engine seed: ${seed}`);
  if(data.origin){
    lines.push(`Stored cells: ${data.width} × ${data.height} × ${data.depth}`);
    lines.push(`Origin X/Y/Z: ${data.origin.join(', ')}`);
    if(data.metadata?.chunkArea)lines.push(`Native destination chunks: ${data.metadata.chunkArea.width} × ${data.metadata.chunkArea.depth}`);
  }else{
    lines.push(`Stored samples: ${data.width} × ${data.height}`);
    lines.push(`Centre X/Z: ${data.x}, ${data.z} · span X/Z: ${data.span}, ${data.depth}`);
    if(data.y!==undefined)lines.push(`Slice Y: ${data.y}`);
  }
  return lines;
}
