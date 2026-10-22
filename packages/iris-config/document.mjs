import { pointerEscape, pointerParts, JSON_LIMIT } from '../shared/paths.mjs';
export class JsonNumber {
  constructor(raw) { if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) throw new Error('Enter a valid JSON number.'); this.raw = raw; Object.freeze(this); }
  toString() { return this.raw; }
  valueOf() { return Number(this.raw); }
}
export function stringify(value, depth = 0) {
  if (value instanceof JsonNumber) return value.raw;
  if (value === null || typeof value !== 'object') { const text = JSON.stringify(value); if (text === undefined) throw new Error('Unsupported JSON value.'); return text; }
  const pad = '  '.repeat(depth), inner = pad + '  ', array = Array.isArray(value), entries = array ? value.map((v, i) => [i, v]) : Object.entries(value);
  if (!entries.length) return array ? '[]' : '{}';
  return (array ? '[' : '{') + '\n' + entries.map(([key, v]) => inner + (array ? '' : JSON.stringify(key) + ': ') + stringify(v, depth + 1)).join(',\n') + '\n' + pad + (array ? ']' : '}');
}
export class JsonDocument {
  constructor(text) {
    this.text = text; this.nodes = new Map(); this.issues = []; let cursor = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    const whitespace = () => { while (/[\x20\t\r\n]/.test(text[cursor] || '\0')) cursor++; };
    const fail = message => { const error = new SyntaxError(message); error.offset = cursor; error.line = text.slice(0, cursor).split('\n').length; error.column = cursor - text.lastIndexOf('\n', cursor - 1); throw error; };
    const string = () => { const start = cursor++; for (; cursor < text.length; cursor++) { if (text[cursor] === '\\') { cursor++; continue; } if (text[cursor] === '"') { cursor++; try { return JSON.parse(text.slice(start, cursor)); } catch { fail('Invalid JSON string.'); } } } fail('Unterminated JSON string.'); };
    const parse = (pointer, depth = 0) => {
      if (depth > 100) fail('Configuration nesting exceeds 100 levels.');
      whitespace(); const start = cursor; let value, type, children = [];
      const char = text[cursor];
      if (char === '{' || char === '[') {
        const array = char === '[', end = array ? ']' : '}'; type = array ? 'array' : 'object'; value = array ? [] : Object.create(null); cursor++; whitespace();
        if (text[cursor] !== end) for (;;) {
          let key,keyStart,keyEnd;
          if (array) key = String(value.length);
          else { if (text[cursor] !== '"') fail('Expected a quoted property name.'); keyStart=cursor;key = string();keyEnd=cursor;whitespace(); if (text[cursor++] !== ':') fail('Expected a colon after the property name.'); }
          const child = parse(pointer + '/' + pointerEscape(key), depth + 1);
          child.memberStart=array?child.start:keyStart;if(!array){child.keyStart=keyStart;child.keyEnd=keyEnd;}
          if (!array && Object.hasOwn(value, key)) this.issues.push({ pointer, message: `Duplicate property: ${key}`, severity: 'error' });
          Object.defineProperty(value, key, { value: child.value, writable: true, configurable: true, enumerable: true }); children.push(child);
          whitespace(); if (text[cursor] === end) break;
          if (text[cursor++] !== ',') fail('Expected a comma between values.'); whitespace();
        }
        if (text[cursor++] !== end) fail(`Expected ${end}.`);
      } else if (char === '"') { type = 'string'; value = string(); }
      else if (text.startsWith('true', cursor)) { value = true; type = 'boolean'; cursor += 4; }
      else if (text.startsWith('false', cursor)) { value = false; type = 'boolean'; cursor += 5; }
      else if (text.startsWith('null', cursor)) { value = null; type = 'null'; cursor += 4; }
      else { const token = text.slice(cursor).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/); if (!token) fail('Expected a JSON value.'); value = new JsonNumber(token[0]); type = 'number'; cursor += token[0].length; }
      const node = { pointer, start, end: cursor, type, value, children }; this.nodes.set(pointer, node); return node;
    };
    this.root = parse(''); whitespace(); if (cursor !== text.length) fail('Unexpected content after the JSON value.'); this.value = this.root.value;
  }
  replace(pointer, value) {
    return this.replaceRaw(pointer,stringify(value, pointerParts(pointer).length));
  }
  selected(pointer){if(this.issues.length)throw new Error('Resolve duplicate properties in JSON view before structural editing.');const node=this.nodes.get(pointer);if(!node)throw new Error('The selected property no longer exists.');return node;}
  fragment(text){if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>JSON_LIMIT)throw new Error('JSON value exceeds 8 MiB.');const doc=new JsonDocument(text);if(doc.issues.length)throw new Error('JSON values cannot contain duplicate properties.');return text.slice(doc.root.start,doc.root.end);}
  splice(start,end,value){const text=this.text.slice(0,start)+value+this.text.slice(end);if(new TextEncoder().encode(text).byteLength>JSON_LIMIT)throw new Error('Configuration exceeds 8 MiB.');const result=new JsonDocument(text);if(result.issues.length)throw new Error('Structural edits cannot introduce duplicate properties.');return text;}
  replaceRaw(pointer,text){const node=this.selected(pointer);return this.splice(node.start,node.end,this.fragment(text));}
  parent(pointer){const parts=pointerParts(pointer);if(!parts.length)throw new Error('The root resource has no parent.');parts.pop();return this.selected(parts.length?'/'+parts.map(pointerEscape).join('/'):'');}
  remove(pointer) {
    if(pointer==='')throw new Error('The root resource cannot be removed.');
    const node=this.selected(pointer),parent=this.parent(pointer),index=parent.children.indexOf(node);
    // Remove only the member and one adjacent separator; retain all other value tokens.
    return index>0?this.splice(parent.children[index-1].end,node.end,''):this.splice(node.memberStart,parent.children[1]?.memberStart??node.end,'');
  }
  add(pointer, key, value) {
    return this.addRaw(pointer,key,stringify(value,pointerParts(pointer).length+1));
  }
  layout(node){
    const first=node.children[0],last=node.children.at(-1),body=this.text.slice(node.start+1,node.end-1),multiline=/[\r\n]/.test(body),newline=this.text.includes('\r\n')?'\r\n':'\n';
    const line=at=>this.text.slice(this.text.lastIndexOf('\n',at-1)+1,at),base=line(node.start).match(/^[\t ]*/)[0],indent=last&&/^[\t ]*$/.test(line(last.memberStart))?line(last.memberStart):base+'  ';
    const gap=node.children.length>1?this.text.slice(node.children.at(-2).end,last.memberStart):'',space=gap.match(/^,([\t ]*)$/)?.[1]??(/^[\t ]+/.test(body)?' ':'');
    const colon=node.type==='object'&&first?this.text.slice(first.keyEnd,first.start):multiline?': ':':';
    return{separator:multiline?newline+indent:space,colon,multiline,newline,base,indent};
  }
  addRaw(pointer,key,text){
    const node=this.selected(pointer);if(node.type==='array')return this.insertRaw(pointer,node.children.length,text);
    if(node.type!=='object')throw new Error('Choose an object or array.');if(typeof key!=='string')throw new Error('Enter a property name.');if(Object.hasOwn(node.value,key))throw new Error('That property already exists.');
    const raw=this.fragment(text),layout=this.layout(node),member=JSON.stringify(key)+layout.colon+raw,last=node.children.at(-1);
    if(last)return this.splice(last.end,last.end,','+layout.separator+member);
    const whitespace=this.text.slice(node.start+1,node.end-1);return this.splice(node.start+1,node.end-1,layout.multiline?layout.newline+layout.indent+member+layout.newline+layout.base:whitespace+member+whitespace);
  }
  insertRaw(pointer,index,text){
    const node=this.selected(pointer);if(node.type!=='array')throw new Error('Choose an array.');if(!Number.isSafeInteger(index)||index<0||index>node.children.length)throw new Error('Choose an array insertion position.');
    const raw=this.fragment(text),layout=this.layout(node),next=node.children[index],last=node.children.at(-1);
    if(next)return this.splice(next.start,next.start,raw+','+layout.separator);
    if(last)return this.splice(last.end,last.end,','+layout.separator+raw);
    const whitespace=this.text.slice(node.start+1,node.end-1);return this.splice(node.start+1,node.end-1,layout.multiline?layout.newline+layout.indent+raw+layout.newline+layout.base:whitespace+raw+whitespace);
  }
  duplicate(pointer){const node=this.selected(pointer),parent=this.parent(pointer);if(parent.type!=='array')throw new Error('Choose an array entry to duplicate.');return this.insertRaw(parent.pointer,parent.children.indexOf(node)+1,this.text.slice(node.start,node.end));}
  rename(pointer,key){const node=this.selected(pointer),parent=this.parent(pointer);if(parent.type!=='object'||typeof key!=='string')throw new Error('Choose an object property and enter its new name.');if(pointerParts(pointer).at(-1)===key)return this.text;if(Object.hasOwn(parent.value,key))throw new Error('That property already exists.');return this.splice(node.keyStart,node.keyEnd,JSON.stringify(key));}
  move(pointer,index){
    const node=this.selected(pointer),parent=this.parent(pointer),from=parent.children.indexOf(node);if(parent.type!=='array'||!Number.isSafeInteger(index)||index<0||index>=parent.children.length)throw new Error('Choose an existing array position.');if(from===index)return this.text;
    const low=Math.min(from,index),high=Math.max(from,index),children=parent.children.slice(low,high+1),values=children.map(child=>this.text.slice(child.start,child.end)),[chosen]=values.splice(from-low,1);values.splice(index-low,0,chosen);
    const replacement=values.map((value,i)=>value+(i<children.length-1?this.text.slice(children[i].end,children[i+1].start):'')).join('');return this.splice(children[0].start,children.at(-1).end,replacement);
  }
}
export class EditHistory {
  constructor(text, maxBytes = 32 * 1024 * 1024) { this.entries = [text]; this.index = 0; this.maxBytes = maxBytes; }
  get text() { return this.entries[this.index]; }
  push(text) { if (text === this.text) return; this.entries.splice(this.index + 1); this.entries.push(text); this.index++; while (this.entries.length > 1 && this.entries.reduce((sum, s) => sum + s.length * 2, 0) > this.maxBytes) { this.entries.shift(); this.index--; } }
  undo() { if (this.index > 0) this.index--; return this.text; }
  redo() { if (this.index + 1 < this.entries.length) this.index++; return this.text; }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index + 1 < this.entries.length; }
}
