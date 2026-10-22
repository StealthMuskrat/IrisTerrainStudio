import{JSON_LIMIT}from'../../../packages/shared/paths.mjs';
export const editorLines=text=>text.replace(/\r\n?/g,'\n');
// Map a textarea's normalized edit back to the original source. Unchanged source
// stays byte-for-byte; only inserted line breaks adopt its first existing style.
export function editorTextToSource(source,value){
  if(typeof source!=='string'||typeof value!=='string'||value.length>JSON_LIMIT)throw new Error('JSON editor source exceeds 8 MiB.');
  const before=editorLines(source),after=editorLines(value);if(before===after)return source;
  let start=0,endBefore=before.length,endAfter=after.length;
  while(start<endBefore&&start<endAfter&&before.charCodeAt(start)===after.charCodeAt(start))start++;
  while(endBefore>start&&endAfter>start&&before.charCodeAt(endBefore-1)===after.charCodeAt(endAfter-1)){endBefore--;endAfter--;}
  let sourceStart=start,sourceEnd=endBefore;
  for(let i=0,offset=0;offset<endBefore&&i<source.length;i++,offset++)if(source.charCodeAt(i)===13&&source.charCodeAt(i+1)===10){if(offset<start)sourceStart++;sourceEnd++;i++;}
  const newline=source.match(/\r\n|\r|\n/)?.[0]??'\n',inserted=after.slice(start,endAfter).replace(/\n/g,newline),result=source.slice(0,sourceStart)+inserted+source.slice(sourceEnd);
  if(result.length>JSON_LIMIT||new TextEncoder().encode(result).byteLength>JSON_LIMIT)throw new Error('JSON editor source exceeds 8 MiB.');return result;
}
export function sourceEditor(element,source,attributes={}){
  const node=element('textarea',{class:'conflict-editor',spellcheck:'false',...attributes});let text=source;node.value=text;
  node.addEventListener('input',()=>{try{text=editorTextToSource(text,node.value);node.setCustomValidity?.('');}catch(error){node.value=text;node.setCustomValidity?.(error.message);node.reportValidity?.();}});
  return{node,read(){text=editorTextToSource(text,node.value);return text;},set(value){text=value;node.value=value;node.setCustomValidity?.('');}};
}
