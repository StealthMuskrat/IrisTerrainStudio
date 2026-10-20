# Foundation validation

Run date: 2026-10-20. Local runtime: Node.js 24.19.0, Linux. This records tooling verification only.

| Command | Result | Meaning |
| --- | --- | --- |
| `npm run check` | Exit 0 | Required documentation exists and the source lock is internally consistent |
| `npm test` | 17 passed, 0 failed | Synthetic capture and CLI tests cover comparison, malformed inputs and source-lock consistency |
| `npm run reference:preflight` | Exit 1, expected | Java 25 execution and required engine/dependency/schema/registry/asset inputs remain unavailable |
| `npm run release:check` | Exit 1, expected | Recorded release prerequisites remain incomplete; no release readiness claimed |

The comparator was exercised with shuffled samples, fractional and large/negative coordinates, one-bit and signed-zero differences, block identifiers/properties, complete coverage, duplicate detection, seed range/precision, target provenance drift, invalid output, bounded diagnostics and CLI failure modes.

Native Iris build: **not run**. TeaVM compilation: **not run**. Browser worker generation: **not run**. Native/browser parity: **not run**. WebGPU, editor, server, resource-pack, Docker and performance checks: **not applicable; implementations do not exist**.

The foundation GitHub Actions workflow repeats structure and tooling checks. It is not a parity or deployment workflow. A future release pipeline must verify actual native/browser evidence rather than trust status flags alone.
