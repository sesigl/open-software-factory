---
status: accepted
date: 2026-11-05
---

# 0081. Pull requests replay the system test results of unchanged suites from the turbo cache

## Context

CI runs all system test suites on every pull request, one job per suite (ADR 0026). A pull request that changed one
README took 8 minutes of wall time. The slowest job, deploy, spends about 3 minutes on kind and its images before its
tests start. ADR 0026 did not cache tests: PASS required that every implemented scenario ran in this CI run.

System tests use no real network, model, clock or randomness (AGENTS.md). The same inputs therefore give the same
result, and a result can be used again while its inputs do not change. The risk is an input that the cache key does
not know. An example existed: gatekeeper's tests start the adapters forge-github and channel-slack through
`sut.adapter(...)`, but gatekeeper's `package.json` did not declare them. A change to forge-github then did not change
gatekeeper's key, and `make check`, which selects the affected suites with turbo, did not run gatekeeper's tests.

## Decision

- `test:system` is a cached turbo task. Its key is turbo's hash of the package's files, the builds of its declared
  workspace dependencies, its lockfile entries and the repository-wide files in `globalDependencies` of `turbo.json`.
  Its outputs are the package's `reports/` folder: `reports/junit.xml` and `reports/coverage/`.
- On a pull request, CI restores the turbo cache of each suite with `actions/cache`, from earlier runs of the pull
  request or of `main`. A suite with a known hash replays its results and skips its slow setup (images, kind,
  browser). Everywhere else (`main`, nightly, `make verify`) every suite runs: `make verify-tests` gives each run its
  own `OSF_TEST_RUN`, an environment variable in the hash of `test:system` only, so the tests run again and the builds
  stay cached. A missing input therefore shows up at the latest in the next run on `main`.
- Lint, typecheck and build (`make verify-static`) use the same rule: a pull request replays the results of unchanged
  packages from the cache of its job; everywhere else they run with `--force`.
- Two turbo options do not fit: `--force` also rebuilds every package, and `--only` leaves the builds of the
  dependencies out of the hash of `test:system`, so a change in a dependency would replay old results.
- `turbo.json` sets `cacheDir` to `.turbo/cache`. Without it, turbo shares one cache between Git worktrees, and the
  results hold absolute paths of the worktree that made them.
- `osf collect-reports` copies each package's results to `reports/junit/<name>.xml` and
  `reports/coverage/<name>-*.json`, where the checks read them. PASS, FLAKE, BUDGET and REACH count a replayed result
  as a result of this run: it is the result of the same inputs.
- The check AFFECTED enforces the key, in every `make check` and `make verify`, without a cache:
  - every adapter that a system test starts with `sut.adapter(...)` and every `@opensoftware/*` package it imports is
    declared in its `package.json`;
  - a path in a system test that leaves its package points into a declared workspace dependency or a file of
    `globalDependencies`;
  - every package with system tests runs in exactly one tests job of `verify.yml`;
  - every such package writes its JUnit results to its own `reports/junit.xml`;
  - `turbo.json` caches `test:system` with the inputs and outputs above, and `globalDependencies` lists the
    repository-wide files that tests depend on;
  - only pull requests use the cache, `make verify-static` forces lint, typecheck and build otherwise, no run of
    `test:system` uses `--only`, and `cacheDir` is set.
- A module may declare an adapter that its system tests start as a `devDependency`. ISOLATION accepts that and still
  forbids an import of the adapter, and any declaration of another module.

This replaces the decision of ADR 0026 that tests are never cached. The rest of ADR 0026 stays.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Turbo cache of `test:system` with an enforced key (chosen) | Precise: a suite runs only when its inputs change; the same in CI and locally; no new service | The key is only as good as the declared inputs, so it needs the check AFFECTED; results of a pull request can come from older runs |
| Select suites by the git diff against the base | Simple to read | Coarser; replayed results must come from a stored run of `main`; the same declaration problem |
| Run all suites, only faster setup (cache `node_modules`, kind images) | PASS stays as it is | Saves about a third; a README change still runs every suite |
| Turborepo remote cache (Vercel) | Shared cache with no workflow steps | A new paid service |

## Prior art

- Turborepo task cache (MIT, maintained by Vercel), already in use for builds: hashes inputs and dependency tasks and
  replays outputs. Adopted; `$TURBO_ROOT$` and `--dry=json` exist in the pinned 2.11.
- `actions/cache` (MIT, maintained by GitHub): stores the local turbo cache between runs; caches of `main` are
  readable by pull requests.
- Nx affected and Bazel remote cache: the same idea with their own build graph; adopting either means replacing turbo.

## Consequences

- A pull request runs only the suites whose inputs changed. The others replay their results in about a minute.
- A new package with system tests must join a tests job (or `rest`) and write its results to `reports/junit.xml`;
  AFFECTED says so.
- A system test that uses another package must declare it. This also fixes `make check`, which selects affected
  suites with the same graph.
- Revisit when a test reads an input that AFFECTED cannot see, for example a file it builds a path to at run time.
  The run on `main` without the cache finds such a gap.
