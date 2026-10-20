import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { compareCaptures, doubleBits } from '../tools/reference-tests/compare.mjs';

// Synthetic captures exercise comparison failures. They are never native parity evidence.
function capture(kind = 'native', scope = 'noise') {
  return {
    formatVersion: 1,
    scope,
    producer: { kind, artifactSha256: (kind === 'native' ? 'a' : 'b').repeat(64) },
    identity: {
      irisCommit: '1'.repeat(40), volmLibCommit: '2'.repeat(40), minecraftVersion: '26.3',
      registrySha256: '3'.repeat(64), schemaSha256: '4'.repeat(64), packSha256: '5'.repeat(64),
      worldSeed: '-9223372036854775808', dimension: 'test', featureSet: ['noise-test'],
    },
    grid: { origin: [-16, 0, 29999983], step: [16, 1, 1], size: [3, 1, 1] },
    samples: [-16, 0, 16].map((x, i) => ({ x, y: 0, z: 29999983,
      ...(scope === 'noise' ? { bits: doubleBits(i / 4) } :
        { state: { id: 'minecraft:oak_log', properties: { axis: 'y', waterlogged: 'false' } } }),
    })),
  };
}

test('compares every sample independent of generation order and preserves large/negative coordinates', () => {
  const browser = capture('browser');
  browser.samples.reverse();
  assert.deepEqual(compareCaptures(capture(), browser), {
    equal: true, scope: 'noise', compared: 3, mismatches: 0, diagnostics: [], diagnosticsTruncated: false,
  });
});

test('a one-bit output difference reports the actual coordinate and bits', () => {
  const browser = capture('browser');
  browser.samples[1].bits = '3fd0000000000001';
  const result = compareCaptures(capture(), browser);
  assert.equal(result.equal, false);
  assert.equal(result.mismatches, 1);
  assert.deepEqual(result.diagnostics[0], {
    coordinates: [0, 0, 29999983], expected: '3fd0000000000000', actual: '3fd0000000000001',
  });
});

test('positive and negative zero output bits are different', () => {
  const browser = capture('browser');
  browser.samples[0].bits = doubleBits(-0);
  assert.equal(compareCaptures(capture(), browser).mismatches, 1);
});

test('fractional lattice sampling is accepted', () => {
  const native = capture();
  const browser = capture('browser');
  for (const value of [native, browser]) {
    value.grid.origin[0] = -0.25;
    value.grid.step[0] = 0.125;
    value.samples.forEach((sample, i) => { sample.x = -0.25 + i * 0.125; });
  }
  assert.equal(compareCaptures(native, browser).equal, true);
});

test('block properties compare independently of object key ordering', () => {
  const browser = capture('browser', 'blocks');
  browser.samples.forEach(sample => { sample.state.properties = { waterlogged: 'false', axis: 'y' }; });
  assert.equal(compareCaptures(capture('native', 'blocks'), browser).equal, true);
  browser.samples[2].state.properties.axis = 'x';
  const result = compareCaptures(capture('native', 'blocks'), browser);
  assert.equal(result.mismatches, 1);
  assert.equal(result.diagnostics[0].actual.properties.axis, 'x');
});

test('block ID changes are detected even when properties match', () => {
  const browser = capture('browser', 'blocks');
  browser.samples[0].state.id = 'minecraft:birch_log';
  assert.equal(compareCaptures(capture('native', 'blocks'), browser).mismatches, 1);
});

test('every generation identity field participates in comparison', () => {
  for (const field of Object.keys(capture().identity)) {
    const browser = capture('browser');
    browser.identity[field] = field.endsWith('Commit') ? 'f'.repeat(40) :
      field.endsWith('Sha256') ? 'f'.repeat(64) : field === 'worldSeed' ? '9223372036854775807' :
        field === 'featureSet' ? ['another-feature'] : 'different';
    assert.throws(() => compareCaptures(capture(), browser), /identity mismatch/, field);
  }
});

