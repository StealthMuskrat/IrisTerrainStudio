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

`npm run build` creates a standalone development copy in `dist/`. Docker configuration is in `docker/`; remote binding requires a server access token of at least 32 characters. Use HTTPS when accessing WebGPU remotely.

## Native Iris development module

Build the actual pinned Iris NoiseStyle/CNG, configured-style, SeedManager, native configuration reader and standalone generator bridge locally:

```sh
npm run engine:setup
npm run engine:build
npm run engine:registry
```

The registry command exports actual Minecraft 26.3 development data locally; the engine build adds native field guidance to the inspector. The automatic tool setup supports Linux x64. Select **Iris noise style** or open a generator resource and use **Preview this generator**. Raw dimension continent/region control fields are also available; the separate **Native regions** mode now selects actual region resources from the native compatibility-filtered pool. Focused region choices and the dimension studio layout are connected; use **Studio layout** for native buffet region choices. The **Native procedural height** and **Native surface biomes** maps now execute the original IrisComplex biome/height streams with world-seed derivation, child pools, generator interpolation and shore correction. Heights display world Y; Studio layout is currently limited to region previews. Native volumetric shaping is now connected, including a **Native volumetric occupancy** slice that distinguishes unshaped columns, empty cells and solid cells. Hydrology, transforms and upper/stacked dimensions still refuse this path. The **Native terrain materials** mode now paints one actual native terrain-stage chunk and passes its block states to the 3D renderer. Matching local block assets are required; missing models and tints produce diagnostics. Caves and later chunk stages, full rendering and release qualification remain unfinished. Standalone generator seeds are native `superSeed` inputs; dimension seed derivation and biome blending are not applied to this view. The module compiles and its focused Node/native export check passes; complete browser/native qualification remains outstanding. Unsupported resource-dependent paths fail explicitly.

Native resources can be inspected through the worker memory loader. To export schemas for a specific saved pack, run `npm run engine:schemas -- /path/to/your/pack`, then select **Load matching native schema** in the inspector. With no path, the exporter uses the pinned upstream terrain fixture. The editor verifies the saved pack snapshot before attaching a schema; exported metadata warnings are retained. The bundle currently uses vanilla registries and is not production-qualified.

## Native noise laboratory

The optional noise laboratory uses the previously executed, hash-verified TeaVM Wasm GC module. Install its recorded evidence archive locally:

```sh
npm run engine:install -- /path/to/noise-rng-evidence.zip
```

Select a **Noise lab** field and generate. These are actual VolmLib primitive samples, not dimension terrain. Wasm, runtime and archive hashes are verified during installation; corresponding source and license material are installed alongside the module. Generated engine assets, packs and browser-local resource packs are not committed.

The voxel previews contain native terrain painting and cave materials using actual MantleCarvingComponent profile selection and IrisCarveModifier in a five-chunk marker window. Overworld previews continue through native post-processing, floating-child-biome solids and natural-cave decoration. Material diagnostics additionally run native deposits, block-matter insertion, surface/floating decoration and material cleanup, with object/structure content explicitly pending. Separate dimension-only and Slice Y marker diagnostics remain available. Vine face correction, complete mode ordering, floating decoration, subterrain and later stages are unfinished. Hydrology and the complete chunk pipeline remain unfinished and unqualified. F8thful and matching vanilla assets must be supplied locally. See [development implementation notes](docs/DEVELOPMENT.md).

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


Native `.iob` object resources can now be inspected from the explorer using the original Iris binary reader in the browser worker. The inspector shows dimensions and a bounded block sample. Binary bytes are preserved, and changed object content invalidates cached previews. Object/structure placement and tile-entity payload support remain unfinished; see [development details](docs/DEVELOPMENT.md#native-binary-object-resources).


For an isolated procedural tree or natural-object preview, open a biome or region and choose **Preview procedural object or tree**. Select its native entry and baked variant index; the configured entry seed is preserved exactly. The preview uses local object coordinates and matching local block assets. Automatic terrain scattering and full collision replay remain unfinished. See [development details](docs/DEVELOPMENT.md#isolated-native-procedural-variants).


The same chooser can attempt **Single placement on terrain** at the selected chunk centre. It uses native placement conditions and source plans, replays touched destinations within a temporary 3 × 3 chunk window, and reports acceptance or rejection. The displayed volume remains the selected chunk. Start with rotation-disabled entries; rotated block states, edit merging, tile values and native structure obstacles remain unsupported. See [the supported placement subset](docs/DEVELOPMENT.md#native-single-procedural-placement).


**Native procedural content · one source chunk · development** now runs native world-seed derivation, chance/density selection and tree/object placement for the selected source chunk. Neighboring source contributions and collision replay remain unfinished. Use rotation-disabled natural entries without imported objects, ruins or cave anchors. See [the current source-pass scope](docs/DEVELOPMENT.md#native-one-source-procedural-scatter).
