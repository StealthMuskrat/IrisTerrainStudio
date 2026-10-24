# Roadmap and gates

No calendar estimates are assigned before browser feasibility is demonstrated. Phase numbers and completion gates follow the implementation specification.

| Phase | Result | Completion gate | Current state |
| --- | --- | --- | --- |
| 0 | Immutable dependency inventory, architecture, native reference setup, browser feasibility report, asset provenance | Real Iris functionality runs in a browser-compatible environment, or exact blockers are demonstrated and resolved before implementation advances | Candidate primitive/RNG JVM/Wasm proof passes; Iris core compiles, but native checksum fails; dependency/schema/registry gates remain open |
| 1 | Supported-path generation proof of concept | Exact native/browser noise, seeds, regions, biomes, heights, and minimal voxel output for a stated real-pack subset | Native scalar, volumetric, registered terrain/content and bounded multi-chunk paths connected for documented subsets; selected original JVM/Wasm comparisons pass; complete supported-scope and actual browser qualification pending |
| 2 | Native pack editor and safe server IO | Schema-driven editing, references, unknown-field preservation, undo/redo, atomic saves, backups and conflict tests | Local editor/server, lossless changes, references/search/problems, undo/drafts/history/conflicts, native starter and pack-specific schemas implemented; shipping schema provenance and final integration qualification pending |
| 3 | WebGPU 2D visualizer | Real engine outputs, navigation, revision-aware workers and invalidation; exact parity remains passing | WebGPU scalar/category views, range/legend/sample exploration and retained-volume coordinate focus implemented; final browser/GPU verification pending |
| 4 | WebGPU 3D voxel renderer | Actual voxel chunks, correct block models/states, clipping and inspection; measured rendering behavior | Stored native areas, model/fluids/tints, sections, greedy geometry, camera, picking and retained GPU buffers connected; asynchronous startup validation and visible diagnostics implemented; actual browser/GPU qualification pending |
| 5 | Remaining in-scope terrain systems | Feature-by-feature native/browser regression evidence across volumetric, cave, subterrain, river, material, ore, decorator, object and tree systems | Volumetric/cave/subterrain/hydrology/material/deposit/decorator and procedural object/tree/ruin authoring connected through original registered mode ordering for bounded documented paths; layered/Studio/custom-biome inputs and tile inspection connected. Complete in-scope option/interactions, platform adapters and native/browser parity remain unqualified |
| 6 | Resource-pack system | Authorized F8thful/default baseline, local ZIP imports, dependency resolution and non-cube models; switches preserve voxels | Supplied F8thful default and matching vanilla baseline provisioned locally; source-preserving dependency optimization, pack precedence, contextual models, raw animated mipmaps, fluids/tints/culling and flat cardinal colors connected. Complete target compatibility, required parser/geometry options and actual client/browser rendering qualification remain open |
| 7 | Performance, deployment and release | Measured budgets, full applicable parity/security/integration tests, Docker/persistence checks and documentation | Development packaging implemented; comprehensive release checks deferred until completion |

## Working process

Track acceptance criteria in GitHub issues. Link each implementation PR to its phase and prerequisite issues. Keep PRs small enough to review against the pinned source. Record test commands, failed/unavailable checks, and remaining blockers. Close issues only when the acceptance evidence is present. Native execution and browser execution are separate results; foundation CI does not certify either.

The native authoring graph now loads through worker memory snapshots and typed loaders, with real registry keys, predicates and property descriptors exported. The Java registry adapter and actual native compatibility walker are now connected, with ordinary region selection. Inferred biome variants and focused/buffet region restoration are now connected. Native biome/height composition, material diagnostics and binary object resource inspection are now connected. Isolated procedural variant previews now run the native pools. Manual single placement now uses native source plans, destination transactions and populated ephemeral matter across a bounded 3 × 3 window. Native source diagnostics now run source seeding, chance/density and tree callbacks; the neighborhood mode combines native source enumeration/private-plan building into one destination transaction. Native modded-platform state rotation is now connected through typed property handles and native math. Native edit-state merging is connected for explicit diagnostic placement rules; native procedural entry types do not expose these rules. Modern tile envelopes, explicit native Studio biome layouts and generated ruins are connected for the recorded subsets. Remaining work includes tile continuation/legacy and custom-state adapters, correct full-mode completion/REAL lifecycle, collision qualification and complete mode sequencing. Imported structures remain excluded. Authoring inspection does not qualify terrain.

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