test('incomplete, empty, duplicate and outside-grid captures fail closed', () => {
  for (const mode of ['missing', 'empty', 'duplicate', 'outside']) {
    const browser = capture('browser');
    if (mode === 'missing') browser.samples.pop();
    if (mode === 'empty') browser.samples = [];
    if (mode === 'duplicate') browser.samples[1] = structuredClone(browser.samples[0]);
    if (mode === 'outside') browser.samples[1].x = 1;
    assert.throws(() => compareCaptures(capture(), browser), /cover every|Duplicate|outside grid/, mode);
  }
});

test('seeds reject lossy JSON numbers, noncanonical strings and overflow', () => {
  for (const seed of [42, '-0', '+1', '01', '9223372036854775808', '-9223372036854775809']) {
    const browser = capture('browser');
    browser.identity.worldSeed = seed;
    assert.throws(() => compareCaptures(capture(), browser), /worldSeed/);
  }
});

test('malformed and non-finite scalar output is rejected', () => {
  for (const bits of ['not-a-double', '7ff0000000000000', 'fff0000000000000', '7ff8000000000000']) {
    const browser = capture('browser');
    browser.samples[0].bits = bits;
    assert.throws(() => compareCaptures(capture(), browser), /Noise bits|Non-finite/);
  }
});

test('malformed identity, unknown fields, scope and producer errors are rejected', () => {
  for (const change of [
    value => { value.identity.registrySha256 = null; },
    value => { value.unexpected = true; },
    value => { value.producer.kind = 'native'; },
    value => { value.formatVersion = 2; },
    value => { value.scope = 'height'; },
    value => { value.identity.featureSet = ['same', 'same']; },
  ]) {
    const browser = capture('browser');
    change(browser);
    assert.throws(() => compareCaptures(capture(), browser));
  }
});

test('grid bounds, memory limits and precision collapse are validated', () => {
  for (const change of [
    value => { value.grid.size = [1000001, 1, 1]; },
    value => { value.grid.size = [0, 1, 1]; },
    value => { value.grid.step = [0, 1, 1]; },
    value => { value.grid.origin = [Infinity, 0, 0]; },
    value => { value.grid.origin[0] = 1e30; },
  ]) {
    const browser = capture('browser');
    change(browser);
    assert.throws(() => compareCaptures(capture(), browser));
  }
});

test('fractional coordinates cannot masquerade as voxel blocks', () => {
  const browser = capture('browser', 'blocks');
  browser.grid.origin[0] = 0.25;
  assert.throws(() => compareCaptures(capture('native', 'blocks'), browser), /safe integers/);
});

test('diagnostics are bounded without truncating mismatch counts', () => {
  const browser = capture('browser');
  browser.samples.forEach(sample => { sample.bits = doubleBits(-1); });
  const result = compareCaptures(capture(), browser, { maxDiagnostics: 1 });
  assert.equal(result.mismatches, 3);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnosticsTruncated, true);
});

test('CLI returns 0 for equality, 1 for differences and 2 for invalid captures/usage', async () => {
  const root = new URL('../', import.meta.url);
  const output = new URL('.reference-output/', root);
  await mkdir(output, { recursive: true });
  const temp = await mkdtemp(new URL('cli-', output));
  const nativePath = `${temp}/native.json`;
  const browserPath = `${temp}/browser.json`;
  const run = args => spawnSync(process.execPath, ['tools/reference-tests/compare.mjs', ...args],
    { cwd: root, encoding: 'utf8' });
  try {
    await writeFile(nativePath, JSON.stringify(capture()));
    const browser = capture('browser');
    await writeFile(browserPath, JSON.stringify(browser));
    assert.equal(run([nativePath, browserPath]).status, 0);
    browser.samples[0].bits = doubleBits(1);
    await writeFile(browserPath, JSON.stringify(browser));
    const mismatch = run([nativePath, browserPath]);
    assert.equal(mismatch.status, 1);
    assert.equal(JSON.parse(mismatch.stdout).mismatches, 1);
    await writeFile(browserPath, '{broken json');
    assert.equal(run([nativePath, browserPath]).status, 2);
    assert.equal(run([]).status, 2);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
