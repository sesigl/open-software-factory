---
status: accepted
date: 2026-11-14
---

# 0127. A run blocked at its checks, and the reason of a failure

## Context

T-45, after ADR 0113: intake tells a Slack thread or an issue when its run waits at a gate (`gate.requested@v1`) and
when it ended. A run whose stage waits for the checks of its pull request told nothing, since no event says so, and a
failed run's message named only the stage it ended at. The foreman reads pending checks again every
`FOREMAN_CHECK_POLL_MS`, so a wait is many reads; JetStream delivers an event at least once.

## Decision

- A new event `run.blocked@v1` on `osf.run.blocked.v1`, published by the foreman: `runId`, `workItemId`, `stage`,
  `waitsFor` (`checks`, the one value for now), the `pullRequest` and the names of the `checks`, the `requester` and
  `source`. Its ID is `<run ID>.blocked.<stage>`.
- The foreman publishes it from the activity that reads the checks, when that read makes the stage wait and the stage
  did not wait before. The workflow schedules no new activity, so the runs in flight replay as before. A retried
  activity publishes the same ID again, which consumers drop.
- `run.completed@v1` gets an optional `reason`: the reason of the stage the run ended at, as `/v1/runs/<id>` shows
  it.
- intake's durable consumer also reads `osf.run.blocked.v1` and tells each origin of the work item once, deduped by
  `intake.told` as in ADR 0113: `The run waits for the checks of <pull request> at the stage <stage>: <run>`. Its
  failure message adds `(<reason>)` after the stage.
- Both contract changes are additive: a new event type and an optional field.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `run.blocked@v1` with `waitsFor` (chosen) | One event for every wait of a stage; a gate or a take-over can be added as a value | A second event for a gate next to `gate.requested@v1` if it is ever added |
| `stage.waiting@v1` | Names the stage | The run is what blocks; the console and `RunView` call the state `blocked` |
| Publish from the workflow | The transition is in one place | A new activity changes the history of runs in flight; Temporal's replay fails without a patch |
| intake reads the foreman's API for blocked runs | No contract change | Polling; intake would know the foreman's API |

## Prior art

No new module, dependency or service. As in ADR 0113, bots that follow CI, such as Renovate, post once per change of
state with a link to the run; CloudEvents gives the dedupe by source and ID.

## Consequences

- A gate still tells through `gate.requested@v1`; `run.blocked@v1` never says `gate` until a consumer needs it.
- A run that failed with an error outside a stage, not a stage's reason, has no `reason` yet.
- A run that waits for its checks again in a later stage publishes one event per stage.
