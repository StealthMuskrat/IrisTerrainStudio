# Native procedural ruin generation

Target: Iris 4.3.4 `c3a9449a026078c44a87c9776766f54a67779392`, candidate VolmLib `e971ae0176d4d50dff5bd483b2b0d2cc2a77c1ac`. Generated ruins are procedural objects. Imported conventional structures remain excluded by the specification.

## Connected paths

The native entry descriptor and chooser now include `proceduralObjects.ruins` from biomes and regions. The original `IrisRuin` variant pool, configured long seed, shape generator, burial, erosion, weathering and accent algorithms execute. The existing isolated volume serializer preserves native local coordinates, pool keys and bounds. Native placement uses the entry's original placement settings and existing destination transaction.

The guarded source and neighborhood paths now accept ruins through the original placement list. Native source selection, chance/density, radii, variant choice, plan construction, destination replay and bounded continuation/session caches retain their existing implementation. The registered Overworld route reaches ruins through those same original content stages. This does not add a general structure editor or imported placement service.

## Pinned rounding boundary

A tiny native comparison exposed TeaVM 0.16.0's `Math.round(double)` implementation: negative half values round away from zero, unlike OpenJDK's rule toward positive infinity. Ruin noise-coordinate rounding changes erosion and weathering decisions at negative coordinates. The mismatch affected even a small buried pillar, so matching a few positive probes alone was insufficient.

Exactly eight original `RuinGenerator` calls and four `RuinShapes` calls now use the existing OpenJDK 25 `WorkerJdkRound` adapter. Compiler checks enforce those counts. The native method instructions and arithmetic around the calls remain unchanged. This initially scoped binding is subsequently extended by the [shared native rounding boundary](NATIVE_ROUNDING.md). That extension does not qualify every caller. The adapter and full corresponding OpenJDK source/notices accompany the module.

## Admission and ownership

Before native baking, each configured dimension must be within 1–64 blocks, the form must be present, and burial/erosion/weathering numbers must be finite. Pools retain the existing eight-variant limit. At most sixteen accents are admitted, with native targets, finite chances and scatter radii of 1–16. A conservative expanding envelope bounds total accent candidate work to 1,048,576 across the configured pool. These are explicit worker limits, not substituted native settings.

Ruin canvases and temporary native maps use the existing preview-owned map boundary. New `putAll` admission charges new keys against the shared 262,144-entry budget before mutation. It delegates to the original bulk insertion operation so capacity and iteration behavior are retained. Existing scope cleanup covers both refusal and successful serialization. Output axis/volume, placement window and source-attempt limits remain in force.

## Focused validation

Five tiny native shapes cover PILLAR, WALL, ARCH, FLOOR_SLAB and RUBBLE, with selected TOP, SURFACE and BASE_SCATTER accents. Original JVM output supplies block counts, bounds, keys, seeds and at most three distinct material probes per shape. A single small pillar also runs through manual placement, one-source generation, neighborhood replay and registered Overworld generation. Selected populated journal cells supply material probes without searching the full voxel volume. Native reference captures are cached by input and source identity.

Actual Wasm, existing registry bytes, worker and client exercise descriptors, typed transport, cache reuse and refusal/recovery. Dimension, scatter radius, missing form and candidate-work guards are checked. These are controlled Node-host checks, not actual browser/GPU/UI execution. See [evidence](../evidence/native-ruins-2026-10-23.json).

All ruin settings and palettes, every accent interaction, complete collision behavior, full engine lifecycle, browser/GPU/performance, native dependency/release provenance and full terrain parity remain unqualified. No exhaustive state or full program verification is part of this implementation batch.
