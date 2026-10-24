# Native flat colors and stored biome blending

Target: official Minecraft 26.3 client / format 97.1, SHA-256 `4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d`. Original client classes/assets and decompiled references remain local. The committed code contains adapters, authored probes, numeric results and source identities.

The native terrain metadata writer now exports `IrisDimension.getEnvironment()` directly. Prepared context metadata already travels through the generation worker into retained volumes. NORMAL and THE_END select default cardinal colors; NETHER selects nether colors. CUSTOM and absent environments stay explicitly unshaded with a diagnostic. Diagnostic block/biome identity views remain unlit. The adapter does not guess an environment for standalone object previews or old volumes.

## Flat model and fluid colors

`flat-lighting.mjs` follows original `CardinalLighting`, `BlockModelLighter.prepareQuadFlat`, `QuadInstance.multiplyColor` and `ARGB` operations. Direction selection uses the client's strict greater-than comparison and DOWN, UP, NORTH, SOUTH, WEST, EAST tie order over supplied binary32 normals. The model's shade-direction override takes precedence. Cardinal brightness is first packed to an eight-bit gray value, then multiplied by packed tint channels with integer truncation. Authored floating tint components are quantized to the nearest byte before these packed operations. This does not qualify all original model geometry/normal calculations.

Fluid faces explicitly retain their original top, bottom or side identity while keeping the client's upward vertex normal. Top/bottom colors use up/down brightness. Side colors use up multiplied by north or west brightness, including the Nether's different up factor. Original float32 scale/truncate behavior preserves tint alpha. Reverse fluid faces retain the same lighting identity. The mesh worker bakes these colors once per emitted quad into the existing vertex stream. Snapshot-owned inputs and section caching retain colors across clipping; picking ownership and alpha stay independent of RGB shade. The fragment shader no longer applies the old Studio directional dot-product lighting a second time. Its existing Studio fog is still an unqualified preview effect.

This is the flat cardinal color stage. World block/sky lightmaps, emission contribution, ambient occlusion, environment color processing and complete client shaders are not implemented by this adapter. Emission metadata stays visible without invented brightness.

## Explicit stored-biome box averaging

The resource-pack dialog offers a local stored-biome blend radius from zero to seven, default zero. Changing it remeshes retained data and preserves the camera; no engine generation occurs. Busy requests refuse, failed current renders restore the prior setting, and closed dialogs cannot apply new actions. The preference survives local settings restoration and GPU recovery through the existing retained render path.

Original `ClientLevel.calculateBlockTint` resolves every integer X/Z position in the square at the same Y, sums packed RGB channels and truncates the channel averages. Radius zero preserves the original single resolver color, including its alpha; positive radii produce opaque averaged RGB. Coordinate-dependent modifiers evaluate at each sample position. Lower-grass tint sources still resolve their original lower Y first. Constant/property/explicit tints are not spatially blended. Water surfaces and biome-dependent model tints use the same resolver.

The source is explicitly the retained per-block physical biome array. It is **not** Minecraft's obfuscated-seed/quart/Voronoi biome lookup. Authentic client quart data and its halo remain an integration requirement. Missing retained edge samples refuse the affected tinted faces and produce diagnostics; no clamping, fabricated neighboring biome or silent fallback is used. An interior section can use neighboring stored samples outside the visible clip. Each mesh request admits at most four million actual resolver samples and 32,768 cached answers/errors; exceeding the work budget refuses the mesh with a smaller-area/radius instruction. No full palette/state enumeration is added.

## Focused evidence

- `capture-client-flat-lighting.py` verifies the locked client and executes original flat-lighting/packed-color methods for 28 small model cases and four direction decisions. Three original ClientLevel averaging calls inspect 1, 9 and 25 positions. Only Minecraft options access and biome lookup are hosted; the original averaging method body, cursor and packed arithmetic execute unchanged. An explicit authored resolver supplies colors at those positions. No world or GPU starts.
- `capture-client-fluid-lighting.py` runs the original fluid tesselator on one isolated water cell in each cardinal profile and captures actual vertex colors. Its small level/material carriers provide owned state, biome and texture addresses. The existing helper defaults remain unchanged for older requests.
- `client-flat-lighting-smoke.mjs` compares those references and uses the real Node mesh worker through MeshSession to check color transport, caching, original picking ownership, missing-halo diagnostics and work refusal. `biome-blend-ui-smoke.mjs` checks the actual dialog/render/persistence functions with a controlled host. The small cell-view check uses current raw uploads rather than stale canvas assumptions.
- `native-environment-smoke.mjs` checks two original native environment outputs and one 16³ native worker metadata handoff. It inspects metadata only, with zero voxel-value comparisons. The browser engine is rebuilt with reused native inputs; no registry or state-pair re-export runs.

These are selected implementation checks. Actual browser/GPU rasterization, full geometry/lighting/filtering/biome coverage, authorized F8thful assets, native terrain parity/provenance and final comprehensive verification remain open. All qualification flags stay false.


The later [seeded biome integration](MINECRAFT_BIOME_SAMPLING.md) adds native seed hashing/eight-corner selection over an explicit offline-writer quart projection, alongside the original stored source. It does not qualify production visible-biome grid/halo equivalence; the earlier evidence above keeps its historical source and scope.
