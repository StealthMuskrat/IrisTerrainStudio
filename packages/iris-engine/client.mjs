export class UnsupportedGenerationError extends Error { constructor(message, feature) { super(message); this.name = 'UnsupportedGenerationError'; this.feature = feature; } }
export function numericSeed(value) { const text = String(value).trim(); if (!/^-?(?:0|[1-9]\d*)$/.test(text)) throw new Error('This noise engine needs a signed 64-bit decimal seed.'); const number = BigInt(text); if (number < -(1n << 63n) || number > (1n << 63n) - 1n) throw new Error('Seed is outside the signed Java long range.'); return number.toString(); }
export class GenerationClient extends EventTarget {
  constructor() { super(); this.worker = null; this.sequence = 0; this.pending = null; this.cache = new Map(); this.cacheBytes = 0; this.maxCacheBytes = 48 * 1024 * 1024; }
  cancel() { if (this.pending) { this.worker?.postMessage({ kind: 'cancel', id: this.pending.id }); this.pending.reject(new DOMException('Preview cancelled.', 'AbortError')); this.pending = null; } }
  async generate(request) {
    this.cancel();
    if (!request.field.startsWith('lab-')) throw new UnsupportedGenerationError('Pack terrain generation is not yet available. The native reference checksum remains unresolved; no approximate terrain is substituted.', request.field);
    const options = { ...request, seed: numericSeed(request.seed) };
    for (const key of ['x','z','y','span','width','height']) if (!Number.isFinite(options[key])) throw new Error('Preview coordinates and dimensions must be finite.');
    if (!Number.isInteger(options.width) || !Number.isInteger(options.height) || options.width < 1 || options.height < 1 || options.width > 512 || options.height > 512 || options.span <= 0 || options.span > 4096 || Math.abs(options.x) + options.span / 2 > 30_000_000 || Math.abs(options.z) + options.span / 2 > 30_000_000) throw new Error('Preview exceeds the supported coordinate, resolution or memory limits.');
    if (Math.abs(options.y) > 30_000_000 || Math.abs(options.z) + options.span * options.height / options.width / 2 > 30_000_000) throw new Error('Preview exceeds the supported coordinate range.');
    const key = JSON.stringify(options); if (this.cache.has(key)) { const value = this.cache.get(key); this.cache.delete(key); this.cache.set(key, value); return value; }
    if (!this.worker) { this.worker = new Worker('/app/workers/noise-worker.js'); this.worker.onmessage = ({ data }) => { if (!this.pending || data.id !== this.pending.id) return; if (data.kind === 'progress') { this.dispatchEvent(new CustomEvent('progress', { detail: data.progress })); return; } const pending = this.pending; this.pending = null; if (data.error) { pending.reject(new Error(data.error)); return; } const result = { ...data.result, values: new Float64Array(data.result.values) }; this.cache.set(pending.key, result); this.cacheBytes += result.values.byteLength; while (this.cacheBytes > this.maxCacheBytes && this.cache.size > 1) { const oldest = this.cache.keys().next().value; this.cacheBytes -= this.cache.get(oldest).values.byteLength; this.cache.delete(oldest); } pending.resolve(result); }; this.worker.onerror = event => { this.pending?.reject(new Error(event.message || 'Generation worker failed.')); this.pending = null; this.worker.terminate(); this.worker = null; }; }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => { this.pending = { id, key, resolve, reject }; this.worker.postMessage({ kind: 'generate', id, options }); });
  }
  invalidate() { this.cancel(); this.cache.clear(); this.cacheBytes = 0; }
  dispose() { this.cancel(); this.worker?.terminate(); this.worker = null; this.cache.clear(); }
}
