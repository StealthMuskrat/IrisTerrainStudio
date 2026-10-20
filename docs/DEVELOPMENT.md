# Application development

Development now proceeds locally in larger batches, as explicitly requested by the user. Repository pushes are checkpoints. GitHub workflows use `workflow_dispatch`; broad application verification happens after implementation. A focused check may be used to resolve the specific behavior under development.

## Current implementation

- Node 24 HTTP application and pack-file server, with no runtime package dependencies and no server generation endpoints.
- Pack discovery, folder/ZIP import, ZIP export and preservation of unrelated binary resources.
- JSON resource reads and atomic, version-checked writes; automatic backups; history restore, including deleted-resource recovery; duplicate, rename and delete operations. Possible reference matches are shown without guessing which unknown fields should be rewritten.
- Three-panel browser editor, resource search, field and raw JSON editing, undo/redo, local draft recovery, conflict resolution, keyboard shortcuts and resizable panels.
- A JSON document model that patches source text and preserves original numeric tokens, including 64-bit integers. Browser state and drafts use IndexedDB.
- Local JSON Schema loading, source-token preservation for schema bounds, exact decimal validation, local references, alternatives, conditionals, object/array constraints and Iris's legacy boolean-exclusive-bound convention. Full schema conformance and pinned native schema export remain outstanding.
- Browser worker scheduling, cancellation, bounded scalar caches, an optional primitive-noise laboratory, and a locally compiled actual Iris NoiseStyle/CNG, configured style, SeedManager, noise-layer and composite-generator module. Image maps, resource-dependent expressions, float-cache paths and full dimension terrain remain explicitly unavailable.
- WebGPU scalar-field rendering and cursor inspection; no WebGL fallback.
- Voxel storage, DDA inspection, model geometry baking, bounded typed-page worker meshing, cancellation, translucent-face distance sorting, orbit/pan/zoom camera and GPU block-model rendering modules for future authoritative voxel outputs.
- Local resource-pack ZIP loading, overlay lookup, model-parent and texture-reference resolution, blockstate variants/multipart selection, pixel-aligned texture atlases and non-interpolated texture animation.
- Development build copying and Node-only Docker deployment configuration.

## Focused check performed

A single pack-editing check exercised lossless preservation of a Java long and an unrelated object, atomic saving, backup creation and rejection of a stale file version. The experimental noise archive was installed after verifying its recorded archive, Wasm and runtime hashes. A later focused check covers exact large-integer schema bounds, alternatives/conditions and deleted-resource recovery with overwrite conflicts. The local Iris core and TeaVM module compile. The export linkage check matches 186 style names, three scalar samples and one seed derivation between native Java and Node Wasm GC; 1,152 seeded JDK adapter comparisons also match. This is a focused check, not full browser/native qualification. Comprehensive application, browser, rendering, deployment and terrain verification has not been run for this development batch.

## Remaining implementation

The complete Iris browser engine is not connected. Region/biome selection, terrain heights, volumetric terrain, caves, hydrology, surfaces, deposits, decorators, objects and trees are not implemented in the application engine. Production reference qualification remains blocked by the native checksum mismatch and unresolved release dependency provenance. The editor does not fabricate previews for these modes.

The current voxel renderer is not a finished Minecraft rendering implementation: rotated UV-lock adaptation, exact weighted-model selection, fluids, authoritative biome tint inputs, complete Minecraft transparency behavior and remaining client rendering behavior still need implementation and verification. Missing or unsupported model behavior produces diagnostics rather than invented geometry. A scalar noise field is never converted to fake terrain.

Pinned Iris schemas and the Minecraft registry still need real exports. Creating an empty folder or blank JSON does not create a validated Iris dimension pack. Native resources can be duplicated as templates; existing resources are structurally edited while unknown data is preserved.

F8thful and a matching authorized vanilla asset baseline have not been supplied. Users can load their resource packs locally; they remain in that browser. Full parity, application verification and release checks remain required before calling the program finished.

## Commands

```sh
npm start
npm run dev
npm run build
npm run engine:install -- /path/to/noise-rng-evidence.zip
npm run engine:setup
npm run engine:build
# Reuse the captured native classes while changing only the browser bridge:
npm run engine:build -- --reuse-native-inputs
```

`IRIS_PACKS_DIR` identifies the parent of pack folders. The default is `packs/` under the application. Set `HOST`, `PORT` and `IRIS_STUDIO_TOKEN` in `.env` when needed. Binding outside loopback requires a token of at least 32 characters. The application serves code and pack data only; preview seeds, coordinates and generated buffers are not sent to the server.

Automatic engine-tool setup currently supports Linux x64 and uses SHA-256/SHA-512 pinned JDK, Gradle and Maven archives. Other environments can provide `IRIS_JAVA_HOME`, `IRIS_GRADLE_BIN` and `IRIS_MAVEN_BIN`. Building the engine also needs git, curl, tar and Python 3. Source checkouts must match the pinned, unmodified Git revisions. The generated module, corresponding-source ZIP and license files remain local ignored build outputs.
