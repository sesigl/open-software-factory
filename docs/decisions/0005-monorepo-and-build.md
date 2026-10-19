---
status: accepted
date: 2026-10-18
---

# 0005. Monorepo with native package managers and independent releases

## Decision
One repository. pnpm workspaces (TypeScript only, ADR 0009), `make` as the single entry point
(`make check`, `make verify`, `make smoke`). Add Nx for the task graph and caching when CI passes about ten
minutes. Release every package independently with release-please (Changesets would also work now that
every package is npm; release-please also covers the generated Python and Java clients) from conventional commits.

## Options considered
Bazel (hermetic, but steep and hostile to contributors), Gradle (familiar to the maintainer, unfamiliar to TS and
Python contributors), moon (good, smaller community), Make only (no caching).

## Consequences
Commit messages follow Conventional Commits with the module as scope, for example `feat(proof): attach evidence`.
