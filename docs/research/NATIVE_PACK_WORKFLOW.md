# Native starter creation and retained region inspection

Two functional acceptance gaps are now connected: a usable new terrain pack and the selected native region in block inspection.

## New terrain packs

Pack actions defaults to a linked volumetric stone starter. Four JSON files are copied byte-for-byte from the pinned Iris 4.3.4 `probe/src/test/resources/terrain3d-pack` fixture, with its original field values and resource IDs. These are authored fixture choices, not invented engine defaults. The shipped manifest records all source paths and hashes. GPL license and source notice accompany the files and remain in pack exports. An explicit empty-folder choice retains the previous behavior.

The server admits only bundled starter IDs, checks source hashes and the total byte limit before publication, then uses the existing staged import/name lock. Existing packs cannot be overwritten, competing create/import operations share the name lock, and failures remove staging directories. The authenticated catalog returns only public starter metadata. Browser creation waits for the modal to close before opening the new dimension; cancelled or superseded handoffs still refresh the pack list and report completed creation without taking over navigation. No generation is performed on the server.

## Selected regions

The browser engine exposes the original `Engine.getRegion` defaults through the generated host boundary. `TerrainRegionSnapshot` calls the original three-coordinate method at internal Y zero for 256 columns in an aligned chunk. Without a dimension stack, the pinned native method returns the same host-region stream at every Y, including its subterrain branch. Upper-only contexts retain that native host-region meaning; this is not feature-source attribution.

Dimension stacks can have different regions along Y and are explicitly refused by this column diagnostic. Worker transport omits their column data and records a reason. Isolated object-local previews and outside-Studio chunks do not invent a region map. This scope does not claim complete layer/feature provenance.

Supported chunk previews retain a unique native region palette, dimension identity and 256 Uint16 indices. Shared validation bounds coverage and labels; client caching charges the typed buffer and retained metadata. A region query reads the retained column at the picked block, with no new generation. Native region cells use the existing unlit identity view, legend, section cache and greedy geometry. Both worker emitters use column indices directly rather than allocating a height-expanded region buffer. Appearance-only rendering retains validated region ownership, block/biome arrays and camera state.

## Focused evidence

Six shipped files survive authenticated creation/read/export. Duplicate/invalid requests, empty creation, competing publication, cancelled late completion and stale navigation are checked. Original Java compares two height bits, two biome keys, two region keys and three selected material states against the actual Wasm/worker/client path. The native capture is cached by source/input/classpath-order identity. Retained region indices and their exact cache charge pass on the rebuilt module, as do actual layered omission, diagnostic refusal, release and retained-result ownership.

Four controlled stored cells separately exercise both region-color emitters, two region picks, legend, color identities, cache reuse and malformed/missing metadata. These are Node/controlled-host checks, not actual browser/GPU verification. See [evidence](../evidence/native-pack-workflow-2026-10-23.json).

The actual browser gate remains blocked: local Chrome previously exited with SIGTRAP, the cloud browser cannot reach workspace loopback, and the managed preview supervisor is unavailable. Required F8thful input, reference provenance/checksum, full terrain/client qualification, deployment execution and final program verification remain open. No registry re-export, exhaustive state comparison, broad suite or GitHub workflow ran for these changes.
