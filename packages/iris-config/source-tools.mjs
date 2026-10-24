import{JsonDocument,JsonNumber}from'./document.mjs';
import{propertySchema}from'./schema.mjs';
import{fieldHint}from'./inventory.mjs';
import{JSON_LIMIT,pointerParts}from'../shared/paths.mjs';
export const SOURCE_TOOL_LIMITS=Object.freeze({nodes:32768,outlineRows:4096,metadataUnits:1024*1024,searchUnits:4*1024*1024,formatBytes:2*1024*1024,previewUnits:65536});
const encoder=new TextEncoder();
export function formatJsonSource(text,{indent='2',newline='keep'}={}){
  if(typeof text!=='string'||text.length>SOURCE_TOOL_LIMITS.formatBytes||encoder.encode(text).length>SOURCE_TOOL_LIMITS.formatBytes)throw new Error('Formatting admits at most 2 MiB of source. Larger resources remain editable in JSON view.');
  if(!['2','4','tab','compact'].includes(indent)||!['keep','lf','crlf'].includes(newline))throw new Error('Choose a supported indentation and line ending.');const document=new JsonDocument(text,{maxNodes:SOURCE_TOOL_LIMITS.nodes});if(document.root.type!=='object'||document.issues.length)throw new Error('Formatting requires an object resource without duplicate properties.');
  const line=newline==='keep'?(text.match(/\r\n|\r|\n/)?.[0]??'\n'):newline==='lf'?'\n':'\r\n',unit=indent==='tab'?'\t':indent==='compact'?'':' '.repeat(Number(indent)),compact=indent==='compact',parts=[];let units=0;
  const append=value=>{if((units+=value.length)>JSON_LIMIT)throw new Error('Formatted source exceeds 8 MiB. Choose a smaller indentation.');parts.push(value);};
  const visit=(node,depth)=>{if(!['object','array'].includes(node.type)){append(text.slice(node.start,node.end));return;}const object=node.type==='object';append(object?'{':'[');for(let i=0;i<node.children.length;i++){const child=node.children[i];if(i)append(',');if(!compact)append(line+unit.repeat(depth+1));if(object)append(text.slice(child.keyStart,child.keyEnd)+(compact?':':': '));visit(child,depth+1);}if(node.children.length&&!compact)append(line+unit.repeat(depth));append(object?'}':']');};
  // Keep BOM and outer trivia verbatim. Formatting changes only container whitespace.
  append(text.slice(0,document.root.start));visit(document.root,0);append(text.slice(document.root.end));const result=parts.join(''),bytes=encoder.encode(result).length;if(bytes>JSON_LIMIT)throw new Error('Formatted UTF-8 source exceeds 8 MiB.');return{text:result,changed:result!==text,bytes,nodes:document.nodeCount,indent,newline:line};
}
export function sourceOutline(document,{pointer='',query='',type='all'}={}){
  if(!(document instanceof JsonDocument)||document.issues.length)throw new Error('Resolve JSON syntax and duplicate properties before opening the outline.');if(document.nodeCount>SOURCE_TOOL_LIMITS.nodes)throw new Error('Outline admits 32,768 parsed values. Use Go to or source search for this resource.');if(typeof pointer!=='string'||typeof query!=='string'||query.length>256||!['all','containers','string','number','boolean','null'].includes(type))throw new Error('Invalid outline filter.');const root=document.nodes.get(pointer);if(!root)throw new Error('The selected subtree pointer is not present.');const rows=[],stack=[{node:root,depth:0}],needle=query.toLowerCase();let units=0,search=0,complete=true,visited=0;
  while(stack.length){const{node,depth}=stack.pop();visited++;const preview=['array','object'].includes(node.type)?node.children.length+' children':document.text.slice(node.start,Math.min(node.end,node.start+128)),cost=node.pointer.length+preview.length+64;if((search+=cost)>SOURCE_TOOL_LIMITS.searchUnits){complete=false;break;}const matches=type==='all'||type==='containers'&&['array','object'].includes(node.type)||type===node.type;
    if(matches&&(!needle||node.pointer.toLowerCase().includes(needle)||preview.toLowerCase().includes(needle))){if(rows.length===SOURCE_TOOL_LIMITS.outlineRows||units+cost>SOURCE_TOOL_LIMITS.metadataUnits){complete=false;break;}units+=cost;rows.push({pointer:node.pointer,type:node.type,start:node.start,end:node.end,depth,preview,clipped:!['array','object'].includes(node.type)&&node.end-node.start>128});}
    for(let i=node.children.length-1;i>=0;i--)stack.push({node:node.children[i],depth:depth+1});
  }
  return{rows,complete,visited,metadataUnits:units};
}
// Bounded display only. An ellipsis means the snippet is not a complete JSON value.
export function hintPreview(value,{maxUnits=2048,maxNodes=64}={}){
  let text='',nodes=0,clipped=false;const add=part=>{if(text.length+part.length>maxUnits){text+=part.slice(0,Math.max(0,maxUnits-text.length));clipped=true;return false;}text+=part;return true;};
  const visit=input=>{if(++nodes>maxNodes){clipped=true;return;}if(input instanceof JsonNumber){const raw=input.raw;if(raw.length>256){add(raw.slice(0,256));clipped=true;}else add(raw);return;}if(typeof input==='string'){add(JSON.stringify(input.slice(0,256)));if(input.length>256)clipped=true;return;}if(input===null||typeof input!=='object'){add(JSON.stringify(input)??'undefined');return;}const array=Array.isArray(input);add(array?'[':'{');let first=true;for(const key in input){if(!Object.hasOwn(input,key))continue;if(nodes>=maxNodes||text.length>=maxUnits){clipped=true;break;}if(!first)add(', ');first=false;if(!array){add(JSON.stringify(key.slice(0,128))+': ');if(key.length>128)clipped=true;}visit(input[key]);}add(array?']':'}');};visit(value);return{text:text+(clipped?'…':''),clipped};
}
export function sourceGuidance(document,schema,inventory,path,pointer){
  const node=document.nodes.get(pointer);if(!node)throw new Error('The selected JSON value no longer exists.');const parts=pointerParts(pointer),native=fieldHint(inventory,path,parts),rule=propertySchema(schema,parts),rows=[];
  for(const[label,input]of[['Attached schema',rule],['Pinned native field inventory',native]]){const values=[];for(const key of['title','description','type','kind','definition','enum','const','default','minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minLength','maxLength','pattern','minItems','maxItems','uniqueItems','required','deprecated'])if(Object.hasOwn(input,key)&&input[key]!==undefined){values.push({key,...hintPreview(input[key])});}if(values.length)rows.push({label,values});}
  const parent=parts.length?propertySchema(schema,parts.slice(0,-1)):null,parentRequired=Array.isArray(parent?.required)?parent.required.includes(parts.at(-1)):null;return{node,rows,parentRequired,schemaAttached:schema!==null&&schema!==undefined,inventoryAttached:!!inventory};
}
