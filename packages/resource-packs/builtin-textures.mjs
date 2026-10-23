// Minecraft 26.3 MissingTextureAtlasSprite.generateMissingImage bytecode.
// This named native atlas sprite is not a missing-file fallback.
export const MISSING_SPRITE='minecraft:missingno';
export function builtinTexture(name){
  if(name!==MISSING_SPRITE)return null;
  const pixels=new Uint8Array(16*16*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const offset=(y*16+x)*4,bright=(y<8)!==(x<8);
    pixels[offset]=bright?248:0;pixels[offset+1]=0;pixels[offset+2]=bright?248:0;pixels[offset+3]=255;
  }
  return{width:16,height:16,pixels};
}
