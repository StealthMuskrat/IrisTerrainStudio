# Repository instructions

The authoritative brief is `docs/SPECIFICATION.md`.

1. Check `docs/STATUS.md` and `upstream.lock.json` before choosing work.
2. Complete the browser feasibility and supported-path parity gates before building broad editor functionality.
3. Keep all runtime generation in the browser. Native Java is development-only reference tooling.
4. Do not fabricate terrain, defaults, schemas, parity results, performance results, or support claims.
5. Preserve pack resources and unknown fields. Never modify Minecraft world chunks.
6. Pin source revisions and artifact hashes; do not resolve mutable dependencies implicitly.
7. Run `npm run check` and `npm test` for foundation changes. Document unmet native/browser requirements explicitly.
8. Record implemented behavior, validation, known limitations, and the next milestone in each PR.
9. Keep contributions on reviewable branches once the initial foundation exists. Do not force-push or silently bypass required checks.
