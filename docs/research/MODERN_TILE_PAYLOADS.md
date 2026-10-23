# Modern tile payloads as retained authoring data

Target: Iris 4.3.4 at `c3a9449a026078c44a87c9776766f54a67779392`, candidate VolmLib `e971ae0176d4d50dff5bd483b2b0d2cc2a77c1ac`, Minecraft 26.3. This is memory storage/inspection, not a world editor or tile simulation.

## Native boundary

The original `IrisObjectIO` parser, including `readTile`, executes unchanged. It reads coordinates and calls `TileData.read`; it retains a tile only when the parsed object has a block at that position. Memory file handles and atomic parsed-object publication stay in the existing adapter.

`WorkerTileData` owns a strict modern namespaced `writeUTF(material)` / `writeUTF(propertiesJson)` envelope. Read text and unknown JSON fields survive without passing through JavaScript Number. UTF strings are encoded with Java's original modified-UTF stream operations. Only canonical native-writer modified-UTF envelopes are covered by the small fixture. This is not qualification of malformed/noncanonical UTF or every Bukkit/modded variant.

The JSON reader admits objects, arrays, strings, booleans, null inside arrays/nested objects and finite numbers. Integer tokens first use native signed long, then finite double, matching the selected probe's LONG_OR_DOUBLE policy for covered inputs. Top-level properties require an object; root null values and duplicate members refuse. The strict JSON subset does not accept every lenient Gson input. Envelope text remains authoritative for transport/download and binary re-encoding; access to a decoded map does not rewrite it. Clone produces separately owned decoded data and bytes.

The native `TileData.of` boundary constructs owned envelopes from native block/property values. Native `IrisMaterialPalette.getTile` and `IrisBlockData.tryGetTile` retain their selection and spawner-field behavior. The probe uses an explicit native object edit rule because procedural entry JSON does not expose these edits. This does not add an edit field to procedural entries or enable imported object placement.

The original `TileMatter`, `TileWrapper`, source-plan replay and destination-transaction tile handling are linked. Tile slice IDs use the original stable persisted alias. `WorkerTerrainPlatform.supportsMatterWorldIo` returns the original interface's false default explicitly; codecs cannot register Bukkit world IO. World-side material applicability, NBT interpretation, inventories, spawns and tile behavior do not execute. Block-entity renderers are unavailable. Rendering continues to use the stored block state/model.

## Ownership and bounds

- Each envelope has the native unsigned-short UTF limit, at most 4,096 JSON value nodes and depth 64. Namespaced material identifiers are required. Legacy or uppercase/non-namespaced records refuse explicitly.
- An object decode admits at most 1,024 tile records, 1,048,576 property-text characters and 65,536 aggregate value nodes. The decode scope resets after success and failure.
- Object-cache charging includes source bytes, two bytes per retained JSON character, 64 logical bytes per decoded value and 128 per record. These are conservative admission estimates, not measured heap sizes. The existing eight-object / 16 MiB logical cache limit applies to those charges; unload and eviction release the charge.
- Sparse native tile slices produce at most 1,024 stored records / 1,048,576 JSON characters per destination chunk. No extra full block-state or voxel traversal is introduced. Admission runs before committing native cache passes.
- Worker transport checks whole world coordinates, destination bounds, unique positions, material/envelope lengths and JSON object shape. It preserves the original JSON string and labels storage as `modern-envelope` with `tileWorldExecution: false`. Older outputs without a tile channel stay unlabeled.
- Object inspection uses object-local coordinates. Stored voxel inspection uses world coordinates. The UI shows up to eight records / 4,096 characters per record, and downloads all retained records with full text. Current source/mesh ownership guards the download.

## Focused evidence and limits

`native-tiles-smoke.mjs` uses one native-written two-block object with one tile. The pinned `StubTileData` reader/factory supplies the development reference platform, while original `IrisObjectIO`, `TileMatter`, native placement and transaction code run unchanged. Native clone/node codec checks are JVM evidence. A large integer, Unicode, nested values, exact envelope text, malformed/depth refusal and recovery are covered in the actual Wasm object loader.

One small oak with one explicit log-to-chest edit compares selected native block probes and every populated tile record through destination replay. The captured real Wasm chunk then passes through the actual worker/client transport with its producer substituted; this is a transport check, not an ordinary procedural entry exposing edits. Controlled DOM hosts check raw text, complete download and stale refusal. No browser, world, GPU, all-state exporter or broad suite starts.

The continuation codec registration is implemented but complete Wasm tile-continuation encoding/replay is not qualified by this batch. Legacy tile envelopes, noncanonical/lenient JSON, every property map type/order, full material replacement/rollback interactions, live-world tiles, block-entity rendering, actual browser/GPU and full terrain/release qualification remain open. See [evidence](../evidence/native-tiles-2026-10-23.json).
