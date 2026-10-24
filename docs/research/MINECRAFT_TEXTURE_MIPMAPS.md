# Pinned Minecraft texture mipmaps

Target: official Minecraft 26.3 client, resource format 97.1, SHA-256 `4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d`. Original definitions inspected locally: `MipmapGenerator`, `TextureUtil`, `ARGB`, `MipmapStrategy`, `TextureMetadataSection`, `SpriteContents` and `SpriteLoader`. Proprietary classes, assets and decompiled source remain local. The repository retains adapter code, numeric lookup inputs and hashes.

## Native pixels and metadata

`texture-mipmaps.mjs` applies the native source-sheet order: select `auto`/`mean`/`cutout`/`strict_cutout`/`dark_cutout`, fill transparent RGB for non-item cutout sheets, generate linear-color mip levels and correct cutout alpha coverage. Item textures retain the native fill exemption. Mean RGB uses captured native 10-bit linear lookup tables; mean alpha uses integer averaging. Dark-cutout averaging and coverage/bias arithmetic retain native binary32 order, including the native one-pixel coverage behavior. Transparent fill preserves original X-then-Y seed ordering and right/left/down/up propagation ties. The source raster stays immutable.

Texture sidecars now carry the original strategy and alpha-cutoff bias through pack resolution and decoding; blur/clamp flags are validated and retained as metadata. These flags do not override the shared atlas sampler: native `SpriteContents` consumes strategy/bias for mip generation, while atlas filtering is a separate boundary. Invalid flags/strategies/bias refuse explicitly. Unknown sidecar keys and all original bytes remain in pack/dependency exports.

Mipmaps are built for the complete source sheet before extracting animated frames. Each level then uses the existing whole-tick/frame/interpolation rules independently. Generating mips after blending frames would change rounding and cutout coverage, so the atlas does not do that.

## Atlas ownership and limits

Textured world previews explicitly request up to four mip levels. The diagnostic identity atlas remains level zero. Each selected sprite's frame dimensions lower the usable global atlas level according to their minimum power-of-two divisibility, following the native `SpriteLoader` restriction. The sampler clamps to that global level. Each entry can retain additional prepared levels above the global clamp; these are unreachable through sampling. The preview uses nearest texels and linear blending between mip levels; full client texture-filter/shader parity is not claimed.

Shelf slots, sprite origins and gutters align to the requested power of two. At the deepest requested level each gutter remains at least one pixel, avoiding cross-entry bleed at the selected sampling footprint. Every animated level refreshes together on changed ticks; unchanged ticks do not upload. Picking retains base-level alpha. Failed entry uploads leave the entry map, cache charge, sampler and shelf coordinates uncommitted; constructor failure and disposal release owned GPU textures. A device failure during multi-level animation upload is not an atomic GPU transaction.

Native pixel work is admitted before preprocessing: at most 1,048,576 source pixels per sprite sheet. Retained cloned sheets and their mip levels share a separate 64 MiB CPU budget per atlas. The pack's existing 64 MiB raw decoded-image budget remains separate; GPU textures, alpha picking storage and temporary fill/coverage work are additional bounded allocations. This is not a measured total browser heap guarantee. Oversized resources produce explicit asset diagnostics.

## Focused reference

`python3 tools/checks/capture-client-mipmaps.py --write-inputs` captures nine tiny authored sheets (544 source pixels), 33 retained levels and eight original metadata-codec decisions. Its child loader executes original `MipmapGenerator` and `TextureUtil` method bytecode with only `NativeImage` allocation/pixel IO remapped to owned Java integer arrays. Original `ARGB` tables, identifiers, strategy and metadata codec execute unchanged. No native image memory, renderer, GPU or world starts. The command verifies the client against the existing lock; `--write-inputs` explicitly refreshes only the numeric lookup input.

`node tools/checks/client-mipmaps-smoke.mjs` compares every retained RGBA byte, preserves source pixels and checks one small animation sheet through actual pack decode, mip atlas upload, per-level interpolation/gutters, small-sprite clamping, base picking alpha, admission refusal, failed-entry ownership and disposal using a controlled device. The existing tiny raw-pixel texture check covers the shared gutter function's level-zero path. No terrain generation, registry/state/pair sweep, broad suite or GitHub workflow runs.

Actual browser/WebGPU sampling, complete texture-filter/anisotropy/shader/cutoff/lightmap/AO/environment lighting, biome jitter/blending, full geometry/material options, supplied F8thful assets and native/reference/release qualification remain open. Numeric pixel agreement and controlled upload descriptors are not GPU rasterization evidence.
