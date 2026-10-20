# IRIS TERRAIN STUDIO

## Complete Software Implementation Specification

**Project type:** Self-hosted, browser-based terrain-generation editor and visualizer

**Primary objective:** Build a lightweight, intuitive application for creating, editing, and visualizing Iris Dimension Engine terrain configurations.

**Reference implementation:** VolmitSoftware Iris Dimension Engine

**Initial Iris target:** v4.3.4, updated to the latest stable release if a newer version exists when development begins

**Initial Minecraft target:** 26.3

**Rendering backend:** WebGPU

**Terrain generation:** Fully client-side, using an Iris-accurate browser engine

**Default resource pack:** User-provided F8thful 8×8 Minecraft resource pack

**Deployment:** Standalone local web application or self-hosted server

---

# 1. PROJECT OBJECTIVE

Develop a standalone web application called **Iris Terrain Studio**, designed specifically to streamline creating and editing general terrain generation for Iris Dimension Engine.

The application must provide a simple, responsive graphical interface in which users can:

1. Create and edit Iris-compatible dimension packs.
2. Manage dimensions, regions, biomes, noise generators, caves, rivers, surfaces, and procedural generation resources.
3. Modify terrain-generation parameters without manually editing JSON.
4. Visualize generated terrain in an interactive 3D voxel environment.
5. Inspect noise, heightmaps, biome distribution, and other terrain-generation information in a 2D visualizer.
6. Immediately preview how configuration changes affect terrain.
7. Load and save real Iris dimension-pack files.
8. Use Minecraft resource packs for accurate block rendering.
9. Run the application locally or host it on a server accessible through a web browser.

The application is exclusively a terrain-generation authoring and visualization tool.

It is NOT intended to recreate Minecraft, replace Iris, implement Iris's complete gameplay systems, or develop a general-purpose world editor.

Prioritize:

- Exact Iris terrain-generation compatibility.
- Responsive client-side generation.
- Efficient WebGPU rendering.
- Minimal server communication.
- A clean, accessible user interface.
- Correct handling of Iris configuration files.
- Low memory usage and predictable performance.
- Strict control of feature scope.

**Fundamental requirement:** Given identical generation inputs, the browser terrain engine must reproduce the target Iris version's supported terrain-generation output exactly.

Visual similarity is insufficient.

# 2. NON-NEGOTIABLE ARCHITECTURAL REQUIREMENTS

The following requirements take precedence over implementation convenience.

## 2.1 All terrain generation must happen in the browser

The browser must contain its own functional terrain-generation engine.

This engine must perform:

- Noise evaluation.
- Region selection.
- Biome selection.
- Height calculations.
- Volumetric terrain generation.
- Cave generation and carving.
- Authored subterrain generation.
- River and hydrology generation.
- Surface material placement.
- Deposit and ore generation.
- Decorator placement.
- Procedural object generation.
- Procedural tree generation.

The server must not generate terrain on behalf of the browser.

The application must not depend on a remote Minecraft or Iris server to generate previews during normal operation.

## 2.2 Server communication restrictions

After delivering the application itself, the server may communicate only information required for Iris pack management.

Allowed application data:

- Iris configuration files.
- Referenced Iris pack assets.
- Pack and resource listings.
- Resource paths and identifiers.
- File version information.
- Validation and save responses.
- Authentication and file-management metadata.

Disallowed application data:

- Generated Minecraft chunks.
- Generated voxel arrays.
- Terrain meshes.
- Heightmap sample buffers.
- Rendered terrain images.
- Generated noise textures.
- Server-calculated terrain results.
- Server-generated procedural objects or trees.

All generated terrain and visual information must remain within the browser.

Preview coordinates, local rendering settings, temporary generation caches, and unsaved editing state should remain client-side unless explicitly stored in legitimate pack configuration data.

The server may deliver JavaScript, WebAssembly, shaders, textures, and other static application assets during application loading.

## 2.3 Exact compatibility with Iris

Do not implement an approximate terrain generator.

Do not substitute generic simplex noise, Perlin noise, or custom terrain algorithms where Iris uses different behavior.

The browser engine must reproduce the corresponding native Iris algorithms, including:

- Seed handling and derivation.
- Random-number generation.
- Coordinate transformations.
- Noise evaluation.
- Floating-point behavior.
- Integer overflow and arithmetic.
- Interpolation.
- Generation ordering.
- Resource inheritance and overrides.
- Biome and region decisions.
- Neighboring-chunk interactions.
- Feature placement and collision rules.
- Material selection.
- Hydrology and carving behavior.

Any algorithmic differences must be identified and corrected through reference comparisons.

If a feature cannot achieve exact parity, it must not be presented as an accurate supported feature.

## 2.4 Latest stable Iris version only

The application must support one current Iris release at a time.

At the beginning of implementation:

1. Determine the latest stable Iris release.
2. Identify its corresponding Minecraft compatibility.
3. Select the latest supported Minecraft version as the application's reference target.
4. Pin the exact Iris Git revision.
5. Pin the corresponding schema and registry definitions.
6. Build and test against those pinned revisions.

At the time this specification was prepared, the reference is Iris 4.3.4, with Minecraft 26.3 and Java 25.

Do not implement:

- Legacy Iris engines.
- Deprecated configuration formats.
- Multi-version compatibility layers.
- Automatic migration of old packs.
- Backward-compatible rendering pipelines.

When a new stable Iris version becomes available, update the engine and schemas together, then rerun all parity tests before publishing the updated application.

A new upstream release must not silently change an already deployed engine.

# 3. AUTHORITATIVE REFERENCE MATERIAL

Use the actual Iris source code and current documentation as the authoritative references.

Primary sources:

