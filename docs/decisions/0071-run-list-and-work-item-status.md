---
status: accepted
date: 2026-10-26
---

# 0071. foreman lists runs by state; intake follows runs and fetches their evidence

## Context

TODO item T-17 lists two slices after the inference gateway (ADR 0070):

- Runs listed and filtered by state (vision scenario ORCH-008: "every run is in exactly one of the states ... and a
  person can filter runs by state"), and intake's work item status follows its run.
- The evidence tool of the Factory MCP server, moved from T-16 because only the foreman records runs (ADR 0063).

What exists:

- `GET /v1/runs/{runId}` answers one run's view from a Temporal query (ADR 0067). There is no list.
- A run publishes `run.started@v1` and `run.completed@v1` on core NATS (ADR 0067). Both carry `runId` and
  `workItemId`; `run.completed@v1` carries the `outcome`: `succeeded`, `failed` or `cancelled`.
- intake's work item view has `status`, always `received` until now (ADR 0063: "the foreman's run events will move it
  on in T-17"). intake publishes through an outbox, but subscribes to nothing.
- `intake mcp` is a client of intake's API and keeps no state. Its tools are `submit_work` and `work_status`.

## Decision

### foreman: the run list

- **`GET /v1/runs`** answers `{ "runs": [RunView, ...] }`: every run of the server's task queue, newest first by
  `startedAt`, then by `runId`. `?state=` with one of `running`, `blocked`, `complete`, `failed` and `cancelled`
  keeps the runs in that state. Another value answers 400 with a problem that names `state`.
- **From Temporal's visibility.** The server lists the workflows of the type `factoryRun` on its task queue with
  Temporal's list API. A workflow that closed returns its last view as its result, so the server reads that result;
  for a running workflow it asks the `view` query, as `GET /v1/runs/{runId}` does. The filter is applied to the
  views, so the state is the run's own, not Temporal's execution status.
- The model `RunList` and the operation `listRuns` are added to `contracts/` (`typespec/foreman.tsp`,
  `typespec/foreman-api.tsp`). A new path and model is not breaking: contracts get a minor version.

### intake: a work item follows its run

- **With `INTAKE_NATS_URL`, `intake serve` subscribes** to `osf.run.started.v1` and `osf.run.completed.v1`. It
  keeps one connection open for this, and connects again when NATS is away, so a server whose NATS is down still
  serves its API and its outbox waits as before.
- **`run.started@v1`** sets the work item's `runId` and moves a `received` work item to `running`.
- **`run.completed@v1`** sets the `runId` and the status from the outcome: `succeeded` is `complete`, `failed` is
  `failed`, `cancelled` is `cancelled`. A `run.started@v1` that arrives after it changes nothing, so the order of the
  two events does not matter. An event for a work item the server does not know changes nothing.
- **The view** shows `status`, now one of `received`, `running`, `complete`, `failed` and `cancelled`, and `runId`
  once a run started. The store keeps both in two new columns of `intake.work_items`, added with
  `ADD COLUMN IF NOT EXISTS`, so an existing database keeps its work items.
- The contract's `WorkItemStatus` gets the four new values and `WorkItemView` the optional `runId`. Both are
  additions: contracts get a minor version.

### intake mcp: the evidence tool

- **`run_evidence`** takes a work item's `id`. It reads the work item from intake's API, then the run's view from the
  foreman's API at `INTAKE_FOREMAN_URL` with `INTAKE_FOREMAN_TOKEN`, and answers that view as JSON text: the run's
  state, factory version, pull request, and each stage with its agent, state, harness session, gate, checks and
  reason. That is what the foreman records of a run today; proof's evidence bundles (T-05) can join it when the
  foreman attaches them.
- A work item without `runId` is a tool error: `work item <id> has no run yet`. Without `INTAKE_FOREMAN_URL` the tool is
  an error that says `set INTAKE_FOREMAN_URL`; `submit_work` and `work_status` work without it. An answer of the
  foreman other than 200 is a tool error with its problem's detail, as for intake's API.
- intake calls the foreman only over its HTTP API in `contracts/`; it imports no foreman code.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| List from Temporal's visibility, views from results and queries | No store of its own; the view is the run's own state | One call per run in the list; slow with many thousands of runs |
| A search attribute `OsfRunState` upserted by the workflow | Temporal filters on its server | Must be registered in every namespace; visibility lags behind the run, so a filter can show a run in an old state |
| A run table of the foreman's own, fed by the workflow | Fast filters | A second store beside Temporal's history to keep in step (ADR 0067 keeps none) |
| intake follows runs through NATS events | Uses the events that exist; no call from foreman to intake | Core NATS: an event published while intake is down is lost |
| foreman calls intake's API when a run changes | Delivery the foreman can retry | foreman would need intake's URL and token; a run of a work item from a program has no intake |
| The evidence tool calls the foreman directly | The foreman's record as it is now, with no copy in intake | `intake mcp` needs the foreman's URL and token |
| intake copies the run's view from the events | No second URL | The events carry no stages; the copy would lag behind |
| The tool derives the run ID from the work item's ID | No `runId` in intake | Ties intake to the foreman's private ID rule (ADR 0067) |

## Prior art

- Temporal's list API and SQL visibility (MIT, very active): adopted through `@temporalio/client` 1.24, already a
  dependency of the foreman (ADR 0067).
- GitHub Actions' and Argo Workflows' run lists (Argo: Apache-2.0, active): both filter runs by a fixed set of states;
  checked for the shape of the API, nothing to adopt as a library.
- `@nats-io/transport-node` (Apache-2.0, ADR 0047) and the MCP TypeScript SDK (MIT, ADR 0063): already used by intake;
  adopted here at the same versions. No new dependency.

## Consequences

- A person or a tool lists the factory's runs and filters them by state; the console (T-18) can build on it.
- A Slack-only team reads a work item's progress in intake, and a local agent fetches its run's evidence through the
  Factory MCP server.
- The list makes one call per run. Revisit with a search attribute or a run table when a factory has thousands of
  runs, or when Temporal's visibility is fast enough to filter on.
- intake's subscription uses core NATS, like the foreman's (ADR 0067). Revisit both with JetStream consumers when they
  run as services.
- intake's status is coarse: `blocked` is only in the foreman's view, because no event says when a run waits.
