---
status: accepted
date: 2026-10-26
---

# 0070. foreman runs one inference gateway per factory, and a person takes over a run

## Context

TODO item T-17 lists the next slice of the foreman: the inference gateway per run (from T-14), and a person takes
over a run (vision scenario ORCH-007).

The inference port exists (ADR 0056): an adapter is a program with `start <config>`, `key <ID> <run ID> [--budget
<USD>]`, `spend-log`, `stop` and `list`, and the litellm adapter runs LiteLLM with PostgreSQL on Docker. Its
consequences name the foreman's part: start one gateway per factory, ask for a key per run with the run's budget, and
hand the URL and the key to the harness. The harness adapters already take a base URL, a key and a model:
`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` (claude-code), `OPENAI_BASE_URL`, `OPENAI_API_KEY` and
`OPENAI_MODEL` (codex, opencode). Each agent in `factory.yaml` already names its `model`, a routing alias of the
gateway, but the foreman passes it to nobody. The factory definition has `providers.inference`, but no place for the
gateway's config or a budget.

ORCH-007 says: "Given an implementation run in progress, When a human takes over the run, Then the human continues from
the run's current state and context." The foreman already ends a stage's turn on a cancel (ADR 0067), and copies a
sandboxed stage's files back to the run's folder when the turn ends (ADR 0068).

## Decision

### The inference gateway

- **The factory names it.** `providers.inference` names at most one adapter. The new optional top-level field
  `inference` of the factory definition holds `config`, the path of the adapter's config relative to `factory.yaml`
  (for litellm, a LiteLLM proxy config), and `budget`, the most a run may spend in USD. A factory that names an adapter
  without `inference.config`, or `inference` without exactly one adapter, stops `foreman serve` with exit code 2 and
  the path `/inference` or `/providers/inference`. The fields are optional, so the contract change is a minor one.
- **The adapter's command line** comes from `FOREMAN_INFERENCES`, a JSON object from adapter name to command line, like
  `FOREMAN_SANDBOXES`; an adapter it does not name runs `npx -y @opensoftware/inference-<name>`.
- **One gateway while the foreman serves.** `foreman serve` runs `start <config>` before it takes work, and `stop <ID>`
  when it stops on SIGTERM or SIGINT. A `start` that fails stops the server with exit code 1 and the adapter's message.
  The config is read once, at the start: a change takes effect at the next start.
- **One key per run.** Before the first stage of a run that runs in this server, the foreman runs `key <ID> <run ID>`
  with `--budget <budget>` when the factory sets one, and keeps the key in memory for the run's later stages. The key
  never enters Temporal's history. A foreman that restarts starts a new gateway, so the run gets a new key there.
- **What the agent gets.** Each stage's harness adapter gets six variables, so every harness adapter finds its own:
  `OPENAI_BASE_URL` is the URL `start` printed, `ANTHROPIC_BASE_URL` the same URL without its trailing `/v1`,
  `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` the run's key, and `OPENAI_MODEL` and `ANTHROPIC_MODEL` the agent's `model`.
  A sandboxed stage gets them in its sandbox spec's `env`. Without an inference adapter, the foreman sets none of them,
  as before.
- **The port's scenarios** gain one each for the Anthropic Messages API (`POST <url without /v1>/v1/messages`, which
  Claude Code calls) and the OpenAI Responses API (`POST <url>/responses`, which Codex calls), with the same key and
  alias rules as chat completions. LiteLLM serves both and translates them for the provider.

### Take over

- **Two signals.** `POST /v1/runs/{runId}/signals` takes `{ "type": "take-over" }` and `{ "type": "hand-back" }`.
- **Take over** needs a running stage, else 409 with `no stage of <run ID> is running`. The running stage's activity
  sees the take-over within `FOREMAN_POLL_MS`, as it sees steering messages, and cancels the agent's turn. A sandboxed
  stage copies its files out and destroys its sandbox, as after any turn. The stage is `blocked` with `takenOverAt`, the
  run is `blocked`, and the run shows `folder`: the run's folder on the foreman's machine, which holds the stage's files.
