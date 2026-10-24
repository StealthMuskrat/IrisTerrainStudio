import{JsonDocument}from'../../../packages/iris-config/document.mjs';
export function jsonSelection(text,pointer='',{offset,document:parsed}={}){
  if(Number.isSafeInteger(offset)&&offset>=0&&offset<=text.length)return{start:offset,end:Math.min(text.length,offset+1)};
  if(typeof pointer!=='string'||pointer!==''&&(!pointer.startsWith('/')||/~(?:[^01]|$)/.test(pointer)))throw new Error('Use a JSON pointer such as /regions/0. Escape / as ~1 and ~ as ~0; empty selects the root.');
  const document=parsed?.text===text?parsed:new JsonDocument(text),node=document.nodes.get(pointer);if(!node)throw new Error('This JSON pointer is not present in the current resource.');return{start:node.start,end:node.end,value:node.value,type:node.type};
}
// HTML textarea values collapse CRLF/CR to LF. Keep search/parser offsets in original source.
export function sourceSelectionForEditor(source,selection,value){
  const {start,end}=selection;if(typeof source!=='string'||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>source.length)throw new Error('Invalid JSON source selection.');
  if(source===value)return{start,end};if(source.replace(/\r\n?/g,'\n')!==value)throw new Error('The JSON viewer text changed. Open this location again.');
  let mappedStart=start,mappedEnd=end;
  for(let i=0;i<end;i++)if(source.charCodeAt(i)===13&&source.charCodeAt(i+1)===10){if(i+1<=start)mappedStart--;if(i+1<end)mappedEnd--;i++;}
  return{start:mappedStart,end:start===end?mappedStart:mappedEnd};
}
export function selectJsonText(editor,selection,{source=editor.value}={}){
  const mapped=sourceSelectionForEditor(source,selection,editor.value);editor.focus({preventScroll:true});editor.setSelectionRange(mapped.start,mapped.end);const height=parseFloat(editor.ownerDocument?.defaultView?.getComputedStyle(editor).lineHeight)||20,lines=editor.value.slice(0,mapped.start).split('\n').length-1;editor.scrollTop=Math.max(0,lines*height-(editor.clientHeight||0)/3);
}
