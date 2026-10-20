import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const AXES = ['x', 'y', 'z'];
const MAX_SAMPLES = 1_000_000;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keys(value, expected, label) {
  requireValue(object(value), `${label} must be an object`);
  requireValue(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()),
    `${label} has missing or unknown fields`);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function doubleBits(number) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, number, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, '0');
}

function coordinateKey(position) {
  // Treat coordinate -0 as the same spatial location as +0. Output value bits stay exact.
  return AXES.map(axis => doubleBits(position[axis] === 0 ? 0 : position[axis])).join(':');
}

export function validateCapture(capture, producerKind) {
  keys(capture, ['formatVersion', 'scope', 'producer', 'identity', 'grid', 'samples'], 'capture');
  requireValue(capture.formatVersion === 1, 'Unsupported capture formatVersion');
  requireValue(['noise', 'blocks'].includes(capture.scope), 'Unsupported capture scope');
  keys(capture.producer, ['kind', 'artifactSha256'], 'producer');
  requireValue(capture.producer.kind === producerKind, `Expected ${producerKind} producer`);
  requireValue(SHA256.test(capture.producer.artifactSha256), 'Invalid producer artifact SHA-256');
  const identityKeys = ['irisCommit', 'volmLibCommit', 'minecraftVersion', 'registrySha256',
    'schemaSha256', 'packSha256', 'worldSeed', 'dimension', 'featureSet'];
  keys(capture.identity, identityKeys, 'identity');
  const identity = capture.identity;
  for (const field of ['irisCommit', 'volmLibCommit']) {
    requireValue(COMMIT.test(identity[field]), `Invalid identity.${field}`);
  }
  for (const field of ['registrySha256', 'schemaSha256', 'packSha256']) {
    requireValue(SHA256.test(identity[field]), `Invalid identity.${field}`);
  }
  requireValue(typeof identity.worldSeed === 'string' && /^(0|-?[1-9][0-9]{0,18})$/.test(identity.worldSeed),
    'worldSeed must be a canonical signed 64-bit decimal string');
  const seed = BigInt(identity.worldSeed);
  requireValue(seed >= -(1n << 63n) && seed < (1n << 63n), 'worldSeed is outside signed 64-bit range');
  for (const field of ['minecraftVersion', 'dimension']) {
    requireValue(typeof identity[field] === 'string' && identity[field].trim().length > 0,
      `identity.${field} must be a nonempty string`);
  }
  requireValue(Array.isArray(identity.featureSet) && identity.featureSet.length > 0 &&
    identity.featureSet.every(x => typeof x === 'string' && x.trim().length > 0) &&
    new Set(identity.featureSet).size === identity.featureSet.length,
    'identity.featureSet must contain distinct feature names');
  keys(capture.grid, ['origin', 'step', 'size'], 'grid');
  for (const field of ['origin', 'step', 'size']) {
    requireValue(Array.isArray(capture.grid[field]) && capture.grid[field].length === 3,
      `grid.${field} must contain x, y, z`);
  }
  requireValue(capture.grid.origin.every(Number.isFinite), 'grid.origin must be finite');
  requireValue(capture.grid.step.every(x => Number.isFinite(x) && x > 0), 'grid.step must be finite and positive');
  requireValue(capture.grid.size.every(x => Number.isSafeInteger(x) && x > 0 && x <= MAX_SAMPLES),
    'grid.size must contain positive safe integers');
  const count = capture.grid.size.reduce((a, b) => a * b, 1);
  requireValue(count <= MAX_SAMPLES, `Capture exceeds ${MAX_SAMPLES} samples`);
  requireValue(Array.isArray(capture.samples) && capture.samples.length === count,
    'Capture must cover every grid coordinate exactly once');

  const expected = new Set();
  const [sx, sy, sz] = capture.grid.size;
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
    const position = Object.fromEntries([x, y, z].map((index, axis) =>
      [AXES[axis], capture.grid.origin[axis] + index * capture.grid.step[axis]]));
    requireValue(Object.values(position).every(Number.isFinite), 'Grid produces non-finite coordinates');
    if (capture.scope === 'blocks') requireValue(Object.values(position).every(Number.isSafeInteger),
      'Block grid coordinates must be safe integers');
    const key = coordinateKey(position);
    requireValue(!expected.has(key), 'Grid has overlapping coordinates at floating-point precision');
    expected.add(key);
  }

  const indexed = new Map();
  for (const sample of capture.samples) {
    keys(sample, ['x', 'y', 'z', capture.scope === 'noise' ? 'bits' : 'state'], 'sample');
    requireValue(AXES.every(axis => Number.isFinite(sample[axis])), 'Sample coordinates must be finite');
    const key = coordinateKey(sample);
    requireValue(expected.has(key), `Sample outside grid at ${AXES.map(axis => sample[axis]).join(',')}`);
    requireValue(!indexed.has(key), `Duplicate sample at ${AXES.map(axis => sample[axis]).join(',')}`);
    let value;
    if (capture.scope === 'noise') {
      requireValue(typeof sample.bits === 'string' && /^[a-f0-9]{16}$/.test(sample.bits),
        'Noise bits must be 16 lowercase hexadecimal digits');
      requireValue((BigInt(`0x${sample.bits}`) & 0x7ff0000000000000n) !== 0x7ff0000000000000n,
        'Non-finite noise output is invalid');
      value = sample.bits;
    } else {
      keys(sample.state, ['id', 'properties'], 'block state');
      requireValue(typeof sample.state.id === 'string' && /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(sample.state.id),
        'Block ID must be a namespaced identifier');
      requireValue(object(sample.state.properties) && Object.entries(sample.state.properties).every(([key, value]) =>
        key.length > 0 && typeof value === 'string' && value.length > 0), 'Invalid block state properties');
      value = canonical(sample.state);
    }
    indexed.set(key, { sample, value });
  }
  return indexed;
}

