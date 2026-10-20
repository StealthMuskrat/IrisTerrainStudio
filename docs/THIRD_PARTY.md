# Third-party code and assets

This initial foundation includes original project tooling and the user-supplied specification. It does not include copied Iris/VolmLib implementation code, a compiled engine, F8thful, vanilla textures/models, or Minecraft binaries.

| Input | Observed provenance | Current handling | Before distribution |
| --- | --- | --- | --- |
| Iris | Tagged source headers identify GPL version 3 or later; upstream `LICENSE.md` contains GPL v3 | Exact commit and source blob hashes recorded; source linked, not vendored | Review the integrated distribution, preserve notices, include required licensing/source material |
| VolmLib | RNG/noise/native APIs referenced by Iris; exact release artifact/source unresolved | No code or binary bundled | Resolve source, license, transitive notices, and immutable artifacts |
| TeaVM | Candidate compiler; not provisioned or pinned | Documentation links only | Pin tested compiler and review runtime distribution notices |
| F8thful | Mentioned by the specification; archive and its terms not supplied | Missing; no assets bundled | Inspect authorized supplied archive, format/overlays, dependency graph, and permission for redistribution |
| Minecraft 26.3 baseline | Required by block models/registries; no baseline supplied | Missing; no proprietary assets bundled | Establish authorized local provisioning and applicable distribution terms |

Use `.local-assets/` for authorized development inputs and `.upstream/` for pinned development checkouts. Both are ignored by Git. Record input hashes and provenance before creating derived rendering bundles. Local access to an archive does not itself establish redistribution permission.

No license for this project's original code has been selected in this bootstrap. Upstream licensing observations are not a complete licensing assessment of a future combined application.
