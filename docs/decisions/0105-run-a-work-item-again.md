---
status: accepted
date: 2026-11-12
---

# 0105. A run that failed or was cancelled runs again as a new run

## Context

The foreman starts one run per work item, forever (ADR 0067). The run ID is `run_` and 20 hex digits of the SHA-256
of the work item's ID (`runIdOf`), it is the Temporal workflow ID, and `start` uses `REJECT_DUPLICATE`. intake gives
an issue the same work item each time (dedupe key, ADR 0065) and publishes `work.received@v1` only for a new work
item. So a run that failed or was cancelled can never run again; the only way is a new issue (`TODO.md` T-38).

Much is derived from the run ID or the work item's ID today:

- The workflow ID. A run that failed or was cancelled also ends its workflow normally: the workflow catches the
  failure or the cancel and returns its view. So Temporal sees every ended run as `COMPLETED`.
- `GET /v1/runs` lists the workflows of the task queue from Temporal's visibility, and reads a closed one's result.
  `GET /v1/runs/<id>` queries the workflow with that ID.
- The event IDs `<run ID>.started` and `<run ID>.completed`, which JetStream also uses to drop a second publish of
  the same message in its duplicate window (ADR 0085).
- `gate.decided@v1` names the work item and the gate, not the run. The foreman routes it to `runIdOf(workItemId)`.
- gatekeeper makes the gate ID from the request's work item, stage and change (`gateId` in
  `modules/gatekeeper/src/domain/request.ts`): "the same request twice asks only once" (`SCN-GATE-006`). The foreman's
  change is the factory, the policy and the approvers, so a second request of the same work item and stage gets the
  first gate back, with its decision.
- The run's folder `runs/<run ID>` in the foreman's data folder, which holds the clone between stages.
- The trace ID and the span IDs (`traceIdOf(runId)`, ADR 0087), and the inference gateway's key, made once per run
  ID with the factory's budget (ADR 0070).
- intake's `work_items.run_id` and status (`followRun`): `run.started@v1` moves a work item to `running` only while it
  is `received` (`SCN-INTAKE-033`), and every `run.completed@v1` of the work item moves it.

## Decision

**A second run is a new run with an ID of its own.** The run ID of the `n`-th run of a work item is
`runIdOf(workItemId, n)`: the first run keeps its ID, `run_` and 20 hex digits of the SHA-256 of the work item's ID;
run `n ≥ 2` takes the SHA-256 of `<work item ID>#<n>`. The ID still is the workflow ID, and `start` keeps
`REJECT_DUPLICATE`: each run ID starts at most one workflow, forever. Each derived thing follows the new ID:

| What | What happens |
| --- | --- |
| Workflow ID and reuse policy | A new workflow ID per run, still `REJECT_DUPLICATE`. That two runs of a work item never run at once comes from the rule below, and two requests at once start one workflow, since both name run `n + 1`. |
| `GET /v1/runs`, `GET /v1/runs/<id>` | Unchanged code. Each run is its own workflow, so the list shows both runs, and each ID shows its own run. |
| `run.started@v1`, `run.completed@v1` | The event IDs `<run ID>.started` and `<run ID>.completed` are new for the new run, so JetStream does not drop them. Both events gain the optional `retryOf`, the run before. |
| `gate.decided@v1` | The foreman routes a decision to the newest run of the work item: it looks up run 1, 2, … in Temporal until one is not found. The newest run ignores a decision for a gate it does not wait for, as today (`SCN-FORE-015`). |
| gatekeeper's "same request" | The foreman adds `run: <run ID>` to the gate request's `change`, so each run's request is a new request and is asked again; gatekeeper does not change. Within one run, the same request twice still asks once. |
| The run's folder | The new run moves the folder of the run before, `runs/<old ID>`, to `runs/<new ID>` before its first stage, so it keeps the clone and the work of a person who took a stage over. The old run's view still names the old folder; the old run has ended. |
| Trace ID, span IDs | A new trace per run, from the new ID. The run's span gets the attribute `osf.run.retry_of`. |
| Gateway key and budget | A new key per run ID, with the factory's full budget. |
| intake's work item | intake follows the newest run: an event whose `retryOf` is the work item's run moves the work item to that run, also from `failed` or `cancelled`. An event of another run changes nothing once the work item follows a run. |
| The console | The run page of a run that ended without success has the form "run again"; the run page of a run with `retryOf` links the run before. The work page shows intake's `run_id`, so it shows the newest run. |
| Other readers | ledger and taskcapture read their own `run_id` from run records and transcripts, not the run events; nothing else reads `run.started@v1` or `run.completed@v1` (grep across `modules/`). |

**The new run starts at the first stage that did not succeed.** It keeps the folder and the pull request of the run
before; the stages before it are copied from the run before, as they ended. This covers the three cases:

- A run that failed in `verify` because a check failed reads the checks again; a person who pushed a fix to the pull
  request sees the run go on. To let the agent fix it, the person starts from the stage before (`from`).
- A run a person cancelled starts the cancelled stage again with a fresh turn.
- A run whose gate was rejected asks gatekeeper again, as a new request.

