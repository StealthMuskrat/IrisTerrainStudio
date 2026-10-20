# Native Iris source-build audit

This development audit attempts the pinned Iris source's real `NoiseSeedCohesionTest` and `NoiseStyleContractTest` with the explicitly pinned experimental VolmLib checkout. It records source identities, Gradle/dependency inputs, build diagnostics and JUnit results. No algorithm is replaced or removed to make the build pass.

The candidate is not verified as the shipping release dependency. Passing native regressions would establish only this native source-build result, not browser parity, registry/schema correctness, final terrain parity or compatibility with an unidentified release binary.

The workflow is an **audit**, not a parity gate: it records a failed build as `nativeRegressionsPassed: false`, including missing required suites and the actual Gradle exit code. A completed audit never changes production readiness flags. Consumers requiring passing native tests must use the report command's `--require-pass` flag.

The audited Gradle distribution is the pinned source's version 9.5.1. Its official checksum is checked against the committed source manifest and retained with the downloaded distribution hash. The initial dependency resolution is exploratory; generated Gradle locks and resolved JAR digests are retained for subsequent explicit pinning. They must be reviewed before adopting this as a production reference environment. Gradle's verification-metadata writer is excluded from the build attempt because it independently failed on duplicate timestamped spark-api entries; checksum collection does not depend on that writer.

## Run with the pinned source checkouts

Use Java 25, the Gradle version from `source-lock.json`, and exact Iris/VolmLib checkouts under `.upstream/`. Verify both Git heads/trees and clean status first. Run from the Iris checkout:

```sh
gradle --no-daemon --max-workers=2 --stacktrace \
  --init-script /path/to/IrisTerrainStudio/tools/native-reference/record-inputs.gradle \
  --write-locks \
  -PlocalVolmLibDirectory=/absolute/path/to/VolmLib \
  :core:test \
  --tests art.arcane.iris.generation.noise.NoiseSeedCohesionTest \
  --tests art.arcane.iris.generation.noise.NoiseStyleContractTest
```

Preserve the actual Gradle process exit code; do not treat logging/tee success as build success. Then, from this repository:

```sh
python3 tools/native-reference/report.py \
  --results .upstream/Iris/core/build/test-results/test \
  --exit-code ACTUAL_GRADLE_EXIT_CODE \
  --output .reference-output/native-reference/report.json --require-pass
python3 -m unittest discover -s tools/native-reference -p 'test_*.py'
```

An empty/missing XML directory, skipped tests, mismatched JUnit counters, malformed output, absent required suites or a failed Gradle invocation cannot yield a passing native result. All generated inputs/results stay in ignored work directories; normal application runtime never uses a native generation server.

## Checksum investigation

The audit also runs `:core:captureStudioCngHistory` through `capture.gradle`. `NoiseStyleCapture.java` invokes the unchanged upstream test's private `samples` method and seed field, preserving its enum, seed and coordinate order. It captures all three dimensions as hexadecimal IEEE-754 values and executes the original checksum assertion again. No assertion or upstream source is edited.

`cng-history.json` pins exact CNG sources at the seed-cohesion fixture, parent-invalidation and unsigned-memo changes, alongside the current candidate. CI obtains those files with `git show` and verifies SHA-256 before compiling. Each historical class set goes into a separate output directory, first on a fresh JVM's classpath. **Only CNG is exchanged**; Iris and every other dependency remain the current candidate. These are controlled isolation experiments, not full historical builds or supported legacy engines. A matching checksum would identify a sufficient source difference, not establish shipping provenance.

`compare-cng.py` verifies seed order, duplicate/coordinate coverage, bit encoding and the checksum recomputed from samples before reporting per-style difference counts and the first differing sample. Run it against the artifact's `cng-isolation/` directory. The comparison can complete while the native qualification remains blocked; inspect `report.json` separately. Capture/compile/validation failures fail their workflow step.

An additional current-source `-Xint` JVM profile checks whether interpreter/JIT math behavior changes this fixture in the same environment. It is a runtime diagnostic, not an algorithm replacement or a production runtime recommendation.
