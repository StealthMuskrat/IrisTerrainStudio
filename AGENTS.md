# Repository instructions

The authoritative brief is `docs/SPECIFICATION.md`.

1. Check `docs/STATUS.md` and `upstream.lock.json` before choosing work.
2. Complete the browser feasibility and supported-path parity gates before building broad editor functionality.
3. Keep all runtime generation in the browser. Native Java is development-only reference tooling.
4. Do not fabricate terrain, defaults, schemas, parity results, performance results, or support claims.
5. Preserve pack resources and unknown fields. Never modify Minecraft world chunks.
6. Pin source revisions and artifact hashes; do not resolve mutable dependencies implicitly.
7. Follow the user's development workflow: implement locally in coherent batches, use a few targeted behavior assertions and small samples only when needed (no repeated large block-state sweeps during development), and reserve comprehensive verification for the completed application. GitHub workflows are manual during development. Document unmet native/browser requirements explicitly.
8. Record implemented behavior, validation, known limitations, and the next milestone in each PR.
9. Keep contributions on reviewable branches once the initial foundation exists. Do not force-push or silently bypass required checks.

The user explicitly requested sustained local application development on 2026-10-20, with repository checkpoints as context/memory fills. Do not stop implementation to rerun broad test suites after each change. Existing feasibility blockers must remain visible and unsupported engine paths must fail explicitly; they must not prevent implementing independent pack-management and application modules. Complete all parity/release gates before calling the program finished.
