# Foundation validation

Initial foundation run: 2026-10-20. Local runtime: Node.js 24.19.0, Linux. This first section records the bootstrap checks; the later section records the subsequently executed primitive experiment.

| Command | Result | Meaning |
| --- | --- | --- |
| `npm run check` | Exit 0 | Required documentation exists and the source lock is internally consistent |
| `npm test` | 17 passed, 0 failed | Synthetic capture and CLI tests cover comparison, malformed inputs and source-lock consistency |
| `npm run reference:preflight` | Exit 1, expected | Java 25 execution and required engine/dependency/schema/registry/asset inputs remain unavailable |
| `npm run release:check` | Exit 1, expected | Recorded release prerequisites remain incomplete; no release readiness claimed |

The comparator was exercised with shuffled samples, fractional and large/negative coordinates, one-bit and signed-zero differences, block identifiers/properties, complete coverage, duplicate detection, seed range/precision, target provenance drift, invalid output, bounded diagnostics and CLI failure modes.

Native Iris build: **not run**. TeaVM compilation: **not run**. Browser worker generation: **not run**. Native/browser parity: **not run**. WebGPU, editor, server, resource-pack, Docker and performance checks: **not applicable; implementations do not exist**.

The foundation GitHub Actions workflow repeats structure and tooling checks. It is not a parity or deployment workflow. A future release pipeline must verify actual native/browser evidence rather than trust status flags alone.

## Executed primitive experiment, 2026-10-20

[Workflow run 39430229610](https://github.com/StealthMuskrat/IrisTerrainStudio/actions/runs/39430229610) passed at commit `d836069792889d0a5be1147bbed58b41e06a622c`. The [committed evidence summary](evidence/primitive-portability-2026-10-20.json) records source/output hashes and the artifact identity. Foundation CI also passed all **20** current tooling tests.

| Check | Result |
| --- | --- |
| Verify immutable candidate source inputs | 16 upstream Java files and GPL license passed exact Git blob checks |
| Native compilation | Passed with Temurin Java 25.0.4.1+1 |
| Independent native execution | 5,000 seed/coordinate cases; fresh/reused primitive outputs agreed |
| TeaVM 0.16.0 Wasm GC compilation | Passed using the same unmodified source |
| Actual Chrome Web Workers | Three independent workers; forward/reverse/shuffled requests, fresh/reused instances |
| Exact primitive comparisons | **150,000 comparisons; 0 mismatches** |
| Browser | Chrome 155.0.8059.84, V8 15.5.35.25 |

Methods tested: white noise in 2D/3D/4D and Perlin in 2D/3D. Seeds include both signed Java long limits. Coordinates include fractions, negatives, chunk boundaries and large values. These are real executed primitive comparisons, separate from the synthetic unit tests.

The VolmLib commit is a temporal candidate, not a verified shipping dependency. Iris CNG/NoiseStyle, RNG/SeedManager, schemas, registries, heights, block states and terrain remain untested. No production parity or release readiness is claimed. Full evidence artifacts contain captures, compiler outputs, exact sources/license and toolchain/dependency digests and have 30-day retention; the compact report is committed for durable tracking.

The evidence ZIP was also downloaded and verified against its published SHA-256 digest; its native/browser captures were independently compared again locally with the same zero-mismatch result.

## Native Iris and expanded RNG investigation, 2026-10-20

- Current foundation validation: **22 Node tests and 9 Python native-report tests pass**.
- Actual Iris core compiled with the candidate dependency. Unchanged native suites ran 15 tests: **14 passed, 1 failed**. `allStylesRetainPinnedSamples` expected `5059606393854142913` and observed `3659164368724912644`. Gradle exited 1; the audit correctly records native readiness as false. [Verified report](evidence/native-reference-audit-2026-10-20.json).
- The expanded [browser report](evidence/noise-rng-portability-2026-10-20.json) records **195,696 exact comparisons, zero mismatches**: 150,000 noise comparisons and 45,696 RNG comparisons. Its archive hash and captured output pairs were independently rechecked locally.
- Missing JDK operations were handled by an explicit six-call compiler compatibility adapter without changing RNG/M source. Native Java independently validated 257 UUID cases and 65,560 UTF-8 cases; the malformed-surrogate browser failure remains in the regression inputs and now passes.

The native build audit's successful workflow completion means its diagnostics were recorded, **not that native regressions passed**. The report's `nativeRegressionsPassed` field and `--require-pass` command enforce that distinction. Full Iris/browser terrain parity and release qualification remain blocked by the unresolved native checksum and other recorded prerequisites.
