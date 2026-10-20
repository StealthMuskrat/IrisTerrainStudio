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

## Iris noise development module

Build the actual pinned Iris NoiseStyle/CNG, configured-style, SeedManager, native configuration reader and standalone generator bridge locally:

```sh
npm run engine:setup
npm run engine:build
npm run engine:registry
```

The registry command exports actual Minecraft 26.3 development data locally; the engine build adds native field guidance to the inspector. The automatic tool setup supports Linux x64. Select **Iris noise style** or open a generator resource and use **Preview this generator**. Raw dimension continent/region control fields are also available; the separate **Native regions** mode now selects actual region resources from the native compatibility-filtered pool. Focused/buffet layouts, biome composition and complete terrain remain unfinished. Standalone generator seeds are native `superSeed` inputs; dimension seed derivation and biome blending are not applied to this view. The module compiles and its focused Node/native export check passes; complete browser/native qualification remains outstanding. Unsupported resource-dependent paths fail explicitly.

Native resources can be inspected through the worker memory loader. To export schemas for a specific saved pack, run `npm run engine:schemas -- /path/to/your/pack`, then select **Load matching native schema** in the inspector. With no path, the exporter uses the pinned upstream terrain fixture. The editor verifies the saved pack snapshot before attaching a schema; exported metadata warnings are retained. The bundle currently uses vanilla registries and is not production-qualified.

## Native noise laboratory

The optional noise laboratory uses the previously executed, hash-verified TeaVM Wasm GC module. Install its recorded evidence archive locally:

```sh
npm run engine:install -- /path/to/noise-rng-evidence.zip
```

Select a **Noise lab** field and generate. These are actual VolmLib primitive samples, not dimension terrain. Wasm, runtime and archive hashes are verified during installation; corresponding source and license material are installed alongside the module. Generated engine assets, packs and browser-local resource packs are not committed.

Pack terrain modes remain explicitly unavailable until the complete browser engine is connected and qualified. F8thful and matching vanilla assets must be supplied locally. See [development implementation notes](docs/DEVELOPMENT.md).

## Verified target

Checked on 2026-10-20 against upstream's latest non-prerelease release:

| Component | Target | State |
| --- | --- | --- |
| Iris | 4.3.4, tag `4.3.4-26.1.2-26.3` | Commit `c3a9449a026078c44a87c9776766f54a67779392` pinned |
| Minecraft | 26.3 | Version verified; registry export pending |
| Native build toolchain | Java 25 | Iris core compiles locally and in CI; pinned native noise checksum fails |
| VolmLib | Release-matching source and binaries | Unresolved; upstream uses mutable snapshot/composite resolution |
| Browser compiler | TeaVM 0.16.0 Wasm GC experiment | Iris styles, configured styles, seeds and standalone generators compile; full terrain pending |

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