export function compareCaptures(native, browser, { maxDiagnostics = 20 } = {}) {
  requireValue(Number.isInteger(maxDiagnostics) && maxDiagnostics >= 1 && maxDiagnostics <= 1000,
    'maxDiagnostics must be between 1 and 1000');
  const expected = validateCapture(native, 'native');
  const actual = validateCapture(browser, 'browser');
  requireValue(native.scope === browser.scope, 'Capture scope mismatch');
  const normalizedIdentity = identity => ({ ...identity, featureSet: [...identity.featureSet].sort() });
  requireValue(canonical(normalizedIdentity(native.identity)) === canonical(normalizedIdentity(browser.identity)),
    'Capture identity mismatch: engine, dependencies, registry, schema, pack, seed, dimension, or features differ');
  requireValue(canonical(native.grid) === canonical(browser.grid), 'Capture grid mismatch');
  const diagnostics = [];
  let mismatches = 0;
  for (const [key, entry] of expected) {
    const result = actual.get(key);
    if (!result || entry.value !== result.value) {
      mismatches++;
      if (diagnostics.length < maxDiagnostics) diagnostics.push({
        coordinates: AXES.map(axis => entry.sample[axis]),
        expected: native.scope === 'noise' ? entry.sample.bits : entry.sample.state,
        actual: result ? (native.scope === 'noise' ? result.sample.bits : result.sample.state) : null,
      });
    }
  }
  return { equal: mismatches === 0, scope: native.scope, compared: expected.size, mismatches,
    diagnostics, diagnosticsTruncated: mismatches > diagnostics.length };
}

async function readCapture(path) {
  requireValue((await stat(path)).size <= 128 * 1024 * 1024, 'Capture file exceeds 128 MiB');
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length !== 2) {
    console.error('Usage: node tools/reference-tests/compare.mjs native.json browser.json');
    process.exitCode = 2;
    return;
  }
  try {
    const [native, browser] = await Promise.all(paths.map(readCapture));
    const report = compareCaptures(native, browser);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.equal ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
