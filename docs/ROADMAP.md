# Roadmap and gates

No calendar estimates are assigned before browser feasibility is demonstrated. Phase numbers and completion gates follow the implementation specification.

| Phase | Result | Completion gate | Current state |
| --- | --- | --- | --- |
| 0 | Immutable dependency inventory, architecture, native reference setup, browser feasibility report, asset provenance | Real Iris functionality runs in a browser-compatible environment, or exact blockers are demonstrated and resolved before implementation advances | In progress; source audit complete, toolchain/dependency/registry/browser blockers open |
| 1 | Supported-path generation proof of concept | Exact native/browser noise, seeds, regions, biomes, heights, and minimal voxel output for a stated real-pack subset | Blocked by Phase 0 |
| 2 | Native pack editor and safe server IO | Schema-driven editing, references, unknown-field preservation, undo/redo, atomic saves, backups and conflict tests | Not started |
| 3 | WebGPU 2D visualizer | Real engine outputs, navigation, revision-aware workers and invalidation; exact parity remains passing | Not started |
| 4 | WebGPU 3D voxel renderer | Actual voxel chunks, correct block models/states, clipping and inspection; measured rendering behavior | Not started |
| 5 | Remaining in-scope terrain systems | Feature-by-feature native/browser regression evidence across volumetric, cave, subterrain, river, material, ore, decorator, object and tree systems | Not started |
| 6 | Resource-pack system | Authorized F8thful/default baseline, local ZIP imports, dependency resolution and non-cube models; switches preserve voxels | Not started |
| 7 | Performance, deployment and release | Measured budgets, full applicable parity/security/integration tests, Docker/persistence checks and documentation | Not started |

## Working process

Track acceptance criteria in GitHub issues. Link each implementation PR to its phase and prerequisite issues. Keep PRs small enough to review against the pinned source. Record test commands, failed/unavailable checks, and remaining blockers. Close issues only when the acceptance evidence is present. Native execution and browser execution are separate results; foundation CI does not certify either.

The first work queue is dependency provenance, schema/registry capture, native reference export, and the TeaVM worker experiment. UI polish, deployment packaging, and new features must not displace that critical path. Asset provenance work can proceed independently without bundling assets.
