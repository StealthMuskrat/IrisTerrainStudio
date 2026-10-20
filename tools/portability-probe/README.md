# Experimental VolmLib primitive portability probe

This development-only experiment compiles **unmodified, hash-verified FastNoiseDouble, RNG and M sources** for Java 25 and TeaVM 0.16.0 WebAssembly GC, then compares actual Chrome Web Workers against the JVM. A narrowly scoped compiler adapter supplies missing JDK UUID/UTF-8 behavior, independently checked against native Java.

The candidate commit is `e971ae0176d4d50dff5bd483b2b0d2cc2a77c1ac`. It was selected from VolmLib history before the Iris 4.3.4 release publication. **Temporal proximity does not prove that the release used this commit.** The actual native Iris all-style checksum fails with this candidate. This probe does not update the production VolmLib pin or establish Iris terrain compatibility. Iris SeedManager, browser CNG/NoiseStyle, resource loading, registry/material decisions and voxel generation are not exercised.

## What executes

- Eighteen upstream Java source files plus the upstream GPL license are pinned by Git blob digest in `source-lock.json` and copied only after all inputs verify.
- The harness calls five actual primitive methods: white noise in 2D/3D/4D and Perlin in 2D/3D.
- Five signed 64-bit seeds, including both limits, and ten values on each x/y/z axis produce 5,000 input cases. Coordinates include fractions, negatives, chunk boundaries and large world coordinates.
- A native JVM first verifies fresh and reused instance outputs agree and exports exact binary64 bit strings.
- Three independent browser workers use forward, reverse and deterministic shuffled ordering. Each compares fresh and reused instances. Browser workers receive inputs only, never expected results.
- A second native capture samples 68 numeric/textual seed and derived-signature cases, including precision/overflow and malformed-surrogate boundaries. Sixteen rounds of seven RNG outputs are reset/repeated across three workers: 45,696 additional comparisons.
- The combined report records 195,696 exact comparisons plus mismatch diagnostics, actual Wasm instance validation, browser identity, output hashes and source manifest hash.

These checks do not exercise CNG caching, Iris SeedManager, biome/region selection, neighboring chunks, worker cancellation, or a production generation pipeline. A passing result is evidence only for this explicitly selected candidate/compiler/browser combination.

## Explicit JDK compatibility layer

TeaVM lacks name-based UUID creation and its bit accessors, and its UTF-8 encoder throws for one malformed-surrogate seed case. `UuidTeaVMPlugin` redirects exactly four UUID and two UTF-8 call sites inside the pinned RNG bytecode. A changed call count fails compilation; native calls still use the original JDK. No VolmLib source is rewritten. `UuidCompat` preserves the required UUID-v3/MD5 and Java replacement-byte semantics and is checked against native Java on 257 byte arrays and 65,560 encoding cases before browser comparison. See `docs/research/NATIVE_RNG_AUDIT.md` for the exact scope and diagnostics.

## Run

Prerequisites: Java 25 JDK, Maven, Node 24, Google Chrome and the exact VolmLib checkout. The local initial workspace has only a Java 17 runtime, so the GitHub Actions experiment provisions Java 25 and performs the compiler/browser run.

```sh
node tools/portability-probe/prepare.mjs /absolute/path/to/VolmLib
mvn --batch-mode --no-transfer-progress --file tools/portability-probe/pom.xml process-classes
java -cp tools/portability-probe/target/classes studio.probe.NoiseProbe > tools/portability-probe/target/native.json
java -cp tools/portability-probe/target/classes studio.probe.RngProbe > tools/portability-probe/target/rng-native.json
node tools/portability-probe/run-browser.mjs
```

`CHROME_BIN` can select a local Chrome executable. The local test server binds only to loopback and serves the worker, Wasm/runtime, and input plan. It never computes generation results. Chrome is started headlessly and closed after the test.

The workflow retains captures, the report, exact downloaded sources and license, harness/POM, Java/Maven/Chrome versions, native class digests and resolved Maven JAR digests. No pack/game assets are involved. Downloaded source, generated code, compiler artifacts and captures remain ignored under `target/` and `.upstream/`; the project does not vendor upstream implementation code.

The experimental harness is GPL-3.0-or-later. Preserve the included upstream notices/license with compiled outputs and their source. This does not select a license for unrelated original project components.

`licenses/TeaVM-LICENSE.txt` and `licenses/TeaVM-NOTICE.txt` are preserved from TeaVM commit `e87d452e4bd70c77b9e19314a46c3d6971c148b6` and accompany experiment artifacts. The Java setup coordinate is `25.0.4+1`; the workflow additionally requires the JVM's reported runtime build to be exactly `25.0.4.1+1-LTS`.
