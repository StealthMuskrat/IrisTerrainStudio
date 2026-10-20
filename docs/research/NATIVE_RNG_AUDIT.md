# Native Iris baseline and RNG browser investigation

Date: 2026-10-20. The native Iris core now compiles on the explicit candidate dependency. Its pinned noise baseline does **not** pass. The independent primitive/RNG browser experiment passes, with its limited scope recorded separately.

## Actual native Iris result

The audit checked out exact Iris commit `c3a9449a026078c44a87c9776766f54a67779392` and VolmLib candidate `e971ae0176d4d50dff5bd483b2b0d2cc2a77c1ac`. It verified clean Git identities, the Iris root tree, Java runtime build, and Gradle 9.5.1 distribution SHA-256. It compiled the upstream projects and ran the two original, unchanged suites:

| Suite | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| NoiseSeedCohesionTest | 2 | 1 | 0 |
| NoiseStyleContractTest | 12 | 0 | 0 |

`allStylesRetainPinnedSamples` expected signed 64-bit checksum **5059606393854142913** and observed **3659164368724912644**. The assertion was not modified. Actual Gradle exit code: **1**. The reference is therefore unqualified, even though compilation and the other 14 checks succeeded.

[The durable audit report](../evidence/native-reference-audit-2026-10-20.json) links the run and verified evidence archive. The first audit recorded digests for 353 resolved JARs. Its Gradle verification-metadata writer also failed independently on duplicate timestamped `me.lucko:spark-api` entries; later audit configuration collects JAR hashes separately, so that writer cannot obscure the native assertion.

The checksum test was introduced in Iris commit `4ef6fc7cc6d4f52829fb5598f242fc1c2a6165d0` on 2026-10-02. VolmLib noise history includes subsequent backend, caching and octave changes. This is an investigation lead, not proof of the mismatch's cause. Dependency drift, a stale upstream fixture and platform behavior still need to be distinguished before any baseline is adopted. A matching hash alone would not prove shipping binary provenance.

## Missing Java services in TeaVM

Compiling unmodified VolmLib RNG exposed absent `UUID.nameUUIDFromBytes` and UUID bit accessors in TeaVM 0.16.0. Its [pinned TUUID implementation](https://github.com/konsoletyper/teavm/blob/e87d452e4bd70c77b9e19314a46c3d6971c148b6/classlib/src/main/java/org/teavm/classlib/java/util/TUUID.java) provides only a limited string-backed UUID API.

The experiment adds an explicit compiler plugin that redirects exactly four UUID call sites and two UTF-8 encoding call sites inside the pinned RNG bytecode. Source files RNG.java and M.java stay unmodified. The call-count checks reject an unexpected input shape. The browser compatibility code implements only the operations needed by those call sites: MD5-based version-3 UUID creation, its two bit halves, and Java's UTF-8 seed encoding/replacement behavior.

The UUID adapter implements the integer operations of [RFC 1321](https://www.rfc-editor.org/rfc/rfc1321). Its output, UUID version/variant handling and bit halves are checked against the actual native JDK for every byte-array length from 0 through 256: **257 independent checks**. It is not advertised as a complete java.util.UUID replacement.

The first browser execution also exposed a TeaVM encoding exception for a lone low surrogate: `New position 2 is outside of range [0;1]`. The UTF-8 adapter preserves Java's replacement byte rather than dropping that input. It passes **65,560 independent native JDK encoding checks**: every UTF-16 code unit, 16 surrogate-pair boundary combinations and eight mixed strings.

## Executed browser result

The same experiment now compares unmodified RNG calls with native JVM results over **68 cases**, including numeric seeds beyond JavaScript Number precision, both Java long limits, textual/Unicode/control-character seeds, lone surrogates and overflowing derived-stream signatures. Each case samples 16 rounds of seven RNG outputs. Three workers use forward/reverse/shuffled ordering and reset/repeat the stream.

The combined [executed report](../evidence/noise-rng-portability-2026-10-20.json) records **195,696 exact comparisons, zero mismatches**: 150,000 existing noise primitive comparisons and 45,696 RNG comparisons. Its archive digest and both native/browser capture pairs were independently verified after download. The reports preserve compiler, source-manifest, Wasm/runtime and native capture hashes; Actions retains full run artifacts for 30 days.

This proves only the tested candidate primitive/RNG path with the explicit JDK compatibility adapter. Iris SeedManager, browser CNG/NoiseStyle integration, pack resources, schemas/registries, terrain heights and block states remain unproved. Production readiness flags and the release dependency pin remain unresolved. Next work must explain the native checksum mismatch before claiming a qualified Iris reference environment.
