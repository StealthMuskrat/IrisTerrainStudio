export const JSON_LIMIT = 8 * 1024 * 1024;
export const ARCHIVE_LIMIT = 256 * 1024 * 1024;
export const FILE_LIMIT = 64 * 1024 * 1024;
export const ENTRY_LIMIT = 20000;
export function resourcePath(value) {
  if (typeof value !== 'string' || !value || value.length > 1024 || /[\u0000-\u001f\\:]/u.test(value) || value.startsWith('/')) throw new Error('Use a relative pack resource path.');
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.iris-terrain-studio'))) throw new Error('Invalid pack resource path.');
  if (/(?:\.mca|\.mcc|(?:^|\/)level\.dat(?:_old)?)$/i.test(value)) throw new Error('Minecraft world files cannot be edited by Iris Terrain Studio.');
  return parts.join('/');
}
export function packId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value)) throw new Error('Pack names use 1–64 letters, numbers, underscores or hyphens.');
  return value;
}
export function jsonPath(value) {
  const path = resourcePath(value);
  if (!path.toLowerCase().endsWith('.json')) throw new Error('Only JSON configuration resources can be edited. Other assets are preserved.');
  return path;
}
export function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function pointerEscape(value) { return String(value).replaceAll('~', '~0').replaceAll('/', '~1'); }
export function pointerParts(pointer) {
  if (pointer === '') return [];
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) throw new Error('Invalid property pointer.');
  return pointer.slice(1).split('/').map(p => p.replaceAll('~1', '/').replaceAll('~0', '~'));
}
export function getAt(root, pointer) { return pointerParts(pointer).reduce((value, key) => value?.[key], root); }
export function setAt(root, pointer, value, remove = false) {
  const next = structuredClone(root), parts = pointerParts(pointer);
  if (!parts.length) return structuredClone(value);
  const key = parts.pop(), parent = parts.reduce((node, part) => node?.[part], next);
  if (parent === null || typeof parent !== 'object') throw new Error('The parent property no longer exists.');
  if (remove) { if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key]; }
  else Object.defineProperty(parent, key, { value: structuredClone(value), enumerable: true, configurable: true, writable: true });
  return next;
}
