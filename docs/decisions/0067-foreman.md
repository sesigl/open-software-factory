---
status: accepted
date: 2026-10-26
---

# 0067. foreman: runs of the factory's workflow on Temporal, with gates, steering and cancel

## Context

TODO item T-17 asks for the foreman: run any declared multi-agent pipeline with retries, pauses and human gates,
without writing workflow code. Its public surface is an HTTP API (runs, state, signals), the events `run.started` and
`run.completed`, and Temporal's UI for the history. ADR 0004 chose Temporal with stage logic in plain functions.

Much of what it needs exists:

- The factory definition (`contracts/factory-definition/`) declares agents and `workflow`: stages in order, each with
  an agent and an optional `gate`.
- The harness port (ADR 0050) runs any coding agent behind one protocol, ACP on stdio. `harness-acp` with the
  testkit's scripted agent is the deterministic harness (ADR 0052).
- gatekeeper serves `POST /v1/gates` and publishes `gate.decided@v1` (ADR 0048). intake publishes
  `work.received@v1` (ADR 0063). `run.completed@v1` is in the contracts; `run.started@v1` is not.
- The testkit starts Temporal's dev server and NATS in containers (ADR 0016). This environment and many laptops have
  no Docker, and each container start costs about 5 seconds per scenario and per mutant (ADR 0049, ADR 0061).

The item is too large for one pull request. This decision covers the first slice: runs of the workflow's stages
through the harness port, gates, steering, cancel, recovery, and the run events. The sandbox port, a failing CI check
before the ship stage, the inference gateway per run, taking over a run, and the evidence tool of intake's MCP server
come in later slices; `TODO.md` lists them.

## Decision

- **A new core module `modules/foreman/`** (prefix `SCN-FORE`), released to npm as `@opensoftware/foreman`, with the
  command `foreman serve`. It serves the run API on `PORT` and runs a Temporal worker on the task queue
  `FOREMAN_TASK_QUEUE` (default `foreman`) of the Temporal server at `FOREMAN_TEMPORAL_ADDRESS` (default
  `localhost:7233`), namespace `FOREMAN_TEMPORAL_NAMESPACE` (default `default`). It needs `FOREMAN_API_TOKEN`; without
  it, it exits 2 and names it. Every call to `/v1/` needs `Authorization: Bearer <FOREMAN_API_TOKEN>`, else 401.
- **The factory.** `foreman serve` reads `factory.yaml` from `FOREMAN_FACTORY` (default `factory.yaml`) when it
  starts, checks it against the `factory-definition` contract, and checks that every stage names a declared agent.
  A wrong file exits 2 with the file, the path in it and the problem. A run reads the file again when it starts and
  keeps that definition, with its agents' prompts, in the workflow's input. A new commit changes only later runs. The
  factory version is the commit of the folder that holds `factory.yaml` (`git rev-parse HEAD`), as `CommitHash` in
  `contracts/` says.
- **Runs.** `POST /v1/runs` takes a work item (the contract `work-item`). The run's ID is `run_` and the first 20 hex
  digits of the SHA-256 of the work item's ID, and the Temporal workflow ID is the run's ID. The same work item again
  answers 200 with the run it started; a new run answers 201. `GET /v1/runs/{runId}` answers the run's view from a
  Temporal query: `runId`, `workItem`, `factory`, `factoryVersion`, `state`, `startedAt`, `endedAt` and `stages`, each
  with `stage`, `agent`, `state`, `sessionId` and `gateId`. A run's state is one of `running`, `blocked`, `complete`,
  `failed` and `cancelled` (vision scenario ORCH-008); a stage's is one of `pending`, `blocked`, `running`,
  `succeeded`, `failed`, `rejected` and `cancelled`. The models `RunView`, `StageView` and `RunSignal` and the three
  operations are added to `contracts/` (`typespec/foreman.tsp`, `typespec/foreman-api.tsp`).