**The new run tells its agent why the run before ended.** The prompt of the first stage the new run runs gets one
more line after the pull request link, made only from what the old run's view holds: `Run before: <old ID> failed in
the stage <stage>: <reason>` for a failed stage with a `reason`, the same without `: <reason>` when the stage has
none, `Run before: <old ID> was cancelled in the stage <stage>` for a cancelled one, and `Run before: <old ID>: the
gate before the stage <stage> was rejected` for a rejected gate. Only that stage gets the line: the stages after it
run on the work of the new run, and an old failure in their prompt would point them at a problem that the first
stage may have fixed. No new field holds the reason.

The person may name `from`: a stage at or before the first stage that did not succeed. A later stage is refused
with 400. The new run takes the factory as it is now. When its stages are not the stages of the run before, the run
starts at the first stage, and a `from` other than the first stage is refused with 409.

**Which runs run again.** Only the newest run of a work item, and only when it ended as `failed` or `cancelled`. A run
that is `running` or `blocked`, or `complete`, is refused with 409 and its state. A run that already has a later run
is refused with 409 that names the later run. Two requests at once both start run `n + 1`; Temporal starts one
workflow, and the other request gets 409 that names the new run.

**The API.** A route of its own: `POST /v1/runs/<run ID>/retry` with `RunRetry { by: Actor; from?: Name }`. It
answers 201 with the new run's view, 400 for a body that is not a retry or a `from` that does not fit, 401, 404 for
an unknown run and 409 as above. A signal does not fit: signals act on the run they name and answer its view with
202, and a signal to a run that ended is refused (`SCN-FORE-019`). `RunView` gains the optional `attempt` (1 when
absent), `retryOf` and `retriedBy`. `POST /v1/runs` with the work item again answers the newest run with 200, so a
second `work.received@v1` still starts nothing. All of these are additions to `foreman.tsp`, `foreman-api.tsp` and
`events.tsp`; the `runId` pattern stays.

**The label put on an issue again.** A person removes the label and adds it again; GitHub and Forgejo then send one
more `issues` delivery with the action `labeled`, which the forge adapter turns into `issue.labeled@v1` as before.
intake finds the work item by its dedupe key. When its status is `failed` or `cancelled`, intake puts the new event
`work.retry-requested@v1` in its outbox, with the work item, the run it follows and the requester as for the first
label, and the event ID `<run ID>.retry`. intake asks once per run: the label put on again for the same run adds
nothing to the outbox. For any other status it publishes nothing, as today. The foreman's durable
consumer reads the event and retries that run, as the route does. A second delivery of the same request names the
same run: JetStream drops it in its duplicate window, and later the foreman finds that the run has a later run, warns
and acknowledges it (ADR 0085). A second `work.received@v1` stays a duplicate.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A new run ID per run (chosen) | Every derived ID is new without a change of its own: events, trace, key, folder; each run keeps its view; the new run can name the run before | `gate.decided@v1` needs a lookup of the newest run; the folder must move |
| The same run ID with an attempt number, a new Temporal run of the same workflow ID | `gate.decided@v1` and intake's `run_id` stay as they are | The ended run's view is gone from `GET /v1/runs/<id>`; the list shows the ID twice; event IDs, span IDs and the gateway's cached key all need the attempt; JetStream would drop the new `<id>.started` in its window |
| Start the new run from the first stage | Simple; no copy of stages | Runs `plan` again and the agent may open a second pull request; a run whose last stage failed pays for every stage again |
| Start from the stage that did not succeed, without a choice | Smallest API | A check that failed fails again at once; the agent that could fix it never runs |
| `retry` as a signal on `POST /v1/runs/<id>/signals` | No new route | Answers the old run with 202; changes the rule that a signal to an ended run is refused |
| intake publishes `work.received@v1` again with a new event ID | No new event type | The foreman cannot tell it from a duplicate delivery of the first event, and would need intake's event IDs |
| intake calls the foreman's API | No new event | `intake serve` would depend on the foreman being up; events already carry intake's facts to the foreman (ADR 0071) |

## Prior art

No new dependency. What the Temporal TypeScript SDK 1.24.0 in `node_modules` offers:

- **Workflow ID reuse policies** (`ALLOW_DUPLICATE`, `ALLOW_DUPLICATE_FAILED_ONLY`, `REJECT_DUPLICATE`,
  `TERMINATE_IF_RUNNING`) and the conflict policy (`FAIL`, `USE_EXISTING`, `TERMINATE_EXISTING`). We keep
  `REJECT_DUPLICATE` with a new ID per run. `ALLOW_DUPLICATE_FAILED_ONLY` does not help: a failed run returns its
  view, so Temporal sees it as completed. `ALLOW_DUPLICATE` would hide the run before behind the same ID.
- **Reset** (`workflowService.resetWorkflowExecution`, no high-level API in the client): replays the history up to an
  event and goes on from there as a new Temporal run of the same workflow ID. It needs an event ID of the history,
  keeps the old run's signals and its gateway key, and shares the ID problems of the option above.
- **Continue-as-new**: a running workflow starts its next run itself. It does not apply: the run has ended when a
  person asks.
- **Retry policies** of activities and workflows: they retry a failure the code throws, without a person. A stage's
  activity already has 3 attempts (ADR 0101); a turn that ends with `refusal`, a failed check or a rejection is a
  result, not a failure to retry.

Other tools: GitHub Actions' "Re-run failed jobs" and Argo Workflows' `argo retry` both run again from the failed
step and keep the earlier steps; Argo's `retry` also takes a choice of nodes to run again, as `from` does here.

## Consequences

- A person runs a failed or cancelled work item again from the API, the console or the issue's label; the new run
  names the run before, and intake's work item follows it.
- Each run is its own workflow, view, trace and key: the ledger counts each run's spending, and `GET /v1/runs` shows
  both.
- There is no limit on the number of runs of a work item. Each run is a person's request; the factory never retries
  on its own, so no loop arises without a person or a bot that puts the label on again. Each run has the factory's
  budget. Revisit with a limit when a team sees such a loop.
- A run that succeeded is not run again: its pull request exists. A change after it is a new work item.
- The folder moves on the foreman's machine; a foreman whose data folder is not shared between its workers has this
  limit already for the stages of one run.
- No implemented scenario changes.
