# Manual acceptance

Use this checklist for the browser, GPU and deployment checks that cannot run in the development workspace. A local browser at `http://127.0.0.1:4783` is sufficient; a hosted HTTPS deployment is not required. These checks supplement automated results. They do not resolve the native checksum or release-dependency provenance.

## Setup and records

1. Use Node.js 24 and a current browser with WebGPU and Wasm GC enabled. Follow the [README](../README.md) to prepare the engine, matching registry and authorized local rendering defaults. A Git checkout alone does not contain those generated or third-party files.
2. Run `npm start`, open the loopback URL and inspect **Runtime status**. Record the repository commit, engine Wasm/source hashes, registry identity, browser version, OS, GPU/driver and viewport size. Keep the native qualification warnings in the record.
3. Create a disposable native terrain starter using **Pack actions**. Test real packs using copies. Keep an untouched exported copy for comparison.
4. Open browser developer tools. Record console errors and network requests during each failed case. Download **Rendering diagnostics…** reports and retain the smallest source/configuration that reproduces a failure. Never include an access token in a report.

Record each case as **pass**, **fail**, **blocked** or **not run**. Include expected/observed behavior and the input seed, dimension, coordinates, preview type and chunk-area size. A refused required terrain option is an unresolved case, not a successful generation result.

## Editor and file workflows

| Case | Action | Expected result |
| --- | --- | --- |
| Create/open | Create native starter and empty packs; reopen each | Starter has its linked native resources/notices; empty creation is explicit; resources load correctly |
| Source preservation | Add an unknown nested field and `9223372036854775807`; edit a separate field in Fields mode, save, export/reopen | Unknown content and the large integer retain their exact source tokens |
| Form/raw/structure | Switch Fields/JSON; insert, remove, reorder and duplicate small values; use outline, guidance and reviewed formatting | Correct selection, valid source and one undoable change per action; no invented native defaults |
| Undo/redo | Edit two resources, switch repeatedly, undo/redo each | Independent retained histories and dirty indicators; no cross-file edits |
| Save All | Modify two resources and save all; change one on disk before retry | Per-file outcomes are shown; stale source requires review and is not overwritten |
| Conflict/recreation | Change or delete a file outside the app; save its open edit | Base/local/disk review appears; recreation requires review and refuses a competing create |
| History | Save two versions, review/download a backup, restore it; also restore a deleted resource | Exact reviewed content returns; newer disk/backup versions refuse stale restore |
| Draft durability | Make unsaved edits, reload/close/reopen browser, recover; export/import selected drafts | Exact source/base recovers; existing newer drafts/open edits survive; storage failures are visible |
| Multiple tabs | Edit the same resource in two tabs; perform draft/library management concurrently | Server ETags prevent stale saves; guarded management refuses conflicts. Ordinary draft autosave has no cross-tab editor ownership guarantee |
| Search/references/problems | Search exact source, navigate matches, review replacement and run JSON problems with matching schema | Correct file/range navigation; literal reference matches remain labeled as possible; missing schema coverage stays explicit |
| Import/export | Import ZIP and folder with an enclosing directory, unrelated binary file and excluded resource; export/reimport | Reviewed layout matches publication; preserved files are byte-identical; paths/collisions/invalid archives refuse |
| Failure ownership | Close an import/search/schema/export dialog while busy, then open another resource/dialog | Old completions cannot overwrite the current selection, text, controls or error message |

## Generation and retained previews

Use small windows and 1×1 areas first. Use fixed signed long seeds, a negative coordinate and a chunk boundary. There is no need to enumerate registry states or compare millions of cells.

| Case | Action | Expected result |
| --- | --- | --- |
| Real worker startup | Generate a native scalar preview in the browser | The installed verified Wasm loads in a worker; no server generation endpoint or generated sample/voxel/mesh upload appears in Network |
| Scalars | Inspect native styles, regions, biomes, height and density at selected coordinates | Labels and exact retained samples match the chosen inputs; categories are not presented as numeric terrain heights |
| Unsaved inputs | Change the current dimension without saving, generate, then revert | Preview uses the captured unsaved text; input/revision labels identify it; disk stays unchanged |
| Revisions/cancellation | Start generation, change inputs or cancel, then generate another view | UI remains responsive; stale jobs cannot publish; the retained valid preview survives failures |
| Registered modes | Generate the starter’s supported registered mode; inspect individual blocks/biomes/regions | Mode, stage scope and per-destination metadata are correct; intermediate diagnostics remain labeled incomplete |
| Areas and boundaries | Generate 1×1, 2×2 and an admitted 4×4 area at negative coordinates | Correct world bounds and destination-owned inspection; oversized requests refuse clearly and preserve prior data |
| Terrain systems | On copied representative packs exercise volumetric terrain, caves, subterrain, rivers, materials, deposits, decorators and procedural trees/objects | Required options execute or produce a precise documented refusal; no silent omission or invented terrain |
| Layered/Studio/custom biome | Exercise supported upper/stack layers, Studio layout and authored custom biome colors/definition download | Native bounds/attribution and retained metadata remain correct; unsupported combinations refuse |
| PNG/expression/cache | Exercise PNG image maps, expressions and float-cache use; repeat after browser reload | Native sampling/source-policy notes are consistent; cache failures do not corrupt the preview; invalid expressions/images refuse and subsequent valid input recovers |
| Determinism | Generate the same small input twice, after cancellation, and after reopening; export retained samples | Exact selected samples and canonical block/biome keys remain equal; record the input and output artifacts |
| Maps and downloads | Pan/zoom, select categories, adjust display range, inspect samples, analyse a transect and export JSON/CSV | Analysis describes retained samples; coordinates and exact value bits survive export; display changes do not regenerate |