- **Stages.** Each stage is one Temporal activity. It starts the harness adapter of the stage's agent as a program,
  speaks ACP to it as its client, opens a session in the run's working folder (`OSF_DATA/runs/<run ID>`), sends one
  prompt: the agent's prompt file, then the work item's title and description, and waits for the end of the turn. It
  allows every tool call the adapter asks about: the adapter's `--allow` list is where a factory limits tools until
  the sandbox slice. `end_turn` is `succeeded`, `cancelled` is `cancelled`, every other stop reason and a harness that
  exits is `failed`. The first stage that does not succeed ends the run, and the later stages stay `pending`.
  - The adapter's command line comes from `FOREMAN_HARNESSES`, a JSON object from harness name to command line. A
    harness it does not name runs `npx -y @opensoftware/harness-<name> run`. The adapter gets
    `OTEL_RESOURCE_ATTRIBUTES` with `osf.run.id`, `osf.work_item.id`, `osf.stage` and `osf.factory.version`, so the
    run record it exports carries the run (internals: "Correlate at launch").
  - The activity heartbeats. Temporal retries it up to 3 times when the worker dies during a stage, so a stage can
    run again after a crash; its agent then finds the working folder as the crash left it.
- **Gates.** A stage with a `gate` posts a request to gatekeeper at `FOREMAN_GATEKEEPER_URL` with
  `FOREMAN_GATEKEEPER_TOKEN` before it starts: `workItem` is the work item's ID, `stage` the stage, `summary`
  `<title>: start the stage <stage>`, `links` the origin's link, and `change` holds `factory`, `policy` and
  `approvers` from the definition. The run is `blocked` until a `gate.decided@v1` for that gate arrives on NATS
  (`FOREMAN_NATS_URL`). The server signals the workflow of the event's work item; a decision for another gate
  changes nothing. `approved` starts the stage; `rejected` and `expired` mark it `rejected` and fail the run.
  gatekeeper decides with the policy it serves; the definition's `policy` reaches it as a fact in `change`.
- **Signals.** `POST /v1/runs/{runId}/signals` takes `{ "type": "steer", "message": "..." }` or `{ "type": "cancel" }`
  and answers 202. A steering message is a Temporal signal; the running stage's activity asks the workflow for new
  messages every `FOREMAN_POLL_MS` (default 1000) and sends each as a prompt to its session, which the harness port
  defines as steering. A cancel cancels the workflow: the running activity sends `session/cancel`, a waiting gate
  stops waiting, and the run and its current stage end `cancelled`. A signal to a run that ended answers 409.
- **Events.** With `FOREMAN_NATS_URL`, the server subscribes to `osf.work.received.v1` and starts a run for each work
  item, as `POST /v1/runs` would, and to `osf.gate.decided.v1`. A run publishes `run.started@v1` (new in
  `contracts/events/run-started/`: `runId`, `workItemId`, `factory`, `factoryVersion`, `stages`, `startedAt`,
  `requester` and `source`) when it starts and `run.completed@v1` when it ends, on `osf.run.started.v1` and
  `osf.run.completed.v1`, from activities, so Temporal retries them until NATS takes them. The event IDs are the run's
  ID with `.started` and `.completed`, so a consumer drops a copy.
- **Durability.** The workflow keeps no state outside Temporal's history. A foreman that stops and starts again picks
  its runs up from the history; a run waiting at a gate waits on.
- **Determinism and time.** The workflow code calls activities for everything that reads files, clocks or the
  network. Times in the view and events come from activities, which read `OSF_NOW` when it is set.
