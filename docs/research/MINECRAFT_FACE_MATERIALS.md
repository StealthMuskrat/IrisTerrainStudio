# Native face materials and alpha cutout

Target: official Minecraft 26.3 client / format 97.1, SHA-256 `4508d006323f24fa02876310c192d739af56516eb259000ac50f0909a68c9a2d`. The reference reads original `SpriteContents.computeTransparency`, `NativeImage.computeTransparency`, `FaceBakery.computeMaterialTransparency`, `ChunkSectionLayer`, `RenderPipelines` and `CuboidModelElement.Deserializer`. Proprietary classes, assets and decompiled source stay local; only adapter code, numeric policies and hashes are committed.

## Transparency is selected per face

An atlas entry records whole-source-sheet transparency once. Exact zero alpha and intermediate alpha are distinct flags. Full-frame UVs use the original whole-sheet flags, including unused animation frames, as native `SpriteContents` does. Partial UVs use original float32 normalization, floor/ceil bounds and each unique selected frame. Static/disabled animation samples the top-left frame for partial UVs. Reversed and empty rectangles retain original behavior. Out-of-image reads refuse where the original methods refuse; an entirely opaque source takes the native early return. Classification occurs before model/UV-lock transforms, matching `FaceBakery`.

Native interpolation does not promote a binary-alpha sprite to a translucent material. The selected layer remains cutout while frames interpolate, so its proper alpha test applies to intermediate colors. A face's `force_translucent` material overrides classification. Each immutable atlas entry has a 32-answer LRU for partial UV rectangles. Whole-source and uncached rectangle work share an explicit 32 Mi-pixel cumulative inspection budget per atlas; at most 1,048,576 source pixels are admitted per sheet. Charging is conservative and includes work spent on failed attempts. These are source pixel reads, not block-state or state-pair checks.

## Mesh, shader and picking contract

The original terrain pipeline metadata supplies these policies:

| Layer | Alpha cutoff | Back-face culling |
| --- | ---: | --- |
| SOLID | 0 | Yes |
| CUTOUT | 0.5 | Yes |
| TRANSLUCENT | 0.1 | Yes |

The fragment shader rejects alpha strictly below the selected cutoff after tint multiplication. A compact float32 vec4 per quad carries cutoff, shade-direction index, native model light-emission metadata and culling policy. Vertex geometry keeps its existing 48-byte layout. Material arrays travel through actual worker transfers, section-cache accounting and flattening. GPU storage buffers use the same bounded retained owner as vertex/index buffers; opaque and translucent draws bind their respective material stream. Indexed transparent sorting retains original vertex indices, so material indexing remains tied to the original quad. Material rows are validated once per immutable result and shared by GPU upload and picking, avoiding duplicate validation passes.

Picking uses the same cutoffs with float32 alpha multiplication and the captured back-face rule. The inspector exposes selected material metadata. Base-level nearest alpha is used for picking; this does not qualify exact agreement with minified/mip-filtered GPU pixels or triangle raster edges. Older standalone picker records without material arrays retain their legacy behavior, but the renderer explicitly refuses a worker result missing current material buffers.

The current model parser retains `shade_direction_override` and `light_emission`, including the native numeric truncation for supported finite int-range inputs. Unknown direction names, strings in numeric fields and out-of-range values refuse. The native parser ignores legacy `shade`; this adapter does too. The later [flat-color adapter](MINECRAFT_FLAT_LIGHTING.md) applies retained shade overrides using native environment/cardinal inputs. Emission stays metadata-only; world lightmaps, AO, complete environmental lighting and the existing Studio fog remain unqualified.

## Focused reference and limits

`python3 tools/checks/capture-client-face-materials.py --write-inputs` verifies the existing locked client and captures five tiny sheets (80 source pixels), thirty UV decisions, three terrain pipeline policies and eight model-metadata decisions. Selected original image/sprite method bytecode executes with native image allocation replaced by owned Java storage, `MemoryUtil.memIntBuffer` redirected to an owned buffer view and animation frame addressing supplied by a small host using the original row/column formula. Pixel classification and sprite UV/unique-frame decisions execute original method bodies. Original layer/pipeline objects and element deserializers execute unchanged; no GPU or world starts.

`node tools/checks/client-face-materials-smoke.mjs` compares that evidence and sends four stored model faces through the actual Node worker and transfers. It checks whole-sheet/partial-UV distinctions, binary-alpha animation classification, forced translucency, section reuse, material ownership, indexed sorting, controlled GPU bindings, alpha boundaries, back faces and malformed-result refusal. Small current picking and mipmap checks exercise the affected shared paths with retained references. No native terrain rebuild/generation, registry/state/pair sweep, broad suite or GitHub workflow runs. The historical canvas-based picking fixture now uses the retained raw-alpha plane and current native cutoff/back-face expectations; its refreshed result stays local rather than overwriting old evidence.

Actual browser/WebGPU shader execution and filtering, complete geometry/options, world lightmaps/AO/environment lighting, biome jitter/blending, supplied F8thful assets, native terrain/reference/release qualification and final comprehensive verification remain open.
