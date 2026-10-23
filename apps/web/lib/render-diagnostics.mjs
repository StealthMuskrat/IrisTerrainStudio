// A small, portable report of the displayed resources, without copying voxel arrays.
export function renderingDiagnosticReport(world,session){
  const volume=world?.volume,rows=[...(session?.diagnostics??[]),...(world?.diagnostics??[])],limit=1024;
  return{formatVersion:1,createdAt:new Date().toISOString(),view:world?.mode??null,volume:volume?{width:volume.width,height:volume.height,depth:volume.depth,origin:volume.origin.slice(),scope:volume.metadata?.scope??null,seed:volume.metadata?.seed??null}:null,
    total:rows.length,omitted:Math.max(0,rows.length-limit),diagnostics:rows.slice(0,limit).map(row=>({severity:row.severity??row.type??'error',source:row.block??row.label??'Rendering',code:row.code??(row.block?'rendering-notice':'gpu-startup'),message:String(row.message),...(row.line?{line:row.line,column:row.column}:{} )}))};
}
