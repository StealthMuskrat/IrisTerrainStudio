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
- Browser worker scheduling, cancellation, bounded scalar caches, an optional primitive-noise laboratory, and a locally compiled actual Iris NoiseStyle/CNG, configured style, SeedManager, noise-layer and composite-generator module, plus raw native dimension continent/region control fields. The latter are control noise, not selected regions/biomes or completed terrain. Image maps, resource-dependent expressions, float-cache paths and full dimension terrain remain explicitly unavailable.
- WebGPU scalar-field rendering and cursor inspection; no WebGL fallback.
- Voxel storage, DDA inspection, model geometry baking, bounded typed-page worker meshing, cancellation, translucent-face distance sorting, orbit/pan/zoom camera and GPU block-model rendering modules for future authoritative voxel outputs.
- Local resource-pack ZIP loading, overlay lookup, model-parent and texture-reference resolution, blockstate variants/multipart selection, pixel-aligned texture atlases and non-interpolated texture animation.
- Development build copying and Node-only Docker deployment configuration.

## Focused check performed

A single pack-editing check exercised lossless preservation of a Java long and an unrelated object, atomic saving, backup creation and rejection of a stale file version. The experimental noise archive was installed after verifying its recorded archive, Wasm and runtime hashes. A later focused check covers exact large-integer schema bounds, alternatives/conditions and deleted-resource recovery with overwrite conflicts. The local Iris core and TeaVM module compile. The export linkage check matches 186 style names, three scalar samples and one seed derivation between native Java and Node Wasm GC; 1,152 seeded JDK adapter comparisons also match. A separate focused native Gson/snippet integration check matches three generator samples; broader generated-reader and browser qualification remain pending. This is a focused check, not full browser/native qualification. Comprehensive application, browser, rendering, deployment and terrain verification has not been run for this development batch.

A focused Node Wasm check loads all four unchanged resources from the upstream `terrain3d-pack` fixture through the new native memory loaders, and checks missing/dotted resource names and path guards. It also checks exported block predicates, partial-property matching, ore conversions and native metadata consistency. It does not execute terrain generation or establish browser/native parity. [Checkpoint evidence](evidence/native-memory-pack-development-2026-10-20.json) records the exact build and fixture hashes.

## Remaining implementation

The complete Iris browser engine is not connected. Region/biome selection, terrain heights, volumetric terrain, caves, hydrology, surfaces, deposits, decorators, objects and trees are not implemented in the application engine. Production reference qualification remains blocked by the native checksum mismatch and unresolved release dependency provenance. The editor does not fabricate previews for these modes.

Native configuration loading now reaches the actual `IrisData` ownership graph through memory IO. The compatibility gate deliberately remains in its native unready branch and records an incomplete report: the JVM reflection walker and the browser Java platform registry adapter are not linked. No terrain entry point may treat authoring loads as a successful compatibility check. Java expression bytecode compilation, static-object validation, binary object/image/matter loading and full native parser syntax remain outstanding. The JavaScript state adapter currently accepts the editor's simple unquoted property syntax; it does not implement every Minecraft command parser form. Object cache capacity is a worker-local 32 MiB platform budget.

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
