# Iris Terrain Studio

A self-hosted browser workspace for real Iris dimension packs. The server manages pack files; generation modules execute in browser workers and visualization uses WebGPU.

**Development build:** the local pack editor and file server are implemented. Full Iris terrain generation and release qualification remain incomplete. No approximate terrain is substituted.

The [implementation specification](docs/SPECIFICATION.md) is the project brief. The user directed sustained local implementation, repository checkpoints, focused checks as needed and comprehensive verification after the program is developed. Automatic GitHub test runs are disabled; workflows remain manually available.

## Run the editor

Use Node.js 24. No npm install is needed.

```sh
cp .env.example .env
npm start
```

Open `http://127.0.0.1:4783`. Place native Iris pack folders under `packs/`, set `IRIS_PACKS_DIR` to their parent directory, or import a pack ZIP/folder in the editor. The editor preserves unrelated resources and unknown JSON fields. Numeric tokens are retained exactly, including Java long values.

Implemented editing includes resource search, field/JSON views, undo/redo, local draft recovery, duplicate/rename/delete operations, version-checked saves, backups and restore, and complete pack ZIP export. New resources can copy an existing native resource as a template. Empty JSON is not presented as an engine-valid Iris template.

`npm run build` stages a clean standalone development copy in `dist/`; run it with `npm --prefix dist start`. Old distribution files are removed when the staged copy replaces the previous build. `BUILD.json` records the installed module integrity checks. `npm run build -- --require-engine` requires the Iris Wasm/runtime, field inventory, corresponding source and a matching native registry. A failed required-engine build preserves the previous distribution. `--release` refuses while implementation or release prerequisites remain unfinished.

The **Runtime status** panel reports installed Iris, registry and laboratory files. Generation controls follow the selected field’s requirements; pack editing remains available without generation modules. Installation checks establish file integrity and matching inputs, not terrain parity.

Docker configuration is in `docker/`; remote binding requires a server access token of at least 32 characters. Use HTTPS when accessing WebGPU remotely.

## Native Iris development module

Build the actual pinned Iris NoiseStyle/CNG, configured-style, SeedManager, native configuration reader and standalone generator bridge locally:

```sh
npm run engine:setup
npm run engine:build
```

A cold engine build prepares only Minecraft 26.3 class inputs and property metadata; it does not automatically export block predicates or placement pairs. Install a full native registry separately with `npm run engine:registry` when intentionally regenerating that capture. Engine and registry server-JAR hashes must match. Registry placement capture groups the complete inputs of the exact pinned native method, reducing native pair calls from 1,653,796 to 1,156. It preserves the existing registry format and refuses changed source; see the [capture proof](docs/research/NATIVE_PLACEMENT_CAPTURE.md). If the Eco dependency server is unavailable, `npm run engine:build -- --browser-terrain-inputs` explicitly excludes only the server inventory EcoItems provider and its compile-only dependency; this development profile is recorded in the manifest and does not qualify the full native reference. `--native-inputs-only` stops after core class capture, and `--reuse-native-inputs` requires the matching explicit profile. The automatic tool setup supports Linux x64. Select **Iris noise style** or open a generator resource and use **Preview this generator**. Raw dimension continent/region control fields are also available; the separate **Native regions** mode now selects actual region resources from the native compatibility-filtered pool. Focused region choices and the dimension studio layout are connected; use **Studio layout** for native buffet region choices. The **Native procedural height** and **Native surface biomes** maps now execute the original IrisComplex biome/height streams with world-seed derivation, child pools, generator interpolation and shore correction. Heights display world Y; Studio layout is currently limited to region previews. Native volumetric shaping is now connected, including a **Native volumetric occupancy** slice that distinguishes unshaped columns, empty cells and solid cells. Hydrology and transforms still refuse these scalar/intermediate paths. Native upper-dimension and stack contexts are now connected for the documented bounded material/mode routes; scalar maps retain their host-dimension meaning. The **Native terrain materials** mode now paints one actual native terrain-stage chunk and passes its block states to the 3D renderer. Matching local block assets are required; missing models and tints produce diagnostics. Additional native stage previews are available below; full rendering and release qualification remain unfinished. Standalone generator seeds are native `superSeed` inputs; dimension seed derivation and biome blending are not applied to this view. The module compiles and its focused Node/native export check passes; complete browser/native qualification remains outstanding. Unsupported resource-dependent paths fail explicitly.

