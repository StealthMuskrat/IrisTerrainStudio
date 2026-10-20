# Application development

Development now proceeds locally in larger batches, as explicitly requested by the user. Repository pushes are checkpoints. GitHub workflows use `workflow_dispatch`; broad application verification happens after implementation. A focused check may be used to resolve the specific behavior under development.

## Current implementation

- Node 24 HTTP application and pack-file server, with no runtime package dependencies and no server generation endpoints.
- Pack discovery, folder/ZIP import, ZIP export and preservation of unrelated binary resources.
- JSON resource reads and atomic, version-checked writes; automatic backups; history restore, including deleted-resource recovery; duplicate, rename and delete operations. Possible reference matches are shown without guessing which unknown fields should be rewritten.
- Three-panel browser editor, resource search, field and raw JSON editing, undo/redo, local draft recovery, conflict resolution, keyboard shortcuts and resizable panels.
- A JSON document model that patches source text and preserves original numeric tokens, including 64-bit integers. Browser state and drafts use IndexedDB.
- Local JSON Schema loading, source-token preservation for schema bounds, exact decimal validation, local references, alternatives, conditionals, object/array constraints and Iris's legacy boolean-exclusive-bound convention. Pack-specific native SchemaBuilder export is available; full schema conformance and production qualification remain outstanding.
- Generated native-field Gson streaming readers for 126 configuration types / 1,312 fields. Original native constructor and numerical method bytecode is retained; only config-field visibility changes in the browser compiler classpath. Style and generator snippet references resolve locally using actual native field metadata.
- Sealed worker-local native pack snapshots, typed resource loaders, lazy snippet access, native load-key/owner assignment and native load-time region/biome pool cascades. The inspector can load a selected resource with its current unsaved text and the saved pack resources. Missing resources return native lookup misses; dotted root filenames follow the native exact-first/lexicographic fallback rule. This authoring inspection is not complete pack validation or terrain generation.
- Exported native platform registry keys: 67 biomes, 52 structures, 1,658 items, 161 entity types, 43 enchantments and 40 potion effects, actual reloadable loot-table keys, plus the 1,286 blocks. Native block-property metadata retains all 122 shared descriptor groups. Browser state adapters use actual exported predicate bits, placement pairs and ore conversions, with canonical native property order and first-parse partial-property masks.
- Browser worker scheduling, cancellation, bounded scalar caches, an optional primitive-noise laboratory, and a locally compiled actual Iris NoiseStyle/CNG, configured style, SeedManager, noise-layer and composite-generator module, plus raw native dimension continent/region control fields and ordinary native region selection. The control fields are noise values; the separate region mode returns actual native region keys. The additional native scalar terrain path below supplies actual procedural heights and surface biomes. Image maps, resource-dependent expressions, float-cache paths and complete dimension terrain remain unavailable.
- WebGPU scalar-field rendering and cursor inspection; no WebGL fallback.
- Voxel storage, DDA inspection, model geometry baking, bounded typed-page worker meshing, cancellation, translucent-face distance sorting, orbit/pan/zoom camera and GPU block-model rendering modules for future authoritative voxel outputs.
- Local resource-pack ZIP loading, overlay lookup, model-parent and texture-reference resolution, blockstate variants/multipart selection, pixel-aligned texture atlases and non-interpolated texture animation.
- Development build copying and Node-only Docker deployment configuration.

## Focused check performed

A single pack-editing check exercised lossless preservation of a Java long and an unrelated object, atomic saving, backup creation and rejection of a stale file version. The experimental noise archive was installed after verifying its recorded archive, Wasm and runtime hashes. A later focused check covers exact large-integer schema bounds, alternatives/conditions and deleted-resource recovery with overwrite conflicts. The local Iris core and TeaVM module compile. The export linkage check matches 186 style names, three scalar samples and one seed derivation between native Java and Node Wasm GC; 1,152 seeded JDK adapter comparisons also match. A separate focused native Gson/snippet integration check matches three generator samples; broader generated-reader and browser qualification remain pending. This is a focused check, not full browser/native qualification. Comprehensive application, browser, rendering, deployment and terrain verification has not been run for this development batch.

