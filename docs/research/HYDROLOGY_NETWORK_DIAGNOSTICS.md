# Native hydrology route diagnostics

The pinned Iris revision is `c3a9449a026078c44a87c9776766f54a67779392`. Native definitions live under `core/src/main/java/art/arcane/iris/generation/hydrology/`: `RiverCourse`, `HydraulicSegment`, `HydraulicChannelProfile`, `DrainageNode`, `RiverOutlet`, `HydrologyTile` and the original runtime. The adapter reads these records; it does not construct routes or port a planner.

## Selection and ownership

The existing surface planning map still samples the original primary surface feature at floored grid centers. A separate `network` member retains course geometry from owner tiles intersecting the visible rectangle extended by the original runtime's publication radius. Tile traversal is deterministic, Z then X. This includes underground/deep courses in a two-dimensional projection, unlike the primary-surface raster. Offscreen retained geometry is available to inspection/export; display lines are clipped to the visible rectangle before float32 conversion.

The excerpt contains original course/segment IDs, profile keys, discharge, source/outlet references, hydraulic heads, flags, complete station sequences and native per-station widths/depths. Native drainage-node natural points/potentials and outlet connection/landward points are retained. Unsigned native long IDs use hexadecimal strings; seeds retain signed decimal strings. Coordinates are explicitly labeled `native-hydrology-x-headY-z`: heads are not advertised as independently qualified world-fluid heights. Drainage edges and other planner internals are not serialized. Owner records can repeat cross-tile identities, and referenced nodes/outlets can lie outside this excerpt.

Caps are 32 owner tiles, 256 courses, 1,024 segments, 32,768 stations, 4,096 nodes and 1,024 outlets. Whole courses are omitted when their complete segment/station sequence would exceed a cap. Omission counts for courses/nodes/outlets concern queried owners; unqueried owners' contents are unknown. The metadata reports limits, retained counts, omitted counts and truncation. Existing native planning-call/root and carving-input admission still applies; graph extraction occurs inside the surface map lease before admission totals are published. Oversized native work refuses rather than returning a partial successful planning operation.

## Retained views

The shared validator bounds metadata before indexing it. The map overlays original station connections and square markers for nodes, outlets and segment starts, using diagnostic feature-identity colors. The routes dialog searches/pages course records, shows selected native fields and the first stations, toggles the stored overlay and downloads retained network JSON. Coordinates can populate the next preview without generating terrain. Sample inspection projects onto the closest retained centerline within half a sample-cell diagonal; displayed interpolated dimensions are explicitly identified as derived inspection values.

The client cache charges each graph a conservative **8 MiB logical estimate**, in addition to sample buffers. This is neither measured browser heap nor a hard total-memory guarantee. The JSON download has a 16 MiB encoded-size limit. GPU lines upload once; marker buffers change only with viewport size. Replacement failures retain previous buffers, and replacement/disposal releases owned resources. The overlay toggle applies to the current renderer; it is not a persisted preference.

## Focused evidence and remaining work

`node tools/checks/native-hydrology-map-smoke.mjs` compares five raster samples in three tiny windows and the complete retained network metadata against the original JVM through the actual Node-hosted Wasm worker/client. One seed/flat-floor pool fixture retains four owners, 32 independent pool courses, 32 segments and 96 stations per window. It has **zero drainage nodes/outlets**, so it does not qualify genuine river routing, drops or mouth planning. The reference cache key includes both map and network helper class bytes.

`node tools/checks/hydrology-network-ui-smoke.mjs` uses one explicitly authored source/outlet/cascade graph plus the retained native pool excerpt. It checks transport refusal, exact identities/export, nearest interpolation, clipped line geometry, cache charging, controlled upload cleanup and stale-dialog rejection. Its source/outlet/drop records are UI input, not native planner evidence. No state/pair sweep, full terrain comparison, comprehensive suite or GitHub workflow runs.

Actual browser/WebGPU/UI, river/drop/outlet planning, all native options, full terrain lifecycle/parity, F8thful assets and final release/reference qualification remain open. This is a development route diagnostic, not fluid simulation or proof of full hydrology support.