Native resources can be inspected through the worker memory loader. To export schemas for a specific saved pack, run `npm run engine:schemas -- /path/to/your/pack`, then select **Load matching native schema** in the inspector. With no path, the exporter uses the pinned upstream terrain fixture. The editor verifies the saved pack snapshot before attaching a schema; exported metadata warnings are retained. The bundle currently uses vanilla registries and is not production-qualified.

Procedural neighborhood previews now run the original native object-layer entry point with snapshot-owned plan caching. Native vine and multiface attachment correction uses prepared matter and chunk neighbors. These remain bounded development previews; full terrain generation and browser qualification are unfinished.

**Native Overworld · terrain and content** now executes the original registered mode entry, including native matter scheduling, guarded procedural contributions, deposits, insertion, decoration, cleanup and final subterrain preservation. The terrain-only view remains separate. These are bounded development paths: imported structures/objects, active custom-block contributions, complete hydrology options, history/REAL/world lifecycle and real browser qualification remain unfinished. Matching local registry/assets are still required. Repeated previews reuse their immutable terrain context with separate caches for registered mode generation and standalone procedural diagnostics.

The dimension hydrology inspector now reports native containment-plan summaries and source coordinates. Stored voxel inspection includes native hydrology publication counts by section and fluid profile. Registered Overworld previews retain exact distant carving-input identities separately from their bounded scheduling window; these diagnostics do not execute Minecraft fluid simulation. See the [containment boundary](docs/research/HYDROLOGY_CONTAINMENT_INSPECTION.md).

Rendering packs now apply target-97.1 overlay precedence and bounded resource filters, retain texture-sidecar ownership, and export selected dependency sources. Raw RGBA loading preserves transparent color; whole-tick animated textures support interpolation and current-alpha picking. Unsupported pattern/profile semantics still produce explicit errors. See [client asset behavior](docs/research/MINECRAFT_ASSET_RESOLUTION.md).

Contextual weighted models now select per stored block coordinate, including native multipart reseeding and special upper-half/bed seed rules. X/Y/Z rotations and UV locking use pinned client matrices. Selected model identities appear in voxel inspection; appearance changes keep the stored terrain. See [model behavior and limits](docs/research/MINECRAFT_MODEL_SELECTION.md).

Native plant/model displacement now moves rendered geometry and picking bounds together while retaining the owning voxel coordinate. The inspector shows the offset; diagnostic cells keep their integer extents. See [offset behavior](docs/research/MINECRAFT_MODEL_OFFSETS.md).

Native noise tiles can now be reused from browser-local storage for scalar, voxel, registered-mode and procedural previews. The cache is limited to 32 MiB globally and 8 MiB per snapshot; clear it in Workspace settings. Retained previews reuse their current tiles, and temporary previews save before releasing their native snapshot. Real browser storage durability remains unqualified.

Native image maps now load owned PNG samples from `images/` and definitions from `image-maps/`. Generator-style and dimension height/mask bindings use the original native compiler and samplers. Source-image and map inspection shows metadata and native hashes. PNG loading and raw-band inspection now retain packed grayscale/indexed palettes, gray alpha/transparency and RGB/RGBA 8/16-bit with Adam7, under explicit input/memory limits. Original Iris image-map eligibility remains unchanged: indexed/gray-alpha and unsupported map depths are refused by the native compiler. Packed-gray transparency now retains the pinned JDK’s 8-bit expansion and scale-before-key comparison. The image-map editor can sample up to sixteen world-coordinate pairs, show native scalar/height/target values and source/filter bounds, and report clipping/unknown-color counts. Animation and unsupported profile/HDR semantics remain unfinished.

## Native noise laboratory

The optional noise laboratory uses the previously executed, hash-verified TeaVM Wasm GC module. Install its recorded evidence archive locally:

```sh
npm run engine:install -- /path/to/noise-rng-evidence.zip
```

Select a **Noise lab** field and generate. These are actual VolmLib primitive samples, not dimension terrain. Wasm, runtime and archive hashes are verified during installation; corresponding source and license material are installed alongside the module. Generated engine assets, packs and browser-local resource packs are not committed.

