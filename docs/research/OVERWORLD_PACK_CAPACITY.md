# Overworld pack capacity

The unchanged IrisDimensions Overworld 4016 pack now loads through the full native snapshot, actual Wasm module and worker/client transport. Pack import/export preserves all 8,124 files byte for byte. The previous 4,096-resource and 128-custom-biome caps blocked this pack; the budgets below replace those caps consistently across capture, client, worker and Java admission.

Test input: [IrisDimensions/overworld](https://github.com/IrisDimensions/overworld/tree/1d3cf8a93f5c4a586a8465baeff2b1b5f76b4fe3), commit `1d3cf8a93f5c4a586a8465baeff2b1b5f76b4fe3`, tree `1525af2df6566afdcf6c6fc878f65c22ab7a6753`. The checkout remains unchanged; no resources are removed to obtain the final load pass.

| Admission budget | Previous | Current | Observed input |
| --- | ---: | ---: | ---: |
| Native snapshot resources | 4,096 | 16,384 | 5,594, including 4,662 object binaries |
| Combined snapshot charge | 64 MiB | 256 MiB | 56,462,317 bytes |
| Reachable custom biome definitions | 128 | 1,024 | 146 |
| Combined custom definition JSON | 1,048,576 characters | 8,388,608 characters | 343,290 bytes of retained metadata charge |
| Baked variants per procedural entry | 8 | 128 | 24 in the selected real entry |
| Configured source attempts | 64 | 16,384 | Initial real-pack admission advances past this guard |
| Density attempts per entry | 64 | 256 | Raw scanned records reach 4 |
| Cumulative procedural canvas entries | 262,144 | 4,194,304 | Selected real variant occupies 6 blocks |
| Potential cells in the 49-chunk terrain window | 8,388,608 | 33,554,432 | 9,633,792 at height 768 |

These are admission/work bounds, not measured total browser heap or performance guarantees. Snapshot charge counts binary bytes and twice JSON character length. Existing file, malformed-data, coordinate and output guards remain. Native density, variant generation, random selection, geometry and ordering are unchanged. No options or resources are silently discarded. The old height-window failure is source-derived, rather than an executed baseline failure; custom-biome admission failed first in that baseline.

## Focused validation

- All 8,124 imported/exported files retain their SHA-256 identities, including unrelated resources. Full native snapshot capture reads all 5,594 resources and charges 56,462,317 bytes.
- The actual Wasm/worker/client path loads and inspects `overworld` with no compatibility findings. Both terrain preparation requests publish 146 custom biome definitions for heights −256 through 512, passing the actual JavaScript metadata validator.
- Four selected region answers at seed `813753` match original native Java region selection. These nearby points all select `prismatics`; this is a small comparison, not region-distribution coverage.
- The real `carving/ember-vaults` formations entry 0 previews zero-based variant 23 from its 24-variant pool: ten volume cells and six occupied blocks.
- Existing focused custom-biome, procedural, registered Overworld and image-snapshot/worker checks pass. The rebuilt standalone package passes fourteen-module static delivery and real HTTP/authentication/persistence checks. No production registry export, broad suite or block-state sweep ran.

The reproducible check is `node --experimental-vm-modules tools/checks/overworld-pack-acceptance.mjs --pack /path/to/pinned/overworld`. It verifies the exact input revision and unchanged checkout, uses unique result directories and returns failure while native scalar or generation paths refuse. See [recorded evidence](../evidence/overworld-pack-capacity-2026-10-23.json).

## Remaining feature boundaries

Loading and authoring this pack succeeds. Full terrain generation does not yet succeed: the registered Overworld path refuses imported object placements, and the intermediate scalar terrain path refuses complete hydrology previews. Increasing capacity does not implement these engine adapters. The original native scalar reference harness also stops with `No native cave host` for this hydrology configuration; the separate original region-only oracle succeeds. This is a reference-host limitation, not evidence of an upstream pack defect.

The final check includes every original object binary. An earlier diagnostic deliberately omitted binaries to identify the next blocker; it is not the final acceptance result. Native region inputs from the initial run are reused unchanged in the focused capacity rerun. Actual browser/GPU execution, full terrain parity, large-input performance and the existing release gates remain unqualified.
