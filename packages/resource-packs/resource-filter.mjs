// Java Pattern.asPredicate uses find(), not whole-string matching. This bounded regular
// subset uses dynamic programming, so repeated wildcard atoms cannot backtrack exponentially.
const META='\\.^$|?*+()[]{}',ESCAPES=new Set('\\.^$|?*+()[]{}-/'.split(''));
function atom(source,at){
  const c=source[at];if(c==='['){let end=at+1,escaped=false;for(;end<source.length;end++){if(!escaped&&source[end]===']'&&end>at+1)break;if(!escaped&&source[end]==='\\')escaped=true;else escaped=false;}
    if(end===source.length)throw new Error('Unclosed resource-filter character class.');const text=source.slice(at,end+1);if(text.includes('&&')||text.slice(1,-1).includes('[')||/\\[^dDsSwW\\.\^$|?*+()[\]{}\-/]/.test(text))throw new Error('Resource-filter character class needs an additional Java pattern adapter.');let pattern;try{pattern=new RegExp('^(?:'+text+')$');}catch{throw new Error('Invalid resource-filter character class.');}return{test:value=>pattern.test(value),end:end+1};
  }
  if(c==='\\'){const next=source[at+1];if(next===undefined)throw new Error('Incomplete resource-filter escape.');if('dDsSwW'.includes(next)){const pattern=new RegExp('\\'+next);return{test:value=>pattern.test(value),end:at+2};}if(!ESCAPES.has(next))throw new Error('Resource-filter escape needs an additional Java pattern adapter.');return{test:value=>value===next,end:at+2};}
  if(c==='.')return{test:()=>true,end:at+1};
  if(META.includes(c))throw new Error('Resource-filter groups, counted repetitions or assertions need an additional Java pattern adapter.');
  return{test:value=>value===c,end:at+1};
}
export function resourcePattern(source){
  if(typeof source!=='string'||source.length>1024||/[^\x20-\x7e]/.test(source))throw new Error('Resource filters require an ASCII Java pattern within 1,024 characters.');
  const branches=[[]];let at=0;
  while(at<source.length){const c=source[at];if(c==='|'){if(branches.length>=64)throw new Error('Too many resource-filter alternatives.');branches.push([]);at++;continue;}
    if(c==='^'||c==='$'){branches.at(-1).push({anchor:c});at++;continue;}
    const value=atom(source,at);at=value.end;const repeat='*+?'.includes(source[at]??' ') ? source[at++] : '';branches.at(-1).push({test:value.test,repeat});
    if(branches.reduce((n,b)=>n+b.length,0)>256)throw new Error('Resource filter exceeds its 256-atom budget.');
  }
  return value=>{
    if(typeof value!=='string'||value.length>1024||!/^[a-z0-9_./-]*$/.test(value))throw new Error('Resource filters require a bounded Minecraft resource namespace/path.');
    for(const tokens of branches){let next=new Uint8Array(value.length+1).fill(1);for(let i=tokens.length-1;i>=0;i--){const token=tokens[i],row=new Uint8Array(value.length+1);for(let j=value.length;j>=0;j--){if(token.anchor)row[j]=(token.anchor==='^'?j===0:j===value.length)&&next[j]?1:0;else{const hit=j<value.length&&token.test(value[j]);row[j]=token.repeat==='*'?(next[j]||hit&&row[j+1]?1:0):token.repeat==='+'?(hit&&(next[j+1]||row[j+1])?1:0):token.repeat==='?'?(next[j]||hit&&next[j+1]?1:0):hit&&next[j+1]?1:0;}}next=row;}if(next.some(Boolean))return true;}return false;
  };
}
export function resourceFilter(section){
  if(section===undefined)return()=>false;
  if(!section||typeof section!=='object'||Array.isArray(section)||!Array.isArray(section.block)||section.block.length>128)throw new Error('Expected at most 128 resource-filter entries.');
  const rules=section.block.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Invalid resource-filter entry.');return{namespace:row.namespace===undefined?()=>true:resourcePattern(row.namespace),path:row.path===undefined?()=>true:resourcePattern(row.path)};});
  // The pinned resource manager selects namespaces and paths independently across the list.
  return(namespace,path)=>rules.some(row=>row.namespace(namespace))&&rules.some(row=>row.path(path));
}
