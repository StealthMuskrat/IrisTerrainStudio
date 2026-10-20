# Architecture decisions

Status: proposed boundaries, grounded in the Phase 0 source audit. No application packages have been scaffolded before the engine feasibility gate.

## Three runtime responsibilities

| System | Responsibilities | Boundary |
| --- | --- | --- |
| Pack server | Static delivery; pack discovery, authorized file reads/writes, schema validation, backups, optimistic concurrency | Never generates chunks, noise, heightmaps, meshes, or previews |
| Browser editor | Schema controls, resource navigation, lossless edits, history, local validation, preview scheduling, resource-pack imports | Unsaved state, coordinates, caches, and custom resource packs remain local |
| Browser engine workers | Pinned Iris generation, dependency resolution, bounded local data and deterministic output | Native development reference services are never used as a runtime fallback |

Generation output is consumed locally by both visualizers. Rendering uses WebGPU; capability failure disables GPU visualization while preserving pack editing. Resource-pack changes invalidate model/texture resources; camera changes do not regenerate terrain.

## Engine reuse strategy

First isolate a real Iris `NoiseStyle`/VolmLib `RNG`/`CNG` call graph and compile that exact source using TeaVM Wasm GC. Investigate TeaVM JavaScript only if the first backend has a demonstrated blocker. Hand ports require native deterministic evidence; there is no approximate fallback.

The pinned Iris source already exposes platform services in `spi/`, native block-state interfaces in VolmLib, and development probes in `probe/`. These are useful boundaries, but browser feasibility is not established by their existence. The stub probe platform cannot stand in for a complete Minecraft block registry or exact platform material behavior.

Schemas should be exported during a pinned native build. Runtime Java reflection must not become a browser schema dependency. Browser asset and pack IO should use immutable in-memory resources while preserving original bytes/unknown fields for save operations. File operations remain confined to the configured server pack root.

## Generation protocol requirements

The eventual worker protocol carries a job ID, revision, pinned engine identity, pack digest, dimension, signed 64-bit seed as a decimal string, coordinates, requested bounds, and generation settings. Completion is applied only if job and revision are still current. Cooperative cancellation must be checked within bounded work units; obsolete messages alone do not cancel synchronous computation. Queues and caches need explicit memory budgets. These requirements are not implemented by this foundation.

## Planned code boundaries

After the proof of concept, use `apps/web`, `apps/server`, and separate packages for engine, configuration, resources, renderer, resource packs, and shared contracts. Start with only modules needed by the proved generation path. Development-only reference/export tools live under `tools/reference-tests`; generated game assets remain local unless distribution rights are established.
