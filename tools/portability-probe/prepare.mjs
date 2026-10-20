import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function gitBlobSha(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

export function verifySource(bytes, source) {
  if (!/^(?:shared\/src\/main\/java\/art\/arcane\/volmlib\/util\/(?:math|noise)\/[A-Za-z0-9]+\.java|LICENSE)$/.test(source.path)) {
    throw new Error('Source path is outside the experiment allowlist');
  }
  if (!/^[a-f0-9]{40}$/.test(source.gitBlobSha) || gitBlobSha(bytes) !== source.gitBlobSha) {
    throw new Error(`Source digest mismatch: ${source.path}`);
  }
}

async function main() {
  const sourceDirectory = process.argv[2];
  if (!sourceDirectory) throw new Error('Usage: node tools/portability-probe/prepare.mjs /path/to/pinned/VolmLib');
  const lock = JSON.parse(await readFile(new URL('source-lock.json', import.meta.url), 'utf8'));
  const files = [];
  // Verify all sources before writing any compiler input.
  for (const source of lock.sources) {
    const bytes = await readFile(resolve(sourceDirectory, source.path));
    verifySource(bytes, source);
    files.push({ source, bytes });
  }
  for (const { source, bytes } of files) {
    const destination = source.path === 'LICENSE' ? new URL('target/provenance/VolmLib-LICENSE.txt', import.meta.url) :
      new URL(`target/generated-sources/upstream/${source.path.replace('shared/src/main/java/', '')}`, import.meta.url);
    await mkdir(dirname(destination.pathname), { recursive: true });
    await writeFile(destination, bytes);
  }
  await writeFile(new URL('target/provenance/source-lock.json', import.meta.url), JSON.stringify(lock, null, 2));
  console.log(`Verified ${files.length} immutable source inputs. Release match remains unverified.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
