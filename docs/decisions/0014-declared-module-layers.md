---
status: accepted
date: 2026-10-19
---

# 0014. Every module declares its layers in architecture.json, and ARCH checks them

## Context

Agents write most of the code. Without a rule a machine can check, a module's structure drifts with every change:
a domain file imports a CLI helper, an adapter reaches into another adapter. ISOLATION already stops imports
between modules. Nothing stops wrong imports inside one module. `skills/implement-scenario` asks that domain logic
never imports an adapter, but no check enforces it.

## Decision

- Every module with source files (`modules/*`, `packages/*`, `adapters/*/*`) has an `architecture.json` next to
  its `package.json`. It lists the module's layers from top to bottom:
  `{ "layers": [{ "name": "cli", "paths": ["src/cli/"] }, { "name": "domain", "paths": ["src/domain/"] }] }`.
  A path that ends in `/` is a folder; any other path is one file.
- The new check ARCH (fast set) fails when:
  - a module with files in `src/` or `bin/` has no `architecture.json`;
  - a source file in `src/` or `bin/` is in no layer;
  - a file imports a file of a layer listed above its own. Imports within a layer and to lower layers are fine.
- The module's author picks the layers when the module starts (`skills/new-module`). The template starts with
  `entry` → `adapters` → `domain`, the ports-and-adapters shape most modules need.
- ARCH uses dependency-cruiser, which ISOLATION and BOUNDARY-STATIC already use.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `architecture.json` per module, checked with dependency-cruiser | One small file per module; no new dependency; same output format as the other checks | A home-made format |
| A `.dependency-cruiser.cjs` per module | Full power of dependency-cruiser rules | Code instead of data; every module repeats the same rule boilerplate |
| eslint-plugin-boundaries | Mature, element types and rules | Needs ESLint next to Biome |
| ArchUnitTS / ts-arch | Architecture rules as tests | Rules would be unit-style tests, which ADR 0007 rules out; ts-arch is barely maintained |
| Nx module boundaries | Tag-based rules | Needs Nx; ADR 0010 chose Turborepo |

## Prior art

- dependency-cruiser (MIT, active, 18.x): already a dependency (ADR 0011). Adopted as the engine.
- eslint-plugin-boundaries (MIT, active): the closest model for layers as element types; not adopted because the
  repository uses Biome, not ESLint.
- ArchUnitTS (MIT, active, young) and ts-arch (MIT, few releases since 2023): rules as test code; not adopted, see
  ADR 0007.
- Nx `enforce-module-boundaries` (MIT, active): needs Nx; not adopted, see ADR 0010.

## Consequences

- A module's structure is data that a reviewer reads in one file, and every change is checked against it.
- Moving a file across layers, or adding a layer, is a change to `architecture.json` in the same pull request.
- The first user is `packages/testkit`: `cli` → `api` → `scenario` → `sut` → `fakes` → `support`.
- Revisit when a module needs rules that layers cannot express, for example two peer layers that must not import
  each other.
