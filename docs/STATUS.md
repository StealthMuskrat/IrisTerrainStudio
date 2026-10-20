# Project status

As of 2026-10-20. Current phase: **0 — research and technical feasibility**. Gate: **open; blocked**.

## Implemented

- Initial empty-repository audit and preservation of the complete user specification.
- Verified latest stable Iris release and pinned its Git commit and inspected source blob hashes.
- Initial source dependency inventory, architecture, phase roadmap, compatibility matrix, and asset provenance notes.
- Dependency-free exact capture comparator with provenance, seed, bounds, complete coverage, duplicate detection, and diagnostic checks.
- Preflight and prerequisite status commands that fail explicitly when reference inputs are missing.
- Foundation CI and contribution/issue/PR templates.

These are project and test-tooling capabilities. No application feature or terrain-generation algorithm is implemented. Comparator unit tests use synthetic data only.

## Immediate work, in order

1. Recover the VolmLib commit/artifact provenance used by the tagged Iris release. Lock all generation-affecting dependencies and compiler inputs; verify the native build.
2. Export the Minecraft 26.3 block registry and Iris schemas with content hashes. Choose a real minimal in-scope pack and hash its content.
3. Build a Java 25 reference harness and capture upstream noise results, including raw IEEE-754 bits. Preserve existing upstream noise/seed tests.
4. Compile an actual pinned RNG/noise path through TeaVM Wasm GC, run it in a browser worker, and compare its capture against the native harness.
5. Resolve the compilation/reachability report before extending to seed derivation, regions, biomes, terrain heights, and minimal voxel chunks.
6. Obtain authorized local F8thful and vanilla asset inputs for compatibility inspection.

## Evidence and limitations

The initial workspace has Node 24.19.0. Its `java --version` fails while loading `libjli.so`; the available launcher resolves to a Java 17 path, not the required Java 25. Maven/Gradle compiler dependencies were not provisioned. No native Iris build, TeaVM compilation, browser generation, GPU test, or native/browser comparison was executed.

No native reference capture or browser exporter exists yet. The capture comparator is ready to consume them but is not a proof of parity. The lock has explicit null values for unresolved dependencies, schemas, registries, and assets. The release prerequisite checker remains red by design; it is not a substitute for a future evidence-verifying release gate.
