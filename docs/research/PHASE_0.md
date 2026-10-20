# Phase 0: initial source audit

Audit date: 2026-10-20. Outcome: **feasibility unproved; exact blockers identified**. This is a source inspection, not a successful compilation experiment.

## Release and immutable identity

GitHub's [latest stable release endpoint](https://api.github.com/repos/VolmitSoftware/Iris/releases/latest) returned tag `4.3.4-26.1.2-26.3`, published 2026-10-18, with prerelease/draft both false. The [tag ref](https://api.github.com/repos/VolmitSoftware/Iris/git/ref/tags/4.3.4-26.1.2-26.3) resolves directly to commit `c3a9449a026078c44a87c9776766f54a67779392`. The pinned [gradle.properties](https://github.com/VolmitSoftware/Iris/blob/c3a9449a026078c44a87c9776766f54a67779392/gradle.properties) declares Iris 4.3.4 and Minecraft 26.3. The release notes and core toolchain configuration specify Java 25. The upstream recursive Git tree was complete (4,156 entries).

`upstream.lock.json` records the commit, tree, and inspected blob hashes. Generated schema and registry artifacts are not yet pinned; their null hashes are deliberate blockers.

## Inspected dependencies and entry points

All paths below are relative to [the pinned Iris source](https://github.com/VolmitSoftware/Iris/tree/c3a9449a026078c44a87c9776766f54a67779392). This inventory covers initial entry points, not the full transitive call graph.

| Source path | Observation | Consequence |
| --- | --- | --- |
| `core/src/main/java/art/arcane/iris/generation/noise/NoiseStyle.java` | Uses `art.arcane.volmlib.util.math.RNG`, `util.noise.CNG`, NoiseType and stream helpers | Noise is not self-contained within the Iris repository |
| `core/src/main/java/art/arcane/iris/generation/runtime/SeedManager.java` | Seed derivation includes RNG, CNG, Java long overflow, string hashes and double bit conversions | A generic JavaScript seed/RNG implementation cannot establish compatibility |
| `core/build.gradle` | Java 25, incubator vector module, VolmLib native/shared snapshot coordinates and runtime libraries | Need a reachable subset and dependency/native acceleration audit |
| `gradle/volmlib-resolution.settings.gradle` | Local composite substitution or published `master-SNAPSHOT`; changing modules are rechecked | Iris commit alone does not freeze actual generation code; inspect the release's embedded VolmLib provenance stamp |
| `core/src/main/java/art/arcane/iris/generation/runtime/IrisEngine.java` | Engine services, native block states, mantle storage, Java IO, AWT color, concurrent runtime/lifecycle dependencies | Full plugin compilation is not a credible first browser experiment |
| `core/src/main/java/art/arcane/iris/pack/loading/IrisData.java` | Gson adapters, registries, resource loading and platform services | Separate lossless editor storage from authoritative generation loading |
| `core/src/main/java/art/arcane/iris/pack/schema/SchemaBuilder.java` | Runtime reflection and field metadata, draft-07 schema generation | Export matching schemas at build time, hash them, and validate defaults against pinned source |
| `probe/build.gradle` | `genProbe`, `generationOrderProbe`, `hydrologyProbe`, `terrain3DProbe` and related tasks | Reuse development entry points after verifying their exact scope and platform fidelity |
| `probe/src/main/java/art/arcane/iris/probe/GenerationProbe.java` | Constructs real engine infrastructure and hashes output; uses inert service implementations | Useful development reference starting point, not evidence of browser/native full parity |
| `probe/src/main/java/art/arcane/iris/probe/StubPlatform.java` | Supplies stub platform and block handling | Must audit material/registry behavior before treating it as authoritative for final states |
| `core/src/test/java/art/arcane/iris/generation/noise/NoiseSeedCohesionTest.java` | Existing all-style checksum and cache/order/concurrency tests with extreme seeds/coordinates | Preserve and run upstream tests; supplement with per-coordinate native/browser captures |

## TeaVM strategy and exact unresolved questions

TeaVM's [overview](https://teavm.org/docs/intro/overview.html) describes restrictions around reflection, class loading, resources and JNI. Its [Java library notes](https://teavm.org/docs/runtime/java-classes.html) state that only a subset is implemented and some behavior differs from the JVM. The [Wasm GC loader documentation](https://teavm.org/docs/wasm-gc-backend/loader.html) explicitly covers worker loading. These support testing a narrow compiled call graph, not claiming the Iris plugin compiles unchanged.

1. **Release dependency provenance:** recover the VolmLib commit and clean/dirty status from a tagged release artifact's `META-INF/volmit/volmlib.properties`, or an equivalent authoritative build record. Pin artifact hashes and source. The release API returned no attached binary assets; the build dependency must not be guessed from today's VolmLib head.
2. **Toolchain:** provision Java 25 and a tested, pinned TeaVM version. The initial workspace's Java launcher fails loading `libjli.so` and points to Java 17. Native builds and compiler experiments could not run here.
3. **Reachability:** compile actual RNG/CNG and one Iris noise call first; record compiler errors and every replacement/adapter. Establish Java long/float/string behavior, vector/native code selection, and reachable unsupported APIs. These are source-based risk findings until a compiler reports the concrete reachable failures.
4. **Registry and schemas:** export exact Minecraft 26.3 block states/properties and generated schemas, with artifact hashes and relevant platform context. A simplified stub registry cannot silently substitute for the target runtime.
5. **Reference fidelity:** determine which upstream headless probes preserve final terrain material and neighboring-chunk behavior. Extend a verified path with per-sample bit/block-state exports and complete pack/seed/region identity.
6. **Assets:** `F8thful.zip` and an authorized matching vanilla baseline were not attached. Their contents, overlay applicability and licenses have not been examined.

## Next experiment and evidence requirements

Start with an immutable VolmLib-backed native noise harness, preserve the existing upstream all-style tests, then compile the same selected classes to TeaVM Wasm GC. Run them in a real browser worker, export double bits at identical coordinates for several signed 64-bit seeds, and compare using the repository tool. Include large and negative coordinates, chunk/biome/region boundary cases as the path expands, cold/warm caches, shuffled requests and worker scheduling.

The first report must distinguish compiler success, worker execution, exact scalar results, seed derivation, terrain heights and voxel states. Only implemented paths with independent native captures may be marked supported. Proceed to Phase 1 expansion only after the browser execution blocker is resolved. No editor UI or mock terrain was created during this audit.
