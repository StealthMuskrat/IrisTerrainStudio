importScripts('/probe.wasm-runtime.js');

self.onmessage = async ({ data }) => {
  try {
    const engine = await TeaVM.wasmGC.load('/probe.wasm');
    if (!(engine.instance instanceof WebAssembly.Instance)) throw new Error('No actual WebAssembly instance');
    if (typeof engine.exports.sample !== 'function') throw new Error('Missing compiled sample export');
    const cases = [...data.cases];
    if (data.order === 'reverse') cases.reverse();
    if (data.order === 'shuffle') {
      let state = 813753;
      for (let i = cases.length - 1; i > 0; i--) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const j = state % (i + 1);
        [cases[i], cases[j]] = [cases[j], cases[i]];
      }
    }
    const results = cases.map(row => ({ id: row.id,
      cold: engine.exports.sample(row.seed, row.x, row.y, row.z, false),
      warm: engine.exports.sample(row.seed, row.x, row.y, row.z, true),
    }));
    self.postMessage({ order: data.order, backend: 'WebAssembly GC', results });
  } catch (error) {
    self.postMessage({ error: String(error.stack || error) });
  }
};