- [https://github.com/VolmitSoftware/Iris](https://github.com/VolmitSoftware/Iris)
- [https://github.com/VolmitSoftware/Iris/releases](https://github.com/VolmitSoftware/Iris/releases)
- [https://github.com/VolmitSoftware/docs](https://github.com/VolmitSoftware/docs)
- [https://www.teavm.org](https://www.teavm.org)
- [https://threejs.org](https://threejs.org)

Before implementation, inspect the real Iris source code to identify:

- Shared generation modules.
- Platform-dependent modules.
- Configuration schemas.
- Noise implementations.
- Random-number utilities.
- Terrain-generation order.
- Block-state dependencies.
- Hydrology implementation.
- Cave and subterrain systems.
- Procedural objects and trees.
- Existing determinism tests.

Do not assume resource layouts, class names, JSON fields, default values, or generation rules without checking the pinned Iris revision.

Where this specification describes a feature at a conceptual level, implement its exact behavior and configuration structure as defined by the target version of Iris.

# 4. APPLICATION ARCHITECTURE

Use a modular architecture with three primary systems.

## 4.1 Application server

Recommended technologies:

- Node.js
- TypeScript
- Fastify
- Docker for deployment

Responsibilities:

- Serve the browser application.
- Serve the compiled client-side generation engine.
- List available Iris packs.
- Read Iris pack files.
- Create valid new pack resources.
- Write modified configuration files.
- Preserve unrelated pack files.
- Validate file access and server-side save operations.
- Manage backups and editing conflicts.

The application server must not execute terrain-generation jobs.

The server should remain lightweight enough to run without Minecraft or Java during normal application operation.

## 4.2 Browser application

Recommended technologies:

- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand or an equivalent lightweight state manager
- Web Workers
- Three.js with a verified WebGPU backend

Responsibilities:

- Configuration editing.
- Pack-resource navigation.
- Local configuration validation.
- Client-side terrain generation.
- 2D terrain visualization.
- 3D voxel visualization.
- Resource-pack loading.
- Block-model resolution.
- Texture atlas construction.
- Local generation caching.
- Undo and redo.
- Saving modified resources.

## 4.3 Browser generation engine

Preferred implementation:

Use the actual Iris generation code wherever feasible, compiled or adapted for browser execution.

Investigate TeaVM and its WebAssembly backend first.

The generation engine should run inside dedicated Web Workers, independently of the UI rendering thread.

If compiling the necessary Java code to WebAssembly proves impractical, investigate compiling the same source to browser-compatible JavaScript while retaining its behavior.

A complete independent rewrite should be considered only when necessary, and every replacement algorithm must pass deterministic comparison tests.

Do not abandon exact parity to simplify the implementation.

If a required Minecraft-dependent service cannot be adapted for browser execution, identify the dependency and resolve it through a local compatibility layer.

Do not secretly substitute server-side generation.

# 5. BROWSER GENERATION ENGINE

## 5.1 Required architecture

Separate generation into these logical modules:

1. Iris configuration loader.
2. Resource-reference resolver.
3. Noise and expression evaluator.
4. Region and biome selector.
5. Terrain height generator.
6. Volumetric terrain generator.
7. Cave and carving processor.
8. Authored subterrain processor.
9. Hydrology processor.
10. Surface and material processor.
11. Deposit and ore processor.
12. Decorator processor.
13. Procedural object and tree processor.
14. Block-state output and local voxel storage.

These are conceptual module boundaries. Preserve the actual Iris generation ordering and dependencies rather than forcing an incorrect sequence.

## 5.2 Generation inputs

The engine must accept:

- Selected dimension.
- Complete resolved pack configuration.
- World seed.
- World coordinates.
- Requested generation area.
- Target Iris revision.
- Target Minecraft block registry.
- Relevant feature and generation context.

Use the same seed interpretation as native Iris.

Java 64-bit arithmetic must be preserved where necessary. Avoid JavaScript Number precision loss for long seed values.

## 5.3 Generation outputs

The engine should expose efficient local interfaces for:

- Scalar noise sampling.
- 2D field sampling.
- 3D density sampling.
- Terrain height queries.
- Biome and region identity.
- Hydrology diagnostics.
- Voxel chunk generation.
- Block-state palettes.
- Feature and material metadata required for inspection.

The renderer must consume these outputs locally.

Do not serialize generated voxel data into network requests.

## 5.4 Worker management

Implement generation through Web Workers.

Requirements:

- Do not block the React UI thread.
- Support asynchronous preview generation.
- Support cancellation of obsolete jobs.
- Prevent stale jobs from overwriting newer previews.
- Reuse compiled engine instances where safe.
- Apply memory limits and bounded work queues.
- Support transferable buffers where appropriate.
- Reuse generated data when inputs have not changed.

The engine must be deterministic regardless of the order in which preview requests are submitted.

# 6. SUPPORTED IRIS TERRAIN-GENERATION FEATURES

Implement only the following systems and the dependencies required for their correct operation.

## 6.1 Dimensions

Support the terrain-related parts of Iris dimension configuration.

Include:

- Dimension creation and selection.
- Dimension identity and required metadata.
- World height and vertical bounds.
- Fluid level.
- Region references.
- Terrain sampling settings.
- Region and biome distribution controls.
- Terrain and material configuration.
- Terrain-related feature toggles.
- Dimension-specific generation settings.

Support relevant inverted or stacked terrain configurations when required by the pinned Iris terrain-generation implementation.

Only implement the generation aspects necessary to visualize terrain accurately.

Exclude gameplay and server-administration settings unless required as generation inputs.

## 6.2 Regions

Implement Iris region configurations and their relationships to dimensions and biomes.

Support:

- Region selection.
- Region distribution.
- Region noise settings.
- Land, sea, shore, and cave biome pools.
- Biome references.
- Biome selection weights and styles.
- Region-level terrain settings.
- Region-level overrides.
- Terrain material and feature references.

Provide an intuitive interface for editing relationships between regions and biomes.

## 6.3 Biomes

Support the terrain-generation portions of Iris biome configurations.

Include:

- Biome creation and editing.
- Terrain generators.
- Generator blending and weighting.
- Surface materials.
- Terrain layers.
- Cave-related settings.
- Hydrology-related policies.
- Decorators.
- Deposits and ores.
- Procedural objects and trees.
- Terrain-related inheritance and overrides.

Provide direct navigation from biome references to the corresponding editable resources.

## 6.4 Noise generators and expressions

Implement all noise types and generator configurations required by the supported Iris terrain systems.

Include:

- Native Iris noise styles.
- Configurable noise parameters.
- Noise zoom and scaling.
- Octaves and related modifiers.
- Composite generators.
- Generator blending.
- Height transformations.
- Noise expressions.
- Referenced snippets.
- Image-based noise and height inputs.
- 2D and 3D noise evaluation where applicable.

Every noise algorithm must reproduce the actual Iris implementation.

A generic noise library may only be used if verified to produce identical results.

## 6.5 Volumetric terrain

Support Iris volumetric terrain features, including:

- `terrain3D` configuration.
- Overhangs.
- Cliffs.
- Floating terrain.
- Terrain shelves.
- Multiple solid spans.
- Natural openings.
- Ceiling terrain.
- Other supported volumetric shaping behavior.

The 3D visualizer must represent the actual block geometry produced by these systems.

Do not reduce volumetric terrain to a basic heightmap.

## 6.6 Caves and carving

Implement:

- Cave profiles.
- 3D cave density fields.
- Cave generation thresholds.
- Vertical cave restrictions.
- Cave-biome selection.
- Cave carving.
- Cave fluids.
- Cave floor, wall, and ceiling materials.
- Cave decorators.
- Cave profile inheritance and overrides.
- Appropriate interactions with terrain and hydrology.

Support cave visualization through horizontal slices, vertical cross-sections, and full 3D voxel previews.

## 6.7 Authored subterrain features

Support the subterrain families provided by the pinned Iris version, including:

- Faults.
- Cenotes.
- Lava tubes.
- Travertine basins.
- Associated chambers, formations, materials, and fluids.

Implement their actual placement, geometry, biome, material, and carving behavior.

Do not approximate these as randomly placed generic caves.

## 6.8 Rivers and hydrology

Implement the Iris hydrology system.

Support:

- Surface rivers.
- River routing.
- Sources and outlets.
- Tributaries.
- River meanders.
- River width and depth.
- River valley carving.
- Riverbanks and beds.
- Erosion-related shaping.
- River mouths.
- Waterfalls and cascades.
- Underground rivers.
- Grottos and sinkholes.
- Deep fluids.
- River policy and content rules.
- Interactions with terrain, biomes, caves, and object placement.

Provide 2D hydrology diagnostics showing the generated river network.

The 3D preview must display the actual river and water geometry.

## 6.9 Surfaces and material layers

Implement the applicable Iris surface-generation systems.

Support:

- Surface layer definitions.
- Surface material selection.
- Land, shore, seabed, cave, and ceiling surfaces.
- Layer depths.
- Material palettes.
- Material noise.
- Surface treatment rules.
- Relevant biome and region overrides.
- Rock and fluid palettes.
- Terrain post-processing required for accurate results.

## 6.10 Decorators

Support terrain-related decorators, including:

- Grass.
- Flowers.
- Small vegetation.
- Natural surface clutter.
- Underwater decoration.
- Cave decoration.
- Ceiling decoration.
- Other Iris-defined terrain decorators.

Implement relevant density, biome, noise, material, height, orientation, and placement conditions.

## 6.11 Deposits and ores

Support:

- Ore configurations.
- Deposit definitions.
- Deposit variants.
- Vein and blob distributions.
- Height ranges.
- Noise-driven placement.
- Replacement rules.
- Host-material restrictions.
- Biome restrictions.
- Cave-exposure behavior.
- Relevant dimension and region overrides.

Provide a way to inspect underground deposits through the 3D cross-section view.

## 6.12 Procedural objects

Support Iris procedural objects used for natural terrain generation.

Examples include:

- Natural rock formations.
- Boulders.
- Hoodoos.
- Spires.
- Organic formations.
- Fungi.
- Coral.
- Crystals.
- Procedural natural arches.
- Other supported procedural object families.

Implement their generation parameters, materials, variation, and placement conditions.

Do not implement a general-purpose imported structure editor.

## 6.13 Procedural trees

Implement Iris procedural tree generation.

Support:

- Tree profiles.
- Trunk generation.
- Branching.
- Forks.
- Roots.
- Canopy and foliage generation.
- Material selection.
- Tree variants.
- Random seed behavior.
- Placement and environmental restrictions.
- Terrain interaction.

Include an isolated tree preview mode that renders individual procedural tree variants using the same browser engine.

## 6.14 Required dependencies

Include any supporting system necessary for the above features to function correctly.

Examples:

- Block-state references.
- Custom block aliases used by terrain resources.
- Material palettes.
- Generator expressions.
- Reusable snippets.
- Image maps.
- Resource inheritance.
- Placement conditions.
- Native generation context.
- Required block registries.
- Terrain generation flags.

These dependencies must not become an excuse to expand the application into unrelated Iris functionality.

# 7. EXPLICITLY EXCLUDED FEATURES

Do not implement editors or generation systems for:

- Entity spawning.
- Mob AI.
- Gameplay mechanics.
- Loot tables.
- Custom item drops.
- Combat systems.
- Inventory systems.
- Player-related systems.
- Minecraft world gameplay simulation.
- Server permissions management.
- Minecraft server configuration.
- World pregeneration administration.
- Imported conventional structures.
- Jigsaw structure systems.
- Structure libraries.
- General-purpose structure building.
- Full Minecraft object editing.
- Vanilla structure placement.
- Unrelated vanilla or modded gameplay features.
- Commands unrelated to pack editing.
- Unrelated Iris integrations.
- General-purpose 3D modeling tools.

Existing packs may contain these resources.

The application must preserve their files and configuration fields when loading and saving, but must not expose editors or simulate excluded features.

If an excluded feature affects complete generated-chunk output, report this clearly.

The engine must guarantee exact parity for the supported terrain-generation scope, not falsely claim full Minecraft-world parity for deliberately excluded content.

Do not silently replace excluded generation with approximate results.

# 8. USER INTERFACE REQUIREMENTS

The UI must be minimal, consistent, intuitive, and easy to understand.

Avoid unnecessary menus, nested dialogs, and excessive controls.

Use a three-panel editor layout.

## 8.1 Main layout

### Left panel — Resource Explorer

Displays the loaded Iris pack and supported resources.

Organize resources under understandable categories:

- Dimensions
- Regions
- Biomes
- Noise & Generators
- Caves & Carving
- Subterrain
- Rivers & Hydrology
- Surfaces
- Decorators
- Deposits & Ores
- Procedural Objects
- Procedural Trees

These are UI categories, not necessarily literal Iris resource folders.

Use the actual Iris resource layout when reading and writing data.

Provide:

- Search.
- Resource selection.
- Add resource.
- Duplicate resource.
- Rename resource.
- Delete resource.
- Expand and collapse groups.

Warn users when an action would break references.

### Center panel — Main Visualizer

This panel occupies the majority of the available screen space.

Provide two primary visualization modes:

**2D Map** and **3D World**.

Include an optional split view.

Provide a small control bar for:

- Selected dimension.
- World seed.
- Preview coordinates.
- Preview size.
- Regenerate.
- Camera reset.
- Visualization mode.

### Right panel — Properties Inspector

Display settings relevant to the currently selected resource.

Use:

- Sliders.
- Number inputs.
- Toggles.
- Dropdowns.
- Color indicators.
- Resource selectors.
- Collapsible property groups.
- Inline validation messages.

Organize properties by function.

Provide Basic and Advanced modes.

Basic mode should expose the most useful terrain-generation controls.

Advanced mode should expose all supported configuration fields.

Use tooltips with concise explanations based on the current Iris documentation and schemas.

## 8.2 Top toolbar

Include:

- Application title.
- Pack selector.
- Dimension selector.
- Save button.
- Undo.
- Redo.
- Texture-pack selector.
- Settings.

Avoid adding unrelated toolbar functions.

## 8.3 Bottom status bar

Display:

- Current world coordinates.
- Selected biome and region when available.
- Current Iris target version.
- Preview generation progress.
- Validation status.
- Generation or rendering errors.

Keep the status bar unobtrusive.

## 8.4 User experience principles

The editor must:

- Have clear visual hierarchy.
- Keep the visualizer prominent.
- Avoid visual clutter.
- Retain selections when switching views.
- Preserve camera state where practical.
- Clearly identify unsaved changes.
- Display meaningful errors.
- Support keyboard shortcuts for common actions.
- Support undo and redo.
- Allow resizing of editor panels.
- Remain responsive during generation.

Do not use unnecessary animations or decorative interfaces that reduce performance.

# 9. 2D TERRAIN AND NOISE VISUALIZER

Implement a WebGPU-accelerated 2D visualizer using actual browser-engine generation outputs.

## 9.1 Required views

Support:

1. Raw noise.
2. Combined noise.
3. Final terrain heightmap.
4. Region distribution.
5. Biome distribution.
6. Land and ocean distribution.
7. Cave density at a selected Y coordinate.
8. Volumetric terrain density slices.
9. River and hydrology map.
10. Deposit distribution or eligibility map.
11. Other directly relevant generation diagnostics supported by the engine.

## 9.2 Controls

Provide:

- Pan.
- Zoom.
- Coordinate selection.
- Preview resolution.
- Seed selection.
- Noise visualization range.
- Grayscale and heatmap coloring.
- Optional grid.
- Horizontal slice elevation where applicable.
- Value inspection at the cursor.

Clicking a map location should allow the user to center the 3D preview at the same world coordinates.

## 9.3 Noise editing behavior

When a noise generator is selected:

- Automatically display its relevant noise preview.
- Show raw noise separately from transformed output.
- Allow viewing the resulting terrain height where applicable.
- Update the preview when parameters change.
- Keep the same seed and coordinates during comparisons.

Expensive previews should use debounced background generation.

Noise visualizations must reflect the actual Iris calculations, not approximations generated by GPU shaders.

WebGPU may perform coloring, scaling, filtering, and display operations without changing authoritative generation values.

# 10. 3D WEBGPU VOXEL VISUALIZER

Build a high-performance Minecraft-style voxel visualizer.

The 3D preview must display locally generated block data using actual Minecraft block models, blockstates, and resource-pack textures.

## 10.1 Rendering technology

Use WebGPU as the required 3D rendering backend.

Three.js `WebGPURenderer` is the preferred starting point.

Explicitly verify WebGPU availability and confirm that the renderer is actually using WebGPU.

Do not silently fall back to WebGL.

If WebGPU is unavailable:

- Display a clear compatibility message.
- Disable 2D and 3D GPU visualization as necessary.
- Keep pack editing and saving available.

## 10.2 World rendering

Support:

- Terrain blocks.
- Cave geometry.
- Surface materials.
- Water and lava.
- Deposits and ores.
- Natural decorators.
- Procedural objects.
- Procedural trees.
- Non-cubic block models.
- Correct blockstate orientations.

Render the actual output of the local terrain engine.

Do not use generic terrain meshes as substitutes for generated voxel data.

## 10.3 Camera controls

Implement:

- Orbit.
- Pan.
- Zoom.
- Optional free-fly camera.
- Reset view.
- Focus on selected coordinates.
- Jump to selected biome or map location.

Camera movement must remain smooth during background generation.

## 10.4 Inspection tools

Clicking a rendered block should display:

- World coordinates.
- Block identifier.
- Blockstate properties.
- Selected biome.
- Selected region.
- Relevant generation information when available.

## 10.5 Cross-section controls

Implement configurable clipping planes.

Support:

- Horizontal Y slices.
- Vertical X slices.
- Vertical Z slices.
- Adjustable clipping positions.
- Underground-focused views.
- Cave inspection.
- Deposit inspection.
- Material-layer inspection.

Cross-sections must expose actual generated voxel data.

## 10.6 Visualization modes

Include optional:

- Textured terrain view.
- Biome-color view.
- Region-color view.
- Cave inspection view.
- Deposit visualization.
- Material visualization.

Only expose intermediate generation stages when the engine can provide real stage data.

Do not invent intermediate terrain states.

# 11. WEBGPU RENDERING OPTIMIZATION

Implement a rendering pipeline designed for Minecraft-style voxel terrain.

## 11.1 Chunk-based rendering

Generate and store terrain in chunks matching Iris/Minecraft chunk coordinate behavior.

Build rendering geometry locally.

Use chunk-based mesh caching and update only affected areas.

## 11.2 Geometry optimization

Implement:

- Hidden-face culling.
- Greedy meshing for compatible cube faces.
- Chunk frustum culling.
- Efficient non-cube block-model batching.
- Instancing where beneficial.
- Mesh reuse.
- GPU buffer reuse.
- Limited GPU allocation churn.
- Neighbor-aware face visibility.

Do not greedily merge faces that would break texture coordinates, material variation, tinting, transparency, or visual correctness.

## 11.3 Texture rendering

Use:

- Texture atlases or texture arrays.
- Efficient material batching.
- Nearest-neighbor sampling for pixel-art textures.
- Appropriate mipmapping without excessive texture bleeding.
- Correct transparency and alpha cutout.
- Biome tinting where applicable.
- Animated block textures where required.

Texture filtering must preserve the intended pixel-art style.

## 11.4 Rendering and generation separation

Resource-pack changes must invalidate rendering resources, not generated terrain.

Camera changes must not trigger terrain regeneration.

Material and texture changes must not change voxel contents.

WebGPU shader calculations must not replace authoritative Iris algorithms unless their exact equivalence has been demonstrated.

# 12. MINECRAFT RESOURCE-PACK SYSTEM

## 12.1 Default resource pack

Use the supplied `F8thful.zip` as the default development resource pack.

It is an 8×8 Minecraft resource pack.

The bundled rendering assets must be optimized for this application.

Preserve all files necessary for block rendering, including:

- Block textures.
- Block animation metadata.
- Block model definitions.
- Blockstate definitions.
- Referenced parent models.
- Referenced texture dependencies.
- Other assets strictly required by supported block models.

Remove assets unrelated to block rendering.

Examples of generally unnecessary content:

- Entity textures.
- Item-only textures.
- GUI textures.
- Fonts.
- Paintings.
- Mob-effect icons.
- Interface graphics.
- Unrelated OptiFine features.
- Legacy compatibility overlays not applicable to the target version.

Do not remove an asset if a retained block model genuinely depends on it.

Validate each resource dependency before removing it.

The provided pack contains older-format overlay folders. Resolve whether those overlays apply to the pinned Minecraft target, and exclude inapplicable legacy overlays from the optimized build.

Do not retain historical format compatibility merely because it exists in the original archive.

## 12.2 Baseline Minecraft block definitions

The F8thful pack overrides only some Minecraft assets.

Provide the matching vanilla block-model and blockstate baseline for the pinned Minecraft version through a legally appropriate asset-loading process.

Do not assume that F8thful provides every required model or texture.

Resolve missing assets against the correct vanilla baseline.

Do not silently substitute a cube model for a missing model.

## 12.3 Custom resource-pack loading

Allow users to select and load a standard Minecraft resource-pack ZIP directly from their computers.

The selected resource pack must be processed entirely in the browser.

Do not upload custom resource packs to the application server.

Support temporary use from memory and optional local persistence through IndexedDB.

Provide:

- Load custom resource pack.
- Select the active pack.
- Restore the default pack.
- Display the current resource-pack name.
- Report unsupported or missing assets.

## 12.4 Resource-pack precedence

Use this default resolution order:

1. Selected custom resource-pack overrides.
2. Built-in F8thful overrides.
3. Matching vanilla Minecraft asset baseline.

Permit the user to choose whether custom packs partially override the default or replace its overrides entirely.

## 12.5 Block model and blockstate resolution

Implement the model formats required by the pinned Minecraft version.

Support:

- Model inheritance.
- Parent model references.
- Texture variables.
- Model elements.
- Element rotations.
- Face UV mapping.
- Texture UV rotations.
- Face culling information.
- Blockstate variants.
- Multipart blockstates.
- Blockstate property matching.
- Model rotations.
- UV locking.
- Weighted model variants.
- Relevant display geometry.
- Tint indices.
- Transparency.
- Animation metadata.

Handle typical terrain-rendering block types correctly, including:

- Full blocks.
- Slabs.
- Stairs.
- Fences.
- Walls.
- Logs.
- Leaves.
- Grasses.
- Flowers.
- Cross-plane plants.
- Fluids.
- Other shapes used by supported terrain-generation resources.

Model selection must reproduce deterministic or contextual variation where required.

## 12.6 Resource-pack build optimization

Create an asset-processing pipeline that:

1. Reads the supplied pack.
2. Resolves the target pack format.
3. Extracts relevant block resources.
4. Follows model and texture dependencies.
5. Removes unrelated assets.
6. Validates references.
7. Builds a block texture manifest.
8. Prepares GPU-friendly texture resources.
9. Reports missing required assets.
10. Outputs an optimized rendering asset bundle.

Do not assume every image in the block directory is exactly 8×8; animated textures and packed texture strips may use different dimensions.

Preserve valid animation and metadata behavior.

## 12.7 Asset licensing

Review the licenses governing Iris, F8thful, and Minecraft assets before distributing application builds.

The supplied F8thful archive may be used as a local development input, but public redistribution must not be assumed permissible.

If distribution permission is unavailable, provide a local asset-import or build-time provisioning workflow that lets an authorized user supply the pack themselves.

Likewise, do not redistribute proprietary vanilla Minecraft assets without appropriate authorization.

The project must document which assets are bundled, imported, generated, or excluded and why.

# 13. IRIS PACK FILE MANAGEMENT

## 13.1 Native pack compatibility

The application must operate directly on real Iris dimension-pack files.

Do not invent a proprietary replacement format.

Support opening:

- Existing pack directories managed by the server.
- Imported Iris pack archives.
- Newly created valid packs.

Use the resource structures and naming conventions of the pinned Iris version.

## 13.2 Configuration editing

The browser editor should use schema-driven controls where feasible.

Use actual Iris schema information for:

- Field types.
- Valid ranges.
- Allowed values.
- Defaults.
- Descriptions.
- Resource references.
- Required fields.

Support advanced editing for every in-scope configuration field.

## 13.3 Resource references

Implement a dependency-aware resource system.

Examples:

- Dimension references region.
- Region references biome.
- Biome references generator.
- Generator references expressions and noise resources.
- Biome references decorators and procedural content.
- Image-map configuration references PNG assets.

Provide navigation and reference validation.

Prevent accidental deletion or renaming that would break other resources without clearly warning the user.

## 13.4 Preserve unsupported resources

When loading and saving existing packs:

- Preserve all unrelated resource files.
- Preserve unknown JSON fields.
- Preserve unsupported but valid configuration fields.
- Preserve unmodified resource values.
- Do not silently normalize or overwrite unrelated data.
- Do not rewrite the entire pack unnecessarily.

Use a lossless or minimally destructive editing strategy.

Unknown fields must remain intact unless the user explicitly removes them through an appropriate supported operation.

## 13.5 Saving

Support:

- Explicit Save.
- Save All.
- Unsaved-change indicators.
- Undo.
- Redo.
- Atomic server-side writes.
- File backups.
- Conflict detection.
- Validation before saving.

Do not rewrite production Minecraft world chunks.

Editing a pack should modify its source configuration, not existing world data.

## 13.6 Invalid or incompatible packs

When a pack is incompatible with the target Iris version:

- Clearly identify the incompatibility.
- Explain which resources or fields are affected.
- Prevent inaccurate previews.
- Do not automatically migrate the pack.
- Do not silently substitute defaults.

If partial inspection is safe, permit it without claiming full compatibility.

# 14. APPLICATION SERVER AND DEPLOYMENT

## 14.1 Server responsibilities

Implement a minimal HTTP API for:

- Listing available packs.
- Opening a pack.
- Reading a resource.
- Creating a resource.
- Updating a resource.
- Deleting a resource.
- Saving a pack.
- Loading required pack assets.

The server may perform file-integrity and schema checks but must not calculate terrain-generation outputs.

## 14.2 API behavior

Use clearly versioned API endpoints.

Use optimistic concurrency control to prevent simultaneous editors from silently overwriting one another.

Return validation and file-operation errors in a structured format.

Avoid unnecessary polling.

Do not create endpoints for:

- Generating chunks.
- Sampling noise.
- Rendering images.
- Generating heightmaps.
- Building 3D meshes.
- Creating procedural objects.

## 14.3 Security

For remotely hosted deployments, implement:

- Optional local-only mode.
- Authentication for remote use.
- Configurable access permissions.
- Safe file path resolution.
- Protection against directory traversal.
- Restricted writable pack directories.
- ZIP archive size limits.
- ZIP-bomb protection.
- Validation of uploaded or imported files.
- Atomic backups.
- Safe error handling.
- Appropriate security headers.

Treat imported pack content as untrusted data.

Do not execute code contained inside packs.

## 14.4 Deployment options

Provide:

- Local development mode.
- Production server mode.
- Docker deployment.
- Configurable listening address.
- Configurable port.
- Configurable pack storage directory.
- Persistent storage for pack files.
- HTTPS support through a reverse proxy.

The normal production runtime must not require a Minecraft server.

Use Java and native Minecraft/Iris runtimes only for development tooling or parity-reference testing unless explicitly required for a non-networked build process.

# 15. STATE MANAGEMENT AND PREVIEW INVALIDATION

Keep configuration state separate from generated data and rendering state.

Recommended state groups:

- Pack configuration.
- Resource selection.
- Editing history.
- Generation inputs.
- Generation cache.
- Visualizer state.
- Camera state.
- Rendering assets.
- UI preferences.

## 15.1 Generation updates

When a terrain-related setting changes:

1. Update the in-memory configuration.
2. Validate affected resources.
3. Identify impacted generation dependencies.
4. Invalidate affected cached data.
5. Cancel obsolete generation jobs.
6. Schedule the required new preview.
7. Keep the existing preview visible until replacement data is ready where practical.
8. Display the updated result.

Avoid regenerating unrelated terrain.

## 15.2 Rendering updates

When only the camera moves:

- Do not recalculate terrain.
- Update camera and visible rendering state.

When a texture pack changes:

- Retain generated voxel data.
- Rebuild relevant texture and model resources.
- Refresh affected meshes.

When the world seed changes:

- Invalidate dependent generated data.
- Preserve UI settings and camera preferences as appropriate.

## 15.3 Preview revisions

Each generation request should be associated with:

- Pack revision.
- Dimension identifier.
- World seed.
- Coordinate range.
- Generation settings.
- Engine version.

Prevent output generated for one revision from being displayed as if it belongs to another.

# 16. PERFORMANCE REQUIREMENTS

Performance is a major priority.

However, generation accuracy must always take precedence over approximate optimization.

## 16.1 Preview defaults

Suggested initial defaults:

- 2D preview: 512×512 samples.
- 3D preview: 4×4 chunks.
- Adjustable preview size.
- Fixed world seed until changed.
- Generation around selected world coordinates.

Allow larger previews based on available device resources.

## 16.2 Generation optimization

Use:

- Web Workers.
- WebAssembly where feasible.
- Cached noise evaluations.
- Cached resolved resources.
- Bounded generation queues.
- Cancellable generation requests.
- Selective invalidation.
- Transferable buffers.
- Appropriate memory management.
- Reuse of immutable generation context.

Do not introduce optimizations that change the final output.

## 16.3 Rendering optimization

Target smooth camera navigation on supported GPUs.

Use optimized chunk meshes, atlas-based materials, batching, and culling.

Avoid creating a separate draw call for every block.

Cache geometry when possible.

Release GPU resources that are no longer needed.

## 16.4 Performance testing

Create repeatable benchmarks measuring:

- Browser-engine startup time.
- 2D noise generation time.
- 3D chunk generation time.
- Meshing time.
- Resource-pack parsing time.
- GPU upload time.
- Frame rate.
- Browser memory consumption.
- GPU memory consumption.
- Pack-edit-to-preview latency.

Establish concrete performance budgets on defined reference hardware.

Do not claim that performance targets are met without measurements.

# 17. EXACT IRIS GENERATION PARITY

This is the most important technical requirement.

## 17.1 Native Iris reference environment

Create a development-only reference environment using the pinned native Iris version.

Generate authoritative reference data from actual Iris.

This reference environment must be separate from the deployed application.

It must not serve chunks to browser clients in normal use.

## 17.2 Required comparisons

Compare the browser engine against native Iris for:

1. Individual noise values.
2. Combined noise values.
3. Terrain heights.
4. Region selection.
5. Biome selection.
6. Volumetric terrain.
7. Cave density and carved blocks.
8. Authored subterrain.
9. Hydrology.
10. Surface materials.
11. Deposits.
12. Decorators.
13. Procedural objects.
14. Procedural trees.
15. Final block states for supported generation content.

Use deterministic reference inputs.

## 17.3 Testing conditions

Test across:

- Multiple seeds.
- Positive coordinates.
- Negative coordinates.
- Large coordinates.
- Chunk boundaries.
- Region boundaries.
- Biome boundaries.
- Cave-heavy terrain.
- River intersections.
- Underground river systems.
- Volumetric terrain.
- Multiple procedural tree variants.
- Different generation-order requests.
- Cold and warm caches.
- Different browser worker scheduling conditions.

Where native Iris generation has context or neighbor dependencies, reproduce the necessary context.

## 17.4 Block-state comparisons

Compare final generated block states, not only visual textures.

Block comparisons must include:

- Block identifier.
- Blockstate properties.
- Coordinates.
- Material placement.
- Relevant generated decoration and object placement.

Generate deterministic hashes of reference areas.

When a hash differs, provide a diagnostic showing mismatched coordinates, expected block states, and actual block states.

Do not hide differences through broad numerical tolerances when they lead to distinct generation results.

## 17.5 Scope-aware parity

Differentiate:

**Supported terrain parity:** Exact output for the implemented Iris terrain systems.

**Complete native chunk parity:** Exact output including every Iris, Minecraft, or platform feature that may affect a chunk.

Only claim complete native chunk parity when all applicable generation systems are included in the comparison.

For packs containing excluded structures, imported features, unsupported modded resources, or other non-terrain systems, provide a clear explanation that these systems are outside the preview's scope.

Never label an approximate preview as exact.

## 17.6 Release gate

A supported feature must not be considered complete until its required deterministic parity tests pass.

Parity regressions must block release.

# 18. VALIDATION AND ERROR HANDLING

Provide validation at multiple levels.

## 18.1 Resource validation

Check:

- Required fields.
- Value ranges.
- Enum values.
- Resource existence.
- Reference cycles where prohibited.
- Duplicate identifiers.
- Valid coordinate ranges.
- Compatible generation settings.
- Missing image maps.
- Missing material definitions.

## 18.2 Preview validation

Before generating a preview:

- Confirm that required resources resolve.
- Confirm that the selected dimension is usable.
- Confirm the engine supports all necessary in-scope features.
- Confirm a compatible engine revision is loaded.
- Identify unsupported external dependencies.

Do not replace generation errors with silently fabricated terrain.

## 18.3 Rendering validation

Check:

- WebGPU support.
- Shader compilation.
- Resource-pack compatibility.
- Missing models.
- Missing textures.
- Invalid blockstate references.
- GPU allocation failures.

Use clear, understandable error messages.

# 19. DEVELOPMENT PHASES AND MILESTONES

Implement incrementally.

Do not build the entire UI before verifying generation compatibility.

## Phase 0 — Research and technical feasibility

Tasks:

1. Inspect the latest stable Iris source code.
2. Pin the engine revision.
3. Identify all in-scope generation dependencies.
4. Investigate browser compilation.
5. Investigate required Minecraft registry abstractions.
6. Establish the native parity-reference environment.
7. Verify the supplied F8thful pack against the target Minecraft version.
8. Document licensing and asset-loading requirements.

Deliverables:

- Technical architecture.
- Dependency inventory.
- Initial feature compatibility matrix.
- Reproducible reference environment.
- Browser compilation strategy.

**Completion gate:** Demonstrate that real Iris generation functionality can execute in a browser-compatible environment or clearly identify the exact blockers before proceeding.

## Phase 1 — Generation-engine proof of concept

Tasks:

1. Compile or adapt core Iris noise algorithms.
2. Implement deterministic seed handling.
3. Load minimal Iris configuration.
4. Sample native Iris noise.
5. Compare browser output to native Iris.
6. Add basic region and biome selection.
7. Generate basic terrain heights.
8. Produce a minimal voxel chunk.

Deliverables:

- Working browser generation module.
- Reference comparison tests.
- Deterministic generation results.

**Completion gate:** Demonstrate exact parity on the supported proof-of-concept generation path.

## Phase 2 — Pack editor and server

Tasks:

1. Implement the server.
2. Implement pack discovery and loading.
3. Build the resource explorer.
4. Build the properties inspector.
5. Implement schema validation.
6. Implement resource references.
7. Implement saving.
8. Implement undo and redo.
9. Implement safe preservation of unrelated files.

Deliverables:

- Functional pack-management interface.
- Real Iris resource editing.
- Reliable pack save/load behavior.

## Phase 3 — 2D visualizer

Tasks:

1. Implement WebGPU initialization.
2. Implement 2D noise display.
3. Implement heightmaps.
4. Implement region and biome maps.
5. Implement coordinate navigation.
6. Implement generation workers and caching.
7. Connect property edits to previews.

Deliverables:

- Working 2D noise and terrain visualizer.
- Interactive generation controls.
- Native Iris parity tests.

## Phase 4 — 3D voxel renderer

Tasks:

1. Implement local chunk generation.
2. Implement voxel storage.
3. Implement chunk meshing.
4. Implement WebGPU rendering.
5. Implement camera controls.
6. Implement clipping planes.
7. Implement block inspection.
8. Integrate block models and blockstates.

Deliverables:

- Working 3D terrain preview.
- Correct block geometry.
- Stable rendering performance.

## Phase 5 — Complete terrain-generation scope

Implement and verify:

- Volumetric terrain.
- Caves.
- Carving.
- Authored subterrain.
- Hydrology.
- Surfaces.
- Decorators.
- Deposits.
- Procedural objects.
- Procedural trees.

Implement each system against the pinned Iris source.

Add regression tests before marking the system complete.

## Phase 6 — Resource-pack system

Tasks:

1. Optimize the provided F8thful pack.
2. Build model and blockstate resolution.
3. Implement texture atlases.
4. Implement custom ZIP loading.
5. Implement local asset caching.
6. Implement missing-asset reporting.
7. Verify non-cube block rendering.
8. Verify resource-pack switching without terrain regeneration.

Deliverables:

- Built-in F8thful appearance.
- Custom resource-pack loading.
- Accurate supported block-model rendering.

## Phase 7 — Performance, verification, and release

Tasks:

1. Optimize worker scheduling.
2. Optimize generation caches.
3. Optimize chunk meshing.
4. Optimize WebGPU rendering.
5. Test large-coordinate behavior.
6. Run complete parity regression tests.
7. Test representative Iris packs.
8. Validate safe file operations.
9. Test Docker deployment.
10. Write deployment and user documentation.

Deliverables:

- Production-ready standalone application.
- Reproducible build instructions.
- Test reports.
- Documented limitations.
- Release package.

# 20. PROJECT STRUCTURE

Use a maintainable project structure.

Suggested organization:

- `apps/web/` — React editor and visualization UI.
- `apps/server/` — HTTP server and pack file manager.
- `packages/iris-engine/` — Browser-compatible Iris generation engine.
- `packages/iris-config/` — Configuration schemas, parsing, and validation.
- `packages/iris-resources/` — Pack resource resolution.
- `packages/voxel-renderer/` — WebGPU rendering and chunk meshing.
- `packages/resource-packs/` — Minecraft resource-pack parsing and model resolution.
- `packages/shared/` — Shared types and utilities.
- `tools/reference-tests/` — Native Iris parity environment.
- `tools/asset-pipeline/` — Resource-pack optimization.
- `tests/` — Integration and end-to-end tests.
- `docker/` — Deployment configuration.
- `docs/` — Architecture and usage documentation.

Adjust this structure if the actual Iris code requires a more appropriate build arrangement.

Keep modules separate and responsibilities clear.

# 21. REQUIRED TEST SUITES

Implement automated tests for:

**Configuration tests**

- Pack loading.
- Pack saving.
- JSON field preservation.
- Reference resolution.
- Validation.
- Resource renaming.
- Deletion safety.
- Save conflicts.

**Generation tests**

- Noise parity.
- Seed parity.
- Region parity.
- Biome parity.
- Height parity.
- Cave parity.
- Hydrology parity.
- Surface parity.
- Deposit parity.
- Decorator parity.
- Procedural object parity.
- Tree parity.
- Supported block-state parity.

**Rendering tests**

- WebGPU activation.
- Block-model resolution.
- Blockstate variants.
- Multipart models.
- Texture atlas resolution.
- Transparency.
- Animation handling.
- Non-cube geometry.
- Clipping planes.
- Chunk visibility.

**Application tests**

- Pack opening.
- Configuration editing.
- Preview regeneration.
- Switching dimensions.
- Changing seeds.
- Switching resource packs.
- Saving and reopening.
- Unsupported-resource errors.
- Browser reload and recovery.

**Deployment tests**

- Local execution.
- Docker startup.
- Persistent pack storage.
- Remote browser access.
- File access security.
- Multi-user save conflicts.

# 22. COMPLETION CRITERIA

The application is complete only when all applicable criteria are met.

## Functional requirements

- [ ] Opens native Iris packs.
- [ ] Creates valid new Iris terrain packs.
- [ ] Edits all requested terrain-generation systems.
- [ ] Preserves unrelated pack resources.
- [ ] Saves compatible Iris configuration files.
- [ ] Generates terrain entirely in the browser.
- [ ] Provides interactive 2D noise and terrain visualization.
- [ ] Provides interactive 3D voxel visualization.
- [ ] Uses WebGPU for visualization.
- [ ] Renders supported Minecraft block models and blockstates.
- [ ] Uses the supplied F8thful pack as the configured default.
- [ ] Supports user-selected custom resource packs.
- [ ] Never transmits generated chunks or noise outputs to the server.
- [ ] Works locally and through a self-hosted web server.

## Accuracy requirements

- [ ] Uses the pinned latest stable Iris engine behavior.
- [ ] Matches native Iris noise results.
- [ ] Matches native Iris terrain heights.
- [ ] Matches native Iris region and biome selection.
- [ ] Matches native Iris carving and hydrology behavior.
- [ ] Matches native Iris supported block-state generation.
- [ ] Passes deterministic regression tests.
- [ ] Clearly identifies unsupported features or incomplete parity.

## Quality requirements

- [ ] UI stays responsive during generation.
- [ ] Rendering resources are cached efficiently.
- [ ] Configuration edits trigger only necessary preview updates.
- [ ] Resource-pack changes do not regenerate terrain.
- [ ] Errors are explained clearly.
- [ ] File saving is safe.
- [ ] Remote deployment can be secured.
- [ ] The project has clear setup and deployment documentation.
- [ ] No unrelated systems have been introduced.

# 23. IMPLEMENTATION RULES FOR THE DEVELOPMENT AGENT

Follow these rules throughout development:

1. **Do not create mock terrain as a substitute for real Iris generation.**

2. **Do not call unfinished systems complete.** An editor control that changes a value without affecting the authoritative generation engine is not a finished feature.

3. **Do not fabricate configuration fields or resource structures.** Use the pinned Iris source and schemas.

4. **Do not build unrelated Minecraft gameplay features.** Keep the application focused on terrain authoring.

5. **Do not move generation to the server.** The browser must remain fully responsible.

6. **Do not sacrifice generation accuracy for rendering performance.** Optimize the visualization separately.

7. **Do not remove block models or blockstate definitions during resource-pack optimization.**

8. **Do not silently rewrite unsupported or unrelated Iris configuration fields.**

9. **Do not claim exact parity without tests.**

10. **Do not use WebGL silently when WebGPU is required.**

11. **Do not introduce multiple Iris-version compatibility engines.**

12. **Do not assume permission to redistribute third-party resource packs or Minecraft assets.**

13. **Prioritize working, testable implementation over cosmetic polish.**

14. **Build in verifiable milestones.** Test the generation engine before investing in large-scale UI functionality.

15. **Keep dependencies, internal APIs, and modules understandable and maintainable.**

16. **Document technical blockers explicitly.** Do not conceal unresolved behavior behind fallback algorithms, fake outputs, or placeholders.

17. **Preserve the user's existing Iris pack content.** Never modify generated world chunks as a side effect of editing a configuration.

18. **Use the same underlying generation results for 2D and 3D whenever appropriate.** Avoid independent pipelines that could disagree.

19. **Make all generation work cancellable and revision-aware.**

20. **Maintain strict feature boundaries.** Dependencies necessary for supported generation are allowed; unrelated feature editors are not.

# 24. REQUIRED DEVELOPMENT OUTPUTS

At each milestone, provide:

- A summary of implemented functionality.
- The relevant source files.
- Build and run instructions.
- Executable tests.
- Parity results where applicable.
- Known limitations.
- Any unsupported Iris features.
- Remaining work needed to reach the next milestone.

For the final release, provide:

- Complete source code.
- Production build.
- Docker configuration.
- Local installation instructions.
- Server deployment instructions.
- Resource-pack provisioning instructions.
- Supported-feature documentation.
- Test and parity reports.
- Licensing and third-party asset documentation.

No feature should be described as functional unless it has a real implementation.

# 25. FINAL PROJECT DEFINITION

**Iris Terrain Studio must be a lightweight, self-hosted, browser-based visual terrain editor that uses an exact Iris-compatible client-side generation engine and high-performance WebGPU rendering.**

It must allow users to edit real Iris terrain configurations while previewing the resulting world in 2D and 3D.

All terrain-generation calculations must happen locally inside the user's browser.

The server must be limited to application delivery and Iris pack management.

The renderer must support Minecraft resource packs, use the supplied F8thful 8×8 pack as the default development texture source, and allow users to load custom packs locally.

The application must support only the latest stable Iris generation system, with no legacy-version compatibility.

Implement only the requested terrain-generation systems and their required dependencies.

**The highest priorities, in order, are:**

1. Correctness and deterministic Iris parity.
2. Strict adherence to the requested feature scope.
3. Functional editing and preview workflows.
4. Responsive client-side terrain generation.
5. High-performance WebGPU visualization.
6. A simple and intuitive user experience.
7. Reliable file handling and standalone deployment.

The finished result should feel like a small, focused terrain-authoring tool—not a Minecraft server, not a game engine, and not a complete replacement for Iris Studio.

**Begin implementation by verifying the latest Iris release and completing the browser-generation feasibility and deterministic-parity proof of concept. Do not proceed on the assumption that browser compatibility or exact parity is already solved.**