- **The person's context** is the run's folder, the stage's harness `sessionId` (its adapter's `transcript` command
  shows the session), the run's `pullRequest` and the work item.
- **Hand back** needs a stage a person took over, else 409 with `nobody took over <run ID>`. The stage is `succeeded`,
  and the run goes on with the next stage, from the files in the run's folder, or is `complete` after the last stage.
- A cancel ends a run a person took over, like a run at a gate.
- **Contracts.** `RunSignalType` gets `take-over` and `hand-back`, `StageView` gets `takenOverAt` and `RunView` gets
  `folder`: minor changes.

### testkit

- **`fakes.inference()`** is a deterministic inference adapter, as `fakes.sandbox()` is a sandbox adapter: a program
  with `start`, `key`, `spend-log`, `stop` and `list`. `start` records the config's text and prints the ID
  `000000000001` and on, with the URL from its options (default `http://127.0.0.1:4000/v1`); it serves nothing there.
  `key` prints `sk-fake-1` and on and records the gateway, the run and the budget. `fakes.inference({ fails })` makes
  every command exit 1 with that message.
- **`fakes.harness()`** records the model variables (`OPENAI_*`, `ANTHROPIC_*`) of the agent's environment with each
  session it opens, so a test sees what a module handed the harness.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The gateway's config and budget in `factory.yaml` | The factory's desired state holds its routing and its cost limit; versioned with the factory | One more field in the contract |
| The config and budget as variables of the foreman | No contract change | Routing and budgets live outside the factory and its review |
| One gateway while the foreman serves | ADR 0056's "one gateway per factory"; a start of 25 seconds once | The spend log is gone after `stop`; ledger must read it while the foreman serves |
| One gateway per run | Each run's spend log apart | 25 seconds and two containers per run |
| The key in memory per run | No credential in Temporal's history | A restart gives a run a new key with a fresh budget |
| The key in the workflow's state | Survives a restart | The key in plain text in the history; useless anyway with a new gateway after a restart |
| All six variables for every harness | The foreman needs no knowledge of each harness | Two unused variables per stage |
| A variable mapping per harness adapter | Exactly the variables each adapter reads | The foreman knows each adapter; a new adapter needs a foreman change |
| Take over by signal, the files in the run's folder | Same path as steering and cancel; the run's folder already holds the files after every stage | The person works on the foreman's machine, or through the run's pull request |
| A person resumes the agent's session itself | Full context of the agent | Only harnesses whose sessions load; a sandboxed session is gone with its sandbox |
| Hand back counts the stage as succeeded | The person finished the stage's work; the next stage starts from it | A person who wants the agent to try again cancels and starts over |

## Prior art

- The inference port and the litellm adapter (ADR 0056): adopted as they are; the port gains two scenarios for APIs
  LiteLLM already serves.
- LiteLLM proxy (MIT, BerriAI, very active, v1.106.2): its `/v1/messages` and `/v1/responses` routes, adopted with the
  adapter's pinned image.
- Temporal's signals and queries (MIT, Temporal Technologies, very active), already used for steering (ADR 0067):
  adopted for take over and hand back.
- OpenHands (MIT, very active) lets a person type into a running conversation and pause the agent. Checked: it has no
  hand back to a later stage of a pipeline, and it is not a port.
- GitHub Copilot coding agent and Devin let a person check out the agent's branch and go on by hand. Checked: closed
  services; the pattern, the files and the pull request as the context, is the one used here.

No new dependency.

## Consequences

- A factory's agents reach their models through one gateway with a budget per run, and each agent's `model` takes
  effect. A company with its own gateway names it in the config (ADR 0056).
- The run's key enters a sandbox as a variable. It is limited by the run's budget. Revisit when the egress proxy puts
  in the key for the gateway's host (ADR 0056), and when a sandbox must reach a gateway on the foreman's host.
- A gateway lives as long as the foreman serves; its spend log goes with it. Revisit when ledger reads the spend log
  at the end of each run.
- A person who takes over works in the run's folder on the foreman's machine. A remote foreman needs the run's pull
  request as the hand-over; revisit with the console (T-18).
