# Native checksum diagnostics

Date: 2026-10-20. The upstream expected checksum remains unchanged and the reference remains **unqualified**. [Issue #15](https://github.com/StealthMuskrat/IrisTerrainStudio/issues/15) tracks the investigation.

## Executed CNG isolation

[Run 39438966442](https://github.com/StealthMuskrat/IrisTerrainStudio/actions/runs/39438966442) compiled the real Iris core and executed the original suites: 14 pass, one checksum assertion fails. It then captured the original fixture's own private sampler for all **186 styles, three seeds and ten coordinates in 1D/2D/3D**: 16,740 output values per profile.

| Profile | Exchanged source or runtime | Aggregate | Differences from current |
| --- | --- | --- | --- |
| Current | Candidate CNG | 3659164368724912644 | 0 |
| Fixture | CNG at VolmLib `12bc569151b854946fe15dcda0b15a4cdf43dfc1` | 3659164368724912644 | 0 |
| Mutation | CNG at `c2881df4e8b5e40baafacdc65975baf7dd334ef1` | 3659164368724912644 | 0 |
| Memo | CNG at `a05cac2b187d6abbec10280327532d10283346d1` | 3659164368724912644 | 0 |
| Interpreted | Current source with `-Xint` | 3659164368724912644 | 0 |

Each profile used a fresh JVM. Historical source hashes were checked before compilation; captured CNG class hashes confirm distinct compiled class inputs. All profiles also executed the original checksum assertion and reproduced its failure, expected **5059606393854142913**. Billow reported `java-native-access-disabled` in every profile, so its native backend was not used. This was a controlled diagnostic, not a browser execution or a full historical dependency build.

The [durable evidence summary](../evidence/native-cng-isolation-2026-10-20.json) records source/class/capture hashes, toolchain and artifact provenance. The archive was downloaded, verified against GitHub's SHA-256 and independently compared locally: **66,960 historical/runtime-to-current sample comparisons, zero differences**. There are 83,700 captured outputs including the current baseline. Full per-coordinate captures, exact source overlays and dependency digests have 30-day artifact retention.

## Source findings and limits

The Iris `NoiseStyle.java` file is byte-identical between fixture-introduction commit `4ef6fc7cc6d4f52829fb5598f242fc1c2a6165d0` and the pinned release. The near-simultaneous VolmLib seed-cohesion commit changes only the CNG dirty-state field's `volatile` publication; it does not introduce an arithmetic change there.

Comparing complete Git trees, five source files differ in VolmLib's noise/math/interpolation directories between the fixture-era commit and the current candidate: CNG, FractalBillowSimplexNoise, InterpolatedNoise, IrisInterpolation and NoiseBoundsSampleCache2D. The five-profile run exchanged only CNG. CI also includes a separate `fixture_noise` profile exchanging all five exact source files together, with independent hashes; its result is recorded in the corresponding run artifact and PR validation.

The executed CNG-only experiment does not attribute the checksum failure to subsequent CNG changes or interpreter/JIT mode in this environment. It does not establish a stale fixture, exclude other source changes, qualify a shipping dependency, or rule out other operating systems, architectures or Java builds. A matching aggregate alone would not prove release provenance either.

The next investigation must compare the remaining source cohort and obtain a justified fixture/reference environment or an evidenced upstream correction. Keep the original expectation, source pins, negative/large/fractional coordinates and seed coverage. Do not replace the checksum just to produce a green native test result.
