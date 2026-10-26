---
covers: [modules/foreman/src/**, modules/foreman/scripts/**]
---

# foreman

Run the factory's workflow for each work item: the stages of `factory.yaml` one after the other, each with its agent
through the harness port, with human gates, steering and cancel, on Temporal. A run survives a restart of the
foreman, and Temporal's UI shows its history. Decisions: [ADR 0067](../../docs/decisions/0067-foreman.md), on
[ADR 0004](../../docs/decisions/0004-temporal.md), [ADR 0068](../../docs/decisions/0068-foreman-sandboxes.md) for
sandboxes, [ADR 0069](../../docs/decisions/0069-foreman-checks.md) for checks, and
[ADR 0070](../../docs/decisions/0070-foreman-gateway-and-take-over.md) for the inference gateway and take over.

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

## Sandboxes

The quick start runs both agents on your machine. Run an agent you do not trust with that machine in a sandbox: give
it `sandbox` in `factory.yaml`. This factory runs both stages on Docker, each in a fresh sandbox with 2 CPUs and 4 GiB,
that may reach only npm and Anthropic's API:

```yaml sandboxed/factory.yaml
version: 1
factory: hello
providers:
  harness:
    acp: "^0"
  sandbox:
    docker: "^0"
agents:
  plan:
    harness: acp
    model: routes/default
    prompt: ./agents/plan.md
    secrets: [ref:file/anthropic-api-key]
    sandbox:
      template: node:24
      cpu: 2
      memory: 4Gi
      egress: [registry.npmjs.org, api.anthropic.com]
  implement:
    harness: acp
    model: routes/default
    prompt: ./agents/implement.md
    secrets: [ref:file/anthropic-api-key]
    sandbox:
      template: node:24
      cpu: 2
      memory: 4Gi
      egress: [registry.npmjs.org, api.anthropic.com]
workflow:
  - stage: plan
  - stage: implement
```

Put your Anthropic API key in the file `secrets/anthropic-api-key` and serve the foreman as in the quick start, with
`export OSF_SECRETS_DIR=$PWD/secrets` for the [docker sandbox adapter](../../adapters/sandbox/docker/README.md). Each
stage then goes like this:

1. The foreman creates a sandbox with the adapter that the factory names under `providers.sandbox` (`docker` when it
   names none) from the agent's `sandbox`. The spec holds each secret as a reference under a variable,
   `ref:file/anthropic-api-key` as `ANTHROPIC_API_KEY`, and `OTEL_RESOURCE_ATTRIBUTES` with the run. The sandbox gets
   a placeholder; its egress proxy puts the key in on the way to `api.anthropic.com`
   ([sandbox port](../../ports/sandbox/README.md)). The foreman never reads a secret.
2. It copies the run's folder into the sandbox, below the sandbox's working folder, as `<run ID>`.
3. It runs the harness adapter's command line from `FOREMAN_HARNESSES` in the sandbox with the adapter's `exec`, and
   speaks ACP to it. The template must hold that program; `node:24` holds `npx`.
4. When the turn ended, it copies the folder back into the run's folder, so the next stage finds the files.
5. It destroys the sandbox, also when the stage failed or was cancelled.

`FOREMAN_SANDBOXES` maps an adapter's name to its command line; an adapter it does not name runs
`npx -y @opensoftware/sandbox-<name>`. A factory names at most one sandbox adapter. An agent without `sandbox` runs on
the foreman's machine in the run's folder. A sandboxed agent reaches no MCP server yet.

## Checks

A stage can wait for CI: give it `checks`, the names of the checks that must succeed on the run's pull request before
it starts ([ADR 0069](../../docs/decisions/0069-foreman-checks.md)). This factory merges the pull request only when
its check `verify` succeeded:

```yaml checks/factory.yaml
version: 1
factory: hello
providers:
  harness:
    acp: "^0"
  forge:
    github: "^0"
agents:
  plan:
    harness: acp
    model: routes/default
    prompt: ./agents/plan.md
  implement:
    harness: acp
    model: routes/default
    prompt: ./agents/implement-pr.md
  ship:
    harness: acp
    model: routes/default
    prompt: ./agents/ship.md
workflow:
  - stage: plan
  - stage: implement
  - stage: ship
    checks: [verify]
```

```markdown agents/implement-pr.md
Implement plan.md on a new branch, push it and open a pull request. End with the pull request's link.
```

```markdown agents/ship.md
Merge the pull request.
```

Serve it as in the quick start, with the forge adapter's token: `export FOREMAN_FORGE_TOKEN=…`. Then:

1. The run's pull request is the last pull request link that an agent of an earlier stage wrote, in its messages or
   in its tool calls' output: `https://<host>/<owner>/<name>/pull/<n>` (GitHub) or `…/pulls/<n>` (Forgejo). The run
   shows it as `pullRequest`, every later stage's prompt ends with `Pull request: <link>`, and `run.completed@v1` lists
   it in `pullRequests`.
2. Before the stage `ship` starts, and before its gate if it has one, the foreman runs the
   [forge adapter](../../ports/forge/README.md)'s `pr <owner>/<name> <n>` and reads the named checks. The stage lists
   them under `checks`, each with `name` and `state`.
3. Every check `success`: the stage starts. A check `failure` or `error`: the stage is `failed` without running its
   agent, with the `reason` `the check verify ended with failure`, and the run is `failed`. A check `pending`, or one
   the pull request does not have yet: the run and the stage are `blocked`, and the foreman reads the checks again
   every `FOREMAN_CHECK_POLL_MS`. A cancel ends the wait.
4. Without a pull request link, the stage is `failed` with the reason `no earlier stage linked a pull request`.

The forge adapter is the one the factory names under `providers.forge`; a factory with `checks` names exactly one.
`FOREMAN_FORGES` maps an adapter's name to its command line; an adapter it does not name runs
`npx -y @opensoftware/forge-<name>`. It gets `FORGE_URL` and `FORGE_TOKEN` from `FOREMAN_FORGE_URL` and
`FOREMAN_FORGE_TOKEN`.

## Inference gateway

Give the factory's agents one model endpoint with a budget per run: name an
[inference adapter](../../ports/inference/README.md) under `providers.inference` and its config under `inference`.
This factory runs the [LiteLLM gateway](../../adapters/inference/litellm/README.md) on Docker and lets a run spend at
most 5 USD:

```yaml gateway/factory.yaml
version: 1
factory: hello
providers:
  harness:
    acp: "^0"
  inference:
    litellm: "^0"
inference:
  config: ./inference/litellm.yaml
  budget: 5
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

```yaml inference/litellm.yaml
model_list:
  - model_name: routes/default
    litellm_params:
      model: anthropic/claude-sonnet-5-5
      api_key: os.environ/OSF_SECRET_ANTHROPIC_API_KEY
```

Serve it as in the quick start, with `export OSF_SECRET_ANTHROPIC_API_KEY=…` for the adapter. Then:

1. `foreman serve` runs the adapter's `start` with the config, a path relative to `factory.yaml`, before it takes work,
   and `stop` when it stops. A `start` that fails stops the server with exit code 1 and the adapter's message.
2. Before a run's first stage, the foreman asks the adapter for the run's key: `key <gateway> <run ID> --budget 5`. The
   gateway refuses the run's calls once it spent its budget. The key stays in the foreman's memory, not in Temporal.
3. Each stage's harness adapter gets the gateway in the variables that the harness adapters read: `OPENAI_BASE_URL`
   (the URL `start` printed) and `ANTHROPIC_BASE_URL` (the same without `/v1`), `OPENAI_API_KEY` and
   `ANTHROPIC_API_KEY` (the run's key), and `OPENAI_MODEL` and `ANTHROPIC_MODEL` (the agent's `model`, a routing
   alias of the config). A sandboxed stage gets them in its sandbox's environment.

`FOREMAN_INFERENCES` maps an adapter's name to its command line; an adapter it does not name runs
`npx -y @opensoftware/inference-<name>`. A factory names at most one inference adapter. Without one, the foreman sets
none of these variables, and each harness adapter calls the model API it is configured for.

## Take over

A person can take a running stage over from its agent and hand the run back later
([ADR 0070](../../docs/decisions/0070-foreman-gateway-and-take-over.md)):

```sh
curl -H "Authorization: Bearer dev-token" -H "content-type: application/json" \
  --data '{"type": "take-over"}' http://localhost:8080/v1/runs/run_…/signals
```

1. The running stage's agent ends its turn within `FOREMAN_POLL_MS`. A sandboxed stage copies its files out and
   destroys its sandbox, as after every turn.
2. The stage is `blocked` with `takenOverAt`, and the run is `blocked` with `folder`: the run's folder on the foreman's
   machine, which holds the stage's files. The stage's `sessionId`, the run's `pullRequest` and the work item are the
   rest of the context.
3. The person works in that folder, then posts `{"type": "hand-back"}`. The stage is `succeeded`, and the next stage
   starts from the files in the folder, or the run is `complete` after the last stage.

A take-over needs a running stage, and a hand-back a stage that a person took over; otherwise the answer is 409. A
cancel ends a run that a person took over.

## Commands

| Command | What it does |
| --- | --- |
| `foreman serve` | Serve the run API on `PORT` and run the workflow of `FOREMAN_FACTORY` on the Temporal server at `FOREMAN_TEMPORAL_ADDRESS`; with `FOREMAN_NATS_URL`, start a run for each `work.received@v1`. |

## API

| Route | What it does |
| --- | --- |
| `POST /v1/runs` | Start the run of a work item (the [work item](../../contracts/work-item/work-item.schema.json) format). 201 with the new run, 200 with the run the same work item started before, 400 with a problem that names the field. |
| `GET /v1/runs` | The runs of the server, newest first: `{ "runs": [...] }`, each as `GET /v1/runs/{runId}` shows it. `?state=` with `running`, `blocked`, `complete`, `failed` or `cancelled` lists only the runs in that state; another state is 400. |
| `GET /v1/runs/{runId}` | The run: `state`, `factory`, `factoryVersion`, `pullRequest`, `folder`, `startedAt`, `endedAt` and its `stages`. 404 for a run the server does not know. |
| `POST /v1/runs/{runId}/signals` | `{ "type": "steer", "message": "…" }` sends the message to the running stage's agent; `{ "type": "cancel" }` cancels the run; `{ "type": "take-over" }` and `{ "type": "hand-back" }` hand the running stage to a person and back ([Take over](#take-over)). 202 with the run, 409 when the run ended or the signal does not fit its state. |

The OpenAPI of the routes is in [`contracts/openapi/openapi.json`](../../contracts/openapi/openapi.json); the
TypeScript type `paths` of `@opensoftware/contracts` types a client. Every route needs `Authorization: Bearer
<FOREMAN_API_TOKEN>`, else 401. Errors are `application/problem+json` with `title`, `status` and `detail`.

A run's ID is `run_` and 20 hex digits of the SHA-256 of the work item's ID, so a work item has one run. A run is
`running`, `blocked` (at a gate, waiting for checks, or taken over by a person), `complete`, `failed` or `cancelled`. A stage is `pending`,
`blocked`, `running`, `succeeded`, `failed`, `rejected` (by its gate) or `cancelled`; it has its harness `sessionId` once
it started, its `gateId` once its gate was asked, its `checks` once they were read, its `takenOverAt` once a person
took it over, and a `reason` when it failed for a reason the foreman knows.

## How a run goes

- **The factory.** `foreman serve` checks `FOREMAN_FACTORY` against the
  [factory definition](../../contracts/factory-definition/factory-definition.schema.json) when it starts, and that each
  stage's agent is declared; a wrong file exits 2 with the path in the file. Each run reads the file again when it
  starts and keeps that version until it ends. Its `factoryVersion` is the commit of the repository that holds the
  file.
- **Stages.** The stages run in the order of `workflow`, each in the run's folder `OSF_DATA/runs/<run ID>`, or in a
  sandbox when the stage's agent declares one ([Sandboxes](#sandboxes)). The foreman
  starts the stage's harness adapter from `FOREMAN_HARNESSES`, speaks ACP to it, opens a session and sends one prompt:
  the agent's prompt file, then the work item's ID, title and description. It allows the tool calls the adapter asks
  about; limit them with the adapter's `--allow`. A turn that ends with `end_turn` succeeds the stage; any other end
  fails or cancels it, ends the run, and leaves the later stages `pending`. The adapter gets
  `OTEL_RESOURCE_ATTRIBUTES` with `osf.run.id`, `osf.work_item.id`, `osf.stage` and `osf.factory.version`, and the
  factory's inference gateway with the run's key and the agent's model ([Inference gateway](#inference-gateway)).
- **Checks.** Before a stage with `checks` starts, the foreman waits until those checks succeeded on the run's pull
  request; a failing one fails the run ([Checks](#checks)).
- **Gates.** Before a stage with a `gate` starts, the foreman asks gatekeeper at `FOREMAN_GATEKEEPER_URL`
  ([gatekeeper](../gatekeeper/README.md#server)): the work item's ID, the stage, the summary `<title>: start the
  stage <stage>`, the origin's link, and the gate's `policy` and `approvers` in `change`. The run is `blocked` until a
  `gate.decided@v1` for that gate arrives on NATS. `approved` starts the stage; `rejected` or `expired` fails the run.
- **Signals.** A steering message reaches the running stage's agent within `FOREMAN_POLL_MS` as a prompt in its
  session, which the harness port treats as steering. A cancel ends the agent's turn, or the wait at a gate, and the
  run is `cancelled`. A person takes a running stage over and hands the run back with the signals `take-over` and
  `hand-back` ([Take over](#take-over)).
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
| `FOREMAN_SANDBOXES` | string | `"{}"` | serve: a JSON object from sandbox adapter name to the command line of the adapter. An adapter it does not name runs npx -y @opensoftware/sandbox-<name>. The factory names its adapter under providers.sandbox, docker by default. |
| `FOREMAN_FORGES` | string | `"{}"` | serve: a JSON object from forge adapter name to the command line of the adapter. An adapter it does not name runs npx -y @opensoftware/forge-<name>. The factory names its adapter under providers.forge. |
| `FOREMAN_INFERENCES` | string | `"{}"` | serve: a JSON object from inference adapter name to the command line of the adapter. An adapter it does not name runs npx -y @opensoftware/inference-<name>. The factory names its adapter under providers.inference. |
| `FOREMAN_FORGE_URL` | string |  | serve: the forge adapter's FORGE_URL, for a factory whose stages have checks. Default: the adapter's own default. |
| `FOREMAN_FORGE_TOKEN` | string |  | serve: the forge adapter's FORGE_TOKEN: a token that may read the pull requests and their checks. Never written to a file. |
| `FOREMAN_CHECK_POLL_MS` | string | `"30000"` | serve: how long a stage that waits for pending checks waits before it reads them again, in milliseconds. |
| `FOREMAN_POLL_MS` | string | `"1000"` | serve: how often a running stage looks for steering messages and a cancel, in milliseconds. |
| `FOREMAN_GATEKEEPER_URL` | string |  | serve: the URL of gatekeeper serve, which a stage with a gate asks for a decision. Required for a factory with gates. |
| `FOREMAN_GATEKEEPER_TOKEN` | string |  | serve: gatekeeper's API token, GATEKEEPER_API_TOKEN. |
| `FOREMAN_NATS_URL` | string |  | serve: the NATS server for work.received@v1 and gate.decided@v1 in, and run.started@v1 and run.completed@v1 out. Unset: no events. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-FORE-001 | implemented | A program starts a run of the README's factory and it completes |
| SCN-FORE-002 | implemented | Each stage's agent gets its prompt and the work item |
| SCN-FORE-003 | implemented | The same work item again is the same run |
| SCN-FORE-004 | implemented | A stage whose turn ends with "refusal" fails the run |
| SCN-FORE-005 | implemented | A run the server does not know is 404 |
| SCN-FORE-006 | implemented | A call without the API token is refused |
| SCN-FORE-007 | implemented | A work item without a title is refused |
| SCN-FORE-008 | implemented | A run carries the commit of the factory definition |
| SCN-FORE-009 | implemented | A run keeps its factory version when the factory changes during the run |
| SCN-FORE-010 | implemented | A stage that names an unknown agent stops the server at the start |
| SCN-FORE-011 | implemented | The server needs an API token |
| SCN-FORE-012 | implemented | A stage with a gate asks gatekeeper and the run waits |
| SCN-FORE-013 | implemented | An approval of the gate starts the stage |
| SCN-FORE-014 | implemented | A rejection of the gate fails the run |
| SCN-FORE-015 | implemented | A decision for another gate does not start the stage |
| SCN-FORE-016 | implemented | A steering message reaches the running stage's agent |
| SCN-FORE-017 | implemented | A cancel ends the running stage's turn and the run |
| SCN-FORE-018 | implemented | A cancel ends a run that waits at a gate |
| SCN-FORE-019 | implemented | A signal to a run that ended is refused |
| SCN-FORE-020 | implemented | An unknown signal is refused |
| SCN-FORE-021 | implemented | A run goes on from its history after the foreman restarts |
| SCN-FORE-022 | implemented | A work item from intake starts a run |
| SCN-FORE-023 | implemented | A run that ends publishes its outcome and its factory version |
| SCN-FORE-024 | implemented | The foreman allows a tool call that the stage's agent asks about |
| SCN-FORE-025 | implemented | A stage whose harness does not start fails the run |
| SCN-FORE-026 | implemented | A factory outside a Git repository stops the server at the start |
| SCN-FORE-027 | implemented | An event without a valid work item starts no run |
| SCN-FORE-028 | implemented | A stage's harness session carries the run |
| SCN-FORE-029 | implemented | A run that fails publishes the outcome "failed" and the stage that failed |
| SCN-FORE-030 | implemented | A cancelled run publishes the outcome "cancelled" |
| SCN-FORE-031 | implemented | Two steering messages reach the agent once each, in order |
| SCN-FORE-032 | implemented | A stage whose agent declares a sandbox runs in a sandbox created from it |
| SCN-FORE-033 | implemented | The sandbox spec holds the agent's secret as a reference under its variable |
| SCN-FORE-034 | implemented | A stage's sandbox carries the run in its environment |
| SCN-FORE-035 | implemented | A file a stage writes in its sandbox reaches the run's folder and the next stage's sandbox |
| SCN-FORE-036 | implemented | Each stage's sandbox is destroyed when the stage ends |
| SCN-FORE-037 | implemented | A cancel destroys the sandbox of the running stage |
| SCN-FORE-038 | implemented | A sandbox the adapter cannot create fails the run |
| SCN-FORE-039 | implemented | The sandbox adapter is the one the factory names under "providers.sandbox" |
| SCN-FORE-040 | implemented | A factory that names two sandbox adapters stops the server at the start |
| SCN-FORE-041 | implemented | A stage whose agent declares no sandbox runs on the foreman's machine |
| SCN-FORE-042 | implemented | A failing check stops the stage that waits for it |
| SCN-FORE-043 | implemented | A stage starts when its checks succeeded |
| SCN-FORE-044 | implemented | A pending check holds the stage until it succeeds |
| SCN-FORE-045 | implemented | A check the pull request does not have yet holds the stage |
| SCN-FORE-046 | implemented | A stage with checks fails when no earlier stage linked a pull request |
| SCN-FORE-047 | implemented | A run shows its pull request and publishes it when it ends |
| SCN-FORE-048 | implemented | A cancel ends a run that waits for a check |
| SCN-FORE-049 | implemented | A factory with checks but without a forge adapter stops the server at the start |
| SCN-FORE-050 | implemented | A stage's agent calls the factory's gateway with the run's key |
| SCN-FORE-051 | implemented | Each stage's agent calls the gateway with its own model |
| SCN-FORE-052 | implemented | The foreman starts one gateway from the factory's inference config |
| SCN-FORE-053 | implemented | Each run gets its own key with the factory's budget |
| SCN-FORE-054 | implemented | A sandboxed stage gets the gateway in its sandbox's environment |
| SCN-FORE-055 | implemented | The foreman stops the gateway when it stops serving |
| SCN-FORE-056 | implemented | A gateway that does not start stops the server at the start |
| SCN-FORE-057 | implemented | A factory with an inference adapter but without its config stops the server at the start |
| SCN-FORE-058 | implemented | A person takes over the running stage |
| SCN-FORE-059 | implemented | The next stage starts from the files of the person who handed the run back |
| SCN-FORE-060 | implemented | A take-over destroys the stage's sandbox and keeps its files |
| SCN-FORE-061 | implemented | A take-over of a run without a running stage is refused |
| SCN-FORE-062 | implemented | A hand-back of a run nobody took over is refused |
| SCN-FORE-063 | implemented | A cancel ends a run a person took over |
| SCN-FORE-064 | implemented | A person lists the runs of the server |
| SCN-FORE-065 | implemented | A person filters the runs by state |
| SCN-FORE-066 | implemented | A state that no run can have is refused |
