# Native placement capture without a quadratic native sweep

The registry exporter must preserve `NativeBlockProperties.canPlaceOnto` from the pinned VolmLib source. It previously invoked that method for every ordered pair of 1,286 block types: 1,653,796 native evaluations. `NativePlacementGroups` captures the same finite relation through exact input equivalence; it does not implement replacement placement rules.

The reviewed source is `native/minecraft-common/src/main/java/art/arcane/volmlib/nativelib/minecraft26_2/modded/NativeBlockProperties.java` at VolmLib candidate `e971ae0176d4d50dff5bd483b2b0d2cc2a77c1ac`, SHA-256 `64d583bb5256c374d5931b1b481f7d8dfc453da04ae0943d74a57f7ac8284cc3`. Any byte change refuses capture before native evaluations. There is no fallback to an exhaustive sweep.

For this exact source, the complete placement method reads only:

- Identity comparisons against the `Blocks` constants named in the method.
- Membership in its private `FOLIAGE`, `FOLIAGE_PLANTABLE_MATERIAL` and `PLACE_ONTO_LEAVES` sets.
- `isSolid(mat.defaultBlockState())`.

The key captures all these observations for both parameters. Named constants are discovered from the checksum-guarded method text and resolved to real native block identities. The three sets are read from the initialized native class. Solidity is evaluated on each real native default state. The exporter deliberately over-partitions: some observations matter only for the material or only for the supporting block, but both sides use the same complete key.

If two blocks share a key, substituting either for the other cannot change any input observed by this pinned method. Therefore one unchanged native invocation for each ordered key pair determines the answer for every block pair in those two groups. The exporter expands that answer into the existing packed bit matrix. Browser placement lookup and the registry wire format remain unchanged. The proof assumes the exporter’s single initialized native registry and unmodified private sets; this is not a general optimizer for arbitrary future methods or modded registries.

The restored registry has 34 groups, requiring 1,156 native evaluations: approximately 99.93% fewer than the previous capture. The resulting relation contains 1,611,301 allowed pairs, matching the earlier recorded count. That count is a consistency observation, not an exhaustive equivalence comparison.

`node tools/checks/native-placement-groups.mjs` separately checks twenty selected native pairs covering special identities, foliage/ground membership, air, dead bush, dirt path, leaves and ordinary blocks. A changed-source input must refuse. This check does not compare every pair. The exported predicate metadata and registry manifest record the source hash, group count, actual native evaluation count and expanded pair count. Registry normalization rejects missing or inconsistent grouping metadata.

The necessary registry data export still visits each distinct native state once for its state predicates and face-support metadata. It is an installation data capture, not a repeated all-state comparison suite. Native reference provenance, full engine support and browser/rendering qualification remain unresolved.
