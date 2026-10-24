# Iris Terrain Studio

A self-hosted browser workspace for creating, editing and inspecting real Iris terrain packs. The server manages files and delivers the application; generation executes in browser workers and visualization uses WebGPU. Generated chunks, meshes and sample buffers stay in the browser.

**Development application.** Pack editing, generation adapters and rendering modules are implemented for the documented subsets. Complete supported-terrain parity, actual application browser/GPU qualification, performance and Docker verification remain unfinished. No approximate terrain is substituted. See [current status](docs/STATUS.md), [compatibility](docs/COMPATIBILITY.md) and the [completion sequence](docs/ROADMAP.md#remaining-completion-sequence-2026-10-23).

## Start locally

Use **Node.js 24**. No npm install is needed.

```sh
cp .env.example .env
npm start
```

Open <http://127.0.0.1:4783>. Put native pack directories under `packs/`, set `IRIS_PACKS_DIR` to their parent directory, or import a ZIP/folder in the editor. Use **Pack actions** to create a linked native terrain starter or an explicitly empty pack. The starter retains four original resources plus GPL/source notices.

The editor provides schema/JSON controls, resource search and references, undo/redo, local draft recovery, duplicate/rename/delete, version-checked saves, backups/restore and complete pack export. It preserves unknown fields, unrelated files and exact numeric tokens, including Java long values. Saving never modifies Minecraft world chunks.

**Runtime status** reports installed engine/registry integrity. Editing works without an installed engine. Visualization requires a WebGPU-capable browser on loopback or HTTPS; Wasm generation requires Wasm GC. Unsupported resources produce errors rather than fabricated output.

## Prepare the engine

The target is **Iris 4.3.5**, tag `4.3.5-26.1.2-26.3`, commit `c3359e0a16438b1bb8468901c6171dcefdf63f7f`, with Minecraft **26.3** and Java **25**. TeaVM **0.16.0** compiles the source to Wasm GC. [Source pins](upstream.lock.json) and the [upgrade record](docs/research/IRIS_4_3_5_UPGRADE.md) distinguish the synchronized development VolmLib candidate from unresolved shipping-release provenance.

```sh
npm run engine:setup
npm run engine:build
```

Automatic setup supports Linux x64. A cold build captures native class/property inputs, without automatically enumerating registry states or placement pairs. If a full matching registry is absent, intentionally capture it once:

```sh
npm run engine:registry
```

The engine and registry must identify the same Minecraft server artifact. Existing verified registry inputs can be reused; do not recapture them after ordinary application changes. Grouped native placement capture uses 1,156 calls instead of 1,653,796 pairs; [source proof](docs/research/NATIVE_PLACEMENT_CAPTURE.md).

If the unrelated EcoItems dependency is unavailable, `npm run engine:build -- --browser-terrain-inputs` selects the explicit no-EcoItems development profile. `--native-inputs-only` stops after class capture; `--reuse-native-inputs` requires matching source commits and profile. This profile does not qualify the full release reference.

For pack-specific native schemas:

```sh
npm run engine:schemas -- /path/to/native/pack
```

Then use **Load matching native schema** in the inspector. The saved snapshot must match. With no path, the exporter uses the pinned native fixture; it does not produce universal pack defaults.

## Configure rendering defaults

Use authorized local inputs. The provided F8thful archive is now pinned and provisioned in the development workspace with the exact vanilla fallback. Neither third-party archive is committed.

```sh
npm run assets:vanilla -- --client /path/to/26.3/client.jar
npm run assets:defaults -- --baseline .local-assets/vanilla-26.3.zip --overrides /path/to/F8thful.zip
```

Vanilla preparation verifies the exact client size, SHA-1/SHA-256 and embedded resource format **97.1**. Default provisioning preserves original blockstates, block models (including unused templates), parent/texture/animation dependencies, applicable overlays and notices/provenance. Unrelated assets and inactive overlays are omitted. Repeated models share dependency work; no registry-state scan or texture resampling occurs.

The default destination is `.local-assets/rendering-defaults`. Existing destinations refuse replacement. Use `--output /new/directory` for a reviewed replacement and `IRIS_RENDERING_DEFAULTS_DIR` when starting the server. Optional `--roots /path/to/ids.json` limits candidate validation to selected block IDs while retaining all block definitions and their direct dependencies.

Installed defaults load automatically after authentication. **Minecraft resource packs** controls baseline/default/custom roles, priority, enabled state and browser-local persistence. Custom replace mode omits default overrides while keeping vanilla. Changing packs rebuilds appearance without regenerating terrain. Archives supplied by the installation are not duplicated in browser storage.

The provided F8thful metadata declares formats **69–88**, so its five legacy overlays do not apply to target **97.1**. That declaration is preserved and the UI reports its mismatch. Selected real models/animations pass focused checks; full target compatibility is not established. [Input identities and scope](docs/research/F8THFUL_DEFAULTS.md). Local provisioning does not grant redistribution rights.

## Use the previews

Open a dimension and choose a native preview field, seed and coordinate window. Region, biome, height and occupancy maps retain exact samples for inspection, categories, transects and JSON/CSV export. Registered mode previews use original native terrain/content ordering; intermediate diagnostics identify their narrower scope. Unsaved dimension snapshots remain revision-owned, and obsolete jobs are cancelled.

Registered terrain previews offer **1×1, 2×2 or 4×4 chunks**, with a 4,194,304-cell area limit. New workspaces default to 2×2; existing saved setups keep their previous size. Each destination uses the original native mode, and block inspection retains its own chunk metadata. [Area behavior and limits](docs/research/CHUNK_AREAS.md).

3D previews offer camera navigation, sections/cutaways, block/biome/region cells, model-surface picking, face selection and retained metadata/downloads. Resource-pack rendering includes contextual variants/multipart models, native transforms/UV lock/offsets, fluids, tints, face culling/material cutoffs, animated mipmapped textures and flat cardinal shading. Conservative static opaque cube merging retains individual-cell picking. Diagnostic cells are explicitly separate from Minecraft appearance.

Native image-map inspection explains how PNG profile/HDR/animation metadata is read by the pinned JDK policy. Resource-pack filters accept bounded grouped alternatives and repetitions. [Input behavior and limits](docs/research/NATIVE_PNG_AND_FILTERS.md).

Use **Rendering diagnostics…** to inspect or download notices for the displayed preview. GPU startup waits for shader and pipeline validation; empty model definitions are reported and remain inspectable in Block ID cells. [Validation behavior and limits](docs/research/RENDERING_VALIDATION.md).

Native adapters cover the recorded volumetric, cave, subterrain, hydrology, surface/deposit/decorator, procedural object/tree/ruin and bounded layered/Studio/custom-biome authoring routes. The [compatibility matrix](docs/COMPATIBILITY.md) identifies unsupported combinations and qualification limits. Imported conventional structures, gameplay and saved-world transition services are outside ordinary terrain authoring. Complete in-scope options, client rendering and native/browser parity remain open; selected Node/Wasm checks do not constitute browser execution.

## Build and self-host

```sh
npm run build -- --require-engine --include-local-assets
npm --prefix dist start
```

The build atomically stages `dist/`, validates engine/registry/source identities and records `BUILD.json`. Failed builds preserve the prior distribution. `--include-local-assets` explicitly includes the reviewed local defaults; omit it to keep assets outside the distribution. `npm run build` alone can package the editor without requiring installed generation modules. `--release` refuses unfinished implementation/qualification.

The [deployment guide](docker/README.md) covers Docker Compose, persistent pack storage, liveness and HTTPS. Non-loopback binding requires `IRIS_STUDIO_TOKEN` of at least 32 characters. Keep the container port on loopback behind TLS for remote WebGPU access. Corresponding engine source/licenses/notices must remain in the distribution. Docker execution is not qualified in the current workspace.

## Development and acceptance

The [specification](docs/SPECIFICATION.md) is authoritative. Work locally, use small focused checks for changed behavior, and reserve comprehensive verification for completed implementation. GitHub workflows are manual. Checkpoint pushes do not certify completion.

The historical native 4.3.4 audit passed 14 of 15 noise/seed tests. The unchanged checksum assertion now also fails against the pinned 4.3.5 development inputs: expected `5059606393854142913`, observed `3659164368724912644`. Exactly that one assertion was run; no full 4.3.5 native-suite result is claimed. The [investigation and current evidence](docs/research/NATIVE_CHECKSUM_DIAGNOSTICS.md) remain unresolved. The updated bridge compiles and selected original JVM/Wasm/worker comparisons pass; shipping dependencies and complete supported-terrain qualification remain unproved.

The optional separately pinned [noise laboratory](tools/portability-probe/README.md) can be installed with `npm run engine:install -- /path/to/noise-rng-evidence.zip`. Its primitive/RNG evidence is distinct from qualification of the application engine.

[Development details](docs/DEVELOPMENT.md) · [architecture](docs/ARCHITECTURE.md) · [third-party materials](docs/THIRD_PARTY.md)
