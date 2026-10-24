// Java Pattern.asPredicate uses find(), not whole-string matching. This bounded regular
// subset uses bounded Thompson states, so repeated groups cannot backtrack exponentially.
const META='\\.^$|?*+()[]{}',ESCAPES=new Set('\\.^$|?*+()[]{}-/'.split(''));
function characterClass(source,at){
  let cursor=at+1,negated=false,closed=false;const terms=[];
  if(source[cursor]==='^'){negated=true;cursor++;}
  function value(){
    const token=source[cursor++];if(token===undefined)throw new Error('Unclosed resource-filter character class.');
    if(token==='[')throw new Error('Nested resource-filter classes need an additional Java pattern adapter.');
    if(token==='\\'){
      const escaped=source[cursor++];if(escaped===undefined)throw new Error('Incomplete resource-filter class escape.');
      if('dDsSwW'.includes(escaped)){const test=new RegExp('^\\'+escaped+'$');return{test:c=>test.test(c)};}
      if(!ESCAPES.has(escaped))throw new Error('Resource-filter class escape needs an additional Java pattern adapter.');return{code:escaped.charCodeAt(0)};
    }
    return{code:token.charCodeAt(0)};
  }
  while(cursor<source.length){
    if(source[cursor]===']'&&terms.length){cursor++;closed=true;break;}
    if(source.slice(cursor,cursor+2)==='&&')throw new Error('Resource-filter class intersections need an additional Java pattern adapter.');
    const first=value();
    if(source[cursor]==='-'&&source[cursor+1]!==']'&&source[cursor+1]!==undefined){cursor++;const last=value();if(first.code===undefined||last.code===undefined||first.code>last.code)throw new Error('Invalid resource-filter character range.');terms.push(c=>c.charCodeAt(0)>=first.code&&c.charCodeAt(0)<=last.code);}
    else terms.push(first.test??(c=>c.charCodeAt(0)===first.code));
  }
  if(!closed)throw new Error('Unclosed resource-filter character class.');
  const allowed=new Uint8Array(128);for(const c of'abcdefghijklmnopqrstuvwxyz0123456789_./-')allowed[c.charCodeAt(0)]=terms.some(test=>test(c))!==negated?1:0;
  return{test:c=>allowed[c.charCodeAt(0)]===1,end:cursor};
}
function atom(source,at){
  const c=source[at];if(c==='[')return characterClass(source,at);
  if(c==='\\'){const next=source[at+1];if(next===undefined)throw new Error('Incomplete resource-filter escape.');if('dDsSwW'.includes(next)){const pattern=new RegExp('\\'+next);return{test:value=>pattern.test(value),end:at+2};}if(!ESCAPES.has(next))throw new Error('Resource-filter escape needs an additional Java pattern adapter.');return{test:value=>value===next,end:at+2};}
  if(c==='.')return{test:()=>true,end:at+1};
  if(META.includes(c))throw new Error('Invalid resource-filter atom or unconnected Java pattern syntax.');
  return{test:value=>value===c,end:at+1};
}
// Captures do not affect Pattern.asPredicate's boolean result. Backreferences,
// lookarounds, flags and possessive matching require additional native semantics.
export function resourcePattern(source){
  if(typeof source!=='string'||source.length>1024||/[^\x20-\x7e]/.test(source))throw new Error('Resource filters require an ASCII Java pattern within 1,024 characters.');
  let at=0,atoms=0,alternatives=1;
  const sequence=children=>children.length===1?children[0]:{kind:'sequence',children};
  function expression(depth){
    const branches=[];let children=[];
    while(at<source.length&&source[at]!==')'){
      if(source[at]==='|'){if(++alternatives>64)throw new Error('Too many resource-filter alternatives.');branches.push(sequence(children));children=[];at++;continue;}
      let node;
      if(source[at]==='('){
        if(depth>=16)throw new Error('Resource-filter groups exceed their sixteen-level budget.');
        at++;if(source[at]==='?'){if(source.slice(at,at+2)!=='?:')throw new Error('Resource-filter assertions or flags need an additional Java pattern adapter.');at+=2;}
        node=expression(depth+1);if(source[at]!==')')throw new Error('Unclosed resource-filter group.');at++;
      }else{
        if(++atoms>256)throw new Error('Resource filter exceeds its 256-atom budget.');
        if(source[at]==='^'||source[at]==='$')node={kind:'anchor',anchor:source[at++]};
        else if(source[at]==='\\'&&['A','z','Z'].includes(source[at+1])){node={kind:'anchor',anchor:source[at+1]==='A'?'^':'$'};at+=2;}
        else{const value=atom(source,at);at=value.end;node={kind:'character',test:value.test};}
      }
      let minimum,maximum;
      if(['*','+','?'].includes(source[at])){const repeat=source[at++];minimum=repeat==='+'?1:0;maximum=repeat==='?'?1:Infinity;}
      else if(source[at]==='{'){
        const repeat=/^\{(\d+)(?:,(\d*))?\}/.exec(source.slice(at));if(!repeat)throw new Error('Invalid resource-filter counted repetition.');
        minimum=Number(repeat[1]);maximum=repeat[2]===undefined?minimum:repeat[2]===''?Infinity:Number(repeat[2]);
        if(!Number.isSafeInteger(minimum)||minimum>1024||maximum!==Infinity&&(!Number.isSafeInteger(maximum)||maximum>1024)||minimum>maximum)throw new Error('Resource-filter repetition exceeds its 1,024-count budget or has reversed bounds.');at+=repeat[0].length;
      }
      if(minimum!==undefined){
        if(source[at]==='+')throw new Error('Possessive resource-filter repetitions need an additional Java pattern adapter.');
        if(source[at]==='?')at++; // Reluctance changes match selection, not find() existence.
        node={kind:'repeat',child:node,minimum,maximum};
      }
      children.push(node);
    }
    branches.push(sequence(children));return branches.length===1?branches[0]:{kind:'alternative',children:branches};
  }
  const tree=expression(0);if(at!==source.length)throw new Error('Unmatched resource-filter group.');
  // Thompson states share continuations. Counted repetition expands only within
  // this admission limit; matching never invokes a recursive/backtracking engine.
  const states=[];
  function state(value){if(states.length>=2048)throw new Error('Resource filter exceeds its 2,048-state budget.');states.push(value);return states.length-1;}
  function compile(node,next){
    if(node.kind==='character')return state({test:node.test,next});
    if(node.kind==='anchor')return state({anchor:node.anchor,next});
    if(node.kind==='sequence'){let result=next;for(let i=node.children.length-1;i>=0;i--)result=compile(node.children[i],result);return result;}
    if(node.kind==='alternative')return state({edges:node.children.map(child=>compile(child,next))});
    let result=next;
    if(node.maximum===Infinity){const loop=state({edges:[]});states[loop].edges=[compile(node.child,loop),next];result=loop;}
    else for(let i=node.minimum;i<node.maximum;i++)result=state({edges:[compile(node.child,result),result]});
    for(let i=0;i<node.minimum;i++)result=compile(node.child,result);return result;
  }
  const matched=state({matched:true}),start=compile(tree,matched);
  function closure(first,position,length,seen){const pending=[first];while(pending.length){const id=pending.pop();if(seen.has(id))continue;seen.add(id);const entry=states[id];if(entry.edges)pending.push(...entry.edges);else if(entry.anchor&&(entry.anchor==='^'?position===0:position===length))pending.push(entry.next);}}
  return value=>{
    if(typeof value!=='string'||value.length>1024||!/^[a-z0-9_./-]*$/.test(value))throw new Error('Resource filters require a bounded Minecraft resource namespace/path.');
    let active=new Set();
    for(let position=0;position<=value.length;position++){
      closure(start,position,value.length,active);if(active.has(matched))return true;
      const next=new Set();for(const id of active){const entry=states[id];if(position<value.length&&entry.test?.(value[position]))closure(entry.next,position+1,value.length,next);}active=next;
    }
    return false;
  };
}
export function resourceFilter(section){
  if(section===undefined)return()=>false;
  if(!section||typeof section!=='object'||Array.isArray(section)||!Array.isArray(section.block)||section.block.length>128)throw new Error('Expected at most 128 resource-filter entries.');
  const rules=section.block.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Invalid resource-filter entry.');return{namespace:row.namespace===undefined?()=>true:resourcePattern(row.namespace),path:row.path===undefined?()=>true:resourcePattern(row.path)};});
  // The pinned resource manager selects namespaces and paths independently across the list.
  return(namespace,path)=>rules.some(row=>row.namespace(namespace))&&rules.some(row=>row.path(path));
}
