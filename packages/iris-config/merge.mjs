import{JsonDocument}from'./document.mjs';
import{JSON_LIMIT}from'../shared/paths.mjs';
export const MERGE_LIMITS=Object.freeze({sourceUnits:524288,nodesPerSource:8192,changes:256,comparisons:8*1024*1024});
// A proposal only: arrays/type replacements are atomic, object members use their
// decoded identities, and conflicting edits never publish a partial candidate.
export function mergeJsonSources(baseText,localText,diskText){
  const inputs=[baseText,localText,diskText];if(inputs.some(text=>typeof text!=='string'||text.length>MERGE_LIMITS.sourceUnits))throw new Error('Merge suggestions admit at most 1 MiB of UTF-16 payload per source. Merge larger files manually.');
  const docs=inputs.map(text=>{const doc=new JsonDocument(text,{maxNodes:MERGE_LIMITS.nodesPerSource});if(doc.root.type!=='object'||doc.issues.length)throw new Error('Merge suggestions need three JSON objects without duplicate properties. Use the manual merged source for invalid inputs.');return doc;}),[base,local,disk]=docs;
  let comparisons=0,changes=0,accepted=0,already=0;const patches=[],conflicts=[];
  const raw=(doc,node)=>node?doc.text.slice(node.start,node.end):null;
  const same=(a,ad,b,bd)=>{if(!a||!b)return a===b;if(a.end-a.start!==b.end-b.start)return false;comparisons+=a.end-a.start;if(comparisons>MERGE_LIMITS.comparisons)throw new Error('Merge comparison budget reached. Merge this source manually.');return raw(ad,a)===raw(bd,b);};
  const change=()=>{if(++changes>MERGE_LIMITS.changes)throw new Error('Merge suggestion exceeds 256 changed values. Merge this source manually.');};
  const conflict=(pointer,b,l,d,reason)=>{change();conflicts.push({pointer,reason,base:raw(base,b)?.slice(0,256)??null,local:raw(local,l)?.slice(0,256)??null,disk:raw(disk,d)?.slice(0,256)??null});};
  function visit(b,l,d,pointer){
    if(same(b,base,l,local))return true;
    if(same(l,local,d,disk)){change();already++;return true;}
    if(same(b,base,d,disk)){change();accepted++;if(!d)return false;if(!l)return false;patches.push({start:d.start,end:d.end,text:raw(local,l)});return true;}
    if(!b||!l||!d||b.type!=='object'||l.type!=='object'||d.type!=='object'){conflict(pointer,b,l,d,'Both sources changed this value differently, removed its container, or changed an atomic array/type.');return true;}
    const bm=new Map(b.children.map(node=>[node.pointer,node])),lm=new Map(l.children.map(node=>[node.pointer,node])),dm=new Map(d.children.map(node=>[node.pointer,node])),removed=new Set(),added=[];
    for(const key of new Set([...bm.keys(),...lm.keys(),...dm.keys()])){
      const bn=bm.get(key),ln=lm.get(key),dn=dm.get(key);
      if(!bn&&ln&&!dn){change();accepted++;added.push(local.text.slice(ln.memberStart,ln.end));continue;}
      if(!visit(bn,ln,dn,key)&&dn)removed.add(dn);
    }
    const children=d.children,survivors=children.filter(node=>!removed.has(node));
    for(let i=0;i<children.length;i++)if(removed.has(children[i])){const first=i;while(i+1<children.length&&removed.has(children[i+1]))i++;const last=i;patches.push({start:first?children[first-1].end:children[first].memberStart,end:first?children[last].end:children[last+1]?.memberStart??children[last].end,text:''});}
    if(added.length){const layout=disk.layout(d),last=survivors.at(-1),at=last?.end??children[0]?.memberStart??d.start+1,separator=','+layout.separator;patches.push({start:at,end:at,text:(last?separator:children.length?'':layout.separator)+added.join(separator)});}
    return true;
  }
  visit(base.root,local.root,disk.root,'');
  if(conflicts.length)return{candidate:null,conflicts,changes,accepted,already,comparisons};
  patches.sort((a,b)=>a.start-b.start||(a.end-a.start)-(b.end-b.start));const parts=[];let cursor=0;
  for(const patch of patches){if(patch.start<cursor)throw new Error('Merge source ranges overlap. Merge this source manually.');parts.push(diskText.slice(cursor,patch.start),patch.text);cursor=patch.end;}parts.push(diskText.slice(cursor));const candidate=parts.join('');
  if(new TextEncoder().encode(candidate).byteLength>JSON_LIMIT)throw new Error('Merged source exceeds 8 MiB.');const checked=new JsonDocument(candidate,{maxNodes:MERGE_LIMITS.nodesPerSource*2});if(checked.root.type!=='object'||checked.issues.length)throw new Error('Merged source is ambiguous. Merge it manually.');
  return{candidate,conflicts,changes,accepted,already,comparisons};
}
