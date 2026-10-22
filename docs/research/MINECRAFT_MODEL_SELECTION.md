# Pinned model selection, rotation and UV locking

The renderer now bakes referenced candidates once per stored palette state and chooses weighted applications at each stored world coordinate in the mesh worker. Appearance changes keep the original voxel input and create a new model/mesh snapshot; terrain is not regenerated. Existing section-cache keys belong to that immutable snapshot.

## Original client inputs

`tools/engine-build/client-model-inputs.mjs` explicitly reads the authorized local client pinned by `tools/assets/minecraft-client.lock.json`. It captures 24 distinct quarter-turn orientations and 144 original inverse face matrices from BlockModelRotation/BlockMath. Sixty-four X/Y/Z combinations alias those orientations. Float coefficients are retained as binary32 bit patterns. The same capture classifies the declaring visual-seed method once per 1,286 block types; 49 have lower-half or bed-source rules. No block states are evaluated or exported. Unknown owners fail capture, and unknown block identities fail contextual selection.

`client-model-data.json` records the client and capture-source identities. It contains numerical matrices, block identities and rule labels, not client class files, source or textures. The original captured matrix is used for vertices/cull direction and the original inverse face matrix for UV locking, with binary32 arithmetic. X/Y/Z rotations and face-UV rotations accept signed integer quarter-turns normalized as the pinned Quadrant codec does. Model/element geometry is still subject to the existing bounds and explicit adapters.

## Selection and blockstate behavior

ClientModelRandom retains the original 48-bit state, signed nextLong and bounded nextInt/rejection arithmetic. Position seeds retain native int multiplication and signed long overflow. Captured lower-half and bed-source rules retain the original source coordinate adjustments. Multipart collection consumes one nextLong then resets every selected model group to that seed, following the original MultiPartModel. Weighted groups preserve integer weights, zero-weight exclusion and one draw per group. Explicit diagnostic choices remain available; models without contextual alternatives can keep their static path.

Matching variants take precedence over multipart fallback. Multipart `|` terms apply negation to each individual term, including combinations such as `!x|z`. Unknown selected-state properties and empty terms refuse. Native decoding/baking of every malformed blockstate/property-domain combination is not qualified by these selected fixtures.

Each block admits at most 128 selected groups, 128 candidates per group, 512 candidates overall and 8,192 baked candidate faces; weights must fit a positive signed int total. No combinations of candidates or block states are enumerated. Conservative occlusion requires a guaranteed opaque cube regardless of contextual choice. Selected cell model identities are available in the stored voxel inspector; this describes all applied cell models, not just the triangle hit.

## Focused qualification

[Model evidence](../evidence/client-model-selection-2026-10-22.json) records eight original UV/point transforms, eleven actual client seed/WeightedVariants/MultiPartModel selections and three original per-term condition outcomes. Positions include negative coordinates, near-world limits, two upper-half kinds and bed head/foot. Three actual mesh-worker cells select the same native candidates. Selected UV/point results compare exactly after restoring reference decimals to binary32. A UV-locked Z-rotated face bakes with a rotated cull direction, and matching variant precedence is checked.

The reference calls actual client model collectors with marker model parts; it does not start the client renderer or a GPU. The finite matrix/type metadata capture is separate from those small behavior checks. Full model geometry, offsets, fluid/tint/material/mipmap semantics, every selector/property option, real browser/GPU/UI behavior, final terrain/reference/release qualification and supplied F8thful assets remain open. No broad suite, state/volume sweep or GitHub workflow runs.