- **Layers** (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `workflows` → `adapters` → `domain`. `domain` checks a
  definition, derives IDs, builds the view and the events, and maps stop reasons, without I/O. `adapters` read the
  factory and Git, run the harness over ACP, call gatekeeper and NATS. `workflows` holds the Temporal workflow and the
  activities. `commands` join them: `serve` runs Fastify and the worker. The workflow file imports only `domain` and
  the Temporal workflow API, because it runs in Temporal's sandbox.
- **The workflow bundle.** `pnpm build` bundles the workflow code once with the SDK's `bundleWorkflowCode` into
  `dist/workflows.bundle.js`; the worker loads it instead of bundling at each start, which takes seconds.
- **Temporal and NATS in tests run as binaries on the host.** `fakes.temporal()` starts `temporal server start-dev`
  (Temporal CLI 1.4.1, in-memory SQLite) and `fakes.nats()` starts `nats-server -js` (2.11.9), each as a process on
  127.0.0.1 with free ports and a temporary folder, stopped at the end of the scenario. `make install` downloads both,
  checked against their SHA-256, into `.tools/bin` like lychee, oasdiff and opa (ADR 0011); elsewhere they must be on
  PATH. They are the same versions as the container images before, so the module cannot tell the difference
  (ADR 0049, principle 2). CI no longer pulls their images.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Temporal TypeScript SDK (ADR 0004) | Long waits, signals, queries, retries and a history UI built in | A server to run; workflow code must be deterministic |
| DBOS Transact | A library on PostgreSQL, no extra service | ADR 0004 chose Temporal; PGlite in tests serves one connection at a time (ADR 0049) |
| A queue and a state table of our own | No new dependency | Retries, timers, signals and recovery rebuilt by hand |
| One process for API and worker | One command for the quick start; one process per scenario in tests | Scale API and workers together; a later slice can split them with `foreman worker` |
| Run ID from the work item's ID | Deterministic; a duplicate `work.received@v1` starts nothing | One run per work item until a later slice adds reruns |
| Steering through an activity that the signal schedules | No polling | The activity can land on another worker than the running stage |
| Steering by query polling from the stage's activity | Works with any number of workers | One query every `FOREMAN_POLL_MS` while a stage runs |
| Temporal and NATS in containers (ADR 0016) | Already there | Docker; about 5 s per start, paid again per mutant |
| `@temporalio/testing`'s `TestWorkflowEnvironment` | Ships with the SDK | Downloads the CLI at test time, unpinned; the module must run its worker against it |
| Temporal CLI and nats-server pinned in `.tools/bin` | The real servers, about 1 s per start, no Docker | Two more downloads in `make install`; Linux x86_64 only, elsewhere on PATH |

## Prior art

- Temporal (server and TypeScript SDK `@temporalio/*` 1.24, MIT, Temporal Technologies, very active): adopted, as
  ADR 0004 decided. The Temporal CLI 1.4.1 (MIT) runs the dev server in tests.
- OpenHands (MIT, very active): an agent platform with its own controller. Checked, not adopted as the core, as T-17
  says; it can join later as one more harness.
- Argo Workflows and Tekton (Apache-2.0, active): pipelines on Kubernetes. Checked, not adopted: no human gates or
  steering of a running step, and the factory runs on a laptop too.
- n8n (Sustainable Use License) and LangGraph (MIT, active): checked in ADR 0004 and ADR 0063; not a delivery process
  with people and CI.
- `@agentclientprotocol/sdk` (Apache-2.0, 1.9, active), Fastify (MIT, ADR 0048), `@nats-io/transport-node`
  (Apache-2.0, ADR 0047) and `yaml` (ISC, ADR 0020): already used; adopted here at the same versions.
- nats-server 2.11.9 (Apache-2.0, Synadia and the NATS project, very active): the same server as the container image
  of ADR 0016, now as a binary.

## Consequences

- A factory's `workflow` runs today: a work item from intake or a program goes through its stages with gates,
  steering and cancel, and its history is in Temporal's UI.
- Scenarios that use NATS or Temporal need no Docker, and each starts about 4 seconds sooner. intake's and
  gatekeeper's NATS scenarios gain the same.
- A run is one per work item, and a stage runs on the host in the run's folder. The sandbox slice moves stages into
  sandboxes through the sandbox port; until then a factory runs only agents it trusts on the foreman's machine.
- foreman subscribes to core NATS subjects. A `work.received@v1` published while no foreman runs is lost; intake's
  API still has the work item. Revisit with JetStream when a foreman runs as a service.
- Workflow code runs in Temporal's sandbox inside a worker thread. Keep it to the order of stages and the waits; put
  logic in `domain`, which activities and the workflow share.
