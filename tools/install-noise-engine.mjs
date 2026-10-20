import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readZip, writeZip } from '../packages/shared/zip.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const input = process.argv[2];
if (!input) { console.error('Usage: npm run engine:install -- /path/to/verified-noise-rng-evidence.zip'); process.exitCode = 2; }
else {
  const evidence = JSON.parse(await fs.readFile(path.join(root, 'docs/evidence/noise-rng-portability-2026-10-20.json'), 'utf8'));
  const archive = await fs.readFile(input), expected = evidence.evidence.artifactDigest.replace(/^sha256:/, '');
  if (hash(archive) !== expected) throw new Error('Archive SHA-256 differs from the committed browser execution evidence.');
  const entries = await readZip(archive), wasm = entries.get('wasm/probe.wasm'), runtime = entries.get('wasm/probe.wasm-runtime.js');
  if (!wasm || !runtime) throw new Error('Compiled native noise files are missing from the archive.');
  if (hash(wasm) !== evidence.wasmSha256 || hash(runtime) !== evidence.runtimeSha256) throw new Error('Compiled files differ from the recorded execution evidence.');
  const output = path.join(root, 'apps/web/engine/generated'); await fs.mkdir(output, { recursive: true });
  const sources = new Map();
  for (const [name, bytes] of entries) {
    if (name.startsWith('generated-sources/upstream/')) sources.set(name, bytes);
    if (name.startsWith('provenance/') && /(?:\.java|\.xml|\.json|\.txt)$/.test(name)) sources.set(name, bytes);
  }
  sources.set('BUILD-INSTRUCTIONS.txt', new TextEncoder().encode('Corresponding source for the experimental native-noise browser module.\nThe complete build harness is maintained in tools/portability-probe at https://github.com/StealthMuskrat/IrisTerrainStudio .\nThe original source manifest, Maven inputs, adapters, GPL license, TeaVM license and notices are included.\nThis module implements only the experimentally verified primitive/RNG path, not Iris terrain generation.\n'));
  await fs.writeFile(path.join(output, 'probe.wasm'), wasm); await fs.writeFile(path.join(output, 'probe.wasm-runtime.js'), runtime);
  await fs.writeFile(path.join(output, 'source.zip'), writeZip(sources));
  await fs.writeFile(path.join(output, 'LICENSE.txt'), entries.get('provenance/VolmLib-LICENSE.txt'));
  const sourceLock = JSON.parse(new TextDecoder().decode(entries.get('provenance/source-lock.json')));
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ formatVersion: 1, scope: 'volmlib-primitive-portability', sourceCommit: sourceLock.commit, wasmSha256: hash(wasm), runtimeSha256: hash(runtime), archiveSha256: expected, backend: 'TeaVM Wasm GC', qualifiedTerrainEngine: false, supportedExports: ['white2d','white3d','white4d','perlin2d','perlin3d','rng'], evidence: evidence.evidence.workflowUrl }, null, 2) + '\n');
  console.log('Installed the verified experimental native noise module and corresponding source. Iris terrain generation remains unqualified.');
}
