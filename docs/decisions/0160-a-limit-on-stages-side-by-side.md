---
status: accepted
date: 2026-11-17
topic: factory
---

# 0160. A limit on the stages that run side by side, on a task queue of their own

## Context

Nothing limited how many stages a foreman runs at the same time. Each run's stage is a Temporal activity, and the
worker takes up to 100 activities at once, Temporal's default. A stage of the reference factory runs in a sandbox of
2 CPUs and 4 GiB, a sandbox of the docker adapter takes a bridge network of Docker's pools, which end after about 30
(ADR 0158), and the factory of this repository runs on one machine (ADR 0080). A burst of issues would start one
sandbox per run at once and run the machine out of CPUs, memory or networks.

The worker's own limit, `maxConcurrentActivityTaskExecutions`, counts every activity of its task queue, not only the
stages: publishing `run.started@v1`, moving a run's folder, asking gatekeeper for a gate and reading the checks are
activities too (only `next` and `apply` are local activities, which have a limit of their own). On one task queue a
full limit would hold a run's gate request or its `run.completed@v1` behind another run's turn of an hour.

## Decision

- **`FOREMAN_MAX_STAGES`**, a whole number of 1 or more, limits the stages with an agent that one foreman runs at the
  same time. Unset, there is no limit, as before.
- **A task queue of the stages.** `foreman serve` runs a second worker, on `<FOREMAN_TASK_QUEUE>-stages`, with only the
  stage activity and `maxConcurrentActivityTaskExecutions` of `FOREMAN_MAX_STAGES`. A run gets the queue in its input,
  and schedules each stage whose agent runs there; a stage that only waits (ADR 0107) and every other activity stay
  on the run's task queue. A run that started before has no queue in its input and runs its stages as it did then,
  so its history replays.
- **A wait is no failure.** The stage activity has no schedule-to-start timeout, and its start-to-close timeout,
  heartbeat timeout and attempts begin only when a worker takes it. So a stage waits for a place as long as it must,
  without a failed attempt (SCN-FORE-190).
- **A waiting stage shows that it waits.** The workflow cannot see when its activity starts, so `GET /v1/runs/<id>`
  asks Temporal: when the run's stage activity is scheduled and not started, the answer shows that stage `blocked`
  with `waitingSince`, the time it was due, and without `startedAt` and `spanId`; the run stays `running`, as no person
  needs to act (SCN-FORE-191). No contract changes: both states and the field exist.
- **Numbers that are numbers.** `FOREMAN_MAX_STAGES` and the foreman's other number settings, the `FOREMAN_*_MS`
  values, stop `foreman serve` at its start with exit code 2 when they are not a whole number of 1 or more:
  `FOREMAN_POLL_MS is "1s": set a whole number of 1 or more` (SCN-FORE-192). Before, `1s` became `NaN`.
- The Compose profile sets `FOREMAN_MAX_STAGES` to `${FOREMAN_MAX_STAGES:-2}`, the chart `foreman.maxStages: 2`
  (SCN-DIST-061, SCN-DIST-062).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A second worker on a task queue of the stages (chosen) | Temporal holds the waiting stages; no timeout or attempt counts the wait; the bookkeeping never waits | A second worker per foreman; the limit is per foreman, not per factory |
| `maxConcurrentActivityTaskExecutions` on the one worker | One option | Gate requests, checks and events wait behind the turns of other runs |
| A semaphore in the stage activity | No second queue | The activity has started: its heartbeat, timeouts and attempts run while it waits, and a stopped foreman's waiting stages fail an attempt |
| Temporal's resource-based tuner | Adapts to CPU and memory of the foreman's host | The sandboxes do not run on the foreman's host in Kubernetes, so its CPU and memory say nothing about them |
| A global limit across foremen (a task queue rate limit) | One number for a cluster | Temporal's rate limit of a task queue counts activities per second, not activities at once |

## Prior art

No new dependency. Temporal's TypeScript SDK 1.24 (MIT) documents `maxConcurrentActivityTaskExecutions` per worker and
a task queue per kind of resource as the way to limit a scarce resource ("task routing"); a worker that has no free
slot does not poll, so the task waits in the server. GitHub Actions' self-hosted runners and Buildkite agents limit
jobs the same way: a runner takes a job only when it has a place.

## Consequences

- A burst of work items starts at most `FOREMAN_MAX_STAGES` sandboxes per foreman; the others queue in Temporal and
  survive a restart of the foreman.
- The run list (`GET /v1/runs`) and the events still show a waiting run as `running` with its stage `running`: they
  read the view that the workflow keeps, and the workflow does not see the wait. A follow-up could let the stage
  activity tell its workflow when it began, so the view, the list and a console show the wait the same way.
- Two foremen on one task queue each take up to their own limit. The chart runs one foreman per release.
