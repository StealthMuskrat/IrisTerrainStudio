import { ARCHIVE_LIMIT, FILE_LIMIT, ENTRY_LIMIT, resourcePath } from './paths.mjs';
const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
async function inflate(bytes, size) {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { inflateRawSync } = await import('node:zlib');
    return new Uint8Array(inflateRawSync(bytes, { maxOutputLength: Math.max(size, 1) }));
  }
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const parts = []; let length = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > size) throw new Error('Archive entry exceeds its declared size.'); parts.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  return concatenate(parts);
}
function concatenate(parts) { const result = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0)); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result; }
export async function readZip(input, { maxBytes = ARCHIVE_LIMIT, validatePath = resourcePath } = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > maxBytes || bytes.byteLength < 22) throw new Error('Archive is empty, truncated or too large.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('Split or malformed ZIP archives are unsupported.');
  const count = view.getUint16(end + 10, true), centralSize = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (count === 65535 || start === 0xffffffff || count > ENTRY_LIMIT || start + centralSize !== end || view.getUint16(end + 8, true) !== count) throw new Error('Archive directory is invalid or exceeds limits.');
  const entries = new Map(); let cursor = start, total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Invalid ZIP directory entry.');
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true), expectedCrc = view.getUint32(cursor + 16, true);
    const packed = view.getUint32(cursor + 20, true), size = view.getUint32(cursor + 24, true), nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true), offset = view.getUint32(cursor + 42, true);
    if (cursor + 46 + nameLength + extraLength + commentLength > end || flags & 1 || ![0, 8].includes(method) || size > FILE_LIMIT || packed === 0xffffffff || size === 0xffffffff || offset === 0xffffffff) throw new Error('Encrypted, ZIP64, oversized or unsupported archive entry.');
    const rawName = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    const unixMode = view.getUint32(cursor + 38, true) >>> 16;
    if ((unixMode & 0xf000) === 0xa000) throw new Error('Symbolic links are not accepted in archives.');
    cursor += 46 + nameLength + extraLength + commentLength;
    if (rawName.endsWith('/')) { validatePath(rawName.slice(0, -1)); continue; }
    const name = validatePath(rawName);
    if (entries.has(name) || total + size > maxBytes) throw new Error('Duplicate archive path or expanded archive exceeds limits.');
    if (offset + 30 > start || view.getUint32(offset, true) !== 0x04034b50) throw new Error('Invalid ZIP file header.');
    const localNameLength = view.getUint16(offset + 26, true), localExtra = view.getUint16(offset + 28, true), dataOffset = offset + 30 + localNameLength + localExtra;
    if (decoder.decode(bytes.subarray(offset + 30, offset + 30 + localNameLength)) !== rawName || dataOffset + packed > start || view.getUint16(offset + 8, true) !== method || view.getUint16(offset + 6, true) !== flags) throw new Error('ZIP local and central headers disagree.');
    const compressed = bytes.subarray(dataOffset, dataOffset + packed);
    const data = method === 0 ? compressed.slice() : await inflate(compressed, size);
    if (data.length !== size || crc32(data) !== expectedCrc) throw new Error(`Archive checksum failed: ${name}`);
    total += size; entries.set(name, data);
  }
  if (cursor !== end) throw new Error('ZIP directory size differs from its entries.');
  return entries;
}
export function writeZip(entries) {
  const parts = [], directory = []; let offset = 0, count = 0, total = 0;
  for (const [path, input] of entries) {
    const name = encoder.encode(resourcePath(path)), data = input instanceof Uint8Array ? input : encoder.encode(input);
    if (++count > ENTRY_LIMIT || data.length > FILE_LIMIT || (total += data.length) > ARCHIVE_LIMIT) throw new Error('Export exceeds archive limits.');
    const crc = crc32(data), local = new Uint8Array(30 + name.length), localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x800, true); localView.setUint32(14, crc, true); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true); localView.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    parts.push(local, data); directory.push(central); offset += local.length + data.length;
  }
  const central = concatenate(directory), end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, count, true); view.setUint16(10, count, true); view.setUint32(12, central.length, true); view.setUint32(16, offset, true);
  return concatenate([...parts, central, end]);
}
