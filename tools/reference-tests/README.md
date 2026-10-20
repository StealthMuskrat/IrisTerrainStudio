# Native/browser capture comparison

This directory currently contains an executable comparison tool and prerequisite diagnostics. **It does not contain a native exporter, compiled browser engine, or actual reference captures.** Tests construct synthetic captures to verify comparison behavior. They do not demonstrate Iris parity.

## Commands

```sh
npm run reference:preflight
npm run parity:compare -- native.json browser.json
```

The comparator exits `0` for exact equality, `1` for output mismatches, and `2` for invalid input or usage. It reports the total mismatch count and up to 20 coordinate-level expected/actual values. Sampling order is irrelevant. Input size is limited to 128 MiB per file and one million samples per capture; split larger areas into independently identified captures.

## Capture format, version 1

The following is a **format illustration only**, with deliberately invalid placeholder hashes. Supply genuine hashes from the independently produced artifacts before comparison.

```json
{
  "formatVersion": 1,
  "scope": "noise",
  "producer": {
    "kind": "native",
    "artifactSha256": "<64 lowercase hex digits of the producer executable>"
  },
  "identity": {
    "irisCommit": "<40 lowercase hex digits>",
    "volmLibCommit": "<40 lowercase hex digits>",
    "minecraftVersion": "26.3",
    "registrySha256": "<64 lowercase hex digits>",
    "schemaSha256": "<64 lowercase hex digits>",
    "packSha256": "<64 lowercase hex digits>",
    "worldSeed": "-9223372036854775808",
    "dimension": "<actual dimension key>",
    "featureSet": ["<explicit supported generation path>"]
  },
  "grid": {
    "origin": [-16, 0, 0],
    "step": [0.125, 1, 1],
    "size": [1, 1, 1]
  },
  "samples": [{"x": -16, "y": 0, "z": 0, "bits": "0000000000000000"}]
}
```

The second capture has `producer.kind` set to `browser`, with its own artifact hash. Every identity field must match, including exact dependency/registry/schema/pack digests and the canonical signed 64-bit decimal seed string. Feature ordering may differ; the feature set may not. Artifact hash fields record provenance assertions, not a cryptographic proof that the producer was executed. The comparator does not authenticate exporters or certify a release.

Grid arrays are in x/y/z order. For each axis compute `origin + index * step`, with indexes from zero through size minus one. Every grid coordinate must appear exactly once. Positive finite step values and finite coordinates are required. Fractional grids are allowed for scalar sampling; block grids must yield safe integer coordinates. Different sampling plans require separate capture pairs. Negative-zero coordinate signs refer to the same spatial location; negative-zero output bits remain distinct.

Noise samples use big-endian IEEE-754 binary64 bit strings, exactly 16 lowercase hexadecimal digits. Export Java values with `Double.doubleToRawLongBits` formatted as 16 hex digits; use the equivalent DataView conversion in the browser. Non-finite outputs are rejected. There is no tolerance that can conceal a changed generation decision.

For block captures, set `scope` to `blocks` and replace each sample's `bits` with:

```json
"state": {"id": "minecraft:oak_log", "properties": {"axis": "y"}}
```

Include every voxel, including air and fluids, in the declared bounds. Properties must be strings; order does not matter. Compare identifiers and all properties, with no model/texture substitutions. This initial tool compares scalar noise or final blocks, not all intermediate stages or full native chunk parity.

## Native environment plan

1. Provision Java 25 and check out the exact Iris commit in `upstream.lock.json` under `.upstream/Iris/`.
2. Recover and pin the release-matching VolmLib source/artifacts. Do not guess a current head or fetch `master-SNAPSHOT` as a reference. The pinned settings script supports `-PlocalVolmLibDirectory=/absolute/path/to/VolmLib`; verify its embedded provenance stamp and clean status.
3. Lock all resolved generation dependencies, export and hash registry/schemas, and run upstream regression tests before producing captures.
4. Inspect the pinned `probe` module's `genProbe` task and StubPlatform limitations. Its verified parameter names include `probePack`, `probeDimension`, `probeSeed`, `probeWarmupChunks`, `probeMeasuredChunks`, `probeCenterChunkX` and `probeCenterChunkZ`. Its current digest output is not this tool's per-coordinate capture format; an exporter must still be implemented.
5. Build a native noise exporter and matching TeaVM browser worker exporter using the same immutable classes. Record build commands, compiler/dependency versions, generated artifact digests, pack/context, request order, cache mode, browser version and worker scheduling in accompanying run evidence.
6. Compare actual captures. Keep synthetic tool tests separate. Expand into seed derivation, regions/biomes, heights and voxel content only after the first exact browser path passes.

Native tooling is development-only. No normal application endpoint may serve reference generation results. The initial workspace could not execute the Java toolchain, so the steps above are a reproducibility plan, not completed reference-environment delivery.

Follow-up: `tools/native-reference/` now runs the actual pinned Iris source's native noise/seed suites in CI. Compilation succeeds with the candidate, but one pinned checksum test fails. Inspect `docs/research/NATIVE_RNG_AUDIT.md`; the qualified reference environment is still incomplete. The separate primitive/RNG browser experiment does not bypass that failure.