A focused Node Wasm check loads all four unchanged resources from the upstream `terrain3d-pack` fixture through the new native memory loaders, and checks missing/dotted resource names and path guards. It also checks exported block predicates, partial-property matching, ore conversions and native metadata consistency. It does not execute terrain generation or establish browser/native parity. [Checkpoint evidence](evidence/native-memory-pack-development-2026-10-20.json) records the exact build and fixture hashes.

## Remaining implementation

The complete Iris browser engine is not connected. Native surface-biome selection and procedural heights are connected for the subset below. Native volumetric shaping is connected for the development subset below. The native terrain painter now supplies layer/fluid material states for the stage described below. Caves, hydrology, deposits, decorators, objects and trees remain unconnected. Production reference qualification remains blocked by the native checksum mismatch and unresolved release dependency provenance. The editor does not fabricate previews for these modes.

Native configuration loading now reaches the actual `IrisData` ownership graph through memory IO. The native compatibility walker and report-backed Java registry adapter are now linked. Generated reflection access retains native field annotations and generic types, with equivalent raw metadata for a TeaVM reflection-emitter bug. Inspector loading evaluates actual native exclusions and pool cascades. A connected gate is not production qualification or a complete pack-validation claim. Java expression bytecode compilation, static-object validation, binary object/image/matter loading and full native parser syntax remain outstanding. The JavaScript state adapter currently accepts the editor's simple unquoted property syntax; it does not implement every Minecraft command parser form. Object cache capacity is a worker-local 32 MiB platform budget.

The current voxel renderer is not a finished Minecraft rendering implementation: rotated UV-lock adaptation, exact weighted-model selection, fluids, authoritative biome tint inputs, complete Minecraft transparency behavior and remaining client rendering behavior still need implementation and verification. Missing or unsupported model behavior produces diagnostics rather than invented geometry. A scalar noise field is never converted to fake terrain.

A local Minecraft 26.3 development registry export now contains 1,286 blocks and 35,723 states, with source-JAR and report hashes. A native reflection inventory covers 126 Iris configuration types and supplies inspector descriptions and enums. The export also records 18 actual native predicates for every state and 1,611,301 allowed material-placement pairs from the unchanged headless native helper. Native SchemaBuilder now exports 70 pack-specific schemas for the actual four-resource fixture; production schema/registry qualification remains outstanding. Creating an empty folder or blank JSON does not create a validated Iris dimension pack. Native resources can be duplicated as templates; existing resources are structurally edited while unknown data is preserved.

F8thful and a matching authorized vanilla asset baseline have not been supplied. Users can load their resource packs locally; they remain in that browser. Full parity, application verification and release checks remain required before calling the program finished.

## Commands

```sh
npm start
npm run dev
npm run build
npm run engine:install -- /path/to/noise-rng-evidence.zip
npm run engine:setup
npm run engine:build
npm run engine:registry
# Reuse the captured native classes while changing only the browser bridge:
npm run engine:build -- --reuse-native-inputs
# Re-export registries from captured native dependency inputs:
npm run engine:registry -- --reuse-native-inputs
# Export native schemas for a saved authoring pack (defaults to the upstream fixture):
npm run engine:schemas -- /path/to/your/pack
```

`IRIS_PACKS_DIR` identifies the parent of pack folders. The default is `packs/` under the application. Set `HOST`, `PORT` and `IRIS_STUDIO_TOKEN` in `.env` when needed. Binding outside loopback requires a token of at least 32 characters. The application serves code and pack data only; preview seeds, coordinates and generated buffers are not sent to the server.

Automatic engine-tool setup currently supports Linux x64 and uses SHA-256/SHA-512 pinned JDK, Gradle and Maven archives. Other environments can provide `IRIS_JAVA_HOME`, `IRIS_GRADLE_BIN` and `IRIS_MAVEN_BIN`. Building the engine also needs git, curl, tar and Python 3. Source checkouts must match the pinned, unmodified Git revisions. The generated module, corresponding-source ZIP and license files remain local ignored build outputs.

## Native pack-specific schemas

