# Native PNG metadata and Java resource filters

## Native image-map PNG sources

The pinned OpenJDK 25 PNG reader constructs standard gray/sRGB raster models and reads the default PNG image. It does not use embedded ICC profiles, newer HDR descriptors or APNG animation frames to change those raw bands. The worker host now admits `iCCP`, `cICP`, `mDCV`, `cLLI`, `acTL`, `fcTL` and `fdAT` as ancillary metadata for native image-map input. The existing CRC, critical-chunk, ordering, dimension, compression and byte budgets remain enforced. Profile and animation payloads are not decompressed or retained separately. The original pack bytes remain unchanged.

This is a static-image policy, not a color-managed or animated image decoder. APNG's default image may itself belong to the animation or be a separate poster; both are read from `IDAT`. The [PNG specification](https://www.w3.org/TR/png-3/#structure-of-animation) distinguishes those layouts. The authoritative native behavior here is the original JDK reader and Iris image/compiler calls, rather than a browser canvas conversion. The JDK reference source is retained in the corresponding engine source archive.

Image inspection retains a small source-policy object with the actual selected path and encountered metadata types. Notes explain absent profile/HDR conversion and static APNG sampling. Exact paths and the native dotted-name fallback use the same winning image; an alias cannot attach metadata from a different file. This information is inspection-owned and discarded with the request. Cancellation during decoding still cannot register stale images or clear a newer native context.

Minecraft texture decoding passes an explicit separate policy and retains its previous profile/HDR/APNG refusals. Its static PNG path, raw pixels, animation sidecars and texture-upload behavior are unchanged. The native image-map extension does not qualify STB/client color or animation behavior.

Six two-pixel fixtures compare the original JDK/Iris reader/compiler with the actual Wasm/worker path: a plain source, a real compressed linear-RGB ICC profile, all three HDR descriptors, both APNG layouts and combined metadata. All 48 raw bands, twelve exact normalized sample bits and six decoded/compiled hashes match. The actual worker also checks dotted fallback ownership, exact-path precedence, corrupt metadata refusal and recovery. Small existing async snapshot and texture-pipeline checks pass. This does not qualify all PNG metadata, arbitrary malformed APNG, non-PNG formats, browser execution or complete terrain parity.

## Resource-pack filter patterns

The matcher now parses capturing and `(?:...)` groups, nested alternatives, `*`, `+`, `?`, `{n}`, `{n,}`, `{n,m}` and reluctant forms. Captures are not observable through a boolean predicate without backreferences. Reluctance changes the chosen match, not whether `find()` succeeds for this subset. `^`, `$`, `\A`, `\z` and `\Z` retain their meaning for bounded Minecraft identifiers, which contain no line terminators. Native ASCII character classes handle literal leading `]`, negation, ranges and admitted escapes without delegating Java class syntax to a JavaScript class parser. Membership is prepared once for the resource alphabet.

A Thompson state graph shares continuations and visits each active state once per input position. New searches enter the graph at each position, reproducing Java `Pattern.asPredicate()` find semantics. Empty alternatives, optional groups and repeated nullable groups terminate through visited epsilon states. No recursive matching or exponential backtracking is used. Compilation admits at most 1,024 source characters, 256 atoms, 64 alternatives, sixteen group levels, repeat counts through 1,024 and 2,048 states. Input identifiers remain bounded to 1,024 characters; the pack keeps its existing 128-rule limit.

Backreferences, lookarounds, flags, possessive repetition, nested classes and class intersections require additional Java semantics and still fail explicitly. Reversed/oversized counts, excessive state expansion and unmatched groups refuse at compilation. These refusals remain visible during pack loading. Pack precedence, own-resource lookup before filters and independent namespace/path predicate selection are unchanged.

Nineteen selected expressions compare 78 answers against original Java `Pattern.asPredicate()` calls. Cases include nested groups, bounded/open counts, reluctant matching, empty group cycles, absolute anchors, resource paths, leading `]`, hyphen ranges and a long near-match. One actual two-pack stack verifies own overrides, blocked lower resources and unblocked fallback. This is a focused predicate/lookup check, not full Java regex or client rendering qualification.

The related rendering failure path now treats an uncaptured asynchronous GPU error as a failed session, using the existing retained-data recovery boundary rather than leaving the display marked ready. Controlled application/device checks retain committed and pending CPU data and recover without generation; a later physical loss is deduplicated. This does not qualify real driver behavior or transactional GPU uploads.

```sh
node --experimental-vm-modules tools/checks/native-png-metadata-smoke.mjs
node tools/checks/resource-pattern-groups-smoke.mjs
node --experimental-vm-modules tools/checks/image-snapshot-worker-smoke.mjs
node tools/checks/texture-pipeline-smoke.mjs
node tools/checks/gpu-recovery-smoke.mjs
node tools/build-app.mjs --require-engine --include-local-assets
node tools/checks/standalone-render-smoke.mjs dist
```

The source refresh compares all archive entries and changes only the PNG host adapter; original native/build inputs and Wasm/runtime bytes are unchanged. Existing installed registry bytes are reused without export or state enumeration. No terrain generation, broad program suite or GitHub workflow runs for these changes. Native checksum/provenance, required remaining option coverage and real browser/GPU/deployment qualification remain open. [Evidence](../evidence/native-png-and-filters-2026-10-24.json).