Native stage diagnostics and the registered Overworld mode are available for their documented bounded subsets. Complete hydrology coverage, active custom blocks, tile payloads, complete options and the full engine lifecycle remain unfinished. Native upper/stacked dimensions have a bounded development bridge with selected Java comparisons; full options and browser qualification remain open. Rendering still requires supplied matching F8thful/vanilla assets and the remaining Minecraft client adapters. Full browser/GPU and terrain qualification remain open. See [development implementation notes](docs/DEVELOPMENT.md).

## Verified target

Checked on 2026-10-20 against upstream's latest non-prerelease release:

| Component | Target | State |
| --- | --- | --- |
| Iris | 4.3.4, tag `4.3.4-26.1.2-26.3` | Commit `c3a9449a026078c44a87c9776766f54a67779392` pinned |
| Minecraft | 26.3 | Development registry exported; qualification pending |
| Native build toolchain | Java 25 | Iris core compiles locally and in CI; pinned native noise checksum fails |
| VolmLib | Release-matching source and binaries | Unresolved; upstream uses mutable snapshot/composite resolution |
| Browser compiler | TeaVM 0.16.0 Wasm GC experiment | Iris styles, generators, region/biome selection and procedural heights compile; full terrain pending |

[upstream.lock.json](upstream.lock.json) records source blob hashes, unresolved inputs, and readiness. Pinning Iris alone does not establish a reproducible engine.

The [portability experiment](tools/portability-probe/README.md) now passes **195,696 exact Java/browser comparisons with zero mismatches** across actual noise primitives and RNG calls on a separately pinned VolmLib candidate. The JDK compatibility adapter is independently checked against native Java. See the [expanded run evidence](docs/evidence/noise-rng-portability-2026-10-20.json).

The actual Iris core build runs, but its unchanged noise/seed suites pass **14 of 15 tests**: the all-style checksum differs from the pinned expectation. The [native audit](docs/research/NATIVE_RNG_AUDIT.md) records the mismatch. The candidate is not a qualified release reference, and Iris seed-manager, browser noise-wrapper and terrain parity remain unproved.

## Verification tools

Use Node.js 24. No npm dependencies or install step are needed.

```sh
npm test
npm run check
npm run reference:preflight
npm run release:check
```

`reference:preflight` and `release:check` deliberately exit nonzero while prerequisites are unresolved. Passing tooling tests is not a generation parity result. Workflows are manual during development; full application verification is reserved for the completed program.

To compare two genuine captures once exporters exist:

```sh
npm run parity:compare -- /path/to/native.json /path/to/browser.json
```

The comparator checks provenance, complete capture bounds, exact floating-point bits or full block states, and reports coordinate-level mismatches. See the [capture contract](tools/reference-tests/README.md).

## Project management

- [Roadmap and milestone gates](docs/ROADMAP.md)
- [Current status and next actions](docs/STATUS.md)
- [Initial source audit and feasibility blockers](docs/research/PHASE_0.md)
- [Executed primitive portability investigation](docs/research/PORTABILITY_PROBE.md)
- [Native checksum and RNG compatibility investigation](docs/research/NATIVE_RNG_AUDIT.md)
- [Architecture and dependency boundaries](docs/ARCHITECTURE.md)
- [Supported feature matrix](docs/COMPATIBILITY.md)
- [Third-party code and asset provenance](docs/THIRD_PARTY.md)
- [Contribution workflow](CONTRIBUTING.md)

No F8thful archive or Minecraft assets were supplied with the specification. Asset validation and redistribution review remain open. The optional noise-module installer preserves the compiled module's corresponding source and notices. No proprietary game assets are committed.


