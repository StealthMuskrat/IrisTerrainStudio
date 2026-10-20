# Compatibility matrix

Target: Iris 4.3.4 at `c3a9449a026078c44a87c9776766f54a67779392`, Minecraft 26.3.

No feature is currently advertised as supported. “Inspected” means source reviewed, not implemented or parity-tested.

| Feature | Source investigation | Browser implementation | Native/browser parity |
| --- | --- | --- | --- |
| Noise and seed derivation | Iris core compiles; 14/15 tests pass; six native noise/runtime profiles reproduce the failing checksum with identical bits | Actual Iris NoiseStyle/CNG/configured styles/SeedManager compiled to Wasm; worker connection implemented | 195,696 earlier primitive/RNG browser comparisons pass; new focused native/Node check passes, complete browser coverage pending |
| Dimensions, regions, biomes, heights | Source locations inventoried | Native standalone generator/layer bridge compiled; dimension engine missing | Not run |
| Volumetric terrain, caves, subterrain | Upstream systems exist; detailed reachability audit pending | None | Not run |
| Hydrology | Upstream probe entry points identified | None | Not run |
| Surfaces and material selection | Registry/platform boundary identified | None | Not run |
| Deposits, decorators | Detailed behavior audit pending | None | Not run |
| Procedural objects and trees | Detailed behavior audit pending | None | Not run |
| Native pack resources and registries | Actual native IO, compatibility pools and registry exporters inspected | Memory snapshots/loaders and authoring inspection; native predicates/registry metadata; Java compatibility adapter unfinished | Focused four-resource Node Wasm load passes; full parity pending |
| Pack IO, schema editing, saving, undo | Schema builder and resource loader inspected | Local server/editor, lossless JSON, schema rules, recovery and conflicts implemented | Focused editing/recovery checks pass; final integration pending |
| WebGPU 2D/3D visualizers | Design boundary recorded | Scalar WebGPU view and block-model renderer modules implemented | GPU verification pending |
| Resource packs and block models | Required assets absent | Local ZIP stack, models, atlas, animations implemented; remaining client adapters missing | Not run |

Excluded scope follows the specification: gameplay, administration, unrelated structure editors, legacy engines, automatic pack migration, and server-generated previews. In-scope generation with unproved behavior must be reported as unsupported rather than replaced with fabricated output.
