---
status: accepted
date: 2026-10-21
---

# 0039. Libraries in packages/: layout, tests and releases

## Context

ADR 0037 let a module depend on a library in `packages/`: shared code with no CLI and no state, and its own
scenarios. It left open how a library is laid out, how its scenarios are tested and how it is released. DUP
started with nine clones across units in `docs/quality/duplication-baseline.json`. Each one is code that two
modules, or a module and the tooling, need. Each must move into a library or into `contracts/`.

The testkit could not test a library. `scenario()` looked up the unit's `bin` before the test ran, and a library
has none. `sut.files` gave no path into `$INPUT`, but a library's functions take paths. BOUNDARY-STATIC let a
system test import only the testkit, the contracts and the test framework, so a library's test could not import
the library. MUTATION covered only modules and adapters.

## Decision

- **What a library is.** A package in `packages/<name>/` without a `bin`, named `@opensoftware/<name>`. It holds
  code that two or more units need; code of one module stays in that module. It has no CLI and no state. Its
  public surface is the exports of `src/index.ts`.
- **Layout.** The same files as a module: `package.json`, `AGENTS.md` (public surface, layers, budget, quality
  limits, prefix), `README.md` (quick start in TypeScript, API, releases, configuration, scenarios),
  `architecture.json`, `features/`, `system-tests/`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`,
  `biome.json`. Its scenario prefix is registered in `docs/reference/scenario-prefixes.md`.
- **Built before use.** `exports` points at `dist/`. Turbo builds a library before every package that depends on
  it (`^build`). A module's built artifact imports the built library, in this repository and from npm.
- **Tests.** A library's system tests import the library by its package name and call it in their own process.
  BOUNDARY-STATIC allows that import, and only that one, in `packages/<name>/system-tests/`; it resolves to
  `dist/index.js`. An import of the library's `src/` still fails. The testkit looks up a unit's `bin` only when a
  test starts it, so a library's test runs without one. `sut.files.path("$INPUT/...")` gives the absolute path of
  a file in `$INPUT` or `$OUTPUT` for functions that take paths (SCN-TK-045, SCN-TK-046).
- **Quality.** DUP and MUTATION apply as to a module. MUTATION covers every package without a `bin`; Stryker
  rebuilds `dist/` from the mutated sources, so the tests in the same process see each mutant.
- **ISOLATION.** A module may depend on any package without a `bin` in `packages/`. The testkit has a `bin` and
  stays a dev dependency only.
- **Releases.** Each library is released with release-please (ADR 0038) as `<name>-v<version>` and published by
  `.github/workflows/publish-<name>.yml`, like the testkit. A module names the library with `workspace:*`; `pnpm
  pack` writes the released version into the module's published `package.json`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Library tested in its own process through its exports | Fast; the exports are what modules call | Needs a BOUNDARY-STATIC rule and `sut.files.path` |
| Library tested only through the modules that use it | No new rules | A library without its own scenarios; a change breaks a module far away |
| Library tested through a small CLI of its own | Same process model as modules | A CLI nobody uses; more code than the library |
| `exports` at `src/*.ts`, like the testkit | No build step | A module's `tsc` build refuses sources outside its `rootDir`; the published package would differ |
| One package with all shared code | One release | Unrelated code changes together; agents find less by name |

## Prior art

Checked for the layout and the tests, all MIT and maintained in 2026: the pnpm and Turborepo guidance for internal
packages (built packages with `exports` at `dist/`, which we adopt), Nx and its "library" project type (same
model, but its own task runner next to Turborepo), and Changesets for releases (we keep release-please, ADR 0038).
Each library's own ADR names the projects checked for its code.

## Consequences

- An agent that finds a clone has a fixed place to put the code and a fixed list of files to write.
- A library change rebuilds and retests every module that uses it, through Turbo's `...[base]` filter.
- A library's first release needs the npm token once, then a trusted publisher, like every package.
- A module that adopts a library is released after the library; npm installs fail until both are published.
- Revisit when a library is needed outside this repository's modules: it then becomes a module with its own
  surface.
