# Compatibility matrix

Target: Iris 4.3.4 at `c3a9449a026078c44a87c9776766f54a67779392`, Minecraft 26.3.

No feature is currently advertised as supported. “Inspected” means source reviewed, not implemented or parity-tested.

| Feature | Source investigation | Browser implementation | Native/browser parity |
| --- | --- | --- | --- |
| Noise and seed derivation | Iris core compiles; 14/15 tests pass; six native noise/runtime profiles reproduce the failing checksum with identical bits | Actual Iris NoiseStyle/CNG/configured styles/SeedManager compiled to Wasm; worker connection implemented | 195,696 earlier primitive/RNG browser comparisons pass; new focused native/Node check passes, complete browser coverage pending |
| Dimensions, regions, biomes, heights | Source locations inventoried | Native standalone generators, region selection, inferred biome variants and actual IrisComplex surface-biome/procedural-height streams connected for a limited scalar subset | 336 native/Node region selections, 28 inferred-biome views, 384 surface-biome choices and 384 exact height-bit comparisons agree in scoped checks; complete browser qualification pending |
| Volumetric terrain | Actual Terrain3DRuntime, column spans and fragment filter connected | Native height/column outputs and categorical occupancy slices | 64 native/Node biome-height-column results and 9,216 occupancy API checks agree; full qualification pending |
| Cave profile selection and material resolution | Native MantleCarvingComponent, IrisCaveCarver3D and IrisCarveModifier connected | Profile precedence/blending, configured Y/child entries, fluid boundaries/orphan sweep and material volume in a five-chunk window; full mode ordering/decorations pending | 40 component material chunks / 2,752,512 states agree in native/Node checks; earlier dimension-only checks remain scoped separately; full browser/stage qualification pending |
| Subterrain and remaining cave systems | Upstream systems exist; detailed reachability audit pending | Not connected | Not run |
| Hydrology | Upstream probe entry points identified | None | Not run |
| Surfaces and material selection | Actual native terrain painter/layer generator connected | One-chunk terrain-stage voxel output and canonical rendering metadata | 16 native/Node chunks and 1,048,576 exact state comparisons agree; complete option/pipeline qualification pending |
| Deposits and later material stages | Original deposit modifier, matter insertion, surface/floating decorators and perfection connected | Worker-local dispatch/private clump locks; native stage order; object/structure content explicitly pending | One fixture/seed/chunk with 11 targeted probes passes; complete options, populated content and browser qualification pending |
| Natural cave decoration | Original IrisCarveModifier.decorateNaturalCaves connected after floating solids | Native floor/ceiling palettes, stacks, dripstone, two-block plants and MarkerMatter; native full-face support metadata | 32 native/Node chunks / 2,228,224 states / 814 markers agree; 35,723 masks verified; vines and full decorator/browser qualification pending |
| Floating-child-biome solids | Unchanged IrisFloatingChildBiomeModifier connected after native post-processing | Native top shapes, bottom palettes, merged entries, carving/local fluid and scoped context overlays | 36 native/Node chunks / 2,490,368 states agree; custom biome registry contracts refuse; full biome-volume/decorator/browser qualification pending |
| Overworld post-processing | Unchanged IrisPostModifier and native Mantle height queries connected | Cave-component/paint/carve/post prefix with walls, slabs, nib/pothole and waterlogging code retained | 28 native/Node chunks / 1,835,008 block states agree; complete options/foliage/browser qualification pending |
| Deposits, decorators | Detailed behavior audit pending | None | Not run |
| Procedural objects and trees | Detailed behavior audit pending | None | Not run |
| Native pack-specific schemas | Unchanged SchemaBuilder with native world/reloadable registries | 70-schema fixture export and snapshot/hash-checked editor attachment | Four unchanged fixture resources report zero validation issues; complete conformance and browser verification pending |
| Native pack resources and registries | Actual native IO, compatibility pools and registry exporters inspected | Memory snapshots/loaders and authoring inspection; native predicates/registry metadata; Java registry adapter and actual compatibility walker connected | Focused parser/matching and six native compatibility scenarios agree in Node Wasm; full parity pending |
| Pack IO, schema editing, saving, undo | Schema builder and resource loader inspected | Local server/editor, lossless JSON, schema rules, recovery and conflicts implemented | Focused editing/recovery checks pass; final integration pending |
| WebGPU 2D/3D visualizers | Design boundary recorded | Native scalar/occupancy maps and native painting-stage voxel renderer connection implemented | GPU verification pending |
| Resource packs and block models | Required assets absent | Local ZIP stack, models, atlas, animations implemented; remaining client adapters missing | Not run |

Excluded scope follows the specification: gameplay, administration, unrelated structure editors, legacy engines, automatic pack migration, and server-generated previews. In-scope generation with unproved behavior must be reported as unsupported rather than replaced with fabricated output.
