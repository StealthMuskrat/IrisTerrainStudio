# Seeded client biome sampling over an explicit writer projection

Target: official Minecraft 26.3 client, SHA-256 `4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d`. Original client classes/assets and decompiled reference stay local. The adapter and authored coordinate probes are committed; this is not a live-world biome capture.

## Original client lookup

`client-biome-sampling.mjs` follows `BiomeManager.obfuscateSeed` and `getBiome`: little-endian signed-long SHA-256 hashing, the first digest long in little-endian order, native signed-int subtraction/quarter coordinates and eight candidate corners. Each corner uses original signed-64 quadratic LCG arithmetic and floor-mod jitter. Double distance terms retain native order and strict greater-than tie handling. Seed strings never pass through JavaScript Number. The producer now exports `IrisWorld.getRawWorldSeed()` as a decimal string in retained terrain metadata; the displayed seed control or a later request is never used to guess a retained volume's seed.

The reference calls the original client methods unchanged. A small resolver records the selected quart coordinate and returns null; no biome registry, world, renderer or GPU starts. Four authored signed-long seeds and sixteen selected coordinates cover zero, negative, extreme long seeds, negative Y, near-world bounds and signed-int subtraction overflow.

## Explicit biome source

The resource-pack dialog retains **Stored physical biome** as its default. **Native writer + client sampling** projects the immutable per-block biome array using the pinned offline `NativeRegionTerrainWriter.terrain` convention: local X/Y/Z lower quart corners (`x << 2`, `sectionY + (y << 2)`, `z << 2`). Lookup then applies the original client selector to that grid. Vertical queries clamp to the first/last available quart in the declared full dimension height. Horizontal missing quart samples are refused, not clamped or filled with an arbitrary biome.

Admission requires section-aligned origins and dimensions, the native offline writer's height range, complete retained native vertical coverage, physical biome data and the exact native raw world seed. Old volumes without that metadata explicitly require regeneration or stored sampling. The producer's full per-block biome values remain unchanged, and the physical-biome inspector still reports stored data. The color-mode label distinguishes rendering lookup from those stored keys.

This projection is derived from reviewed pinned writer source. The projection itself is not executed through that writer in this batch, and production Bukkit/modded visible-biome grids are not qualified. The feature must not be described as complete native client-world biome parity. Authentic production grid/halo transport remains outstanding. An interior clip may use neighboring retained cells outside the visible clip; a boundary needing absent data emits a typed diagnostic and omits affected tinted faces. The empty-view notice explains the biome-data remedy rather than only requesting texture assets.

Water surfaces and biome-dependent model tints share this selected source. Existing integer box blending, coordinate-dependent biome modifiers and lower-grass Y offsets apply after source selection. Constant/property/explicit model tints remain direct. Each worker request has at most 65,536 uncached seeded lookups and 32,768 cached biome/error answers, in addition to existing blend admission. Sampling budget errors propagate through blending and refuse the mesh; cached missing-data errors preserve their diagnostic code. Snapshot-owned section caches retain resulting geometry and picking owners. No extra registry/state enumeration is introduced in runtime rendering.

The local mode/radius preference remeshes retained data without generation or camera loss. Busy operations refuse changes, failed current publication restores both settings, closed dialogs ignore further actions, and recovery uses the retained mode. Async seed hashing participates in existing renderer job ownership before publication.

## Focused checks and open gates

- `capture-client-biomes.py` uses shared checksummed client-reference input preparation, without an Iris build or all-state exporter. Four seed hashes and sixteen native coordinate results are recorded with source/class/dependency identities.
- `client-biomes-smoke.mjs` compares those native results, checks two explicit projection coordinates, vertical clamp and horizontal refusal, seed/coverage admission, cache/error reuse and composite blend-work refusal. One occupied cell in a 16³ authored buffer passes through actual MeshSession/Node worker transfers in both source modes: client color differs from stored color, cache/picking owners remain intact and source arrays remain unchanged. One edge position separately checks typed missing-halo diagnostics. This is not a terrain-volume comparison.
- `biome-blend-ui-smoke.mjs` checks actual dialog/render/persistence functions with controlled hosts, including both preference rollback and biome-specific empty-view guidance. `native-environment-smoke.mjs` checks two native context seeds and one 16³ Wasm-worker metadata handoff with zero voxel-value comparisons.

Actual browser/GPU execution, measured sampling performance, production biome-source/halo equivalence, custom biome color metadata, complete lighting/material/filter behavior, full native terrain/reference provenance, authorized F8thful assets and final comprehensive verification remain open. All terrain/client/release qualification flags stay false.
