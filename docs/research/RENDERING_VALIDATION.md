# Rendering validation and visible diagnostics

The chunk-area status addition accidentally read `field.volume.metadata` in scalar publication. Scalar fields do not contain a volume. That read now belongs only to the existing volume-description path. Scalar publication, independent retained voxels, failure/cancellation, rendering retries, biome slices and clear continue through the actual application functions in a two-sample/two-voxel controlled fixture.

GPU session startup now waits for all four application shader modules: the map, hydrology overlay, voxel models and selection outline. Hydrology's two pipelines are prepared during startup along with the other four pipelines. Each shader's `getCompilationInfo()` contributes errors or warnings with its label and available line/column. Warning truncation cannot hide an error. Missing diagnostics refuse startup. Validation, internal-error and allocation scopes cover synchronous construction of both renderers. Scopes are popped synchronously before awaiting their results so another renderer cannot accidentally nest commands in an outstanding startup scope. Canvas draws remain suspended until readiness is published. Failure, device loss or disposal while validation is pending cannot publish an orphaned ready session; both renderers release their resources. This uses the [WebGPU compilation diagnostic and error-scope contracts](https://gpuweb.github.io/gpuweb/).

**Rendering diagnostics…** opens a snapshot for the displayed volume and startup warnings. The report includes dimensions/origin, view, retained scope/seed and at most 1,024 notices with an omitted count. Download is local JSON and never copies voxel/biome arrays or requests generation. Model and fluid failures have explicit codes. Native missing-environment lighting is a warning. The UI describes these as rendering notices rather than treating every notice as a missing resource pack.

Visible block models with no reachable faces now produce `empty-block-model`. This also covers particle-only vanilla definitions, which previously disappeared without a notice. Empty geometry can be authored intentionally or rely on Minecraft special renderers; the notice does not replace it with a guessed cube. Air and native invisible render shapes retain their existing paths, including fluid geometry. Waterlogged visible blocks can still report an empty block model. **Block ID cells** shows the retained identities independently of model geometry.

Focused commands, after provisioning the documented local vanilla baseline:

```sh
node tools/checks/gpu-recovery-smoke.mjs
node tools/checks/preview-retention-smoke.mjs
node tools/build-app.mjs --require-engine --include-local-assets
node tools/checks/standalone-render-smoke.mjs dist
```

The first check uses controlled shader/device/loss/canvas services with actual renderer constructors, all four original shader descriptors and six pipeline constructions. It holds compilation results, injects a shader error after 33 warnings, injects asynchronous allocation failure and disposes during validation. An exact locally provisioned vanilla baseline supplies one particle-only chest definition; the actual Node mesh worker produces no model faces with an explicit notice, then six identity-cell faces without changing the stored block. Application recovery/retention checks use two stored cells/samples and no terrain generation. The diagnostics dialog and downloaded JSON run through the actual application function. The standalone check verifies exact module bytes, JavaScript MIME types, the diagnostics control and liveness from the built local server.

These are controlled failure/lifecycle/transport checks, **not actual WGSL compilation, rasterization, browser UI, performance or native terrain parity**. Startup scopes do not make every later GPU upload transactional; later uncaptured errors remain routed through the existing device owner. Full GPU allocation/driver behavior, special block-entity rendering, complete client appearance and browser execution remain unqualified. The Wasm, native source archive and reference identities are unchanged. No registry export, state sweep, full program suite or GitHub workflow is run for these fixes. [Recorded evidence](../evidence/rendering-validation-2026-10-23.json).
