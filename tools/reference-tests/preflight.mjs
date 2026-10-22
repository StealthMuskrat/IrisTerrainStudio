import { spawnSync } from 'node:child_process';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { readLock, unresolvedPrerequisites } from '../check-project.mjs';

try {
  const lock = await readLock();
  const pinned=fileURLToPath(new URL('../../.local-tools/jdk-25.0.4.1+1/',import.meta.url));
  const javaHome=process.env.IRIS_JAVA_HOME||await access(path.join(pinned,'bin/java')).then(()=>pinned,()=>null);
  const executable=javaHome?path.join(javaHome,'bin/java'):'java';
  const env=javaHome?{...process.env,JAVA_HOME:javaHome,LD_LIBRARY_PATH:[path.join(javaHome,'lib'),path.join(javaHome,'lib/server'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter)}:process.env;
  const java = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 10000,env });
  const output = `${java.stdout ?? ''}${java.stderr ?? ''}`.trim();
  const match = output.match(/(?:openjdk|java)\s+(?:version\s+)?"?(\d+)/);
  const javaReady = java.status === 0 && Number(match?.[1]) === lock.java.major;
  const blockers = unresolvedPrerequisites(lock);
  if (!javaReady) blockers.unshift(`Java ${lock.java.major} is not available or does not execute successfully`);
  console.log(JSON.stringify({ ready: blockers.length === 0, javaReady,javaSource:process.env.IRIS_JAVA_HOME?'IRIS_JAVA_HOME':javaHome?'pinned local toolchain':'PATH',
    javaDiagnostic: output || java.error?.message || 'No Java version output', blockers,
    next: 'See docs/STATUS.md and docs/research/PHASE_0.md. This command does not install dependencies or run Iris.' }, null, 2));
  process.exitCode = blockers.length ? 1 : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