Exact native/browser terrain qualification still requires independently captured native results with the same complete input identity. Visual agreement and repeatability alone are insufficient.

## GPU and resource packs

| Case | Action | Expected result |
| --- | --- | --- |
| Actual shaders | Open 2D, 3D and split views; exercise hydrology overlay | Real WGSL/pipelines compile; validation errors are visible; failed startup never advertises a ready display |
| Appearance | Inspect stone/grass/logs/leaves, slab/stair/fence/wall, plant, water/lava and waterlogged blocks present in a copied pack | Supported contextual models, UVs, offsets, tints, transparency and fluid boundaries render consistently; missing/empty models have diagnostics |
| Asset precedence | Enable/disable/reorder custom packs; use replace/overlay modes and restore defaults | The selected override wins; vanilla remains the fallback; original supplied F8thful format mismatch stays visible |
| Animation/mips | Inspect animated water/lava and cutout foliage while near/far and while idle | Correct frames/interpolation, stable sprite boundaries and no atlas bleeding; appearance updates preserve generated voxels |
| Picking | Click slabs/holes/cutout leaves, overhanging models, fluid and a merged cube surface | Selected world cell/biome and face outline agree with visible geometry/alpha; clips and resource changes invalidate stale picks |
| Diagnostic views | Switch textured/block-ID/physical-biome/native-region modes | Retained data is reused; diagnostic cells remain clearly identified; switching back preserves source values |
| Sections/camera | Slice/cut away X/Y/Z; frame section; orbit, fly, edit coordinates and save/reopen a camera | Correct exposed faces and world coordinates; camera-only operations do not generate terrain |
| GPU recovery | Use the browser’s supported device-loss/debug facilities if available; otherwise record blocked | Rendering stops, CPU data survives, diagnostics explain failure, and Retry restores retained previews without regeneration |
| Browser storage denial | Disable site storage or exhaust quota, then edit/use session-only settings | Editing and authentication remain usable; failed persistence is reported; existing saved files are unaffected |
| Layout/accessibility | Resize narrow/wide, zoom browser, navigate by keyboard and open/close dialogs | Controls and errors stay readable/reachable; focus, shortcuts, text selection, IME and native file pickers work |

Lighting currently provides flat cardinal shading and native tint/material information; world lightmap, ambient occlusion and emission simulation are not qualified. Record appearance limitations separately from geometry/selection failures.

## Performance and deployment

- On named hardware, record cold/warm generation time, mesh time, steady camera frame time and browser memory for the same 1×1 and 2×2 inputs. Record distributions over a few repeats rather than a single best result. No measured target or all-device performance claim is established by the automated checks.
- Repeat appearance changes, section changes and generation/cancellation ten times; inspect retained data, memory growth, input responsiveness and errors. Close/reopen the app to distinguish persistent data from session caches.
- Build using `npm run build -- --require-engine --include-local-assets`, run `npm --prefix dist start`, repeat startup/edit/save/export and restart persistence. Verify runtime/source/default hashes in `dist/BUILD.json` and runtime status.
- If Docker is available, follow [docker/README.md](../docker/README.md): build/start, check `/healthz`, save a resource, recreate the container and verify its exact contents in the persistent volume. Verify token authentication and read-only root behavior. Record Docker/version/image identity.
- If remote hosting is later used, follow the documented token/TLS setup and repeat WebGPU startup on the actual HTTPS origin. This is separate from local-browser acceptance.

## Reporting

For a defect include: case, commit/build hashes, browser/OS/GPU, smallest pack/resources, exact steps/inputs, expected result, actual result, console/network errors and rendering report. For data failures attach original and exported files and compare bytes. State explicitly which cases could not run. Keep unresolved native/reference and release prerequisites open even if every manual UI case passes.
