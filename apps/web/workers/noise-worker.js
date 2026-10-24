let runtime, active = 0;
async function engine() {
  if (!runtime) runtime = (async () => {
    const response = await fetch('/app/engine/generated/manifest.json');
    if (!response.ok) throw new Error('The native noise module is not installed. Run npm run engine:install with the verified noise experiment archive.');
    const manifest = await response.json();
    if (manifest.scope !== 'volmlib-primitive-portability' || !/^[a-f0-9]{64}$/.test(manifest.wasmSha256) || !/^[a-f0-9]{64}$/.test(manifest.runtimeSha256)) throw new Error('The installed noise module has invalid provenance.');
    const [bytes,script]=await Promise.all(['probe.wasm','probe.wasm-runtime.js'].map(async name=>{
      const response=await fetch('/app/engine/generated/'+name,{cache:'no-cache'});if(!response.ok)throw new Error('The native noise module is missing '+name+'.');return response.arrayBuffer();
    }));
    const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(await digest(bytes)!==manifest.wasmSha256||await digest(script)!==manifest.runtimeSha256)throw new Error('The native noise module differs from its manifest.');
    const runtimeUrl=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));
    let loaded;try{importScripts(runtimeUrl);loaded=await TeaVM.wasmGC.load(bytes);}finally{URL.revokeObjectURL(runtimeUrl);}
    if (!(loaded.instance instanceof WebAssembly.Instance) || typeof loaded.exports.sample !== 'function') throw new Error('This browser cannot run the Wasm GC noise module.');
    return { loaded, manifest };
  })().catch(error => { runtime = null; throw error; });
  return runtime;
}
const buffer = new ArrayBuffer(8), bits = new DataView(buffer);
function decode(hex) { if (!/^[a-f0-9]{16}$/.test(hex)) throw new Error('Native noise returned invalid IEEE-754 bits.'); bits.setBigUint64(0, BigInt('0x' + hex), false); const value = bits.getFloat64(0, false); if (!Number.isFinite(value)) throw new Error('Native noise returned a non-finite value.'); return value; }
self.onmessage = async ({ data }) => {
  if (data.kind === 'cancel') { if (active === data.id) active = 0; return; }
  if (data.kind !== 'generate') return; const id = data.id; active = id;
  try {
    const started = performance.now();
    const { loaded, manifest } = await engine(); if (active !== id) return;
    const options = data.options, { width, height, x, z, y, span, seed } = options, depth = span * height / width;
    const method = { 'lab-white2d': 0, 'lab-perlin2d': 3, 'lab-perlin3d': 4 }[options.field]; if (method === undefined) throw new Error('Unsupported native noise export.');
    const values = new Float64Array(width * height); let min = Infinity, max = -Infinity;
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const px = x - span / 2 + (column + .5) * span / width, pz = z - depth / 2 + (row + .5) * depth / height;
        const sample = loaded.exports.sample(seed, px, y, pz, true), value = decode(sample.split(':')[method]); values[row * width + column] = value; min = Math.min(min, value); max = Math.max(max, value);
      }
      if ((row & 7) === 0) { self.postMessage({ kind: 'progress', id, progress: (row + 1) / height }); await new Promise(resolve => setTimeout(resolve, 0)); if (active !== id) return; }
    }
    if (active !== id) return;
    self.postMessage({ kind: 'result', id, result: { values: values.buffer, width, height, x, z, y, span, depth, seed, field: options.field, min, max, scope: 'experimental-native-noise-primitive', sourceCommit: manifest.sourceCommit, generationMs: performance.now()-started } }, [values.buffer]);
  } catch (error) { if (active === id) self.postMessage({ id, error: error.message || String(error) }); }
};
