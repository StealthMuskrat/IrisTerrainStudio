import{JsonDocument}from'../../../packages/iris-config/document.mjs';
export function jsonSelection(text,pointer='',{offset,document:parsed}={}){
  if(Number.isSafeInteger(offset)&&offset>=0&&offset<=text.length)return{start:offset,end:Math.min(text.length,offset+1)};
  if(typeof pointer!=='string'||pointer!==''&&(!pointer.startsWith('/')||/~(?:[^01]|$)/.test(pointer)))throw new Error('Use a JSON pointer such as /regions/0. Escape / as ~1 and ~ as ~0; empty selects the root.');
  const document=parsed?.text===text?parsed:new JsonDocument(text),node=document.nodes.get(pointer);if(!node)throw new Error('This JSON pointer is not present in the current resource.');return{start:node.start,end:node.end,value:node.value,type:node.type};
}
export function selectJsonText(editor,selection){editor.focus({preventScroll:true});editor.setSelectionRange(selection.start,selection.end);const height=parseFloat(editor.ownerDocument?.defaultView?.getComputedStyle(editor).lineHeight)||20,lines=editor.value.slice(0,selection.start).split('\n').length-1;editor.scrollTop=Math.max(0,lines*height-(editor.clientHeight||0)/3);}
