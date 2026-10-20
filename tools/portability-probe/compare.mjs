export function compareProbe(native, workers, methodCount = 5) {
  if (native?.formatVersion !== 1 || native.scope !== 'volmlib-primitive-portability' ||
      !Array.isArray(native.cases) || !native.cases.length) throw new Error('Invalid or empty native primitive capture');
  if (!Array.isArray(workers) || workers.length !== 3) throw new Error('Expected three independent workers');
  const pattern = new RegExp(`^[a-f0-9]{16}(?::[a-f0-9]{16}){${methodCount - 1}}$`);
  const expected = new Map();
  for (const row of native.cases) {
    if (!Number.isSafeInteger(row.id) || expected.has(row.id) || !pattern.test(row.bits) ||
        typeof row.seed !== 'string' || !/^(0|-?[1-9][0-9]{0,18})$/.test(row.seed) ||
        BigInt(row.seed) < -(1n << 63n) || BigInt(row.seed) >= (1n << 63n) ||
        !['x', 'y', 'z'].every(key => Number.isFinite(row[key]))) throw new Error('Invalid native sample');
    expected.set(row.id, row);
  }
  let mismatches = 0;
  const diagnostics = [];
  const orders = new Set();
  for (const worker of workers) {
    if (worker.error) throw new Error(worker.error);
    if (!['forward', 'reverse', 'shuffle'].includes(worker.order) || orders.has(worker.order) ||
        worker.backend !== 'WebAssembly GC' || !Array.isArray(worker.results) ||
        worker.results.length !== expected.size) throw new Error('Invalid worker output or coverage');
    orders.add(worker.order);
    const seen = new Set();
    for (const row of worker.results) {
      const reference = expected.get(row.id);
      if (!reference || seen.has(row.id)) throw new Error('Duplicate or unknown worker sample');
      seen.add(row.id);
      for (const mode of ['cold', 'warm']) {
        if (typeof row[mode] !== 'string' || !pattern.test(row[mode])) throw new Error('Invalid worker bit output');
        const values = row[mode].split(':');
        reference.bits.split(':').forEach((bits, method) => {
          if (values[method] !== bits) {
            mismatches++;
            if (diagnostics.length < 20) diagnostics.push({ order: worker.order, mode, method,
              seed: reference.seed, coordinates: [reference.x, reference.y, reference.z],
              expected: bits, actual: values[method] });
          }
        });
      }
    }
  }
  return { equal: mismatches === 0, cases: expected.size, workers: workers.length,
    comparisons: expected.size * workers.length * 2 * methodCount, mismatches, diagnostics,
    diagnosticsTruncated: mismatches > diagnostics.length };
}
