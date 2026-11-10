---
status: accepted
date: 2026-11-10
---

# 0103. BUDGET takes the speed of the runner into account

## Context

BUDGET sums the JUnit times of a module's system tests and compares the sum with the budget in its `AGENTS.md`.
CI runs each suite on its own GitHub-hosted runner. The speed of those runners changes from job to job: the same code
of foreman took 324 s in one run and 224 s in the next, and the deploy suite took 543 s and 874 s. With a margin of
about 10% in each budget, BUDGET failed pull requests that did not change the suite, and a rerun of the job could
make it pass. That makes the check noisy, and it hides real slowdowns among the noise.

On pull requests, turbo replays a suite's JUnit report from an earlier run (ADR 0081), so the times of one report can
come from another runner than the job that checks them.

## Decision

- `testkit timed <command>` runs a package's system tests. With `CI` set, it runs a fixed benchmark before and after
  the command: four Node processes that start and end, and JavaScript that writes and reads objects. It writes
  `reports/runner-speed.json` with both times, the reference time and the slowdown: their mean divided by the
  reference time. turbo stores that file with the JUnit report of the same run, so a replay has the speed of the
  runner that made the times.
- The reference time is the benchmark's median time on the test jobs of one CI run, in
  `packages/testkit/src/support/runner-speed.ts`. A budget is a time on that reference runner.
- `osf collect-reports` copies the file to `reports/speed/<package>.json`. BUDGET divides a module's time by its
  slowdown before it compares the time with the budget, and names both times when it fails. Without the file, as in a
  local `make verify`, the slowdown is 1.
- BUDGET rejects a package with system tests whose `test:system` does not run them with `testkit timed`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A benchmark in the same task as the tests | A slow runner gets more time and a fast runner less; replays keep their speed | About 1 s more for each suite on CI; one benchmark does not see every kind of load |
| Larger margins in the budgets | Nothing to build | A real slowdown goes unseen until it is large |
| Rerun a job that fails BUDGET | Nothing to build | Hides real slowdowns, and costs a whole job |
| CPU time instead of wall time | Does not depend on the other jobs of a runner | Misses waits, which are much of what the budgets are for; Vitest reports wall time |
| Larger runners | Faster and less noisy | A cost for each minute |

## Prior art

No new dependency. Benchmark harnesses such as Google Benchmark and the CPU calibration of some CI systems scale
results by a reference workload; GitHub-hosted runners publish no speed figure of their own.

## Consequences

A budget no longer fails because a pull request got a slow runner, and a suite that got slower fails on a fast runner
too. Each suite takes about 1 s more on CI. The benchmark measures CPU and process starts, not the disk or Docker, so
a suite that waits mostly on containers is still somewhat noisy. Changing the benchmark needs a new reference time
from CI in the same change.
