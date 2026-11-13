---
covers: [modules/foreman/src/**, modules/foreman/scripts/**]
---

# foreman

Run the factory's workflow for each work item: the stages of `factory.yaml` one after the other, each with its agent
through the harness port, with human gates, steering and cancel, on Temporal. A run survives a restart of the
foreman, and Temporal's UI shows its history. Decisions: [ADR 0067](../../docs/decisions/0067-foreman.md), on
[ADR 0004](../../docs/decisions/0004-temporal.md), [ADR 0068](../../docs/decisions/0068-foreman-sandboxes.md) for
sandboxes, [ADR 0069](../../docs/decisions/0069-foreman-checks.md) for checks, and
[ADR 0070](../../docs/decisions/0070-foreman-gateway-and-take-over.md) for the inference gateway and take over, and
[ADR 0078](../../docs/decisions/0078-agent-effort.md) for the effort level of each agent, and
[ADR 0106](../../docs/decisions/0106-waits-that-end.md) for the limits of the waits, and
[ADR 0107](../../docs/decisions/0107-a-stage-that-only-waits.md) for a stage that only waits.

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
    effort: medium
    prompt: ./agents/plan.md
  implement:
    harness: acp
    model: routes/default
    effort: medium
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

## Versions

A run names the versions it runs ([ADR 0110](../../docs/decisions/0110-versions-a-run-can-trust.md)):

- Its `factoryVersion` is the commit of the factory's folder. The folder must be clean: `foreman serve`, a run's start
  and a retry refuse a tracked file of the folder that differs from that commit, and a file the foreman reads
  (`factory.yaml`, the prompts, the inference config) that Git does not track, with
  `factory.yaml: commit the changed files <path>, <path>; a run's factory version is its commit`. The server exits
  with code 2; `POST /v1/runs` and a retry answer 400. Other untracked files and ignored files do not count.
- An adapter that `FOREMAN_HARNESSES`, `FOREMAN_SANDBOXES`, `FOREMAN_FORGES` or `FOREMAN_INFERENCES` does not name
  runs `npx -y @opensoftware/<port>-<name>@<range>`, at the range under `providers.<port>.<name>` (`run` follows for
  a harness). A map entry is a JSON list of the program and its arguments, for a path that holds a space, or a
  string that the foreman splits at each space.
- The run's `adapters` lists each adapter under `providers` with its range as `version`, and either the command line
  the foreman builds as `command` or the map that names it as `configured`.

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
    effort: medium
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
    effort: medium
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
`npx -y @opensoftware/sandbox-<name>@<range>` at the factory's range ([Versions](#versions)). A factory names at most one sandbox adapter. A factory that names none runs
its sandboxes with the adapter of `FOREMAN_SANDBOX` (`docker`), so one factory runs in Docker on one machine and in
Kubernetes in a cluster ([ADR 0096](../../docs/decisions/0096-agents-in-sandboxes-in-the-profile.md)). An agent without `sandbox` runs on
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
    effort: medium
    prompt: ./agents/plan.md
  implement:
    harness: acp
    model: routes/default
    effort: medium
    prompt: ./agents/implement-pr.md
  ship:
    harness: acp
    model: routes/default
    effort: medium
    prompt: ./agents/ship.md
workflow:
  - stage: plan
  - stage: implement
  - stage: ship
    checks: [verify]
```

```markdown agents/implement-pr.md
Implement plan.md on the branch the prompt names, or on a new branch, push it and open a pull request. End with
the pull request's link.
```

```markdown agents/ship.md
Merge the pull request.
```

Serve it as in the quick start, with the forge adapter's token: `export FOREMAN_FORGE_TOKEN=…`. Then:

1. The run's pull request ([ADR 0109](../../docs/decisions/0109-the-runs-pull-request-from-the-forge.md)). When the
   work item's origin is an issue or a pull request of a forge, `<forge>/<owner>/<name>/issues/<n>`, that is the work
   item's repository, the run's branch is `osf/<run ID>`, and every stage's prompt has the line `Branch: osf/<run ID>`.
   After each stage the foreman runs the forge adapter's `prs <owner>/<name> --head osf/<run ID> --state all`: the
   pull request with exactly that head is the run's. Else it takes the agent's last line
   `Pull request: <link>`, but only of the work item's repository; a link the agent only mentions is not taken. A
   stage that refuses a link, or leaves the run without a pull request, says why in its `note`, for example
   `no pull request of tester/web has the head osf/run_…, and the agent stated none`. For any other origin the run's
   pull request is the last pull request link that an agent wrote, in its messages or in its tool calls' output:
   `https://<host>/<owner>/<name>/pull/<n>` (GitHub) or `…/pulls/<n>` (Forgejo). The run shows it as `pullRequest`,
   every later stage's prompt has the line `Pull request: <link>`, and `run.completed@v1` lists it in `pullRequests`.
2. Before the stage `ship` starts, and before its gate if it has one, the foreman runs the
   [forge adapter](../../ports/forge/README.md)'s `pr <owner>/<name> <n>` and reads the named checks. The stage lists
   them under `checks`, each with `name` and `state`.
3. Every check `success`: the stage starts. A check `failure` or `error`: the stage is `failed` without running its
   agent, with the `reason` `the check verify ended with failure`, and the run is `failed`. A check `pending`, or one
   the pull request does not have yet: the run and the stage are `blocked`, and the foreman reads the checks again
   every `FOREMAN_CHECK_POLL_MS`. The stage shows since when it waits as `waitingSince`. A cancel ends the wait.
4. Checks that did not all succeed after `FOREMAN_CHECK_TIMEOUT_MS` (2 hours) fail the stage and the run, with a
   `reason` that names each check that did not end:
   `the checks did not succeed after 7200000 ms: verify is pending; proof is missing on the pull request's head commit`.
   A check is missing when the forge lists no check of that name on the head commit at all, as for a wrong name
   ([ADR 0106](../../docs/decisions/0106-waits-that-end.md)).
5. Without a pull request link, the stage is `failed` with the reason `no earlier stage linked a pull request`.

The forge adapter is the one the factory names under `providers.forge`; a factory with `checks` names exactly one.
`FOREMAN_FORGES` maps an adapter's name to its command line; an adapter it does not name runs
`npx -y @opensoftware/forge-<name>@<range>` at the factory's range ([Versions](#versions)). It gets `FORGE_URL` and `FORGE_TOKEN` from `FOREMAN_FORGE_URL` and
`FOREMAN_FORGE_TOKEN`.

A stage with `evidence: required` also waits for the check `proof`: the commit status that
[proof](../proof/README.md) sets when it attaches the evidence of a pull request
([ADR 0088](../../docs/decisions/0088-evidence-check.md)). Run proof in the CI of the repository, or the stage stays
blocked. Such a stage needs a forge adapter under `providers.forge`, as `checks` do.

A stage with `wait: true` runs no agent ([ADR 0107](../../docs/decisions/0107-a-stage-that-only-waits.md)): it waits
for its checks, for `proof` when it has `evidence: required`, and for its gate, and then succeeds, with no harness
session, no sandbox and no model call. The run shows it with `wait: true`, its own name as `agent` and no `sessionId`. Such a stage names no
`agent`, and it names `checks`, `evidence: required` or a `gate`; `foreman serve` stops at the start otherwise, with
`factory.yaml: /workflow/<n>/agent: a stage that only waits names no agent` or
`factory.yaml: /workflow/<n>/wait: a stage that only waits names checks, the evidence "required" or a gate`. A later
stage that must start only on checks that succeeded on the pull request's head commit, like `ship`, names the same
checks again, so the foreman reads them once more before it starts.

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
    effort: medium
    prompt: ./agents/plan.md
  implement:
    harness: acp
    model: routes/default
    effort: medium
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

1. `foreman serve` runs the adapter's `start` with the config, a path relative to `factory.yaml`, in the background,
   and `stop` when it stops (see 4). The server takes work at once; a stage waits for the gateway before it gets its key. A
   `start` that fails is a warning with the adapter's message, and the server tries again after
   `FOREMAN_INFERENCE_RETRY_MS`. Until a start succeeds, the check `inference` of `/v1/health` fails with that message
   ([ADR 0099](../../docs/decisions/0099-foreman-starts-the-gateway-in-the-background.md)).
   `start` gets `OSF_INFERENCE_OWNER` with the foreman's process ID, so a later start removes the gateway of a foreman
   that was killed ([ADR 0090](../../docs/decisions/0090-no-leaked-containers.md)).
2. Before a run's first stage, the foreman asks the adapter for the run's key: `key <gateway> <run ID> --budget 5`. The
   gateway refuses the run's calls once it spent its budget. The key is never in Temporal; the adapter gives the same
   key for the same run, so a stage after a restart of the foreman goes on with the run's key and its spend
   ([ADR 0108](../../docs/decisions/0108-one-key-and-one-budget-per-run.md)).
3. When the run ended, completed, failed or cancelled, the foreman runs `revoke <gateway> <run ID>`, and the key no
   longer works. A revoke that fails is a warning (`the key of the run <ID>: …`); the run ends as it would, and the
   key lives until the gateway stops.
4. The foreman keeps the gateway's ID and URL in `OSF_DATA/inference/gateway.json`, and a file per run with a key in
   `OSF_DATA/inference/runs/`. At its start it takes the gateway of that file when the adapter's `list` still prints
   it. At its stop it runs `stop` only when no run has a key; otherwise the gateway runs on for the next foreman.
5. Each stage's harness adapter gets the gateway in the variables that the harness adapters read: `OPENAI_BASE_URL`
   (the URL `start` printed) and `ANTHROPIC_BASE_URL` (the same without `/v1`), `OPENAI_API_KEY` and
   `ANTHROPIC_API_KEY` (the run's key), and `OPENAI_MODEL` and `ANTHROPIC_MODEL` (the agent's `model`, a routing
   alias of the config). A sandboxed stage gets them in its sandbox's environment.

`FOREMAN_INFERENCES` maps an adapter's name to its command line; an adapter it does not name runs
`npx -y @opensoftware/inference-<name>@<range>` at the factory's range ([Versions](#versions)). A factory names at most one inference adapter. Without one, the foreman sets
none of these variables, and each harness adapter calls the model API it is configured for.

## Effort level

Every agent in `factory.yaml` names its `effort`: `low`, `medium`, `high`, `xhigh` or `max`. Each stage's harness
adapter gets it as `OSF_EFFORT`, with or without an inference gateway, and a sandboxed stage gets it in its sandbox's
environment. The harness adapter maps it to its product's setting (see the
[harness port](../../ports/harness/README.md#the-effort-level)).

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

## Run again

A run that `failed` or was `cancelled` runs again as a new run
([ADR 0105](../../docs/decisions/0105-run-a-work-item-again.md)):

```sh
curl -H "Authorization: Bearer dev-token" -H "content-type: application/json" \
  --data '{"by": {"kind": "person", "id": "github:ada"}}' http://localhost:8080/v1/runs/run_…/retry
```

1. The new run has an ID of its own, `attempt` 2 (3, …), `retryOf` with the run before and `retriedBy` with the person.
   The run before keeps its view.
2. It starts at the first stage that did not succeed, or at `from`, a stage at or before it: `{"by": …, "from":
   "plan"}`. The stages before are copied from the run before, as they ended. When the names of the factory's stages,
   in order, changed since the run before, the new run starts at the factory's first stage with every stage
   `pending`; a `from` other than that stage is 409.
3. It moves the folder `OSF_DATA/runs/<run ID>` of the run before to its own, and keeps the run's pull request. A
   failed check is read again, a cancelled stage runs a fresh turn, and a rejected gate asks gatekeeper again.
4. The prompt of its first stage has one more line that says how the run before ended, for example `Run before:
   run_… failed in the stage ship: the check verify ended with failure`. The later stages do not get it.
5. It has a trace of its own, whose run span has `osf.run.retry_of`, and its own key of the gateway with the
   factory's budget.

Only the newest run of a work item runs again. A run that is `running`, `blocked` or `complete` is refused with 409
and its state, a run that already ran again with 409 that names the later run. Two retries at once start one run;
the other gets 409. The new run's `run.started@v1` and `run.completed@v1` have `retryOf`, and intake's
`work.retry-requested@v1` runs a run again as this route does ([Events](#events)).

## Commands

| Command | What it does |
| --- | --- |
| `foreman serve` | Serve the run API on `PORT` and run the workflow of `FOREMAN_FACTORY` on the Temporal server at `FOREMAN_TEMPORAL_ADDRESS`; with `FOREMAN_NATS_URL`, start a run for each `work.received@v1` and run a run again for each `work.retry-requested@v1`. |

## API

| Route | What it does |
| --- | --- |
| `POST /v1/runs` | Start the run of a work item (the [work item](../../contracts/work-item/work-item.schema.json) format). 201 with the new run, 200 with the newest run the same work item started before, 400 with a problem that names the field. |
| `GET /v1/runs` | The runs of the server, running runs first, then the runs that ended, the one that ended last first: `{ "runs": [...] }`, each as `GET /v1/runs/{runId}` shows it. `?state=` with `running`, `blocked`, `complete`, `failed` or `cancelled` lists only the runs in that state; another state is 400. |
| `GET /v1/runs/{runId}` | The run: `state`, `factory`, `factoryVersion`, `pullRequest`, `folder`, `startedAt`, `endedAt` and its `stages`; for a run that runs a run before it again, `attempt`, `retryOf` and `retriedBy`. 404 for a run the server does not know. |
| `GET /v1/health` | Whether the server reaches Temporal and, with `FOREMAN_NATS_URL`, NATS: 200 with `status: ok`, else 503 with the failing check and what to fix ([ADR 0086](../../docs/decisions/0086-health-routes.md)). Needs no token. |
| `POST /v1/runs/{runId}/signals` | `{ "type": "steer", "message": "…" }` sends the message to the running stage's agent; `{ "type": "cancel" }` cancels the run; `{ "type": "take-over" }` and `{ "type": "hand-back" }` hand the running stage to a person and back ([Take over](#take-over)). 202 with the run, 409 when the run ended or the signal does not fit its state. |
| `POST /v1/runs/{runId}/retry` | `{ "by": { "kind": "person", "id": "…" }, "from": "<stage>" }` runs a run that failed or was cancelled again ([Run again](#run-again)); `from` is optional. 201 with the new run, 400 without `by`, with a `from` the run does not have or a `from` after the first stage that did not succeed, 404 for an unknown run, 409 for a run in another state, a run that already ran again, or a `from` other than the first stage when the factory's stages changed. |

The OpenAPI of the routes is in [`contracts/openapi/openapi.json`](../../contracts/openapi/openapi.json); the
TypeScript type `paths` of `@opensoftware/contracts` types a client. Every route except `/v1/health` needs
`Authorization: Bearer <FOREMAN_API_TOKEN>`, else 401. Errors are `application/problem+json` with `title`, `status` and `detail`.

A run's ID is `run_` and 20 hex digits of the SHA-256 of the work item's ID; the `n`-th run of a work item, `n` ≥ 2,
takes the SHA-256 of `<work item ID>#<n>` ([Run again](#run-again)). A run is
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
  the agent's prompt file, then the work item's ID, title and description, and `Origin: <url>` when the work item
  has an origin's link, like the issue it came from, `Branch: osf/<run ID>` when the run's pull request comes from the
  forge ([Checks](#checks)), `Pull request: <link>` once the run has one, and `Run before: …`
  in the first stage of a run that runs a run before it again ([Run again](#run-again)). It allows the tool calls the adapter asks
  about; limit them with the adapter's `--allow`. A turn that ends with `end_turn` succeeds the stage; any other end
  fails or cancels it, ends the run, and leaves the later stages `pending`. The adapter gets
  `OTEL_RESOURCE_ATTRIBUTES` with `osf.run.id`, `osf.work_item.id`, `osf.stage` and `osf.factory.version`, and the
  factory's inference gateway with the run's key and the agent's model ([Inference gateway](#inference-gateway)).
- **Checks.** Before a stage with `checks` starts, the foreman waits until those checks succeeded on the run's pull
  request; a failing one fails the run ([Checks](#checks)).
- **Gates.** Before a stage with a `gate` starts, the foreman asks gatekeeper at `FOREMAN_GATEKEEPER_URL`
  ([gatekeeper](../gatekeeper/README.md#server)): the work item's ID, the stage, the summary `<title>: start the
  stage <stage>`, the origin's link and the run's pull request as `links` (`Origin`, `Pull request`), and the run's ID
  and the gate's `policy` and `approvers` in `change`, so each run's request is a new one. The run is `blocked` until a
  `gate.decided@v1` for that gate arrives on NATS, and the stage shows since when it waits as `waitingSince`.
  `approved` starts the stage; `rejected` or `expired` fails the run. Without a decision after
  `FOREMAN_GATE_TIMEOUT_MS` (7 days) the gate expires at the foreman, also when its policy names no `expire_after`:
  the stage is `rejected` with the reason `the gate <id> expired: no decision after 604800000 ms`, and the run is
  `failed`. gatekeeper's record of the gate stays as it is; a decision that comes later is a warning and changes no
  run ([ADR 0106](../../docs/decisions/0106-waits-that-end.md)).
- **Signals.** A steering message reaches the running stage's agent within `FOREMAN_POLL_MS` as a prompt in its
  session, which the harness port treats as steering. A cancel ends the agent's turn, or the wait at a gate, and the
  run is `cancelled`. A person takes a running stage over and hands the run back with the signals `take-over` and
  `hand-back` ([Take over](#take-over)).
- **Restarts.** The runs live in Temporal's history. A foreman that stops and starts again goes on with them; a stage
  that ran when it stopped runs again, up to 3 times. On SIGTERM, foreman gives running activities 1 second, then
  cancels the turns of running stages and exits; Temporal runs those stages again when a foreman starts ([ADR
  0101](../../docs/decisions/0101-foreman-stops-at-once.md)).

## Events

With `FOREMAN_NATS_URL`, the foreman starts a run for each [`work.received@v1`](../../contracts/events/work-received/work-received.schema.json)
on `osf.work.received.v1`, and hands each [`gate.decided@v1`](../../contracts/events/gate-decided/gate-decided.schema.json)
on `osf.gate.decided.v1` to the newest run of its work item. For each
[`work.retry-requested@v1`](../../contracts/events/work-retry-requested/work-retry-requested.schema.json) on
`osf.work.retry-requested.v1` it runs the run in `runId` again, by the `requester`, as `POST /v1/runs/<run ID>/retry`
does ([Run again](#run-again)). A run publishes
[`run.started@v1`](../../contracts/events/run-started/run-started.schema.json) on `osf.run.started.v1` when it starts and
[`run.completed@v1`](../../contracts/events/run-completed/run-completed.schema.json) on `osf.run.completed.v1` when it
ends, with the outcome `succeeded`, `failed` or `cancelled`. Their IDs are the run's ID with `.started` and
`.completed`; a run that runs a run before it again names that run in `retryOf`. The events are kept in the JetStream stream `OSF` on `osf.>`, which the
foreman adds when it is missing, and the foreman reads them through its durable consumer `foreman` ([ADR
0085](../../docs/decisions/0085-durable-events.md)). A work item or a gate decision published while the foreman is down
reaches it when it starts again. A message is acknowledged after it is handled; one that fails comes again after 2
seconds, at most 5 times. A work item that is not valid, a decision for a run that does not exist, or a retry request
for a run that is unknown, not `failed` or `cancelled`, or already ran again, is a warning and does not come again:
a second request for the same run starts no third run.

## Traces

With `OTEL_EXPORTER_OTLP_ENDPOINT`, each run is one OTLP trace ([ADR 0087](../../docs/decisions/0087-run-traces.md)).
When a stage ends, the foreman sends the span `stage <stage>`, and when the run ends the span `run <factory>`, to
`<url>/v1/traces`. The stage spans are children of the run's span. Every span has the resource `osf.run.id`,
`osf.work_item.id` and `osf.factory.version`; a stage span also has `osf.stage`, `osf.agent`, `osf.harness.name`,
`gen_ai.request.model`, `osf.effort`, `gen_ai.conversation.id` (the harness session) and `osf.outcome`. The trace ID
is the first 32 hex digits of the SHA-256 of the run's ID, so a restarted foreman sends to the same trace. A run that
runs a run before it again has a trace of its own, and its run span has `osf.run.retry_of` with the run before. The run's
view names it as `traceId`, so the console links the trace.

Each stage's harness gets `TRACEPARENT` with the trace and the stage's span, also in a sandbox, so the harness's own
spans join the run's trace. A receiver that refuses a span is a warning; the stage goes on.

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
| `FOREMAN_FACTORY` | string | `"factory.yaml"` | serve: the factory definition. Its folder must be in a Git repository and clean, with every tracked file and every file the foreman reads committed: a run's factory version is its commit (ADR 0110). |
| `FOREMAN_TEMPORAL_ADDRESS` | string | `"localhost:7233"` | serve: the gRPC address of the Temporal server. |
| `FOREMAN_TEMPORAL_NAMESPACE` | string | `"default"` | serve: the Temporal namespace of the runs. |
| `FOREMAN_TASK_QUEUE` | string | `"foreman"` | serve: the Temporal task queue of the runs' workflows and activities. |
| `FOREMAN_HARNESSES` | string | `"{}"` | serve: a JSON object from harness name to the command line of its adapter. Each command line is a JSON list of the program and its arguments, or a string split at each space. A harness it does not name runs npx -y @opensoftware/harness-<name>@<range> run, at the range under providers.harness (ADR 0110). |
| `FOREMAN_SANDBOXES` | string | `"{}"` | serve: a JSON object from sandbox adapter name to the command line of the adapter. Each command line is a JSON list of the program and its arguments, or a string split at each space. An adapter it does not name runs npx -y @opensoftware/sandbox-<name>@<range>, at the range under providers.sandbox (ADR 0110). The factory names its adapter under providers.sandbox, or else FOREMAN_SANDBOX picks it. |
| `FOREMAN_SANDBOX` | string | `"docker"` | serve: the sandbox adapter of a factory that names none under providers.sandbox, like docker in the Compose profile and kubernetes in the Helm chart. |
| `FOREMAN_FORGES` | string | `"{}"` | serve: a JSON object from forge adapter name to the command line of the adapter. Each command line is a JSON list of the program and its arguments, or a string split at each space. An adapter it does not name runs npx -y @opensoftware/forge-<name>@<range>, at the range under providers.forge (ADR 0110). The factory names its adapter under providers.forge. |
| `FOREMAN_INFERENCES` | string | `"{}"` | serve: a JSON object from inference adapter name to the command line of the adapter. Each command line is a JSON list of the program and its arguments, or a string split at each space. An adapter it does not name runs npx -y @opensoftware/inference-<name>@<range>, at the range under providers.inference (ADR 0110). The factory names its adapter under providers.inference. |
| `PATH` | string |  | serve: the folders where the foreman finds git, npx for an adapter without a command line, and the programs of the adapter maps. |
| `FOREMAN_FORGE_URL` | string |  | serve: the forge adapter's FORGE_URL, for a factory whose stages have checks. Default: the adapter's own default. |
| `FOREMAN_FORGE_TOKEN` | string |  | serve: the forge adapter's FORGE_TOKEN: a token that may read the pull requests and their checks. Never written to a file. |
| `FOREMAN_CHECK_POLL_MS` | string | `"30000"` | serve: how long a stage that waits for pending checks waits before it reads them again, in milliseconds. |
| `FOREMAN_CHECK_TIMEOUT_MS` | string | `"7200000"` | serve: how long a stage waits for its checks to succeed, in milliseconds; then it fails with a reason that names each check that did not end (ADR 0106). |
| `FOREMAN_GATE_TIMEOUT_MS` | string | `"604800000"` | serve: how long a stage waits for the decision of its gate, in milliseconds; then the gate expires and the stage is rejected (ADR 0106). |
| `FOREMAN_INFERENCE_RETRY_MS` | string | `"1000"` | serve: how long the server waits before it starts the factory's inference gateway again after a failed start, in milliseconds. Until a start succeeds, the health check inference fails. |
| `FOREMAN_POLL_MS` | string | `"1000"` | serve: how often a running stage looks for steering messages and a cancel, in milliseconds. |
| `FOREMAN_GATEKEEPER_URL` | string |  | serve: the URL of gatekeeper serve, which a stage with a gate asks for a decision. Required for a factory with gates. |
| `FOREMAN_GATEKEEPER_TOKEN` | string |  | serve: gatekeeper's API token, GATEKEEPER_API_TOKEN. |
| `FOREMAN_NATS_URL` | string |  | serve: the NATS server for work.received@v1, work.retry-requested@v1 and gate.decided@v1 in, and run.started@v1 and run.completed@v1 out. Unset: no events. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | string |  | serve: the base URL of an OTLP/HTTP receiver, like http://phoenix:6006. Set, each run is one trace with a span per stage and one for the run, sent to <url>/v1/traces, and each stage's harness gets the trace in TRACEPARENT (ADR 0087). |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | string |  | serve: the full URL of the OTLP/HTTP traces endpoint; takes precedence over OTEL_EXPORTER_OTLP_ENDPOINT. |
| `OTEL_EXPORTER_OTLP_HEADERS` | string |  | serve: headers for the OTLP receiver as key=value pairs, comma-separated, like a token from a secret store. |

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
| SCN-FORE-056 | deprecated | A gateway that does not start stops the server at the start |
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
| SCN-FORE-067 | implemented | A run that waits at its gate is listed as blocked |
| SCN-FORE-068 | implemented | A stage ends when its harness keeps running after the turn |
| SCN-FORE-069 | implemented | Each stage's agent gets its agent's effort as "OSF_EFFORT" |
| SCN-FORE-070 | implemented | A sandboxed stage gets its agent's effort in its sandbox's environment |
| SCN-FORE-071 | implemented | A stage's prompt names the origin of the work item |
| SCN-FORE-072 | implemented | A gate request links the run's pull request |
| SCN-FORE-073 | implemented | A work item that intake publishes while the foreman is down starts a run when the foreman starts again |
| SCN-FORE-074 | implemented | A gate decision that gatekeeper publishes while the foreman is down reaches the run when the foreman starts again |
| SCN-FORE-075 | implemented | A server that reaches Temporal and NATS is healthy, without a token |
| SCN-FORE-076 | implemented | A run sends a span per stage and one for the run, in one trace |
| SCN-FORE-077 | implemented | Each stage's harness gets the trace and the stage's span in "TRACEPARENT" |
| SCN-FORE-078 | implemented | A stage that must produce evidence also waits for the check "proof" |
| SCN-FORE-079 | implemented | A stage that must produce evidence fails when the check "proof" failed |
| SCN-FORE-080 | implemented | A factory with a stage that must produce evidence but without a forge adapter stops the server at the start |
| SCN-FORE-081 | implemented | A run's view names its trace ID |
| SCN-FORE-082 | implemented | A work item that the foreman cannot start for a moment comes again and starts its run |
| SCN-FORE-083 | implemented | A work item that breaks its contract and a gate decision for no run are one warning each and come no second time |
| SCN-FORE-084 | implemented | A factory that names no sandbox adapter runs its sandboxes with the adapter of FOREMAN_SANDBOX |
| SCN-FORE-085 | implemented | A factory that names no sandbox adapter runs its sandboxes with docker when FOREMAN_SANDBOX is not set |
| SCN-FORE-086 | implemented | Until the factory's gateway starts, the server serves and its health names the failure |
| SCN-FORE-087 | implemented | A stage that runs a turn when the foreman stops runs its turn again when the foreman starts again |
| SCN-FORE-088 | implemented | A retry of a failed run starts a new run at the stage that failed |
| SCN-FORE-089 | implemented | The new run works in the folder and on the pull request of the run before |
| SCN-FORE-090 | implemented | A retry of a cancelled run starts the cancelled stage again |
| SCN-FORE-091 | implemented | A retry of a run whose gate was rejected asks gatekeeper again |
| SCN-FORE-092 | implemented | A retry from an earlier stage runs that stage again |
| SCN-FORE-093 | implemented | A retry from a stage after the stage that failed is refused |
| SCN-FORE-094 | implemented | A retry without the person who asks is refused |
| SCN-FORE-095 | implemented | A retry of a run that is still going is refused |
| SCN-FORE-096 | implemented | A retry of a run that succeeded is refused |
| SCN-FORE-097 | implemented | A retry of a run the server does not know is 404 |
| SCN-FORE-098 | implemented | Two retries of the same run at the same time start one run |
| SCN-FORE-099 | implemented | A retry of a run that already ran again is refused and names the later run |
| SCN-FORE-100 | implemented | The runs list shows the run before and the new run |
| SCN-FORE-101 | implemented | The same work item again answers the newest run |
| SCN-FORE-102 | implemented | The new run publishes its events with its own IDs and the run before |
| SCN-FORE-103 | implemented | A gate decision reaches the newest run of the work item |
| SCN-FORE-104 | implemented | A retry request from intake runs the work item again |
| SCN-FORE-105 | implemented | A second retry request for the same run starts no third run |
| SCN-FORE-106 | implemented | The new run gets its own key with the factory's budget |
| SCN-FORE-107 | implemented | The new run has a trace of its own that names the run before |
| SCN-FORE-108 | implemented | The first stage of the new run is told why the run before ended |
| SCN-FORE-109 | implemented | A retry after the factory's stages changed starts at the first stage |
| SCN-FORE-110 | implemented | A retry from a later stage after the factory's stages changed is refused |
| SCN-FORE-111 | implemented | A retry from a stage the run does not have is refused |
| SCN-FORE-112 | implemented | A check that stays pending past the foreman's limit fails the stage |
| SCN-FORE-113 | implemented | A check that the pull request's head commit does not have is named as missing when the limit ends the wait |
| SCN-FORE-114 | implemented | A stage that waits for a check shows since when it waits |
| SCN-FORE-115 | implemented | A gate without a decision after the foreman's limit ends as expired |
| SCN-FORE-116 | implemented | A decision after the foreman's limit ended the gate changes nothing |
| SCN-FORE-117 | implemented | A stage that only waits succeeds when its checks succeeded, without a session |
| SCN-FORE-118 | implemented | A factory with a stage that only waits and names an agent stops the server at the start |
| SCN-FORE-119 | implemented | A factory with a stage that only waits for nothing stops the server at the start |
| SCN-FORE-120 | implemented | A stage that only waits at a gate succeeds after the approval, without a session |
| SCN-FORE-121 | implemented | A run keeps its key and its spent budget when the foreman restarts during a stage |
| SCN-FORE-122 | implemented | The foreman revokes the run's key when the run completed |
| SCN-FORE-123 | implemented | The foreman revokes the run's key when the run was cancelled |
| SCN-FORE-124 | implemented | A revoke that fails is a warning and the run completes all the same |
| SCN-FORE-125 | implemented | The foreman stops the gateway when it stops serving after every run's key was revoked |
| SCN-FORE-126 | implemented | The run's pull request is the forge's pull request of the run's branch, not the last link the agent wrote |
| SCN-FORE-127 | implemented | The pull request the agent states is the run's when the forge has none of the run's branch |
| SCN-FORE-128 | implemented | A stated pull request of another repository than the work item's is refused |
| SCN-FORE-129 | implemented | A stage says so when the forge has no pull request of the run's branch and the agent states none |
| SCN-FORE-130 | implemented | A stage whose forge adapter cannot list the pull requests succeeds and names the adapter's error |
| SCN-FORE-131 | implemented | A factory with changes that are not committed stops the server at the start |
| SCN-FORE-132 | implemented | A run does not start while the factory has changes that are not committed |
| SCN-FORE-133 | implemented | The run's view names each adapter's version and the fallback's command line |
| SCN-FORE-134 | implemented | An adapter's command line is a JSON list of arguments, and a path may hold a space |
| SCN-FORE-135 | implemented | A prompt that Git does not track counts as a change, and the error lists the paths sorted |
| SCN-FORE-136 | implemented | Every adapter without a command line runs its package at the factory's range |
| SCN-FORE-137 | implemented | A forge adapter without a command line runs its package at the factory's range |
| SCN-FORE-138 | implemented | An inference config that Git does not track counts as a change, in a factory below the repository's root |
| SCN-FORE-139 | implemented | A sandbox adapter that the factory does not name runs its package without a range |
