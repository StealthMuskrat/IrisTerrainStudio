import { pointerEscape, pointerParts } from '../shared/paths.mjs';
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
          let key;
          if (array) key = String(value.length);
          else { if (text[cursor] !== '"') fail('Expected a quoted property name.'); key = string(); whitespace(); if (text[cursor++] !== ':') fail('Expected a colon after the property name.'); }
          const child = parse(pointer + '/' + pointerEscape(key), depth + 1);
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
    const node = this.nodes.get(pointer); if (!node) throw new Error('The selected property no longer exists.');
    return this.text.slice(0, node.start) + stringify(value, pointerParts(pointer).length) + this.text.slice(node.end);
  }
  remove(pointer) {
    const parts = pointerParts(pointer), key = parts.pop(), parentPointer = '/' + parts.map(pointerEscape).join('/');
    if (key === undefined) throw new Error('The root resource cannot be removed.');
    const parent = this.nodes.get(parts.length ? parentPointer : ''); if (!parent) throw new Error('Missing parent property.');
    const copy = parent.type === 'array' ? parent.value.slice() : Object.assign(Object.create(null), parent.value);
    if (Array.isArray(copy)) copy.splice(Number(key), 1); else delete copy[key];
    return this.replace(parent.pointer, copy);
  }
  add(pointer, key, value) {
    const node = this.nodes.get(pointer); if (!node || !['object', 'array'].includes(node.type)) throw new Error('Choose an object or array.');
    const copy = node.type === 'array' ? node.value.slice() : Object.assign(Object.create(null), node.value);
    if (Array.isArray(copy)) copy.push(value);
    else { if (Object.hasOwn(copy, key)) throw new Error('That property already exists.'); Object.defineProperty(copy, key, { value, enumerable: true }); }
    return this.replace(pointer, copy);
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
