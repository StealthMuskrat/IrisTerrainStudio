import test from 'node:test';
import assert from 'node:assert/strict';
import { readLock, validateLock, unresolvedPrerequisites } from '../tools/check-project.mjs';

test('the source lock is internally consistent and records unresolved inputs honestly', async () => {
  const lock = validateLock(await readLock());
  assert.equal(lock.schemas.sourceCommit, lock.iris.commit);
  assert.ok(unresolvedPrerequisites(lock).length > 0);
  assert.equal(lock.readiness.nativeReferenceExecuted, false);
  assert.equal(lock.readiness.browserGenerationExecuted, false);
  assert.equal(lock.readiness.parityVerified, false);
});

test('source inventory rejects ambiguous or inconsistent provenance', async () => {
  const lock = await readLock();
  lock.schemas.sourceCommit = 'f'.repeat(40);
  assert.throws(() => validateLock(lock), /Schema source pin/);
  lock.schemas.sourceCommit = lock.iris.commit;
  lock.sources.push(lock.sources[0]);
  assert.throws(() => validateLock(lock), /duplicate/);
});
