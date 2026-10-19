---
status: accepted
date: 2026-10-19
supersedes: 0005 (build tool part only)
---

# 0010. pnpm workspaces and Turborepo as the monorepo tooling

## Context

ADR 0005 chose pnpm workspaces and `make`, and deferred Nx until CI passes about ten minutes. That choice was made
while the plan still had Python modules, where a polyglot tool would have helped. With TypeScript as the only core
language (ADR 0009), the native JavaScript toolchain covers the whole repository.

Heavy monorepo tools tend to own the build: their own configuration language, generators, plugin upgrades,
migrations, or rules that fight npm. That cost is the main reason such setups feel painful, and agents pay it on
every change.

## Decision

- **pnpm workspaces** for packages and local links between them.
- **Turborepo** for the task graph, caching and parallel runs, with one root `turbo.json`. Tasks: `build`,
  `lint`, `typecheck`, `check`, `test:system`, `docs`. Each package defines these as plain `package.json`
  scripts, so every package still works with `pnpm run` alone.
- Affected runs use `turbo run <task> --filter=...[origin/main]`.
- Local cache always on. Remote cache optional (a self-hosted Turborepo cache server, or none); CI must pass
  without it.
- **`make`** stays the single entry point for people and agents. It only calls pnpm and turbo; it holds no build
  logic. For example, `make check` runs the affected `check`, `lint`, `typecheck` and `test:system` tasks, and
  `make verify` runs them for all packages plus the repository-wide checks in `tools/checks/`.
- **release-please** stays for independent versions and changelogs from Conventional Commits (ADR 0005).
- No Nx, moon, Bazel, Lerna or Gradle.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| pnpm + Turborepo | small config; caching and task graph; no plugins or generators; easy to remove | coarser understanding of the dependency graph than Nx |
| pnpm only | zero extra tools; `pnpm --filter "...[origin/main]"` gives affected runs | no caching, no task graph across packages |
| Nx | best project graph, generators, caching | opinionated; plugins, inference and `nx migrate` to maintain; overkill at about 30 packages |
| moon | good polyglot task runner | its main advantage (several languages) no longer applies |
| Bazel | hermetic, scales to anything | steep; JavaScript rules fight the native tools |

## Prior art

Turborepo (MIT, maintained by Vercel) is the common pairing with pnpm workspaces for TypeScript monorepos.
release-please supports monorepos with independent package versions.

## Consequences

- T-00 sets up `pnpm-workspace.yaml`, `turbo.json` and the `make` targets on top of them.
- Package scripts must declare their inputs and outputs in `turbo.json` so caching is correct. A cached result must
  never hide a failing check: `tools/checks/` runs outside the cache, and CI runs `make verify` from a clean state.
- Revisit if the repository grows past a few hundred packages or needs finer dependency analysis; then evaluate Nx.
