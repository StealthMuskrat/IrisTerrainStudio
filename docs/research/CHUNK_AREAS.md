# Native destination chunk areas

Registered Superflat/Enclosure/Islands and Overworld terrain/full-mode previews now accept a bounded chunk area. The toolbar offers 1×1, 2×2 and 4×4. New workspaces default to 2×2; earlier saved controls and setups retain their previous single-chunk behavior. Intermediate stage and isolated procedural diagnostics retain their narrower single-chunk scope. Rectangular areas up to four chunks per axis are also admitted by the generation interface.

The selected coordinate is floored to its containing chunk. The first chunk is shifted by half the requested edge, rounded down. Thus a 2×2 area selected at X/Z zero starts at -16/-16; 1×1 preserves the previous containing-chunk rule. Every destination invokes the existing original native generator. The area code copies those results without interpolation, synthesized materials or a second terrain algorithm.

The worker retains one immutable native pack/dimension/seed context across destinations. It hashes that snapshot once per area, uses the existing separate native plan/cache domains and saves browser noise-cache persistence at the end of the area. Requests remain serialized. Cancellation terminates synchronous native work through the existing client owner; cooperative yields also stop copying obsolete destinations. A failed or cancelled area publishes no partial replacement. Previously retained results remain available.

Before painting, native dimension metadata admits at most 4,194,304 output cells. The assembler allocates one Uint32 block grid and, where supplied, one Uint16 physical-biome grid. It remaps exact descriptors/keys into bounded merged palettes while copying rows. Per-destination metadata has a separate 2 MiB logical retention budget, charged conservatively using four times its serialized length. This charge joins the client cache's existing voxel, biome, custom-definition and region-buffer charges.

Native region columns/spans merge without height-expanded region arrays. A mixture of column and span metadata uses one span starting at zero for constant columns. Missing region coverage or exceeded optional metadata limits omit the combined attribution with an explicit reason; native voxels survive. An area mixing destinations with and without physical-biome coverage refuses instead of inventing biomes. This includes some areas crossing the native Studio grid boundary; reduce their area or disable Studio layout.

Every destination retains its own hydrology, tile, context/session and content diagnostics. Both voxel and emitted-model picking resolve metadata for the selected chunk. Shared terrain/environment/custom-biome definitions remain stored once. Area controls participate in browser settings and portable saved setups, while retained preview descriptions identify the actual committed area. Appearance changes, clipping and camera movement retain the generated grid.

Focused validation:

```sh
node tools/checks/chunk-area-smoke.mjs
node tools/checks/view-library-smoke.mjs
node --experimental-vm-modules tools/checks/native-chunk-area-smoke.mjs
node --experimental-vm-modules tools/checks/native-chunk-area-smoke.mjs --overworld
```

Four tiny authored destinations (2,048 cells) cover reordered palettes, mixed compressed regions, negative boundaries, source ownership, actual Node meshing/picking, metadata charging, cancellation/refusal, controls and legacy setup behavior. Two 32-high native destinations per mode compare six selected material/biome probes and two region probes against the original Java entry points. Actual Wasm/worker/client transfers, cache/context reuse, retained ownership after native release and oversized-area refusal pass. These are not full volume/state comparisons, browser/GPU execution, measured performance or full terrain parity. Historical evidence retains its original pins.

The Wasm and native algorithms are unchanged. Corresponding source was refreshed after verifying 131 bridge/build Java files and unchanged upstream checkouts, together with unchanged Wasm/runtime hashes. The development distribution includes that refreshed source and the locally provisioned defaults. Release reference, browser/GPU/Docker and complete supported-scope qualification remain open. See [recorded evidence](../evidence/chunk-areas-2026-10-23.json).
