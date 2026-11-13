---
status: accepted
date: 2026-11-13
---

# 0106. A stage waits for its checks and its gate only up to a limit

## Context

A stage reads pending checks every `FOREMAN_CHECK_POLL_MS` (ADR 0069) and waits for a gate decision until one comes
(ADR 0062). Neither wait has a limit. A check with a wrong name never appears, and a gate whose policy has no
`expire_after` never ends, so the run stays `blocked` forever. The run's view does not say since when it waits
(`TODO.md` T-39).

## Decision

- Two settings of the foreman, in milliseconds like its other durations:
  - `FOREMAN_CHECK_TIMEOUT_MS`, default `7200000` (2 hours). A CI run of this repository takes minutes, a slow one
    under an hour. A check that did not end in 2 hours does not come.
  - `FOREMAN_GATE_TIMEOUT_MS`, default `604800000` (7 days). A person approves a gate within working days; a week
    covers a weekend and a day away. A policy's own `expire_after` that is shorter still ends the gate first.
- A stage whose checks are not all `success` after the limit fails. Its reason names each check that did not end:
  `verify is pending`, or `proof is missing on the pull request's head commit` for a check the forge does not list at
  all. The check's state in the view stays `pending`, so `CheckView` does not change.
- A gate without a decision after the limit ends the stage as a gatekeeper expiry does: the stage is `rejected`, the run
  `failed`, with the reason `the gate <id> expired: no decision after <n> ms`. The foreman cannot change gatekeeper's
  record, so the gate stays `pending` there. A `gate.decided@v1` that comes later changes nothing: the run has ended,
  and an ended run takes no step.
- `StageView` gets `waitingSince`: when the stage became `blocked`, while it is. A stage that waits first for its checks
  and then for its gate gets a new `waitingSince` for the gate. It is an optional field of a response, an addition.
- No per-stage limit in the factory definition yet. It would be an addition, but it needs a field, its schema, the
  checker and a scenario per wait, and no factory needs a limit other than the foreman's so far. A later item adds
  it when one does.
- The limits are timers of the workflow. The workflow notes Temporal's workflow time when a wait starts; Temporal's
  `Date.now()`, `sleep` and `condition` with a timeout are deterministic and replay the same after a restart. The
  checks wait sleeps at most until its limit and then reads the checks one last time; the gate wait is `condition`
  with the time left as its timeout. The domain builds each reason.
- The system tests set `FOREMAN_CHECK_TIMEOUT_MS` and `FOREMAN_GATE_TIMEOUT_MS` to `1000`, as they set
  `FOREMAN_CHECK_POLL_MS` to `100`. The workflow's timers run on Temporal's dev server; `OSF_NOW` fixes only the times
  in the view.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Settings of the foreman, one per wait (chosen) | Small; every factory gets a limit at once | One limit for all stages |
| A limit per stage in `factory.yaml` now | Fits a slow check | More code and schema for a need nobody has yet |
| Count polls instead of time | No timer | The limit changes with the poll interval |
| A new stage state `expired` | Plain to read | An enum value in a response is a change for every client; `rejected` already means a gate ended without approval |

## Prior art

No new module, dependency or service. Temporal's own workflow timers (`sleep`, `condition` with a timeout) are the
documented way to end a wait in a workflow; GitHub Actions ends a job after `timeout-minutes` in the same way.

## Consequences

A run no longer blocks forever, and its reason says which check or gate it waited for. A factory with a slow check
needs the setting raised for the whole foreman until a per-stage limit exists. A gate that the foreman ended stays
`pending` in gatekeeper; its approvers may still decide it, and the decision only ends up in gatekeeper's record.
