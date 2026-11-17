---
status: accepted
topic: design-note
date: 2026-11-16
---

# 0154. main stores its test results under the hash a pull request computes

## Context

ADR 0081 lets a pull request replay the result of a suite whose inputs did not change. Outside pull requests every
suite runs: `make verify-tests` gave each run its own `OSF_TEST_RUN`, an environment variable in the hash of
`test:system` only, so the tests ran again and the builds stayed cached. A pull request leaves `OSF_TEST_RUN` unset.
So main stored each result under a hash that no pull request computes, and a pull request's first push could replay
only what an earlier push of a pull request had stored: the docs-only pull request #362 missed 39 of 39 test tasks,
and 21 of 30 green pull-request runs ran every suite. The Helm and Kubernetes suites, the slowest, ran with them.

## Decision

- `make verify-tests` runs `turbo run test:system --force` unless `OSF_TEST_CACHE` is set, as `make verify-static`
  already does for lint, typecheck and build. `--force` reads no cache entry and writes each result under its usual
  hash. `turbo.json` has no `env` for `test:system`, so main and a pull request compute the same hash for the same
  inputs (measured: the hash of `@opensoftware/tools#test:system` is the same with and without `--force` and with
  `--cache=local:w`; with `--only` it differs).
- main still runs every suite on every push, and the tests job keeps its new entries as before. The job `cache` saves
  them into `turbo-tests-`, which a pull request restores from its base branch on its first push. A result over its
  budget still stays out of the cache.
- `--force` also builds the packages of the suite again in the tests jobs on main and in `make verify`, one after
  the other (`--concurrency=1`). Measured on the development container under load: 26 s for the 3 builds of the
  suite `tools`, 75 s for the 28 builds of `e2e`, the largest. That is accepted: it is outside a suite's BUDGET, the
  slowest suite on main (deploy) has one build, and on main no result, build or test, comes from an earlier run.
- A dispatched run on a release pull request is no pull request either: it runs every suite with `--force` too.
- AFFECTED checks the new lines: `test:system` caches with no env, and `verify-tests` runs with
  `$(if $(OSF_TEST_CACHE),,--force)`. The scenarios that stated `OSF_TEST_RUN` are replaced.

This replaces the `OSF_TEST_RUN` of ADR 0081 and its "the builds stay cached" outside pull requests. The rule of
ADR 0081 and ADR 0094 that every suite runs outside pull requests stays.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `--force` on main, no env in the hash (chosen) | One flag, the same rule as `verify-static`; the hash of a pull request | main builds each suite's packages again, up to about a minute per suite job |
| Before the tests, delete the cache entries of the test tasks that a dry run names | Builds stay cached on main | A script with turbo's dry run and the cache's file names, which AFFECTED would have to pin; relies on turbo's cache layout |
| `--cache=local:w` | turbo's own write-only mode | The same as `--force` for every task: builds run again too |
| `--only` with `--force` after a cached build | Builds stay cached | `--only` leaves the builds of the dependencies out of the hash: a pull request computes another hash |
| Keep `OSF_TEST_RUN` | No change | A pull request's first push replays nothing that main proved |

## Prior art

- Turborepo 2.11.7 (MIT, maintained by Vercel), already in use: `--force` ignores existing entries and overwrites
  them, and `--cache` takes `r`, `w` or `rw` per cache source, for the whole run, not per task. The bundled docs of
  the pinned version (`reference/run.mdx`) were read. Adopted: `--force`.
- `actions/cache` (MIT, maintained by GitHub): a pull request restores caches of its base branch. Already in use.

## Consequences

- A pull request that changes no input of a suite replays main's result for that suite on its first push, also of
  the Helm and Kubernetes suites.
- main saves fewer new entries: a run that changes nothing overwrites the entries of the run before it instead of
  adding new ones under a hash of its own.
- A run on main or `make verify` takes longer by the build of each suite's packages.
- Revisit when turbo can skip reading the cache for one task, or when the builds of a suite job get slow.
