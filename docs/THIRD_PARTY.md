# Third-party code and assets

The repository includes original application/tooling code and the user-supplied specification. No F8thful, vanilla textures/models or Minecraft binaries are committed. An optional local installer provisions the previously verified experimental VolmLib/TeaVM noise module into an ignored generated directory, together with corresponding source, licenses and notices. A development distribution containing that module must retain those materials. The complete Iris terrain engine is not yet integrated.

| Input | Observed provenance | Current handling | Before distribution |
| --- | --- | --- | --- |
| Iris | Tagged source headers identify GPL version 3 or later; upstream `LICENSE.md` contains GPL v3 | Exact commit and source blob hashes recorded; source linked, not vendored | Review the integrated distribution, preserve notices, include required licensing/source material |
| VolmLib | RNG/noise/native APIs referenced by Iris; exact release artifact/source unresolved | No code or binary bundled | Resolve source, license, transitive notices, and immutable artifacts |
| TeaVM | Version 0.16.0 pinned and executed for the primitive experiment | Generated runtime/compiler outputs retained as development evidence | Review runtime distribution notices before any application distribution |
| F8thful | Mentioned by the specification; archive and its terms not supplied | Missing; no assets bundled | Inspect authorized supplied archive, format/overlays, dependency graph, and permission for redistribution |
| Minecraft 26.3 baseline | Required by block models/registries; no baseline supplied | Missing; no proprietary assets bundled | Establish authorized local provisioning and applicable distribution terms |

Use `.local-assets/` for authorized development inputs and `.upstream/` for pinned development checkouts. Both are ignored by Git. Record input hashes and provenance before creating derived rendering bundles. Local access to an archive does not itself establish redistribution permission.

The development-only `tools/portability-probe` harness and its original JDK compatibility adapter are GPL-3.0-or-later. The adapter implements the MD5 integer algorithm described by RFC 1321 and the narrow UUID/UTF-8 behavior exercised by RNG; it does not vendor OpenJDK implementation code. CI fetches exact VolmLib source after digest verification and retains its source/license with generated experiment artifacts. No license for unrelated original project components has been selected. Upstream licensing observations are not a complete licensing assessment of a future combined application.

The local rendering-dependency pipeline creates browser-downloaded Studio ZIPs from user-loaded packs. It copies retained asset bytes unchanged, includes original source metadata and conventionally named notices/licensing directories under `sources/`, and records source archive and retained-file hashes. These downloads are for authorized local reuse; the application does not upload or publicly distribute them. Notice discovery does not establish that every licensing obligation has been found. F8thful and vanilla production inputs remain absent, their terms unreviewed, and target-format/overlay handling and complete client rendering remain unqualified.