Native `.iob` object resources can now be inspected from the explorer using the original Iris binary reader in the browser worker. The inspector shows dimensions, a bounded block sample and preserved modern tile payloads. Binary bytes are preserved, and changed object content invalidates cached previews. Legacy tiles, block-entity rendering, imported object placement and full tile continuation qualification remain unfinished; see [development details](docs/DEVELOPMENT.md#native-binary-object-resources).


For an isolated procedural tree, natural object or ruin preview, open a biome or region and choose **Preview procedural object or tree**. Select its native entry and baked variant index; the configured entry seed is preserved exactly. The preview uses local object coordinates and matching local block assets. Automatic terrain scattering and full collision replay remain unfinished. See [development details](docs/DEVELOPMENT.md#isolated-native-procedural-variants).


The same chooser can attempt **Single placement on terrain** at the selected chunk centre. It uses native placement conditions and source plans, replays touched destinations within a temporary 3 × 3 chunk window, and reports acceptance or rejection. The displayed volume remains the selected chunk. Native modded-platform state rotation is now connected for the development subset; tile values and native structure obstacles remain unsupported. Native edit merging is connected separately for explicit diagnostic placement rules; procedural entries do not expose edit rules. See [the supported placement subset](docs/DEVELOPMENT.md#native-single-procedural-placement).


**Native procedural content · one source chunk · development** now runs native world-seed derivation, chance/density selection and tree/object placement for the selected source chunk. Neighboring source contributions and collision replay remain unfinished. Native generated ruins and bounded cave anchors are connected; imported objects and complete collision replay remain unavailable. See [the current source-pass scope](docs/DEVELOPMENT.md#native-one-source-procedural-scatter).


Use **Native procedural neighborhood · one chunk · development** to include the required neighboring source contributions. Native radii determine the prepared window; one destination chunk is displayed. Native plan caching and bounded in-memory continuations are connected for the development subset; durable persistence and full terrain qualification remain unfinished. See [the neighborhood scope](docs/DEVELOPMENT.md#native-procedural-source-neighborhoods).


Native directional state rotation now runs the pinned modded-platform algorithm with exported property handles and native angle-segment math. A few selected axis/facing/sign/vine/wall/wire states and a fixed-yaw tree placement match the JVM reference; complete state/platform coverage remains unqualified. See [rotation scope and evidence](docs/DEVELOPMENT.md#native-directional-state-rotation).


Native edit-state merging now runs the pinned platform merger with owned property handles and native partial-property masks. Seven selected merges and one explicit-rule oak placement match the JVM reference. This diagnostic does not add edit settings to native procedural entry types. See [merge scope and evidence](docs/DEVELOPMENT.md#native-edit-state-merging).


Native source-plan caching and bounded continuations now serve the connected procedural development subset. The original isolated cache check remains boundary evidence; complete placement, persistence and release qualification remain open. See [the original cache boundary scope](docs/DEVELOPMENT.md#isolated-native-source-plan-cache-boundary).

Texture rendering now classifies alpha across referenced animation frames, refreshes a one-pixel atlas gutter on every uploaded frame, and bounds owned bitmap decoding (including pending loads). Pack replacement pauses the previous atlas before closing its image sources. Interpolated animation, verified Minecraft UV-lock/weighted selection, fluid/tint adapters and real browser/GPU qualification remain pending.

Native double-column caching now retains the original WorldCache2DDouble and ChunkCache2DDouble scalar/fill/batch publication code. Worker adapters supply a bounded map and private byte/double array operations. Terrain context release invokes original IrisComplex cleanup; immutable pack data can be retained when only the terrain context is released. Full hydrology and complete native lifecycle qualification remain pending.

Stored voxel previews now include X/Y/Z slices, lower/upper cutaways, section framing and focus on world coordinates or selected blocks. Section changes reuse generated data and baked rendering assets. Picking respects the committed section and displays stored blockstate/biome metadata. Exact triangle/texel picking and browser/GPU qualification remain pending.

Dimension authoring now includes native image-binding inspection and coordinate samples for region, biome and surface-block overrides, mask weights, raw map values and source metadata. It uses the current unsaved dimension with saved pack resources. Native binding results are shown separately from procedural fallback and later terrain stages.


### Native dimension layers and local vanilla assets

Upper dimensions (self or another pack dimension) and dimension stacks now use the original Iris context factories, layer layouts, blend sampling, terrain/biome actuators and stack stage registration. The registered Overworld route includes its fifth terrain stage when stacked. Superflat, Enclosure and Islands use their native stack/custom registrations. Scalar maps remain host-dimension fields; generated volume metadata identifies its upper dimension or layer count. Worker admission is limited to sixteen stack references and 1–4096 blocks per dimension. Imported object placement, live custom registry epochs, unsupported hydrology combinations and saved-world transitions still refuse. The standalone cave/component diagnostics refuse stacks; use a registered mode for native layer ordering. See [layer evidence](docs/evidence/native-dimension-layers-2026-10-22.json).

Prepare the vanilla baseline from an authorized local Minecraft **26.3** `client.jar`:

```sh
npm run assets:vanilla -- --client /path/to/26.3/client.jar
```

This offline tool checks the exact official client size, SHA-1, SHA-256 and embedded resource format **97.1**, then writes `.local-assets/vanilla-26.3.zip`. Original asset bytes are retained, with explicit provenance and pack metadata. Load that ZIP in **Minecraft resource packs** with the **Vanilla baseline** role. Load your authorized local F8thful pack separately as **Default overrides**. Assets are local inputs and are not committed or bundled with the application. The [pinned input identity](tools/assets/minecraft-client.lock.json) includes Mojang's metadata/download URLs. Local asset preparation does not qualify weighted model selection, UV locking, fluid/tint rendering, animations or browser/GPU behavior; those adapters and qualifications remain unfinished.

The development engine also exposes a bounded native hydrology-column diagnostic with original planning, containment inputs, height and biome output. Use **Inspect hydrology column** on an open dimension to sample one coordinate from its current unsaved snapshot and download native JSON. This is a development diagnostic; the **Native surface hydrology · planning** map now shows original host-dimension surface feature types, while intermediate material previews refuse hydrology-enabled dimensions. The registered **Native Overworld** previews now publish original hydrology matter and execute native fluid/guard/material stages for the bounded development subset. Native cache settings fingerprints are labeled runtime-local because their original record hashes include enum identities. See the [scope and limits](docs/research/HYDROLOGY_WORKER_BOUNDARY.md).

Original hydrology publication is now connected in registered Overworld terrain and terrain/content previews. Native surface-fluid states, containment cells and update markers use owned storage and original codecs; the native mode retains its ordering. One small pool fixture matches Java at twelve selected block/biome probes and 75 seal guards through the worker/client. Flowing/underground/deep-fluid options, containment/update execution, full lifecycle, rendering and real browser qualification remain open. See the [publication boundary](docs/research/HYDROLOGY_MATTER_BOUNDARY.md).


**Native surface hydrology · planning** now maps original primary surface feature types from the current unsaved dimension snapshot. It samples whole blocks at grid centers and supports the existing retained map inspector, category legend, analysis and export. The native selection/flooring rule remains in export metadata. Limits are 256 samples per axis and a 256-block window in each axis; cancel stops its worker. Five selected JVM/Wasm samples, refusal/recovery and controlled transport/cancellation pass. This host-dimension planning map omits underground/deep-fluid layers and does not simulate fluids or qualify all terrain/rendering options. See the [map boundary](docs/research/HYDROLOGY_SURFACE_MAP.md).


Enable **Studio layout** to apply the dimension’s native Studio biome grid to region, map and supported 3D previews. Active layouts take native precedence over authored focus. Outside-grid scalar maps use the native first-cell fallback; outside-grid 3D chunks show the native-source-derived barrier floor at world Y zero and skip biomes/content. Use **Block ID cells** to inspect the normally invisible barrier. Layered, object-buffet, hydrology and explicit procedural Studio combinations remain unavailable. See [Studio layout scope](docs/research/STUDIO_BIOME_LAYOUT.md).


Procedural **ruins** now appear in the native entry chooser and use the original variant generator, erosion, weathering, burial and accents. Isolated, single-placement, source/neighborhood and registered Overworld paths share bounded admission. See [the ruin boundary](docs/research/PROCEDURAL_RUINS.md) for the native rounding adapter and current limits.


Native custom biome **authoring previews** now retain the original content-addressed biome keys and generated 26.3 definitions. Stored model/fluid colors and optional biome blending use those definitions; voxel inspection offers an exact definition download. Handles are bounded and owned by the terrain context. Live registry installation and complete custom biome parity remain unqualified. See [scope](docs/research/CUSTOM_BIOME_AUTHORING.md).


Block-ID and physical-biome cell views now combine compatible faces to reduce geometry while retaining individual-block inspection and selection. **Retained preview details** reports the current quad and section-reuse counts. Emitted-face picking uses bounded spatial buckets for denser geometry, including model overhangs. See [scope and focused checks](docs/research/DIAGNOSTIC_MESH_PICKING.md).
