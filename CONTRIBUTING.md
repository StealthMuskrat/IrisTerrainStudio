# Contributing

Read `docs/SPECIFICATION.md`, `docs/STATUS.md`, and `docs/research/PHASE_0.md` before implementation. Use an issue with acceptance criteria and a feature branch; submit a pull request with validation evidence and limitations.

## Required boundaries

- Generation belongs in browser workers. Servers serve the application and manage packs only.
- Never replace Iris generation with illustrative or approximate terrain.
- Use the pinned source and generated schemas for resource fields and defaults.
- Preserve unknown JSON fields and unrelated files; retain explicit save and concurrency semantics.
- Unsupported generation must fail clearly. Do not silently change algorithms, substitute block geometry, or fall back to WebGL.
- Treat seeds as signed Java 64-bit values, serialized as decimal strings across JSON boundaries.
- Implement cancellation, bounded queues, and revision checks with real generation integration.
- Do not redistribute Iris-derived code, resource packs, or Minecraft assets without satisfying applicable terms. Preserve upstream notices when importing code.

## Evidence required

Run `npm run check` and `npm test` with Node 24. Report which checks ran and which could not run. Generation changes also require fresh native/browser captures tied to immutable engine, dependency, pack, schema, and registry hashes. Test negative and large coordinates, boundaries, sampling orders, and cold/warm caches. A self-comparison, synthetic fixture, upstream JVM-only test, or checksum-only report does not establish browser parity.

Use `npm run release:check` as a prerequisite status check. Its current failure documents unresolved Phase 0 prerequisites. A future passing result must also be accompanied by independently reviewed parity evidence and CI wiring; this initial checker does not inspect or certify captures.

Do not mark a feature supported or advance a milestone until its completion gate has evidence. Update the compatibility matrix, status, and upstream lock when the evidence changes. An upstream release never updates a deployed engine automatically.
