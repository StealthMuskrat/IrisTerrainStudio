# Iris Terrain Studio

A planned self-hosted editor for real Iris dimension packs, with generation entirely in browser workers and WebGPU visualization.

**Status: Phase 0, feasibility investigation. There is no terrain engine, editor, renderer, or deployable application yet. No native/browser parity has been demonstrated.**

The [implementation specification](docs/SPECIFICATION.md) is the project brief. Work proceeds through its gates: prove browser execution and deterministic parity before building the editor.

## Verified target

Checked on 2026-10-20 against upstream's latest non-prerelease release:

| Component | Target | State |
| --- | --- | --- |
| Iris | 4.3.4, tag `4.3.4-26.1.2-26.3` | Commit `c3a9449a026078c44a87c9776766f54a67779392` pinned |
| Minecraft | 26.3 | Version verified; registry export pending |
| Native build toolchain | Java 25 | Required; not available in the initial workspace |
| VolmLib | Release-matching source and binaries | Unresolved; upstream uses mutable snapshot/composite resolution |
| Browser compiler | TeaVM Wasm GC first | Candidate; compilation not attempted successfully |

[upstream.lock.json](upstream.lock.json) records source blob hashes, unresolved inputs, and readiness. Pinning Iris alone does not establish a reproducible engine.

## Run the foundation checks

Use Node.js 24. No npm dependencies or install step are needed.

```sh
npm test
npm run check
npm run reference:preflight
npm run release:check
```

`reference:preflight` and `release:check` deliberately exit nonzero while prerequisites are unresolved. Passing tooling tests is not a generation parity result. The CI foundation check runs only `check` and `test`; it is not a release approval.

To compare two genuine captures once exporters exist:

```sh
npm run parity:compare -- /path/to/native.json /path/to/browser.json
```

The comparator checks provenance, complete capture bounds, exact floating-point bits or full block states, and reports coordinate-level mismatches. See the [capture contract](tools/reference-tests/README.md).

## Project management

- [Roadmap and milestone gates](docs/ROADMAP.md)
- [Current status and next actions](docs/STATUS.md)
- [Initial source audit and feasibility blockers](docs/research/PHASE_0.md)
- [Architecture and dependency boundaries](docs/ARCHITECTURE.md)
- [Supported feature matrix](docs/COMPATIBILITY.md)
- [Third-party code and asset provenance](docs/THIRD_PARTY.md)
- [Contribution workflow](CONTRIBUTING.md)

No F8thful archive or Minecraft assets were supplied with the specification. Asset validation and redistribution review remain open. No third-party engine code or game assets are bundled in this foundation.
