import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const root = new URL('../', import.meta.url);
export async function readLock() {
  return JSON.parse(await readFile(new URL('upstream.lock.json', root), 'utf8'));
}

export function validateLock(lock) {
  if (lock.formatVersion !== 1 || !/^[a-f0-9]{40}$/.test(lock.iris?.commit) ||
      !/^[a-f0-9]{40}$/.test(lock.iris?.tree)) throw new Error('Invalid Iris source pin');
  if (lock.schemas?.sourceCommit !== lock.iris.commit) throw new Error('Schema source pin differs from Iris');
  if (!Number.isInteger(lock.java?.major) || lock.java.major < 1 || !lock.minecraft?.version ||
      !lock.browserCompiler?.name) throw new Error('Missing target toolchain metadata');
  if (!Array.isArray(lock.sources) || lock.sources.length === 0) throw new Error('Missing source inventory');
  const paths = new Set();
  for (const source of lock.sources) {
    if (!source.path || !/^[a-f0-9]{40}$/.test(source.gitBlobSha) || paths.has(source.path))
      throw new Error('Invalid or duplicate source inventory entry');
    paths.add(source.path);
  }
  if (!Array.isArray(lock.readiness?.blockers) || !Number.isInteger(lock.readiness?.phase))
    throw new Error('Missing milestone readiness');
  return lock;
}

export function unresolvedPrerequisites(lock) {
  validateLock(lock);
  const fields = [
    ['VolmLib commit', lock.volmLib?.commit, /^[a-f0-9]{40}$/],
    ['VolmLib artifact', lock.volmLib?.artifactSha256, /^[a-f0-9]{64}$/],
    ['Minecraft registry', lock.minecraft.registrySha256, /^[a-f0-9]{64}$/],
    ['Schema bundle', lock.schemas.bundleSha256, /^[a-f0-9]{64}$/],
    ['F8thful archive', lock.assets?.f8thfulSha256, /^[a-f0-9]{64}$/],
    ['Vanilla asset baseline', lock.assets?.vanillaBaselineSha256, /^[a-f0-9]{64}$/],
  ];
  const reasons = fields.filter(([, value, regex]) => typeof value !== 'string' || !regex.test(value))
    .map(([name]) => `${name} is not pinned`);
  if (!lock.browserCompiler.version) reasons.push('Browser compiler version is not pinned');
  for (const field of ['nativeReferenceExecuted', 'browserGenerationExecuted', 'parityVerified']) {
    if (lock.readiness[field] !== true) reasons.push(`${field} has no recorded successful result`);
  }
  if (lock.readiness.status !== 'ready' || lock.readiness.blockers.length) reasons.push('Milestone blockers remain open');
  return reasons;
}

async function main() {
  try {
    const lock = validateLock(await readLock());
    if (process.argv.includes('--release')) {
      const unresolved = unresolvedPrerequisites(lock);
      console.log(JSON.stringify({ prerequisiteStatus: unresolved.length ? 'blocked' : 'recorded',
        unresolved, note: 'This checks recorded prerequisites only; it does not certify parity evidence.' }, null, 2));
      process.exitCode = unresolved.length ? 1 : 0;
    } else {
      for (const path of ['README.md', 'docs/SPECIFICATION.md', 'docs/STATUS.md', 'docs/research/PHASE_0.md',
        'docs/ROADMAP.md', 'docs/ARCHITECTURE.md', 'docs/COMPATIBILITY.md', 'docs/THIRD_PARTY.md']) {
        if (!(await readFile(new URL(path, root), 'utf8')).trim()) throw new Error(`Empty required file: ${path}`);
      }
      console.log(`Foundation structure valid. Phase ${lock.readiness.phase}: ${lock.readiness.status}. No parity certification.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
