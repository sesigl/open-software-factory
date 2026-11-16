---
status: accepted
date: 2026-11-16
---

# 0155. BUDGET is the wall time of a suite

## Context

BUDGET summed the JUnit times of a unit's system tests and divided the sum by a speed factor of the runner (ADR
0103). Both parts measured something other than what a person waits for:

- The sum grows when tests run side by side. Vitest times each test while the other workers load the same cores:
  gatekeeper's tests summed 83.6 s with one worker (86 s wall time) and 118.5 s with four workers (32 s wall time).
  A change that made the suite end sooner made it fail its budget.
- The factor of `testkit timed` (four Node starts and a JSON loop, before and after the tests, divided by a fixed
  200 ms) ranged from 0.65 to 1.17 over 110 CI jobs, while the budgets kept 7 to 8 % of room.

BUDGET failed 11 of 21 failed pull-request runs. Each time the budget was raised, with a paragraph of measurements in
the unit's `AGENTS.md`: console's budget went from 60 to 335 s in eleven steps, deploy's from 660 to 840 s, and
console's budget section grew to about 2,100 words.

## Decision

- `testkit timed <command>` measures the wall time of the command it runs, from its start to its end, and writes it
  to `reports/run-time.json` (`{"seconds": 12.345}`), with `CI` set or not, so a local `make verify` checks the same
  thing as CI. Each package's `test:system` stays `testkit timed vitest run`. The benchmark and its reference time go.
- `osf collect-reports` copies the file to `reports/run-time/<package>.json`; `verify.yml` uploads that folder with the
  JUnit reports.
- BUDGET compares that wall time with the line `System tests: N seconds of wall time` in the unit's `AGENTS.md`. A
  unit with JUnit results of system tests and no wall time is a finding, as is a package whose `test:system` does not
  run `testkit timed`. A budget section has at most three lines: the budget and what dominates the time. Its history
  stays in Git, and the reason for a new budget goes in the commit message.
- Room: each budget is the measured wall time of the unit's tests times 2, rounded up to the next 10 s, and at least
  45 s. The runners' speed spread from 0.65 to 1.17 of ADR 0103's reference over 110 CI jobs, a factor of 1.8 between
  the fastest and the slowest, and one measurement can come from a fast runner: twice that time still passes on the
  slowest runner seen. The floor covers the start of turbo, Node and Vitest, which a small suite cannot shorten, and a
  busy development machine: the tools suite took 18 s on CI and 27.8 s and 40.8 s on the development container while
  other agents ran their tests.
- The CI numbers come from run 43832015192 (the `make verify-tests` step of each suite's job, which includes a few
  seconds of turbo and builds). For the units of the suite `rest`, which shares one job, the numbers were measured
  one unit at a time on the 4-core development container while other agents worked; that machine is slower than a
  CI runner, so those budgets have more room.
- A replayed result replays its `reports/` (ADR 0081), so its wall time is the time of the run that produced it, as
  the speed file was. CI keeps a result over its budget out of the cache, so a replay does not carry one.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Wall time of the run, twice the measure, no factor | Measures what a person waits for; more workers make it shorter, not longer; covers the 1.8 spread of the runners; nothing to calibrate | A suite can nearly double before BUDGET sees it |
| Keep the sum, divide by the factor (ADR 0103) | Built | Grows with parallel workers; the factor moves more than the room |
| The sum with one worker | Independent of the number of workers | Slower suites for everyone, only to measure them |
| Wall time with the factor | Corrects for slow runners | The factor's noise is larger than what it corrects; one more file to keep |
| Wall time with 50 % room | Sees a slowdown sooner | Less than the 1.8 spread of the runners: it fails on runner luck, as the sum did |
| No budget, only CI's job timeouts | Nothing to keep | A suite that doubles goes unseen until it hits the timeout |

## Prior art

No new dependency. GitHub Actions' `timeout-minutes` and Bazel's test `size` and `timeout` are budgets of wall time
too, with wide classes rather than tight numbers; Vitest reports each test's time, not the time a person waits.

## Consequences

A suite that gets more workers and ends sooner passes, and a pull request no longer fails because it got a slow
runner: the room is 100 %, not 8 %. A suite has to nearly double before BUDGET fails it, so a slow creep is seen
later; review the budgets when a unit's measured time is far below its budget. A local run on a very slow or busy
machine can still exceed a budget set from CI; make the suite faster, or run it alone. Revisit the room if BUDGET
fails a pull request whose suite did not change: measure several CI runs of that unit before raising its budget. ADR 0129
kept foreman at two Vitest workers until BUDGET measured something else than the sum of the tests' times; more
workers can now only shorten what BUDGET measures, so that choice is open again.
