# Available local verification

Recorded October 23, 2026 (America/Toronto); execution timestamps use UTC. The user authorized comprehensive local testing and will perform browser/GPU checks on their own machine.

**Result: 115 automated check groups pass, one original native baseline check fails, and release prerequisites remain blocked.** This is not a release-ready or finished-project claim. [Machine-readable evidence](evidence/comprehensive-local-verification-2026-10-23.json) records individual attempts, timings, log hashes, inputs and limitations.

| Coverage | Result |
| --- | --- |
| Application checks | 58 passing groups, including 22 core tests and 13 Python tests |
| JavaScript syntax | 270 source files parse; this is not browser execution |
| Native/client/worker checks | 57 passing groups, using original Java/client references, actual Node-hosted Wasm/workers and controlled hosts where explicitly identified |
| Native original all-style checksum | Fails unchanged: expected `5059606393854142913`, observed `3659164368724912644`; one original JUnit method executed |
| Final package follow-up | Four passing groups: source syntax, development build, real standalone HTTP and exact rendering-module delivery |
| Release prerequisite check | Blocked; shipping dependency/schema/registry pins and native/browser parity gates are unresolved |
| Real browser, GPU/raster, durability/layout, measured interactive performance and Docker | Not run here; use the [manual acceptance checklist](MANUAL_ACCEPTANCE.md) |

Groups include small fixtures and integration checks, not 115 independent full programs. The 22 core and 13 Python tests are included in the application groups. The package follow-up repeats four relevant groups after source packaging changes; it is not added to the 115 distinct passing groups.

## Findings and corrections

The new 51-request real HTTP acceptance check covers token authentication, host/origin rejection, malformed requests, exact numeric/unknown source preservation, concurrent saves, backup/restore/resource operations, binary ZIP round trips, symlink rejection and restart persistence. Malformed pack/resource paths and non-object operation/restore bodies now return client errors. Invalid UTF-8 is rejected before decoding, preventing silent replacement of input bytes.

The first application/native passes exposed 25 failed historical harness/setup cases. These were corrected: current mesh-worker module imports are loaded into controlled VM hosts; worker messages use structured cloning; browser globals/region metadata are present in mocks; metadata, cache charging, greedy geometry, texture-slot/sidecar/overlay expectations follow the current implementation; tiny original client references are prepared; and the original supplied asset path is explicit. The isolated native continuation/cache probe now supplies the 4.3.5 canopy mutation argument and compiler identity input. All affected groups pass their correction runs. No native expected output was changed to accommodate a mismatch.

Current runs write local outputs rather than overwriting historical committed evidence. The comprehensive runner invokes native checks sequentially. Its preparation exports only 20 test block types / 252 states / 400 placement pairs and tiny client fixtures. No production registry export or large state/pair sweep ran. Previously passing native groups were retained; failures and affected paths were rerun.

Native terrain Wasm and runtime bytes remain unchanged. The corresponding-source refresh compared 5,597 source/build entries; only `package.json` and the source bundler changed. The bundler now excludes Python bytecode caches. The final development package includes the refreshed corresponding source, matching registry, notices and explicitly provisioned local assets. Those assets remain uncommitted and unqualified for public redistribution.

## Reproduce

Prepare the pinned development toolchain, engine/registry and authorized defaults as described in the [README](../README.md). The tests also need the pinned local native/client reference inputs; a source-only checkout is not a prepared test environment.

```sh
npm run verify -- --f8thful /path/to/authorized-original.zip
```

This writes an individual log per command and `results.json` under a new `.local-tools/verification-*` directory. It builds the development distribution, restores bounded test/reference fixtures, runs application/native groups, executes the original checksum assertion and checks release prerequisites. The known native assertion currently makes the full command exit 1. No GitHub workflow, production registry export or browser workaround is invoked.

For a selected regression with existing prepared inputs:

```sh
npm run verify -- --suite application --only server-acceptance.mjs
npm run verify -- --suite native --reuse-prepared --only native-object-session-smoke.mjs
```

Exit 1 means a failed/timed-out check, 2 means blocked prerequisites without another failure, and 0 means all selected checks passed. Keep the native checksum and complete required-option parity unresolved until authoritative reference evidence is available. Manual UI success does not close those gates.
