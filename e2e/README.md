---
covers: [e2e/compose/**, e2e/images/**, e2e/scripts/**, e2e/factory/**, e2e/paid/**]
---

# e2e

The end-to-end smoke scenarios of the factory. Each scenario starts the [Compose profile](../deploy/README.md) with
every module built from this workspace, and the testkit's fakes in place of Slack, the coding agent, the model and
the forge. Nothing calls a real service. Decision: [ADR 0076](../docs/decisions/0076-e2e-smoke-suite.md).
The one exception is the paid smoke run below, which only `make smoke-paid` starts.

## Run it

You need Docker with Compose 2.24 or later.

```sh
make smoke                         # every scenario of features/smoke.feature
make test-scenario ID=SCN-E2E-001  # one scenario
```

`test:system` first builds the image `osf-e2e:workspace` with `scripts/images.ts`: `pnpm pack` of every program of
the factory and its workspace dependencies, installed with npm by [`images/Dockerfile`](images/Dockerfile). Behind
a proxy that inspects TLS, set `OSF_BUILD_CA` to the proxy's CA file, as for the profile's images.

## How a scenario runs

- [`compose/compose.yaml`](compose/compose.yaml) includes the profile's `deploy/compose/compose.yaml` and
  [`compose/override.yaml`](compose/override.yaml). The override runs every module from the workspace image with the
  fixed clock `2026-01-01T00:00:00Z` and points the modules at the fakes.
- The fakes run on the Docker host. Containers reach them at `host.docker.internal`, which the override maps to the
  host gateway.
- foreman starts the testkit's scripted agent with `harness-acp run`. The agent's turns edit files and run commands
  like a coding agent's tools: the implement turn clones the Forgejo repository, pushes a branch and opens a pull
  request.
- A scenario's agent can run in a sandbox of the docker sandbox adapter, started from the workspace image, which holds
  the scripted agent at `/opt/osf/harness-agent.ts`. The agent then takes its script over HTTP from the testkit, and
  gets the forge token as the placeholder of the secret `ref:env/FORGE_TOKEN`.
- observer and taskcapture are services of the Compose profile `tools`: `docker compose run --rm observer <command>`
  works on the scenario's folder as `/work`.
- [`factory/`](factory/) is the scenario's factory: the agents' prompts, the group `maintainers` and the gate
  policy. Each scenario writes its own `factory.yaml` next to them.

## Configuration

The scenario writes these values into its `.env`, next to the profile's own values
([deploy/README.md](../deploy/README.md#configuration)).

| Variable | Meaning |
| --- | --- |
| `E2E_SLACK_URL` | The fake Slack's Web API as containers reach it; gatekeeper and intake post there. |
| `E2E_HARNESSES` | foreman's `FOREMAN_HARNESSES`: the harness `acp` starts the scripted agent with `harness-acp run`. |
| `E2E_AGENT_DIR` | The folder of the scripted agent's code and its dependencies, mounted read-only into foreman at the same path. |
| `E2E_HARNESS_DIR` | The folder of the agent's script and log, mounted into foreman at the same path. |
| `E2E_FORGE_URL` | The Forgejo of the scenario as containers reach it, for `docker compose run factory`. |
| `E2E_FORGE_TOKEN` | Its API token, for factory, observer and taskcapture, and foreman's `OSF_SECRET_FORGE_TOKEN`, the secret `ref:env/FORGE_TOKEN` of a sandboxed agent. |
| `E2E_WEBHOOK_SECRET` | The secret of the webhooks that `factory apply` creates. |
| `E2E_WORK_DIR` | The folder that observer and taskcapture see as `/work`. Default: `./work`. |
| `E2E_USER` | The user and group that observer and taskcapture run as, `<uid>:<gid>`: the scenario's own, so it owns and removes what they write. Default: `node`. |
| `E2E_MODEL_URL` | The scripted model gateway as containers reach it, ending in `/v1`: observer's model, LiteLLM's OpenAI base URL and the scripted Harbor's model. |
| `E2E_HARBOR` | taskcapture's `TASKCAPTURE_HARBOR`. Default: `harbor`. |
| `E2E_LITELLM_CONFIG` | The LiteLLM config file the profile's gateway serves. The scenario copies the profile's config unless it names another. |

## Paid smoke run

`SMOKE-PAID` ([`paid/harness.paid.ts`](paid/harness.paid.ts)) holds the live tests: tests against the real, paid
service, without fakes ([kinds of tests](../docs/quality/testing-strategy.md#kinds-of-tests)). It starts each first-party harness with a real model and
asks it to fix the typo "helo" in `notes.md`. A run passes when the turn ends with `end_turn`, the file says "hello
world", and the run record has output tokens and, when the harness reports a cost, a cost of at most 0.20 USD. It is
no system test: it has no scenario, uses no fakes and runs without the network guard. Decision:
[ADR 0077](../docs/decisions/0077-paid-dogfood.md).

- **opencode** calls [OpenRouter](https://openrouter.ai) on its chat completions API. The workflow `weekly-paid.yml`
  runs it once a week in the environment `smoke-paid`.
- **claude-code** runs only on your own machine, on your Claude subscription. It never runs in CI: a subscription
  belongs to one person. It runs twice: once directly, and once in a sandbox of the docker sandbox adapter, from the
  agents' template of the reference factory. In the sandbox, `CLAUDE_CODE_OAUTH_TOKEN` holds only its placeholder,
  and the run passes only when the egress proxy put the token in on the way to `api.anthropic.com`. The sandboxed
  run needs Docker. Run both again when the sandboxes' template, its Claude Code or the reference factory's egress
  hosts change, before a release of the profile or the chart, and when a stage fails at its first turn with an error
  of authentication ([live tests](../docs/quality/testing-strategy.md#live-tests)).
- **codex** calls OpenRouter on its Responses API with the same key and model, also once a week. Codex knows no
  OpenRouter model, so harness-codex adds the model to Codex's model catalog, and Codex offers it its edit tool
  `apply_patch` (`SCN-HCODEX-012`). harness-codex reports no cost; the key's credit limit is the hard limit.

```sh
OPENROUTER_API_KEY=<key> OPENAI_MODEL=deepseek/deepseek-v4.1-flash-1017 make smoke-paid
CLAUDE_CODE_OAUTH_TOKEN=<token of claude setup-token> pnpm --filter @opensoftware/e2e test:paid -t claude-code
```

| Variable | Meaning |
| --- | --- |
| `OPENROUTER_API_KEY` | The OpenRouter key of opencode and codex. Its credit limit is the hard limit of the budget, and it allows only the weekly run's model. |
| `OPENAI_MODEL` | The OpenRouter model of opencode and codex. Weekly: `deepseek/deepseek-v4.1-flash-1017`. |
| `CLAUDE_CODE_OAUTH_TOKEN` | A token of `claude setup-token`. Only when it is set does claude-code run, on your subscription; the run fails when `CI` is set too. |
| `ANTHROPIC_MODEL` | The model of claude-code. Default, also when it is empty: `claude-haiku-5-5`. |

Each adapter gets only these variables, `PATH`, and its own temporary `HOME`, `OUTPUT` and `OSF_DATA`.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-E2E-001 | implemented | A request in chat becomes a pull request with evidence |
| SCN-E2E-002 | implemented | Approval at a human gate releases the waiting work |
| SCN-E2E-003 | implemented | A repeated failure becomes a pull request to the factory |
| SCN-E2E-004 | implemented | A benchmark result becomes a routing rule |
| SCN-E2E-005 | implemented | A manual change to a running factory is reported as drift |
| SCN-E2E-006 | implemented | An agent in a sandbox pushes to the forge with a placeholder, and holds no token of the foreman |

## Paid reference run

[`paid/reference/run.sh`](paid/reference/run.sh) starts a Forgejo with a tiny sample repository and an issue, starts
the profile from the workspace image with the factory of [`paid/reference/factory/`](paid/reference/factory/): the
reference factory's implement stage on opencode, with LiteLLM in front of OpenRouter and a budget of 0.50 USD. It
submits the issue as a work item and succeeds when the run completed and the sample repository has an open pull
request. Only the workflow `paid-reference-run.yml` runs it, started by a maintainer or an admin; `make smoke-paid`
does not ([ADR 0128](../docs/decisions/0128-paid-reference-run.md)).

## Paid factory run

[`paid/factory/run.sh`](paid/factory/run.sh) runs the factory of [`paid/factory/factory/`](paid/factory/factory/) on
one issue of this repository on github.com: it fails unless the issue is open and carries the label `factory`, then
the implement stage on opencode, with the same model and budget, follows `AGENTS.md`, runs `make check-fast`, pushes
`factory/issue-<n>` and opens the pull request. The forge token reaches only `~/.netrc` of foreman's container. Only
the workflow `paid-factory-run.yml` runs it, started by a maintainer or an admin with
`gh workflow run paid-factory-run.yml -f issue=<number>`; a pull request it opens starts no CI until a maintainer
pushes to it or re-runs its checks, and a person reviews it. Both paid runs share [`paid/lib.sh`](paid/lib.sh).
