# Architecture decisions

Status: proposed boundaries, grounded in the Phase 0 source audit. No application packages have been scaffolded before the engine feasibility gate.

## Three runtime responsibilities

| System | Responsibilities | Boundary |
| --- | --- | --- |
| Pack server | Static delivery; pack discovery, authorized file reads/writes, schema validation, backups, optimistic concurrency | Never generates chunks, noise, heightmaps, meshes, or previews |
| Browser editor | Schema controls, resource navigation, lossless edits, history, local validation, preview scheduling, resource-pack imports | Unsaved state, coordinates, caches, and custom resource packs remain local |
| Browser engine workers | Pinned Iris generation, dependency resolution, bounded local data and deterministic output | Native development reference services are never used as a runtime fallback |

Generation output is consumed locally by both visualizers. Rendering uses WebGPU; capability failure disables GPU visualization while preserving pack editing. Resource-pack changes invalidate model/texture resources; camera changes do not regenerate terrain.

## Engine reuse strategy

First isolate a real Iris `NoiseStyle`/VolmLib `RNG`/`CNG` call graph and compile that exact source using TeaVM Wasm GC. Investigate TeaVM JavaScript only if the first backend has a demonstrated blocker. Hand ports require native deterministic evidence; there is no approximate fallback.

The pinned Iris source already exposes platform services in `spi/`, native block-state interfaces in VolmLib, and development probes in `probe/`. These are useful boundaries, but browser feasibility is not established by their existence. The stub probe platform cannot stand in for a complete Minecraft block registry or exact platform material behavior.

Schemas should be exported during a pinned native build. Runtime Java reflection must not become a browser schema dependency. Browser asset and pack IO should use immutable in-memory resources while preserving original bytes/unknown fields for save operations. File operations remain confined to the configured server pack root.

## Generation protocol requirements

The eventual worker protocol carries a job ID, revision, pinned engine identity, pack digest, dimension, signed 64-bit seed as a decimal string, coordinates, requested bounds, and generation settings. Completion is applied only if job and revision are still current. Cooperative cancellation must be checked within bounded work units; obsolete messages alone do not cancel synchronous computation. Queues and caches need explicit memory budgets. These requirements are not implemented by this foundation.

## Planned code boundaries

After the proof of concept, use `apps/web`, `apps/server`, and separate packages for engine, configuration, resources, renderer, resource packs, and shared contracts. Start with only modules needed by the proved generation path. Development-only reference/export tools live under `tools/reference-tests`; generated game assets remain local unless distribution rights are established.

### Registered Overworld mode ownership

The bounded Overworld route uses original ModeOverworld/EngineMode generation with the original Mantle registration and TERRAIN/CONTENT scheduler. Owned sparse chunks replace storage services; native order, prerequisites, flags, lazy terrain-on-access and algorithms remain authoritative. A non-writing observer checks all four terrain/nine content stages and restores actual stage objects before close. A native generation lease owns the synchronous operation.

Each immutable terrain snapshot owns two separate native object-cache domains: registered mode generation and standalone procedural diagnostics. Native component field hosts capture their domain at construction. Each domain has 8 MiB plan/4 MiB continuation limits; snapshot release closes both. Neighbor/mode requests can share the immutable terrain context while preserving this separation. Retained native continuation bytes do not implement saved-world history restoration. Imported placement/custom/hydrology services and full IrisEngine/REAL/world lifecycle remain explicit unfinished boundaries.

### Native tile publication and asynchronous ownership

Scalar and voxel generation use a shared result-publication boundary. Native CNM bytes and cache diagnostics are captured synchronously for the owning snapshot before asynchronous hashing/storage. Current-request guards precede restore, storage mutation, result publication and temporary-snapshot release. Retained contexts skip repeat restore after style construction. Corrupt-record deletion carries its guard through IndexedDB opening/transaction entry, and delayed context releases check that the worker remains idle before clearing native state. The existing per-snapshot/global encoded-byte budgets and original native FloatCache codecs remain unchanged.

