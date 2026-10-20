---
status: accepted
date: 2026-10-20
---

# 0026. CI runs `make verify` as parallel jobs, one runner per test suite

## Context

`verify` was one job of about 6.5 minutes. Setup took 15 s, lint, typecheck and build 41 s, and the system tests
5 m 10 s, because `make verify` runs one suite at a time. It must: BUDGET adds up the test times of each suite, and
suites that shared the four cores of one runner pushed runlog and tools over their budgets. Running test files two
at a time did not help either. Most of the time goes to the testkit and factory-spec suites, which start containers
(ADR 0016).

## Decision

- `make verify` is three targets: `verify-static` (lint, typecheck, build), `verify-tests` (the system test suites,
  one at a time; `FILTER` limits them to some packages) and `verify-checks` (every check, on the results in
  `reports/`). Locally `make verify` runs them in order, as before.
- `.github/workflows/verify.yml` runs `verify-static` and one `verify-tests` job per suite side by side, each on its
  own runner. A `rest` job runs every package without a job of its own, so a new module needs no workflow change.
- Each test job uploads its JUnit and coverage results with `actions/upload-artifact`. The `verify` job downloads
  them all with `actions/download-artifact`, runs `verify-checks`, and fails when any part failed. It keeps the
  name `verify`, the required check.
- The testkit and factory-spec jobs pull the container images their scenarios start (the `IMAGES` of the testkit)
  in the background, while the build runs.
- Coverage files are named after the process ID, which repeats across runners, so each job prefixes them with its
  suite before upload.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One job per suite (chosen) | Wall time is the slowest suite, not the sum; each suite has a runner to itself, so BUDGET stays fair | Each job pays setup and its own build (about 30 s); the checks wait for the slowest job |
| Run suites side by side on one runner | No workflow change | Tried in #32: suites slow each other and BUDGET fails |
| Larger runners | One job, more cores | A paid service |
| Turborepo remote cache | Skips unchanged builds | A new service; tests are never cached, so little gain |
| In-memory substitutes for the containers (PGlite, an in-process S3) | Faster starts | ADR 0016 chose real services; the testkit scenarios prove those very containers |

## Prior art

- GitHub Actions job matrix with `actions/upload-artifact` and `actions/download-artifact` (MIT, maintained by
  GitHub): the standard way to fan out tests and collect results. `upload-artifact` was already in use.
- Vitest `--shard` (MIT, active): splits one suite across runners. Not needed yet; the slowest suite fits one
  runner. Revisit when one suite dominates.
- Turborepo remote cache (MPL-2.0 client, Vercel service): see Options.

## Consequences

- CI wall time drops to setup, build and the slowest suite, plus the checks job.
- A new heavy suite can get its own matrix entry; until then it runs in `rest`.
- Revisit when one suite alone exceeds a few minutes: shard it with Vitest `--shard`.
