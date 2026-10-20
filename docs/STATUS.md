# Project status

As of 2026-10-20. Current phase: **0 — research and technical feasibility**. Gate: **open; blocked**.

## Implemented

- Initial empty-repository audit and preservation of the complete user specification.
- Verified latest stable Iris release and pinned its Git commit and inspected source blob hashes.
- Initial source dependency inventory, architecture, phase roadmap, compatibility matrix, and asset provenance notes.
- Dependency-free exact capture comparator with provenance, seed, bounds, complete coverage, duplicate detection, and diagnostic checks.
- Preflight and prerequisite status commands that fail explicitly when reference inputs are missing.
- Foundation CI and contribution/issue/PR templates.
- Actual Java 25.0.4.1+1 / TeaVM 0.16.0 Wasm GC primitive execution: 5,000 cases across three Chrome workers and fresh/reused instances; 150,000 exact comparisons, zero mismatches. [Evidence](evidence/primitive-portability-2026-10-20.json).
- Corrected the Iris root-tree identity using the pinned commit object's tree field.

No application generation feature is implemented. The executable primitive experiment uses real, unmodified VolmLib source on an explicitly separate candidate revision; production compatibility remains unproved. Comparator unit tests still use synthetic data and remain distinct from the executed Java/browser experiment.

## Immediate work, in order

1. Recover/verify the VolmLib dependency provenance for the tagged Iris release. Lock all generation-affecting dependencies and verify the full native reference build; Java 25 is now available in CI.
2. Export the Minecraft 26.3 block registry and Iris schemas with content hashes. Choose a real minimal in-scope pack and hash its content.
3. Build a Java 25 reference harness and capture upstream noise results, including raw IEEE-754 bits. Preserve existing upstream noise/seed tests.
4. Extend the successful primitive compilation to the actual Iris NoiseStyle/CNG and RNG/SeedManager path, using verified reference inputs and per-coordinate captures.
5. Resolve the compilation/reachability report before extending to seed derivation, regions, biomes, terrain heights, and minimal voxel chunks.
6. Obtain authorized local F8thful and vanilla asset inputs for compatibility inspection.

## Evidence and limitations

The local workspace has Node 24.19.0 and a Java 17 runtime without javac. Its launcher can run with the correct library path, but it is not a Java 25 JDK. The new development workflow provisions Java 25.0.4.1+1, Maven/TeaVM and real Chrome workers, and has successfully executed the primitive experiment. A full native Iris build, Iris browser generation, GPU test and native/browser terrain comparison have not run.

No production-reference capture or Iris browser exporter exists yet. Experimental primitive captures and compiler/toolchain provenance are available in [the successful CI run](https://github.com/StealthMuskrat/IrisTerrainStudio/actions/runs/39430229610); the committed summary preserves hashes and results, while full run artifacts have 30-day retention. The production lock still has explicit nulls for unresolved dependencies, schemas, registries and assets. Release prerequisites remain blocked.
