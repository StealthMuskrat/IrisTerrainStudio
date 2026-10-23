# Roadmap and gates

No calendar estimates are assigned before browser feasibility is demonstrated. Phase numbers and completion gates follow the implementation specification.

| Phase | Result | Completion gate | Current state |
| --- | --- | --- | --- |
| 0 | Immutable dependency inventory, architecture, native reference setup, browser feasibility report, asset provenance | Real Iris functionality runs in a browser-compatible environment, or exact blockers are demonstrated and resolved before implementation advances | Candidate primitive/RNG JVM/Wasm proof passes; Iris core compiles, but native checksum fails; dependency/schema/registry gates remain open |
| 1 | Supported-path generation proof of concept | Exact native/browser noise, seeds, regions, biomes, heights, and minimal voxel output for a stated real-pack subset | Native style/generator/region/biome/procedural-height paths connected; focused native/Node comparison passes; volumetric columns/occupancy connected; native painting-stage voxels connected; remaining stages and browser qualification pending |
| 2 | Native pack editor and safe server IO | Schema-driven editing, references, unknown-field preservation, undo/redo, atomic saves, backups and conflict tests | Local server/editor implemented; pinned schemas and final integration pending |
| 3 | WebGPU 2D visualizer | Real engine outputs, navigation, revision-aware workers and invalidation; exact parity remains passing | WebGPU scalar/category views, range/legend/sample exploration and retained-volume coordinate focus implemented; final browser/GPU verification pending |
| 4 | WebGPU 3D voxel renderer | Actual voxel chunks, correct block models/states, clipping and inspection; measured rendering behavior | Voxel/model/meshing/inspection modules, triangle/alpha picking and face selection, world-aligned section/frustum draw ranges and retained GPU buffers implemented; actual native painting-stage chunks connected; remaining chunk stages and rendering qualification pending |
| 5 | Remaining in-scope terrain systems | Feature-by-feature native/browser regression evidence across volumetric, cave, subterrain, river, material, ore, decorator, object and tree systems | Native volumetric runtime, cave profile/component selection, configured carving bands, cave materials and native Overworld post-processing, floating-child-biome solids and natural cave decoration, deposits, matter insertion, surface/floating decoration and perfection connected; native binary object inspection, isolated variants and native transactional single placement and bounded manual source-plan replay and native source chance/density/tree callbacks and original object generateLayer with snapshot-owned native plan cache and memory continuation bundles connected; original native vine/multiface face correction connected; in-scope procedural content placement, custom blocks, full mode ordering and remaining terrain systems pending; native image-map compilation, PNG resources, style/height-mask integration connected for a bounded PNG subset |
| 6 | Resource-pack system | Authorized F8thful/default baseline, local ZIP imports, dependency resolution and non-cube models; switches preserve voxels | Resource-pack stack, target overlays/filter subset, raw animated atlas/interpolation, contextual weighted/multipart models, Z rotations/UV lock, dependency export, role/default controls and optional persistence implemented; native fluid/tint/material/mipmap and flat cardinal colors, optional stored-biome blend and native cuboid rotation/winding implemented; supplied default baseline, authentic client biome lookup/world lighting and full browser/rendering qualification pending |
| 7 | Performance, deployment and release | Measured budgets, full applicable parity/security/integration tests, Docker/persistence checks and documentation | Development packaging implemented; comprehensive release checks deferred until completion |

## Working process

Track acceptance criteria in GitHub issues. Link each implementation PR to its phase and prerequisite issues. Keep PRs small enough to review against the pinned source. Record test commands, failed/unavailable checks, and remaining blockers. Close issues only when the acceptance evidence is present. Native execution and browser execution are separate results; foundation CI does not certify either.

The native authoring graph now loads through worker memory snapshots and typed loaders, with real registry keys, predicates and property descriptors exported. The Java registry adapter and actual native compatibility walker are now connected, with ordinary region selection. Inferred biome variants and focused/buffet region restoration are now connected. Native biome/height composition, material diagnostics and binary object resource inspection are now connected. Isolated procedural variant previews now run the native pools. Manual single placement now uses native source plans, destination transactions and populated ephemeral matter across a bounded 3 × 3 window. Native source diagnostics now run source seeding, chance/density and tree callbacks; the neighborhood mode combines native source enumeration/private-plan building into one destination transaction. Native modded-platform state rotation is now connected through typed property handles and native math. Native edit-state merging is connected for explicit diagnostic placement rules; native procedural entry types do not expose these rules. Remaining work includes tile/custom-state adapters, correct full-mode completion/REAL lifecycle, collision qualification and complete mode sequencing. Imported structures remain excluded. Authoring inspection does not qualify terrain.

