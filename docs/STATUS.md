# Project status

As of 2026-10-20. **Local application implementation is in progress. Native/browser terrain qualification remains blocked.** The user requested larger local development batches, focused checks only when needed, checkpoint pushes and full verification after development. GitHub workflows are manual.

## Implemented

- Initial empty-repository audit and preservation of the complete user specification.
- Verified latest stable Iris release and pinned its Git commit and inspected source blob hashes.
- Initial source dependency inventory, architecture, phase roadmap, compatibility matrix, and asset provenance notes.
- Dependency-free exact capture comparator with provenance, seed, bounds, complete coverage, duplicate detection, and diagnostic checks.
- Preflight and prerequisite status commands that fail explicitly when reference inputs are missing.
- Foundation CI and contribution/issue/PR templates.
- Actual Java 25.0.4.1+1 / TeaVM 0.16.0 Wasm GC primitive execution: 5,000 cases across three Chrome workers and fresh/reused instances; 150,000 exact comparisons, zero mismatches. [Evidence](evidence/primitive-portability-2026-10-20.json).
- Corrected the Iris root-tree identity using the pinned commit object's tree field.
- Expanded actual browser verification to VolmLib RNG: 45,696 RNG comparisons plus the 150,000 noise comparisons, all exact. Independently checked missing JDK UUID/UTF-8 compatibility operations. [Evidence](evidence/noise-rng-portability-2026-10-20.json).
- Compiled the actual Iris core and executed both unchanged native noise/seed suites: 14 tests pass; the pinned all-style checksum fails. Captured Gradle/dependency inputs and a fail-closed native audit report. [Evidence](evidence/native-reference-audit-2026-10-20.json).
- Executed six native noise isolation profiles: 186 styles and 16,740 samples each; 83,700 comparisons against current agree exactly and all profiles reproduce the failing checksum. The tested noise/interpolation source changes and interpreter/JIT mode do not explain this run. [Diagnostics](research/NATIVE_CHECKSUM_DIAGNOSTICS.md).

A local pack-management server, browser editor, lossless JSON document model, WebGPU field visualizer, optional native-noise laboratory and resource-pack/voxel rendering modules are now implemented. [Implementation notes](DEVELOPMENT.md) describe behavior, the focused editing check and remaining work. The full Iris terrain engine is not connected. The primitive module uses real, unmodified VolmLib source on a separate candidate revision; production compatibility remains unproved.

## Remaining engine and application work

1. [Explain the native all-style checksum mismatch (#15)](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/15): establish the original fixture, full dependency and platform inputs, then qualify the dependency/build identity and release provenance. The tested noise source history and interpreter/JIT diagnostics reproduce identical outputs; the reference remains unqualified.
2. Export the Minecraft 26.3 block registry and Iris schemas with content hashes. Choose a real minimal in-scope pack and hash its content.
3. Build a Java 25 reference harness and capture upstream noise results, including raw IEEE-754 bits. Preserve existing upstream noise/seed tests.
4. Extend the successful primitive compilation to the actual Iris NoiseStyle/CNG and RNG/SeedManager path, using verified reference inputs and per-coordinate captures.
5. Resolve the compilation/reachability report before extending to seed derivation, regions, biomes, terrain heights, and minimal voxel chunks.
6. Obtain authorized local F8thful and vanilla asset inputs for compatibility inspection.

## Evidence and limitations

The local workspace has Node 24.19.0 and a Java 17 runtime without javac. CI provisions Java 25.0.4.1+1 and now compiles the actual Iris core. Of 15 native noise/seed tests, one fails: expected checksum `5059606393854142913`, actual `3659164368724912644`. The candidate is therefore not a qualified reference. Browser primitive/RNG experiments pass; Iris SeedManager/browser CNG integration, GPU visualization and terrain comparison remain unproved.

No production-reference capture or Iris browser exporter exists yet. Experimental primitive captures and compiler/toolchain provenance are available in [the successful CI run](https://github.com/StealthMuskrat/IrisTerrainStudio/actions/runs/39430229610); the committed summary preserves hashes and results, while full run artifacts have 30-day retention. The production lock still has explicit nulls for unresolved dependencies, schemas, registries and assets. Release prerequisites remain blocked.