The development schema exporter runs the unchanged native `SchemaBuilder` with real world and reloadable registry catalogs, actual native resource loaders and the captured native core classes. It snapshots the chosen pack without modifying it and records all file hashes. The fixture export contains seven root schemas and 63 snippet schemas. Six native metadata warnings remain: missing descriptions for subterrain family/fluid and an undefined array type for `allowedRegions`. They are preserved rather than patched into invented schema behavior. Plugin/mod/custom biome catalogs and host fonts remain unqualified.

The inspector's **Load matching native schema** action checks the complete saved resource set and file ETags before fetching a matching schema, then verifies its bytes and SHA-256. Native schemas are attached to the current selection rather than silently persisted across changed pack snapshots. Pack-specific schema URLs require the configured access token, including encoded URLs. The focused schema check passes on all four unchanged fixture resources with zero reported validation issues and rejects changed content/resource sets. Full schema conformance and browser/application verification remain deferred. [Evidence](evidence/native-schema-development-2026-10-20.json).

## Native compatibility and region selection

The worker now installs a hashed, compact native registry input with 1,286 block types / 35,723 states, actual physical predicates and placement pairs, native property ordering, entity spawn categories, leaf types and the world/reloadable key catalogs. The Java platform adapter retains first-parse property masks and native matching behavior. Its current leaf-decay policy uses the actual native generator-settings default; custom providers, custom biome catalogs and full parser qualification remain outstanding. Brigadier StringReader bytecode matches the captured Minecraft 26.3 dependency, and its pinned sources/license are retained with the module.

The actual Iris `ContentGate`/`CompatWalker` now runs against these inputs. The inspector displays its findings and exclusions. A focused native Java/Node Wasm comparison passes 18 state-parser cases, four partial-match cases and six compatibility scenarios (original fixture, missing biome, missing block, fallback, backup and a two-region input). The same check matches 192 region selections across four signed 64-bit world seeds. [Evidence](evidence/native-compatibility-region-development-2026-10-20.json).

**Native regions** selects from actual filtered pack resources with the original SeedManager, region style and `RegionSelection.select`. The map encodes native region keys categorically and shows those keys on hover. Colors identify regions; they are not terrain material colors. Focused/buffet region restoration is now connected; image-map sources remain an explicit unsupported path. The native biome/height scalar path below is now connected; voxel generation and full browser/GPU verification remain unfinished.

Local engine builds now take an exclusive lock and publish the generated field-access JAR atomically. Do not run overlapping builds; a stale lock after abrupt termination must be checked against active build processes before removal.

## Inferred biome variants and focused layouts

The browser bridge now retains the original `IrisBiome.withInferredType` control flow and inferred-variant cache. Its two Gson copy calls use generated streaming readers/writers over actual native fields. The bridge preserves constructor defaults, Gson's null-field omission, canonical field names and aliases, enum aliases and the native custom subterrain-fluid adapter. This is an internal model-copy boundary; it never rewrites the author's raw JSON or discards unknown pack fields. Complete serialization conformance is still unqualified.

The original `RegionSelection.restore` now supplies focused regions and biome-buffet region choices. The existing verified UUID/UTF-8 bridge creates native focus identifiers, and native KSet key views use supported collection interfaces. **Studio layout** enables the dimension's native studio mode for region previews. This previews region choices, not complete buffet terrain or biome/voxel composition.

The focused Java/Node comparison passes nine controlled inputs, 336 region selections across four world seeds, 28 inferred-biome views and four native Gson round-trip/error cases, in addition to the prior state/matching cases. These include a biome outside existing region pools, a native biome buffet, legacy `force` fields, null/default restoration, a large signed seed and invalid subterrain-fluid rejection. [Evidence](evidence/native-biome-focus-development-2026-10-20.json). Browser/GPU and whole-application verification remain deferred. Build locks are released in an awaited `finally` path after success or failure.


## Native procedural height and surface biomes

