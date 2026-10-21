import { JsonNumber } from '../iris-config/document.mjs';
import { pointerEscape } from '../shared/paths.mjs';

// This bridge maps fields to the pinned IrisGeneratorStyle setters. Sampling and
// all transforms remain in Iris; these are not JavaScript noise implementations.
const supported = new Set(['style','cellularFrequency','cellularZoom','zoom','expression','imageMap','multiplier','fracture','exponent','cacheSize']);
const number = (value, fallback, pointer) => {
  if (value === undefined) return fallback;
  if (!(value instanceof JsonNumber) && typeof value !== 'number') throw new Error(`${pointer} must be a number.`);
  const result = Number(value); if (!Number.isFinite(result)) throw new Error(`${pointer} must be finite.`); return result;
};
export function compileStyle(value, { pointer = '', octaves = 1 } = {}) {
  const definitions = [];
  function visit(source, path, depth) {
    if (depth > 32) throw new Error('Style fracture nesting exceeds the browser bridge limit of 32.');
    if (!source || typeof source !== 'object' || Array.isArray(source) || source instanceof JsonNumber) throw new Error(`${path || '/'} must be a style object. Snippet references need the native resource loader.`);
    for (const key of Object.keys(source)) if (!supported.has(key)) throw new Error(`The browser style bridge does not yet support ${path}/${pointerEscape(key)}. The resource is preserved.`);
    if (source.expression != null) throw new Error(`${path}/expression requires the native expression loader, which is not connected yet.`);
    if (source.imageMap != null) throw new Error(`${path}/imageMap requires the native pack-snapshot preview path.`);
    if (number(source.cacheSize, 0, `${path}/cacheSize`) !== 0) throw new Error(`${path}/cacheSize requires Iris's float-cache semantics, which are not connected yet.`);
    const style = source.style ?? 'FLAT';
    if (typeof style !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(style)) throw new Error(`${path}/style must be an Iris NoiseStyle enum name.`);
    const id = `style-${definitions.length}`, definition = {
      id, style, zoom:number(source.zoom,1,`${path}/zoom`), exponent:number(source.exponent,1,`${path}/exponent`),
      frequency:number(source.cellularFrequency,0,`${path}/cellularFrequency`), cellularZoom:number(source.cellularZoom,1,`${path}/cellularZoom`),
      multiplier:number(source.multiplier,1,`${path}/multiplier`), fracture:'', octaves:depth === 0 ? octaves : 1
    };
    definitions.push(definition);
    if (source.fracture != null) definition.fracture = visit(source.fracture,`${path}/fracture`,depth+1);
    return id;
  }
  if (!Number.isInteger(octaves) || octaves < 1 || octaves > 16) throw new Error('Layer octaves must be an integer from 1 to 16.');
  const root = visit(value,pointer,0);
  return { root, definitions, pointer };
}

export function findStyles(document) {
  const output = [];
  for (const node of document.nodes.values()) {
    if (node.type !== 'object') continue;
    const source = node.value;
    if (((typeof source.style === 'string' && /^[A-Z][A-Z0-9_]*$/.test(source.style)) || (typeof source.imageMap === 'string' && source.imageMap.length>0)) &&
        !Object.hasOwn(source,'opacity') && !Object.hasOwn(source,'octaves') && !Object.hasOwn(source,'enabled')) {
      output.push({ pointer:node.pointer, style:typeof source.imageMap==='string'&&source.imageMap.length?`Image map: ${source.imageMap}`:source.style, value:source });
    }
  }
  return output.sort((a,b)=>a.pointer.localeCompare(b.pointer));
}
