---
covers: [modules/foreman/src/**, modules/foreman/scripts/**]
---

# foreman

Run the factory's workflow for each work item: the stages of `factory.yaml` one after the other, each with its agent
through the harness port, with human gates, steering and cancel, on Temporal. A run survives a restart of the
foreman, and Temporal's UI shows its history. Decision: [ADR 0067](../../docs/decisions/0067-foreman.md), on
[ADR 0004](../../docs/decisions/0004-temporal.md).

## Quick start

This quick start is scenario `SCN-FORE-001` and is tested on every change. You need the
[Temporal CLI](https://docs.temporal.io/cli) for a local Temporal server and Git. Save a factory of two stages:

```yaml factory.yaml
version: 1
factory: hello
providers:
  harness:
    acp: "^0"
agents:
  plan:
    harness: acp
    model: routes/default
    prompt: ./agents/plan.md
  implement:
    harness: acp
    model: routes/default
    prompt: ./agents/implement.md
workflow:
  - stage: plan
  - stage: implement
```

```markdown agents/plan.md
Write a plan for the work item into plan.md.
```

```markdown agents/implement.md
Implement plan.md.
```

Commit it, start Temporal, and serve the foreman with Claude Code behind the `acp` harness adapter:

```sh
git init -q && git add -A && git commit -qm "the hello factory"
temporal server start-dev --headless &
export FOREMAN_API_TOKEN=dev-token
export FOREMAN_HARNESSES='{"acp": "npx -y @opensoftware/harness-acp run --allow read,edit -- npx -y @agentclientprotocol/claude-agent-acp"}'
npx @opensoftware/foreman serve
```

Save a work item, as intake publishes it:

```json work.json
{
  "id": "wi_5d1c1f0a9e7b3c2d4e6f",
  "type": "idea",
  "title": "Export reports as CSV",
  "requester": { "kind": "person", "id": "slack:U0PERSON", "displayName": "Varun" },
  "origin": { "source": "api" },
  "dedupeKey": "idea:export-csv"
}
```

Start a run and read it:

```sh
curl -H "Authorization: Bearer dev-token" -H "content-type: application/json" \
  --data @work.json http://localhost:8080/v1/runs
curl -H "Authorization: Bearer dev-token" http://localhost:8080/v1/runs/run_…
```

The first call answers 201 with the run `run_…` in the state `running`. Once both agents ended their turns, the run is
`complete` and both stages are `succeeded`. Temporal's UI at http://localhost:8233 shows the workflow `run_…`.

## Commands

| Command | What it does |
| --- | --- |
| `foreman serve` | Serve the run API on `PORT` and run the workflow of `FOREMAN_FACTORY` on the Temporal server at `FOREMAN_TEMPORAL_ADDRESS`; with `FOREMAN_NATS_URL`, start a run for each `work.received@v1`. |

## API

| Route | What it does |
| --- | --- |
| `POST /v1/runs` | Start the run of a work item (the [work item](../../contracts/work-item/work-item.schema.json) format). 201 with the new run, 200 with the run the same work item started before, 400 with a problem that names the field. |
| `GET /v1/runs/{runId}` | The run: `state`, `factory`, `factoryVersion`, `startedAt`, `endedAt` and its `stages`. 404 for a run the server does not know. |
| `POST /v1/runs/{runId}/signals` | `{ "type": "steer", "message": "…" }` sends the message to the running stage's agent; `{ "type": "cancel" }` cancels the run. 202 with the run, 409 when the run ended. |

The OpenAPI of the routes is in [`contracts/openapi/openapi.json`](../../contracts/openapi/openapi.json); the
TypeScript type `paths` of `@opensoftware/contracts` types a client. Every route needs `Authorization: Bearer
<FOREMAN_API_TOKEN>`, else 401. Errors are `application/problem+json` with `title`, `status` and `detail`.

A run's ID is `run_` and 20 hex digits of the SHA-256 of the work item's ID, so a work item has one run. A run is
`running`, `blocked` (at a gate), `complete`, `failed` or `cancelled`. A stage is `pending`, `blocked`, `running`,
`succeeded`, `failed`, `rejected` (by its gate) or `cancelled`; it has its harness `sessionId` once it started and its
`gateId` once its gate was asked.

## How a run goes

- **The factory.** `foreman serve` checks `FOREMAN_FACTORY` against the
  [factory definition](../../contracts/factory-definition/factory-definition.schema.json) when it starts, and that each
  stage's agent is declared; a wrong file exits 2 with the path in the file. Each run reads the file again when it
  starts and keeps that version until it ends. Its `factoryVersion` is the commit of the repository that holds the
  file.
- **Stages.** The stages run in the order of `workflow`, each in the run's folder `OSF_DATA/runs/<run ID>`. The foreman
  starts the stage's harness adapter from `FOREMAN_HARNESSES`, speaks ACP to it, opens a session and sends one prompt:
  the agent's prompt file, then the work item's ID, title and description. It allows the tool calls the adapter asks
  about; limit them with the adapter's `--allow`. A turn that ends with `end_turn` succeeds the stage; any other end
  fails or cancels it, ends the run, and leaves the later stages `pending`. The adapter gets
  `OTEL_RESOURCE_ATTRIBUTES` with `osf.run.id`, `osf.work_item.id`, `osf.stage` and `osf.factory.version`.
- **Gates.** Before a stage with a `gate` starts, the foreman asks gatekeeper at `FOREMAN_GATEKEEPER_URL`
  ([gatekeeper](../gatekeeper/README.md#server)): the work item's ID, the stage, the summary `<title>: start the
  stage <stage>`, the origin's link, and the gate's `policy` and `approvers` in `change`. The run is `blocked` until a
  `gate.decided@v1` for that gate arrives on NATS. `approved` starts the stage; `rejected` or `expired` fails the run.
- **Signals.** A steering message reaches the running stage's agent within `FOREMAN_POLL_MS` as a prompt in its
  session, which the harness port treats as steering. A cancel ends the agent's turn, or the wait at a gate, and the
  run is `cancelled`.
- **Restarts.** The runs live in Temporal's history. A foreman that stops and starts again goes on with them; a stage
  that ran when it stopped runs again, up to 3 times.

## Events

With `FOREMAN_NATS_URL`, the foreman starts a run for each [`work.received@v1`](../../contracts/events/work-received/work-received.schema.json)
on `osf.work.received.v1`, and hands each [`gate.decided@v1`](../../contracts/events/gate-decided/gate-decided.schema.json)
on `osf.gate.decided.v1` to the run of its work item. A run publishes
[`run.started@v1`](../../contracts/events/run-started/run-started.schema.json) on `osf.run.started.v1` when it starts and
[`run.completed@v1`](../../contracts/events/run-completed/run-completed.schema.json) on `osf.run.completed.v1` when it
ends, with the outcome `succeeded`, `failed` or `cancelled`. Their IDs are the run's ID with `.started` and
`.completed`. The subjects are core NATS: work published while no foreman listens is not started.

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/foreman/`. Merging it creates
the tag `foreman-v<version>`. The workflow `.github/workflows/publish-foreman.yml` then builds the package and
publishes it to npm as `@opensoftware/foreman`. The first release is `0.1.0`; until `1.0.0`, a breaking change raises
the minor version. The one-time setup is the same as for contracts
([`contracts/README.md`](../../contracts/README.md#releases)).

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `PORT` | string | `"8080"` | serve: the port the HTTP server listens on. |
| `OSF_DATA` | string | `".foreman"` | serve: the folder of the runs' working folders, runs/<run ID>, and of the harness adapters' session records. |
| `OSF_NOW` | string |  | The current time, like 2026-01-01T00:00:00Z, for the times of runs and stages. Default: the clock. |
| `FOREMAN_API_TOKEN` | string |  | serve: the token that callers of /v1 send as Authorization: Bearer <token>. Required. |
| `FOREMAN_FACTORY` | string | `"factory.yaml"` | serve: the factory definition. Its folder must be in a Git repository: a run's factory version is its commit. |
| `FOREMAN_TEMPORAL_ADDRESS` | string | `"localhost:7233"` | serve: the gRPC address of the Temporal server. |
| `FOREMAN_TEMPORAL_NAMESPACE` | string | `"default"` | serve: the Temporal namespace of the runs. |
| `FOREMAN_TASK_QUEUE` | string | `"foreman"` | serve: the Temporal task queue of the runs' workflows and activities. |
| `FOREMAN_HARNESSES` | string | `"{}"` | serve: a JSON object from harness name to the command line of its adapter. A harness it does not name runs npx -y @opensoftware/harness-<name> run. |
| `FOREMAN_POLL_MS` | string | `"1000"` | serve: how often a running stage looks for steering messages and a cancel, in milliseconds. |
| `FOREMAN_GATEKEEPER_URL` | string |  | serve: the URL of gatekeeper serve, which a stage with a gate asks for a decision. Required for a factory with gates. |
| `FOREMAN_GATEKEEPER_TOKEN` | string |  | serve: gatekeeper's API token, GATEKEEPER_API_TOKEN. |
| `FOREMAN_NATS_URL` | string |  | serve: the NATS server for work.received@v1 and gate.decided@v1 in, and run.started@v1 and run.completed@v1 out. Unset: no events. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-FORE-001 | implemented | A program starts a run of the README's factory and it completes |
| SCN-FORE-002 | planned | Each stage's agent gets its prompt and the work item |
| SCN-FORE-003 | planned | The same work item again is the same run |
| SCN-FORE-004 | planned | A stage whose turn ends with "refusal" fails the run |
| SCN-FORE-005 | planned | A run the server does not know is 404 |
| SCN-FORE-006 | planned | A call without the API token is refused |
| SCN-FORE-007 | planned | A work item without a title is refused |
| SCN-FORE-008 | planned | A run carries the commit of the factory definition |
| SCN-FORE-009 | planned | A run keeps its factory version when the factory changes during the run |
| SCN-FORE-010 | planned | A stage that names an unknown agent stops the server at the start |
| SCN-FORE-011 | planned | The server needs an API token |
| SCN-FORE-012 | planned | A stage with a gate asks gatekeeper and the run waits |
| SCN-FORE-013 | planned | An approval of the gate starts the stage |
| SCN-FORE-014 | planned | A rejection of the gate fails the run |
| SCN-FORE-015 | planned | A decision for another gate leaves the run waiting |
| SCN-FORE-016 | planned | A steering message reaches the running stage's agent |
| SCN-FORE-017 | planned | A cancel ends the running stage's turn and the run |
| SCN-FORE-018 | planned | A cancel ends a run that waits at a gate |
| SCN-FORE-019 | planned | A signal to a run that ended is refused |
| SCN-FORE-020 | planned | An unknown signal is refused |
| SCN-FORE-021 | planned | A run goes on from its history after the foreman restarts |
| SCN-FORE-022 | planned | A work item from intake starts a run |
| SCN-FORE-023 | planned | A run that ends publishes its outcome and its factory version |
