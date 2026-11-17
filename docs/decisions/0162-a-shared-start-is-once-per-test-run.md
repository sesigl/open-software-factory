---
status: accepted
topic: design-note
date: 2026-11-17
---

# 0162. A shared start runs once per test run, through the testkit's global setup

## Context

ADR 0157 lets scenarios that only read a slow system share one start of it, tagged `@shared=<name>`, and says that
the start "runs once per test process, like those fakes". T-82 builds it for the deploy suite, whose item is done
when the suite starts the whole Compose profile once and installs the whole chart once.

Vitest runs the deploy suite's test files in several worker processes (`isolate: false`, about one per core), and
`make test-scenario` needs one test file per scenario, named after it. Once per test process would start the profile
once in each worker that runs a scenario of the group: three or four starts on a CI runner, not one. A worker also
has no hook that runs when its last test file is done, so it cannot take the system down itself.

Measured on 17 November 2026, on a machine with 4 cores and Docker, the 30 Compose scenarios of `deploy/`: 85 and
88 s of wall time with a start of the profile in each of SCN-DIST-003, -004, -017, -026 and -050 (each of them 31 to
33 s), and 48, 55, 58 and 77 s with one shared start (the machine ran other suites too).

## Decision

- A shared start runs once per **test run**. `sut.shared(name, start)` meets the other test processes of the run in a
  folder that the testkit's global setup (`@opensoftware/testkit/global-setup`) makes: the first scenario of the group
  that creates the group's folder runs `start` in a workspace of the group and writes the workspace and the result
  there; every other scenario of the group, in any process, waits for that record. `start` gets the files of the
  group's workspace, and `compose` and `helm` on its project and namespace; its result is passed on as JSON.
- The global setup takes each group's project and namespace down when the run ends, also after a failed start or a
  failed test. A run that is killed leaves the Compose project to the sweep of ADR 0090: its owner is the run's main
  process.
- A failed start fails every scenario of the group with `the shared start "<name>" failed in <scenario>: <failure>`.
- The testkit checks the tag both ways: a scenario that calls `sut.shared(name)` without `@shared=<name>` fails, and
  so does a scenario with the tag that did not call it. No separate static check is needed.
- `testkit run` has the global setup; a package that runs `vitest` itself names it in `globalSetup`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Once per test process (ADR 0157 as written) | No global setup | One start per worker: the profile three or four times on CI; no point at which a worker can take it down |
| One test file per group with several `scenario()` calls | Plain module state, one process | `make test-scenario` and the AFFECTED cache find a scenario's test by its file name |
| Start every group in the global setup | One place | Starts groups whose scenarios do not run, as with `make test-scenario` of another scenario |
| A lazy start in the first worker, a record in the run's folder, teardown in the global setup (chosen) | One start per run, and only for groups that run; one test file per scenario stays | Scenarios of a group wait for another process; a process that dies during the start leaves the others waiting until their timeout |

## Prior art

- [Vitest's `globalSetup`](https://vitest.dev/config/#globalsetup) (MIT, active): runs once in the main process
  before the workers, and the function its `setup` returns runs at the end of the run; `provide` and `inject` pass
  serializable values to the tests. We adopt it as it is.
- [pytest-xdist](https://pytest-xdist.readthedocs.io/en/stable/how-to.html#making-session-scoped-fixtures-execute-only-once)
  (MIT, active): session fixtures run once per worker, and its docs show the same answer for "only once": a file lock
  and a file in a shared temporary folder, where the first worker writes the value and the others read it.
- ADR 0157 names Testcontainers' reuse and pytest's fixture scopes; neither shares across the processes of one run.

## Consequences

- The deploy suite starts the profile once and installs the chart once (T-82); the Helm scenarios first run with it
  on CI.
- A shared start needs the global setup: without it, `sut.shared` fails with a message that names it.
- Revisit when a shared start is wanted inside a unit that REACH or MUTATION covers (ADR 0157).
- This ADR amends ADR 0157 on the scope of the start: per test run, not per test process.