The browser now constructs the actual pinned `IrisComplex` with a worker-owned engine boundary. Native streams perform continent/region selection, inferred land/sea/shore pools, child selection, generator groups and interpolation, terrain sampling and shore correction. The host supplies the native pack, dimension, SeedManager, dimension bounds and a non-server-thread hook. Generated implementations throw for every unconnected native engine/host method, including interface defaults. No server runtime or substitute terrain algorithm is used.

**Native procedural height** displays the native local-height double plus the dimension minimum Y. **Native surface biomes** categorically displays actual native biome keys. Both capture the current pack snapshot, including the selected unsaved JSON, and retain the existing revision/cancellation guards. They require the generated engine and hashed native registry. **Studio layout** remains region-only; selecting it for these scalar maps reports an unsupported operation.

The memoization boundary uses bounded worker maps and private array operations, retaining native coordinate truncation and provisional-sample tracking. A nullable, runtime-owned reference replaces the native bounds sampler's weak memoization reference. The pinned TeaVM immutable-map lookup is adapted to JDK lookup semantics because an empty copied map otherwise traps on integer remainder. The existing UUID adapter now also handles the native stream UUID bit constructor. Worker settings currently use the actual native constructor defaults; custom settings snapshots and complete class-library conformance remain unqualified.

A focused comparison of eight controlled packs passes **384 native surface-biome choices and 384 exact procedural-height bit comparisons** in native Java and Node Wasm. Cases cover flat/noisy terrain, child biomes, mixed land/sea pools, focus, negative minimum Y, multiple generators and coarse sampling. The original volumetric fixture is refused, and failed preparation leaves no usable stale terrain runtime. [Evidence](evidence/native-terrain-scalar-development-2026-10-20.json).

At this scalar checkpoint, volumetric terrain, hydrology, saved-world transition contexts, transforms and upper/stacked dimensions were explicit unsupported boundaries; volumetric support is extended below. This does not qualify full packs, complete chunks, custom registries/settings, real browser/GPU execution, performance or release compatibility. No comprehensive application suite or GitHub workflow was run for this development batch. The subsequent volumetric checkpoint is described below.


## Native volumetric columns and occupancy

The unchanged `Terrain3DRuntime`, `Terrain3DFragmentFilter` and `ConcurrentClockCache` now execute in the worker. Private reference arrays supply acquire/release and identity compare/exchange operations; fragment state uses a private integer array. Cache selection, density shaping, span construction and fragment traversal remain native code.

**Native volumetric occupancy** samples the selected world Y and encodes three actual column states: unshaped, empty or solid. An unshaped column is labeled separately, not treated as empty. The native column inspection export retains local-Y span boundaries, base-height bits and complete native occupancy. Procedural height and surface-biome maps now include the connected native volumetric runtime. This still supplies no voxel block/material palette or complete chunks.

The focused Java/Node check passes 64 complete native height/biome/column comparisons across the original fixture, a more fractured configuration, negative minimum height and a biome without a volumetric profile. Shaped outputs have one through nine spans. It also checks 9,216 occupancy API answers and explicit refusal of unconnected hydrology with no stale terrain after failed preparation. A separate Node-hosted execution of the actual worker script passes 12 height/biome/occupancy message samples against the real Wasm exports, including world minimum-Y handling. This is not real browser/GPU qualification. [Evidence](evidence/native-volume-development-2026-10-20.json).

Remaining engine work includes native material/surface selection, caves, subterrain, hydrology, deposits, decorators, procedural objects/trees and full voxel output. Hydrology, saved-world transitions, transforms, upper/stacked dimensions and terrain buffet remain explicit unsupported boundaries. Comprehensive application and GitHub testing remain deferred under the development workflow.


## Native terrain painting-stage voxels

The actual `IrisTerrainNormalActuator.paint` now executes in the worker with the native `ChunkContext`, `ArrayHunk`, SeedManager terrain seed and biome layer/material generators. The output starts with the registry's air state, matching an empty block buffer, and retains the painter's exact canonical block-state results. This is a terrain-stage preview, not the completed mode pipeline: caves, later modifiers, deposits, decorators and content insertion remain absent. The checked inputs cover flat stone, grass/dirt strata, volumetric cave ceilings and native fluid/sea layers.

