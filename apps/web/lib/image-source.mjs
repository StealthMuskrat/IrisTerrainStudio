export function nativePngSourceNotes(source){
  if(!source||source.policy!=='jdk-png-default-image')return[];
  const notes=[];
  if(source.colorChunks.length)notes.push(`PNG ${source.colorChunks.join(', ')} metadata does not change the pinned JDK reader's raw bands. No profile or HDR color conversion is applied.`);
  if(source.animationChunks.length)notes.push('The pinned JDK PNG reader uses the default IDAT image. APNG animation frames are not sampled for terrain generation.');
  return notes;
}
