# Native Studio biome layouts in retained previews

Target: Iris 4.3.4 `c3a9449a026078c44a87c9776766f54a67779392`, candidate VolmLib `e971ae0176d4d50dff5bd483b2b0d2cc2a77c1ac`. The existing Studio layout preference now reaches terrain contexts instead of refusing every terrain request.

## Original layout and host boundary

`prepareTerrain` remains the ordinary entry point. `prepareStudioTerrain` explicitly enables the engine's Studio flag. Neither entry edits `IrisDimension.studioMode`, focus, regions or pack JSON. The original `IrisComplex` constructor, native biome/region streams, generator preparation and Studio cache decisions run with that flag.

Upstream admits the biome layout only when the platform name equals `bukkit`. A pinned compiler boundary extends that one literal predicate to the explicit browser worker host. It does not rename the platform or widen other platform predicates. The compiler requires exactly one matching constructor predicate; source drift refuses compilation. `BiomeBuffetLayout` and the remaining native stream instructions execute unchanged.

The native layout sorts compatible biome keys, resolves focused land variants/regions, uses its original square-grid width and configured chunk-cell size, and retains the original first-cell fallback for scalar coordinates outside the grid. Active layouts take precedence over authored focus through the original constructor branch. Metadata reports the requested/active state, configured mode, cell count, dimensions and original authored focus. NORMAL has no biome grid; deprecated REGION_BUFFET follows the original zero-size behavior. Two selected biome sizes are compared, not every Studio option.

Declared upper/stack dimensions, OBJECT_BUFFET and null Studio modes refuse in the Studio entry point. Ordinary preparation retains its existing behavior. Hydrology and explicit procedural diagnostic combinations refuse at the worker boundary. Admission runs before retained-context reuse, so a cached Studio terrain context cannot bypass a diagnostic refusal. Column/image authoring diagnostics that prepare ordinary contexts keep that scope.

## Scalar fallback and outside-grid chunks

The original `BiomeBuffetLayout.terrain` falls back to its first cell outside the finite grid, including holes in the last row. Native scalar maps retain that policy. It must not be confused with the chunk wrapper's outside-grid behavior.

`BiomeBuffetGenerator.generateChunk` writes `setRegion(0, 0, 0, 16, 1, 16, BARRIER)` for an outside cell and skips engine generation. The browser's owned-array boundary follows that writer policy using the original layout decision and `BoundBlockState` resolution. Y is absolute world zero, not the dimension's minimum. A finite volume that excludes zero contains no floor blocks. The exact native barrier state, including its target-version properties, comes from the registry; it is not a hardcoded canonical string.

The outside writer is source-derived. The original Bukkit generator executes in the JVM reference, not in Wasm. The port records `nativeStudioGeneratorExecuted: false`, `studioFloorWriter: native-source-derived`, no content generation and incomplete pipeline status. It admits the same bounded chunk coordinates and existing 1–4096-block dimension height. Generation leases and scopes close before publication.

The native outside branch never invokes the biome actuator. The preview carries no fabricated biome buffer for it; it does not claim Bukkit buffer-default or live-world biome equivalence. Existing full/intermediate terrain preview choices use this outside writer before starting their native stages. In-grid requests continue through their selected existing native path. Block ID cells can inspect the barrier when ordinary Minecraft rendering makes it invisible.

## Worker, caches and UI

The worker checks the new capabilities for Studio terrain requests, prepares the selected context, validates and transfers bounded output, and retains original publication/cancellation ownership. Studio and ordinary flags already participate in both native-context and persisted noise-cache identities; the new path uses those identities. Two outside requests can retain one native context, while a subsequent ordinary request replaces it.

The preference remains browser-local. Preview descriptions distinguish active layouts, normal Studio streams, scalar fallback and outside chunks that skipped content/biomes. Existing camera, stored volume and failed-preview behavior are preserved by the existing renderer path. No block-state enumeration or registry export is added.

## Focused reference

One authored five-biome pack, one seed, two layout sizes and an ordinary focused control provide twelve selected biome/height pairs and six painted block/physical-biome probes. Original JVM `IrisComplex`, `BiomeBuffetLayout`, actuators and the outside `BiomeBuffetGenerator` run against owned probe hosts. Six outside calls record their exact native region-write arguments, zero biome writes and restored leases/scopes. Twenty-four selected port floor probes check that policy. This is not a Bukkit world or full chunk comparison.

Actual Wasm/registry and worker/client checks cover inside generation, outside transport, retained context reuse, ordinary replacement, cache namespaces, legacy-module refusal, normal-without-grid behavior, missing combinations and recovery. A controlled host checks the actual description function. Native reference captures are cached by their input/source identity to avoid repeating unchanged JVM work while fixing host checks.

Actual browser/GPU/UI, full Bukkit buffers/world behavior, every mode/buffet size and content interaction, layered/hydrology/procedural Studio combinations, performance and full terrain/release qualification remain open. See [evidence](../evidence/native-studio-layout-2026-10-23.json).
