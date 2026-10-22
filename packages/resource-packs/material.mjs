// Format-97.1 Material.CODEC: an identifier or {sprite, force_translucent?}.
// Identifier validation is supplied by the resource resolver to avoid a module cycle.
export function parseMaterial(value,identifier){
  if(typeof value==='string')return{sprite:identifier(value).id,forceTranslucent:false};
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.sprite!=='string'||value.force_translucent!==undefined&&typeof value.force_translucent!=='boolean')throw new Error('Expected a texture identifier or a material with sprite and boolean force_translucent.');
  return{sprite:identifier(value.sprite).id,forceTranslucent:value.force_translucent===true};
}