### PNG raster identity

PNG decoding preserves raw band values and the pinned JDK raster/color-model shape. Packed rows are unfiltered before bit extraction; indexed rasters keep index bands plus a bounded owned RGBA palette. Palette transport has a separate native registration entry; decoded bands/palettes count toward existing snapshot limits. Original IrisImage classifies formats and supplies up to eight inspector pixel samples. Original map compiler validation remains the authority on map eligibility; inspecting a source does not convert indexed/gray-alpha/high-depth inputs into supported maps.

### Image-map authoring requests

`sample-image-map` loads an owned snapshot, compiles the selected map with the original Iris compiler, and evaluates at most sixteen finite coordinate pairs. Native `containsWorld` and `containsWorldForSampling` describe the source rectangle/kernel before outside handling. Per-point native errors accompany successful points; compilation/registration failures abort the request. The worker releases the snapshot only while it still owns the request. GenerationClient cancellation invalidates sampling requests as it does resource inspection. No terrain request or persistence write is required.

Packed-gray transparency creates the same 8-bit gray/alpha raster as the pinned JDK PNG reader. The adapter deliberately preserves its order: scale gray, then compare the scaled sample to the unscaled transparency key. Nontransparent packed gray retains its indexed raster identity.

### Texture ownership and atlas commits

ResourcePackStack owns decoded bitmaps. PNG headers admit a byte charge before asynchronous browser decoding; pending requests count against the same 64 MiB budget as retained results. Failure removes the cached promise and releases its charge. Disposed stacks reject new work and close late results. TextureAtlas borrows those bitmaps and owns its canvas/GPU texture. Duplicate adds share work; a new entry commits shelf space after successful metadata checks, referenced-frame alpha classification and first upload. Each uploaded rectangle includes a refreshed one-pixel gutter. No mipmap generation is claimed.

A resource-pack replacement installs its next stack before awaiting disposal and uses a revision to suppress superseded completions. WorldRenderer pauses old atlas uploads before old source bitmaps close; its existing GPU texture can still draw. The new atlas starts live when its mesh commits. All of this affects appearance/resource ownership; it does not regenerate or change voxel contents.

### Original native double-column caches

CachedDoubleStream2D retains its original WorldCache2DDouble dependency, including the original getBatch implementation. Only its concurrent linked-map service is bound to WorkerChunkCacheMap, whose map capacity is capped at 256 chunks. Native recent-chunk and temporary batch-owner references still follow original behavior. ChunkCache2DDouble retains per-slot state/publication code with private worker byte/double array access. Unique misses, provisional sampling, special double values and publication winners remain native decisions. The old batch-rejecting double-cache shim is removed; the separate object-valued memoization adapter remains.

Terrain release detaches the exported context before teardown, seals native sessions, calls original IrisComplex.close and then releases registration/object domains/references in finally paths. Terrain-only release preserves the immutable pack; full clear replaces the pack/config ownership even when teardown reports a failure. This is worker snapshot cleanup, not saved-world shutdown/history persistence.

### Stored voxel cross-sections

A shared bounds module maps world-coordinate whole-block section settings to half-open local intervals. The mesher, picker and camera use the same interval; empty intervals produce no geometry/hit/focus target. Section remeshing retains the committed model/atlas/occlusion data and original voxel buffers, iterates only selected cells and commits bounds with the matching mesh result. Worker ownership prevents superseded jobs from publishing geometry. Main-thread render ownership disables section changes while a replacement volume/model set is loading.

The UI persists section settings independently of generation parameters and cache keys. Asset/volume rebuilds apply those settings; section edits never call the generation client. Picking returns available stored block/biome/generation values and ignores missing model entries. Camera framing uses the retained bounds, while point/block focus validates that the target still belongs to the committed visible volume. This is whole-voxel selection rather than fractional triangle clipping or exact texel picking.