The context dispatch boundary executes worker tasks locally; the unchanged native scalar SIMD kernels supply rounding where needed. Unconnected platform failures carry an engine-failure cause so the native content-loop error policy aborts the result instead of silently omitting an authored layer. A focused refusal case exercises a persistent-cache request inside a biome palette layer.

**Native terrain materials · one chunk** captures the pack snapshot and paints the 16×16 chunk containing the preview coordinates. The worker transfers a typed palette-index volume with world origin and an explicit incomplete-pipeline marker. Full canonical rendering properties come directly from the installed state table, independently of first-parse matching masks. Generation caches account for voxel bytes, stale mesh jobs are cancelled, block inspection preserves the native state key, and resource-pack changes remesh retained voxel data without rerunning generation.

Volumes support heights through 4,096 within the existing 16-million-cell budget; the native painter enforces one-chunk origins and bounds. The renderer skips authoritative air states. Neighbor culling currently proves only opaque unit-cube model coverage; other shapes retain their faces pending the complete Minecraft shape adapter. Matching authorized local assets, authoritative tints, fluids, weighted-model choices and exact client rendering behavior remain required. Missing assets/models/tints are visible diagnostics, with no invented cubes or colors.

The focused native Java/Node comparison matches **16 terrain-stage chunks / 1,048,576 exact block states** across four controlled inputs and two signed world seeds. A separate Node-hosted actual worker/client check covers the 12 prior scalar samples plus a **98,304-cell** stage volume, world-Y origin, canonical state properties, tall-volume inspection, typed transfer and cache reuse. [Evidence](evidence/native-paint-development-2026-10-20.json). Browser/GPU visual verification and comprehensive application testing remain deferred; the program is not complete.


## Native dimension cave markers

The browser now executes the pinned `IrisCaveCarver3D` for the dimension's enabled cave profile, with native `IrisComplex.naturalTrueHeight` surface inputs. Its exact, adaptive and coarse density passes, module/warp contributions, vertical fades, fluid support resolution and `CavernMatter` palette encoding remain native. A new one-chunk map displays the actual markers at the selected world Slice Y: absent, air, fluid-palette, lava or forced air. It reports disabled profiles explicitly and preserves the native local/world height offset.

Only storage and host execution are adapted. Guarded call-site redirects use one ephemeral native `MantleChunk`; a cavern-only Matter section directly creates the native `CavernMatter` slice. Region IO and persistence are unavailable. Native palette bits and growth policy remain intact, with worker-private reference/long/boolean arrays, locks and permits; native diagnostic metric windows use private double storage. The platform owns an IrisWorld containing only the dimension bounds and seed, without a platform world. Nested ForkJoin dispatch returns typed null work arrays, selecting the original sequential fallback. An opaque JS host boundary avoids TeaVM's null-only primitive-array GC local inference defect; no noise values or carving decisions are computed in JavaScript.

`node tools/checks/native-cave-link.mjs` passes 24 native Java/Node Wasm chunk comparisons, totaling 1,703,936 marker cells. The six controlled inputs cover exact, adaptive, coarse, modules/warp, aquifers and negative world minimum height with lava disabled. Native liquid codes 0–3 are exercised. Disabled profiles, invalid chunk alignment and unconnected persistent caches fail; a valid request succeeds after refusal. The independent native oracle uses the real MantleWriter, MantleChunk, IrisMatter and CavernMatter and never reads or writes a world region. `node tools/checks/native-cave-worker.mjs` checks the actual worker/Wasm path, 256 world-Y slice samples, outside-height handling, disabled-profile errors, cancellation, typed transfer and cache reuse. These are scoped Node-hosted checks, not browser/GPU qualification. [Evidence](evidence/native-cave-development-2026-10-20.json) records exact inputs, artifacts and harness hashes.

This is a dimension-profile marker preview. It is not the full cave stage: biome profile selection/weighting, legacy caves/ravines, subterrain, native block resolution, cave decoration and complete Mantle/mode ordering remain unfinished. The terrain material preview still precedes caves. Next work connects these markers through the native cave resolution/stage path. Full application testing remains deferred until development is complete; no GitHub workflows were run.
