import { JsonNumber } from './document.mjs';
const kind = value => value instanceof JsonNumber ? 'number' : value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
function equivalent(a, b) { return a instanceof JsonNumber || b instanceof JsonNumber ? String(a) === String(b) : JSON.stringify(a) === JSON.stringify(b); }
export function validateSchema(document, schema) {
  const errors = [];
  const report = (pointer, message) => errors.push({ pointer, message, severity: 'error' });
  const visit = (value, rule, pointer, depth = 0) => {
    if (depth > 100) { report(pointer, 'Schema recursion exceeds the application limit.'); return; }
    if (rule === false) { report(pointer, 'This property is not allowed.'); return; }
    if (!rule || rule === true) return;
    if (rule.$ref) { if (!rule.$ref.startsWith('#/')) { report(pointer, 'External schema references must be bundled locally.'); return; } let target = schema; for (const part of rule.$ref.slice(2).split('/')) target = target?.[part.replaceAll('~1','/').replaceAll('~0','~')]; if (!target) report(pointer, 'Schema reference is missing.'); else visit(value, target, pointer, depth + 1); return; }
    const type = kind(value), types = Array.isArray(rule.type) ? rule.type : rule.type ? [rule.type] : [];
    if (types.length && !types.includes(type) && !(type === 'number' && types.includes('integer') && /^-?\d+$/.test(String(value)))) { report(pointer, 'Expected ' + types.join(' or ') + '.'); return; }
    if (rule.enum && !rule.enum.some(item => equivalent(item, value))) report(pointer, 'Choose one of the schema’s allowed values.');
    if (Object.hasOwn(rule, 'const') && !equivalent(rule.const, value)) report(pointer, 'Value differs from the required constant.');
    for (const sub of rule.allOf || []) visit(value, sub, pointer, depth + 1);
    if (type === 'number') { const number = Number(String(value)); if (!Number.isFinite(number)) report(pointer, 'Number exceeds the supported finite range.'); if (rule.minimum !== undefined && number < rule.minimum) report(pointer, `Minimum: ${rule.minimum}.`); if (rule.maximum !== undefined && number > rule.maximum) report(pointer, `Maximum: ${rule.maximum}.`); }
    if (type === 'string') { if (rule.minLength !== undefined && value.length < rule.minLength) report(pointer, `Use at least ${rule.minLength} characters.`); if (rule.maxLength !== undefined && value.length > rule.maxLength) report(pointer, `Use at most ${rule.maxLength} characters.`); if (rule.pattern && rule.pattern.length < 512) { try { if (!new RegExp(rule.pattern).test(value)) report(pointer, 'Value does not match the schema pattern.'); } catch { report(pointer, 'Invalid schema pattern.'); } } }
    if (type === 'array') { if (rule.minItems !== undefined && value.length < rule.minItems) report(pointer, `Use at least ${rule.minItems} entries.`); if (rule.maxItems !== undefined && value.length > rule.maxItems) report(pointer, `Use at most ${rule.maxItems} entries.`); value.forEach((item, index) => visit(item, rule.items, pointer + '/' + index, depth + 1)); }
    if (type === 'object') { for (const key of rule.required || []) if (!Object.hasOwn(value, key)) report(pointer, `Missing required property: ${key}.`); for (const [key, item] of Object.entries(value)) { const sub = rule.properties?.[key] ?? rule.additionalProperties; if (sub !== undefined) visit(item, sub, pointer + '/' + key.replaceAll('~','~0').replaceAll('/','~1'), depth + 1); } }
  };
  visit(document.value, schema, ''); return errors;
}
export function propertySchema(schema, parts) { let current = schema; for (const part of parts) current = current?.type === 'array' ? current.items : current?.properties?.[part]; return current || {}; }
