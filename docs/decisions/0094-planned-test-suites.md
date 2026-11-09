---
status: accepted
date: 2026-11-09
---

# 0094. verify plans its test suites and starts a runner only for a suite with work

## Context

`verify.yml` ran one job for each of the 17 test suites on every push. On a pull request, each job got a runner,
installed the workspace, restored its own turbo cache and asked turbo whether its suite's tests were cache hits
(ADR 0081). A pull request that changed only the console started all 17 jobs; 16 of them spent one to two minutes to
find that they had nothing to run, and replayed their results.

Each suite also kept its own cache, `turbo-<suite>-`. A job could only read the results of its own suite, so the
decision whether a suite has work could not move out of its job.

Other repositories with turborepo start a dynamic matrix from `turbo ls --affected` or `turbo query affected`. Those
name the packages whose files changed since the base. They do not replay the results of the other packages, which
PASS needs, and they do not know which results the cache holds, so a second push of a pull request would run its
changed suites again.

## Decision

- The suites move from the matrix of `verify.yml` to `.github/test-suites.yml`, with the same fields. A new package
  with system tests runs in the suite `rest` without a change.
- The job `plan` restores the one turbo cache of the tests, `turbo-tests-`, and runs `turbo run test:system
  --dry=json` once. On a pull request:
  - A suite with a package whose test task is no cache hit goes into the matrix of the tests job.
  - The job replays the other suites with `make verify-tests`, one suite at a time, and uploads their results as
    `reports-replayed-a<attempt>`.
- Each tests job uploads its results as `reports-<suite>-a<attempt>`. A rerun of a job adds its results under the new
  attempt, and `verify` copies the attempts in order, so the newest result of each suite counts. Merged in any order,
  a rerun of a suite over its budget still read the first, slow result (measured on 9 November 2026: 489.9 s read
  after the rerun measured inside the budget).
- Outside pull requests every suite runs, as before (ADR 0081).
- The tests job restores `turbo-tests-`. When BUDGET passes, it uploads the cache entries it wrote as an artifact. The
  job `cache` joins these entries into `turbo-tests-`, removes the entries older than 14 days and saves the cache once.
  A result over its budget stays out of the cache, as before.
- `.github/test-suites.yml` is a global dependency of turbo, as `verify.yml` is.
- Checks keep the places in step:
  - AFFECTED: each package with system tests is in exactly one suite; each filter names a package with system tests;
    the job `plan` reads the suites; the tests job runs only the planned suites; the jobs `plan`, `tests` and `cache`
    keep `.turbo/cache` in the cache `turbo-tests-`.
  - DEPS: a dependency that needs an exact version of a peer, such as `@electric-sql/pglite-prepopulatedfs` (ADR 0093),
    has that peer at that version in the same package. An optional peer must match only when the package declares
    it. DEPS reads `pnpm-lock.yaml`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A plan job on turbo's dry run and one shared cache (chosen) | The same hashes and replays as before; a second push replays what the first one ran | One more job; one cache that holds every suite's builds and results |
| `turbo query affected --tasks test:system` for the matrix | turbo's own change detection | Runs every changed suite again on each push; replays nothing, which PASS needs |
| A plan job that restores the 17 caches of the suites | No change to the caches | One restore step per suite, which a new suite must also get |
| turbo remote caching on the GitHub cache (rharkor/caching-for-turbo) | One cache per task | A new action that writes each result at once, also a result over its budget |
| Keep one job per suite | No change | 16 idle runners on a small pull request |

## Prior art

- Turborepo 2.11.7 (MIT, ADR 0081): `turbo run --dry=json` gives each task's hash and its cache status; the
  constructing-CI guide recommends `turbo query affected` to skip jobs. The dry run is adopted, as it already decided
  each suite's replay.
- GitHub Actions: a matrix from a job output with `fromJSON`, and `actions/upload-artifact` and `download-artifact`
  with `merge-multiple` (MIT): adopted.
- `rharkor/caching-for-turbo` (MIT, maintained): checked, not adopted for the reason in the table.

## Consequences

- Measured on the pull request of this decision:

  | Push | Test jobs | `plan the suites` | Whole `verify` run |
  | --- | --- | --- | --- |
  | 1, a change to `verify.yml`, a global dependency | 17, each suite ran | 41 s | the slowest suite, deploy, 326 s |
  | 2, a commit with no change | none; all 17 suites replayed | 44 s | plan, then `verify`, 74 s |

  Before this decision, push 2 started all 17 test jobs, each with its own runner, install and cache restore.
- A pull request that changes one module starts the jobs `static`, `plan`, the suites of that module and of the
  modules that depend on it, `cache` and `verify`.
- A change to `turbo.json`, a global dependency or a library that every suite uses still runs every suite.
- The cache entries of a suite reach the next run only through the job `cache`. A run that is cancelled before that
  job saves no new entries.
- Revisit when turbo can replay the results of tasks that `--affected` leaves out.