Development proceeds locally in coherent implementation batches under the user's 2026-10-20 instruction. GitHub pushes are checkpoints and workflows are manual. Use focused local checks to resolve specific problems; reserve comprehensive program verification for the completed implementation. Dependency provenance, native schema/registry capture and full browser terrain generation remain required for release. Asset provenance work can proceed independently without bundling assets.

## GitHub work queue

Immediate blocker: [#15 — explain the native checksum mismatch](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/15). The core compiles and the browser primitive/RNG experiment passes; the pinned native baseline still prevents qualification.

| Priority | Work | Tracking |
| --- | --- | --- |
| P0 | freeze VolmLib provenance and reproduce the Java 25 reference build | [#2](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/2) |
| P0 | export pinned schemas, registry, and native noise reference captures | [#3](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/3) |
| P0 | execute real Iris noise in a TeaVM browser worker and prove scalar parity | [#4](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/4) |
| P1 | establish authorized F8thful and vanilla asset inputs | [#5](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/5) |
| P0 | extend proved generation path through seeds, biomes, heights, and voxels | [#6](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/6) |
| P1 | implement native pack editing and safe pack-management server | [#7](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/7) |
| P1 | implement WebGPU 2D views over authoritative browser outputs | [#8](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/8) |
| P1 | implement WebGPU voxel rendering and block inspection | [#9](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/9) |
| P1 | implement remaining terrain systems with per-feature exact parity | [#10](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/10) |
| P1 | implement local resource-pack loading and accurate model resolution | [#11](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/11) |
| P1 | measure performance, verify deployment, and enforce evidence-based release gates | [#12](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/12) |

Dependencies are recorded in each issue. Start with [#2](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/2); [#4](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/4) is the first browser-execution proof gate. No future monitoring or recurring task has been scheduled.


Native source-plan cache ownership, bounded memory continuation encoding, snapshot reuse and cleanup are now connected together. The explicit browser profile compiles without the unrelated server inventory EcoItems provider, while the full reference remains unqualified. Cold builds capture native class/property inputs without automatic state/pair exports. The original object-layer entry point and native vine/multiface correction are now connected. Historical fragment replay is tied to saved-world transitions, not an extra ordinary-preview pass. Owned PNG/image-map resources, original native compilation/sampling, generator styles and dimension height/mask bindings are now connected. Next: remaining state/custom adapters, expressions/float-cache resources, in-scope mode ordering and completion/REAL lifecycle, collision qualification and remaining terrain stages. See the scoped [batch notes](DEVELOPMENT.md#native-cache-session-and-continuation-batch).


## Remaining completion sequence (2026-10-23)

Implementation and qualification remain separate gates. The current cuboid batch closes the legacy element-rotation/winding boundary; it does not close Phase 6 or the project.

| Work | Evidence needed to finish | Existing tracking |
| --- | --- | --- |
| Native reference/dependency identity | Explain the unchanged checksum failure and establish exact release artifacts/registry/schema provenance | #2, #3, #15 |
| Remaining supported terrain options/platform paths | Connect remaining in-scope state/custom/object/lifecycle paths and compare with the original engine for an explicitly stated supported pack | #6, #10 |
| Remaining Minecraft rendering | Native world lightmap/AO/environment behavior, authentic quart/Voronoi biome input and remaining geometry/filter/parser options | #9, #11 |
| Authorized default assets | Supply the intended F8thful archive in the active workspace, verify identity and exercise its real dependency roots | #5 |
| Actual browser execution | A working browser/GPU environment; prior verified Chrome exited with SIGTRAP before navigation | #4, #8, #9 |
| Final program verification | After implementation: complete applicable native/browser/integration/security/deployment and measured performance checks | #12 |
