import test from 'node:test';
import assert from 'node:assert/strict';
import { gitBlobSha, verifySource } from '../tools/portability-probe/prepare.mjs';
import { compareProbe } from '../tools/portability-probe/compare.mjs';

test('compiler inputs reject changed bytes and unsafe source paths', () => {
  const bytes = Buffer.from('verified source\n');
  const source = { path: 'shared/src/main/java/art/arcane/volmlib/util/noise/Example.java', gitBlobSha: gitBlobSha(bytes) };
  verifySource(bytes, source);
  assert.throws(() => verifySource(Buffer.from('changed'), source), /digest mismatch/);
  assert.throws(() => verifySource(bytes, { ...source, path: '../../Example.java' }), /allowlist/);
});

function fixture() {
  const bits = Array(5).fill('3ff0000000000000').join(':');
  return {
    native: { formatVersion: 1, scope: 'volmlib-primitive-portability', cases: [
      { id: 0, seed: '-9223372036854775808', x: -16, y: 0.125, z: 29999983.25, bits },
      { id: 1, seed: '9223372036854775807', x: 16, y: -0.125, z: -29999983.25, bits },
    ] },
    workers: ['forward', 'reverse', 'shuffle'].map(order => ({ order, backend: 'WebAssembly GC',
      results: [1, 0].map(id => ({ id, cold: bits, warm: bits })) })),
  };
}

test('primitive comparison checks all methods, workers and cold/warm results by sample ID', () => {
  const { native, workers } = fixture();
  assert.equal(compareProbe(native, workers).comparisons, 60);
  workers[1].results[0].warm = workers[1].results[0].warm.replace(/.$/, '1');
  const report = compareProbe(native, workers);
  assert.equal(report.equal, false);
  assert.equal(report.mismatches, 1);
  assert.deepEqual(report.diagnostics[0].coordinates, [16, -0.125, -29999983.25]);
  assert.equal(report.diagnostics[0].method, 4);
});

test('primitive comparison rejects empty captures, duplicate IDs, missing workers and invalid bit outputs', () => {
  for (const modify of [
    data => { data.native.cases = []; },
    data => { data.workers.pop(); },
    data => { data.workers[0].results[0].id = 0; },
    data => { data.workers[0].order = 'reverse'; },
    data => { data.workers[0].results[0].cold = 'bad'; },
    data => { data.native.cases[0].seed = '-9223372036854775809'; },
    data => { data.native.cases[0].bits = 'bad'; },
  ]) {
    const data = fixture();
    modify(data);
    assert.throws(() => compareProbe(data.native, data.workers));
  }
});

function rngFixture() {
  const bits = Array(112).fill('3ff0000000000000').join(':');
  return {
    native: { formatVersion: 1, scope: 'volmlib-rng-portability', cases: [
      { id: 0, seed: '', textSeed: true, signature: '-9223372036854775808', bits },
      { id: 1, seed: '9007199254740993', textSeed: false, signature: '9223372036854775807', bits },
    ] },
    workers: ['forward', 'reverse', 'shuffle'].map(order => ({ order, backend: 'WebAssembly GC',
      results: [1, 0].map(id => ({ id, cold: bits, warm: bits })) })),
  };
}

test('RNG capture comparison preserves textual seeds, 64-bit signatures and per-output diagnostics', () => {
  const { native, workers } = rngFixture();
  assert.equal(compareProbe(native, workers).comparisons, 1344);
  workers[1].results[0].warm = workers[1].results[0].warm.replace(/.$/, '1');
  const report = compareProbe(native, workers);
  assert.equal(report.mismatches, 1);
  assert.equal(report.diagnostics[0].seed, '9007199254740993');
  assert.equal(report.diagnostics[0].signature, '9223372036854775807');
  assert.equal(report.diagnostics[0].method, 111);
});

test('RNG capture input rejects lossy numeric seeds, invalid signatures and missing mode', () => {
  for (const change of [
    data => { data.native.cases[1].seed = 9007199254740992; },
    data => { data.native.cases[1].signature = '9223372036854775808'; },
    data => { delete data.native.cases[0].textSeed; },
    data => { data.native.cases[0].bits = 'bad'; },
  ]) {
    const data = rngFixture();
    change(data);
    assert.throws(() => compareProbe(data.native, data.workers));
  }
});
