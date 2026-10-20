# Compatibility matrix

Target: Iris 4.3.4 at `c3a9449a026078c44a87c9776766f54a67779392`, Minecraft 26.3.

No feature is currently advertised as supported. “Inspected” means source reviewed, not implemented or parity-tested.

| Feature | Source investigation | Browser implementation | Native/browser parity |
| --- | --- | --- | --- |
| Noise and seed derivation | Iris core compiles; 14/15 native noise/seed tests pass, pinned checksum fails | Candidate FastNoiseDouble/RNG Wasm with explicit JDK compatibility; no browser Iris wrapper/SeedManager | 195,696 candidate comparisons pass; target reference remains unqualified |
| Dimensions, regions, biomes, heights | Source locations inventoried | None | Not run |
| Volumetric terrain, caves, subterrain | Upstream systems exist; detailed reachability audit pending | None | Not run |
| Hydrology | Upstream probe entry points identified | None | Not run |
| Surfaces and material selection | Registry/platform boundary identified | None | Not run |
| Deposits, decorators | Detailed behavior audit pending | None | Not run |
| Procedural objects and trees | Detailed behavior audit pending | None | Not run |
| Pack IO, schema editing, saving, undo | Schema builder and resource loader inspected | None | Not applicable yet |
| WebGPU 2D/3D visualizers | Design boundary recorded | None | GPU tests not run |
| Resource packs and block models | Required assets absent | None | Not run |

Excluded scope follows the specification: gameplay, administration, unrelated structure editors, legacy engines, automatic pack migration, and server-generated previews. In-scope generation with unproved behavior must be reported as unsupported rather than replaced with fabricated output.
