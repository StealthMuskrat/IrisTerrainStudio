import { spawnSync } from 'node:child_process';
import { readLock, unresolvedPrerequisites } from '../check-project.mjs';

try {
  const lock = await readLock();
  const java = spawnSync('java', ['--version'], { encoding: 'utf8', timeout: 10000 });
  const output = `${java.stdout ?? ''}${java.stderr ?? ''}`.trim();
  const match = output.match(/(?:openjdk|java)\s+(?:version\s+)?"?(\d+)/);
  const javaReady = java.status === 0 && Number(match?.[1]) === lock.java.major;
  const blockers = unresolvedPrerequisites(lock);
  if (!javaReady) blockers.unshift(`Java ${lock.java.major} is not available or does not execute successfully`);
  console.log(JSON.stringify({ ready: blockers.length === 0, javaReady,
    javaDiagnostic: output || java.error?.message || 'No Java version output', blockers,
    next: 'See docs/STATUS.md and docs/research/PHASE_0.md. This command does not install dependencies or run Iris.' }, null, 2));
  process.exitCode = blockers.length ? 1 : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
