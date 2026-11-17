---
status: accepted
topic: packages
date: 2026-11-14
---

# 0138. A published package runs only on what it publishes and depends on

## Context

`@opensoftware/console@0.8.0` did not start when installed from npm. Its `serve` command resolved
`@opensoftware/ui/brand/favicon.svg` with `createRequire(import.meta.url).resolve(...)` at run time, and
`@opensoftware/ui` is only a devDependency of the console: its build compiles the design system into `dist/web/`,
and the library is not published. npm installs a package with its `dependencies`, `peerDependencies` and
`optionalDependencies`, never with its `devDependencies`. In this repository every devDependency is installed, so
every system test passed; only the deploy suite, which runs after a release, saw it. The repository's rule is that
every per-package convention has a deterministic check that also catches a new package.

## Decision

- **The check DEPS-RUNTIME** fails when the code a published package ships loads, at run time, a package that is not
  in its `dependencies`, `peerDependencies` or `optionalDependencies`, is not a Node built-in and is not the package
  itself. The finding names the file, the line and the fix: move the package to `dependencies` (or add it), or stop
  loading it at run time.
- **The code it ships** is the TypeScript sources that its entry points (`bin`, `main`, `exports` of its
  `package.json`, `dist/x.js` read as `src/x.ts`) reach through relative imports. Tests, scripts and the files a bundler
  builds are not reached: no entry point imports an Astro template, which Node cannot load. So the console's
  templates in `src/web/` may import `@opensoftware/ui`, and nothing names the console.
- **A load** is an import or a re-export that compilation keeps (with `verbatimModuleSyntax`, `import type` and
  `export type` are erased, nothing else), an `import("x")`, or a lookup by name: `require("x")`,
  `createRequire(...)("x")`, and `.resolve("x")` of a require or of `import.meta`. Only a string literal names a
  package.
- **A bundled package** (its build script runs `tools/bin/bundle.ts`, ADR 0079) holds its imports in the bundle, so
  they may name devDependencies, as `channel-slack`'s do; its lookups by name still load from `node_modules` and must
  be dependencies. The build script is where the package already says how its `dist/` is made, so it needs no new
  declaration.
- The check reads the sources with the TypeScript parser that ts-morph ships, as SURFACE does: no build, no
  `node_modules`, so it runs in `make check-fast`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| DEPS-RUNTIME on the sources the entry points reach (chosen) | Sees `createRequire(...).resolve`; no build; templates are left out without a list | A file loaded by a computed path, like the testkit's fakes, is not followed |
| Every source file in `src/` | Simpler | Flags a file that only a bundler builds; needs a per-package list of such folders |
| Install each package from a packed tarball and start it | Proves the install itself | A build and an install per package; minutes; not a static check |
| Extend DEPS | One ID fewer | DEPS reads the lockfile for exact peers; one ID per rule keeps each finding's fix plain |

## Prior art

- **Biome `noUndeclaredDependencies`** (MIT, active, already installed at 2.5.15): checked on a sample. It reports an
  import and an `import()` of a devDependency and skips `import type`, but not the
  `createRequire(import.meta.url).resolve(...)` that broke the console. It judges files by glob, so the console's
  templates and `channel-slack`'s bundled imports would need overrides per package.
- **knip** (ISC, active): its production mode reports dependencies that production code uses but does not list, and
  reads `require.resolve`. A new dependency with a plugin per framework (Astro), resolution through `node_modules`
  and seconds per run; its findings do not map to one rule with its fix.
- **eslint-plugin-import `no-extraneous-dependencies`** (MIT, active): the same rule for imports; needs ESLint, which
  this repository does not use.
- **depcheck** (MIT): finds unused and undeclared dependencies of a whole folder; it does not tell code that runs from
  code that only builds or tests.

## Consequences

- A run-time load of a devDependency fails `make check-fast`, in the pull request that adds it, with file and line.
- A package that needs a file of a library at run time either depends on it or copies the file in its build.
- Revisit when a package loads code by a computed path that matters, or when a bundler other than `osf bundle` and
  Astro builds a published package.
