# Native hydrology worker boundary

The development module exposes an explicit one-column planning diagnostic. The dimension inspector can sample a selected coordinate from the unsaved snapshot and download its native data. It does not enable complete hydrology terrain generation or the disabled hydrology map control. Ordinary terrain previews explicitly refuse active hydrology dimensions, so they cannot present provisional native answers as complete terrain.

## Original algorithms and platform services

The pinned Iris `IrisComplex` constructs the original `IrisHydrologyRuntime`, settings compiler, planner, cross-tile resolver, drainage/geometry samplers, rasterizers, policy resolver and column composer. `HydrologyDiagnostic` prepares the original requested chunk columns before reading a native snapshot, height bits and biome. It opens a generation lease and execution scope. The worker adapts storage and task completion; it does not construct a replacement river, pool, route or terrain sample.

Native Caffeine caches use the existing weighted worker storage with native weighers. Zero-capacity caches compute without retaining values, as required by the native disabled-regional configuration. Entry caches, expiry, invalidation and map views are bounded worker services. A declared 512 MiB heap input selects the original native cache-budget formula; this is an admission input, not measured browser heap use. JVM reference tooling uses a 512 MiB maximum heap because the Minecraft registry bootstrap cannot fit the earlier 128 MiB attempt.

The runtime selects the original inline tile-cache constructor branch. Native fork/join tasks execute synchronously through the worker executor, preserving native task bodies, ordering, provisional-sampling publication and failure propagation. The native wait loop has a completion guard before entering its wait/catch block. Cross-worker waiting, asynchronous prefetch, retry waits, pregeneration, shared prepared caches and filesystem persistence are unavailable.

The compiler emitted an invalid Wasm cast for the original catch-only `RejectedExecutionException` in `HydrologyForkJoin.Task.await(boolean)`: the emitted named type 42 was not a subtype of Throwable type 48. A concrete worker rejection exception replaces that platform exception, and the completion guard constructs it for unavailable waits. The correction preserves native result/failure logic and passes the VM's module validation. This records the observed compiler boundary; it does not establish a general TeaVM root cause.

## Native containment inputs

Even standing pools request the native cave voxel view. Their containment must not assume solid terrain. The diagnostic binds an original `IrisEngineMantle` to an owned sparse worker store and runs the original carving component when the native view requests input. Original `TerrainMatterView` journal semantics select natural matter. Host calls use the prepared store; the native view's storage-token null check becomes an active-store check, while its other constructor checks remain intact. Storage and engine bindings are released on both success and failure.

Admission allows 32 distinct root tiles / 64 planning calls, 256 sparse carving chunks and a conservative 16,777,216-cell charge from unique requested chunk count times height times 256. These are limits on admitted work, not measured sampling counts or heap guarantees. Source/layout/geometry algorithms remain unchanged. Unsupported requests fail explicitly.

## Settings fingerprint scope

`HydrologyPlannerSettings.fingerprint()` mixes record `hashCode()` values. Its nested erosion record includes `IrisRiverBlendStyle` and `IrisRiverBedProfile` enum values; compiled surface-policy bounds also mix policy record hashes. Java enum hash codes are identity hashes. The original fingerprint therefore cannot be treated as a portable semantic digest across JVM and Wasm processes.

The diagnostic retains that original calculation as `runtimeSettingsFingerprint`, with `settingsFingerprintPortable: false`. Evidence records both runtime values. The focused comparison checks all reported column/feature/height/biome fields except this process-local identity and the worker's platform admission counters. It does not replace the fingerprint algorithm or qualify shared/durable cache interchange. Pack snapshot/resource identities remain separate source hashes.

## Scope and next work

The targeted fixture enables a small standing-pool system, disables ordinary surface/underground routes and regional routing, and declares a disabled cave profile. Java selects a fluid-owned channel column at (10, -7) from its populated footprint, plus one negative-coordinate control. The cold worker sample admits four planning roots/calls; the control and warm repeat need no additional planning. Both samples report zero admitted carving chunks/cells. The carving-input adapter is linked but its execution and budget refusal are not qualified by this fixture. No block-state or whole-volume comparison is performed. This cannot qualify flowing rivers, deep fluids, caves, banks, full mode material publication, every option or real browser/GPU behavior. The next integration is the native hydrology matter stage and map visualization. Full engine/history/platform, Minecraft rendering and release gates remain open.

## Authoring ownership

One selected integer X/Z and a signed Java-long seed are admitted per inspection. The worker captures a module/resource/dimension/seed identity, registers the owned snapshot, prepares the original runtime and releases the context in a finally block. Original internal Y and minimum world Y remain in downloadable JSON; the dialog adds minimum world Y for display. Process-local fingerprint labels remain explicit in JSON. Closing a running inspection, changing its source or starting another operation cancels the request and terminates the worker because synchronous native planning cannot receive a queued cancel message. Stale responses/downloads cannot replace newer source state. Controlled worker/client checks exercise transport, bounds/seed rejection, recovery/release and cancellation; actual browser dialog/layout/download behavior remains unverified.