Native source-plan cache ownership, bounded memory continuation encoding, snapshot reuse and cleanup are now connected together. The explicit browser profile compiles without the unrelated server inventory EcoItems provider, while the full reference remains unqualified. Cold builds capture native class/property inputs without automatic state/pair exports. The original object-layer entry point and native vine/multiface correction are now connected. Historical fragment replay is tied to saved-world transitions, not an extra ordinary-preview pass. Owned PNG/image-map resources, original native compilation/sampling, generator styles and dimension height/mask bindings are now connected. That earlier checkpoint preceded the later expression/float-cache, registered-mode, hydrology, modern tile and custom-biome authoring implementations. Their individual boundaries and qualification limits remain in the linked evidence; saved-world REAL/history replay is not an additional ordinary authoring pass. See the scoped [batch notes](DEVELOPMENT.md#native-cache-session-and-continuation-batch).


## Remaining completion sequence (2026-10-23)

Implementation and qualification remain separate gates. Recent geometry/biome, modern tile-payload, native Studio-layout, procedural ruin, shared rounding and custom biome authoring batches close bounded implementation gaps; they do not close the terrain, browser or release gates.

| Work | Evidence needed to finish | Existing tracking |
| --- | --- | --- |
| Native reference/dependency identity | Explain the unchanged checksum failure and establish exact release artifacts/registry/schema provenance | #2, #3, #15 |
| Remaining supported terrain options/platform paths | Complete required native terrain option/platform coverage and interactions against an explicitly stated supported pack; saved-world/gameplay lifecycles are not ordinary new-terrain authoring | #6, #10 |
| Remaining Minecraft rendering | Finish required model/filter/parser and supported-terrain appearance coverage; verify native biome/environment interpretation and real shader/renderer execution. World simulation is excluded | #9, #11 |
| Authorized default assets | Supplied input is pinned and locally provisioned; selected real roots/animation/mesh checks pass. Complete target compatibility and client/browser qualification remain | #5 |
| Actual browser execution | A working browser/GPU environment; prior verified Chrome exited with SIGTRAP before navigation | #4, #8, #9 |
| Final program verification | After implementation: complete applicable native/browser/integration/security/deployment and measured performance checks | #12 |

Custom biome authoring now connects native physical identities and retained generated definitions through ephemeral worker handles, including colors and exact definition download. The original factory/actuator are exercised against a virtual-key JVM fixture; this does not close live registry epochs, production custom contributions, history/world lifecycle or full option coverage. See [scope](research/CUSTOM_BIOME_AUTHORING.md).

Diagnostic greedy meshing and emitted-corner spatial picking now reduce redundant geometry/triangle work for the recorded stored fixtures. Individual voxel/biome selection, clip/cache ownership and current alpha/material tests remain connected. Full textured merging and measured browser/GPU performance remain unqualified; see [scope](research/DIAGNOSTIC_MESH_PICKING.md).

New pack creation now publishes the pinned native starter atomically, and unstacked chunk inspection retains original native region columns with region-color views. These close functional workflow gaps; vertical region attribution, required assets, provenance and actual browser/final qualification remain open.

Static opaque full-sprite cube snapshots now support texture-preserving greedy emission and cell picking; complex models retain their original emitter. Standalone/container startup now has an engine preflight, bounded build context, liveness and documented persistence/HTTPS. At that checkpoint final completion remained blocked by absent F8thful input, unresolved native reference/dependency qualification and unavailable actual browser/GPU/Docker execution. The supplied-input record below closes the missing archive blocker. These are not passed acceptance gates.

Local authorized defaults now have dependency-trimmed provisioning, authenticated automatic loading and opt-in packaging. Stacked regions retain native vertical spans for columns without occupied host-subterrain overrides. Latest-stable audit observed 4.3.5 published October 22, the following development upgrade updates source pins and tree/replay codec boundaries. Historical 4.3.4 evidence is not 4.3.5 qualification.

The 4.3.5 development bridge now builds with a synchronized API candidate. Canopy conditions, bounded root-grounding maps, schema/inventory pins and runtime input admission are updated; narrow native/Wasm/worker and standalone checks pass. Historical registry bytes are retained using exact relevant source/server identities. Shipping dependency provenance and full supported-scope browser/native qualification are still required; no earlier evidence is relabeled.

The supplied F8thful archive is now provisioned as the installation default with the exact vanilla fallback. All original block definitions and source metadata survive optimization. Per-model dependency reuse removes redundant variant work; selected real model/animation/mesh checks pass. The original declaration remains incompatible with target 97.1, so complete rendering compatibility is still a qualification item. See [asset evidence](evidence/f8thful-defaults-2026-10-23.json).

The original checksum assertion now reproduces the historical aggregate on 4.3.5 as well. Exactly one selected JUnit method was run, with source and captured artifacts verified; no full native suite or original expectation was changed. [Current failure evidence](evidence/native-noise-checksum-4.3.5-2026-10-23.json).

Registered native terrain previews now support bounded multi-chunk areas, destination-owned diagnostics, merged block/biome/region transport and saved size controls. Focused original Java/Wasm area probes pass; larger native combinations and browser/performance qualification remain open. See [area scope](research/CHUNK_AREAS.md).

GPU startup and displayed diagnostics now have explicit validation/cleanup and portable reports. Scalar previews no longer access voxel-only chunk metadata. A particle-only native chest model is reported and remains inspectable as identity cells. Controlled-device and Node-worker checks pass; actual shader/browser/GPU qualification remains open. [Rendering validation](research/RENDERING_VALIDATION.md).

Native image maps now accept the pinned JDK reader’s static PNG semantics for ICC/HDR/APNG ancillary chunks, with source inspection notes. Resource-pack filters now admit bounded capturing/noncapturing groups, counted/reluctant repetitions and absolute anchors through non-backtracking states and native ASCII class parsing. Six tiny original JDK/Iris image cases and 78 original Java predicate answers pass; actual browser/client qualification remains open. [Scope](research/NATIVE_PNG_AND_FILTERS.md).
