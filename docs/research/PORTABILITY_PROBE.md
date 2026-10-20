# Pinned primitive portability experiment

Investigation date: 2026-10-20. This expands the source audit with executable Java/browser tooling. The experiment's current result is recorded separately in `docs/VALIDATION.md`.

## Source identity correction

The Iris Git commit endpoint identifies root tree `95b910b97fa75c29b3e98cd4f32bc2a40276dcb3` for commit `c3a9449a026078c44a87c9776766f54a67779392`. The initial lock had incorrectly repeated the commit hash in its tree field after querying the tree endpoint with a commit alias. The lock now records the explicit commit object's tree identity. Source file blob hashes remain unchanged.

## Dependency provenance findings

No GitHub Actions run was returned for the Iris release commit, and no `.github/workflows` directory was present at that pinned revision. The release API has no attached artifacts. The upstream build/README documents `META-INF/volmit/volmlib.properties` as the embedded dependency provenance stamp. An actual release binary or equivalent build record is still required to verify its precise VolmLib input; no such artifact is supplied here.

VolmLib history before release publication returned candidate commit `e971ae0176d4d50dff5bd483b2b0d2cc2a77c1ac` dated 2026-10-17. It is explicitly an experimental candidate. Timestamp proximity is not release provenance, and the production lock's VolmLib commit remains unresolved.

## Executable feasibility approach

`tools/portability-probe/source-lock.json` pins the candidate source and sixteen Java files required to compile FastNoiseDouble plus its geometry type dependencies. Each file and the upstream license is verified using its exact Git blob digest before compiler input is written. No upstream algorithm, vector class, or numerical operation is rewritten.

The experiment uses Java 25.0.4.1+1 and TeaVM 0.16.0, first with the requested Wasm GC backend. The native harness and browser export call the same unmodified primitive methods. The native process emits a complete plan of 5,000 cases, verifying fresh/reused instance consistency. The browser receives only seeds/coordinates/IDs and independently evaluates each case in three workers with different ordering. Exact binary64 comparisons run outside the browser against the independent native capture.

Five primitive methods, three workers, and two instance modes yield 150,000 bit comparisons. A coordinate-level report identifies differences without numeric tolerance. Compiled Wasm/runtime hashes, source-manifest hash, native capture hash, JVM class hashes, resolved Maven artifact hashes, browser identity and toolchain version files are retained with sources/license in the Actions artifact.

This experiment runs in a development CI environment. It is not an application endpoint, native generation fallback, or deployable preview service. The browser remains responsible for every primitive value evaluated by its workers.

## Scope and remaining gate

The result applies only to these FastNoiseDouble primitives, this immutable candidate, and the recorded compiler/browser/toolchain. It does not test Iris NoiseStyle/CNG wrappers, RNG/SeedManager, generation ordering, schema/registry behavior, resource loading, neighboring chunks, heights, block states, or terrain systems. No supported-feature or native chunk parity claim changes as a result.

Next: recover/verify the release dependency inputs, run the pinned Iris source's native noise/seed regressions, then expand the compiled call graph to the real Iris noise and seed path. Keep the production reference lock and experiment identities distinct until evidence supports adoption.
