---
status: accepted
date: 2026-10-23
---

# 0056. The inference port is a command line; the litellm adapter runs LiteLLM with PostgreSQL on Docker

## Context

TODO item T-14 asks for one OpenAI-compatible endpoint for every harness, with routing aliases, budgets per run and
a spend log line per call that names the run (`osf.run.id`). It names LiteLLM as configuration, not a fork. The
vision asks that the model of one agent changes without touching another (SCN-FACTORY-OPEN-001), that a company
uses its own gateway or a fine-tuned model (OPEN-003, OPEN-004), and that a benchmark result becomes a routing rule
(BENCH-006). The principles say "cost is bounded".

Two modules already speak LiteLLM: taskcapture's `route` writes a LiteLLM config that sends a tag of an alias to a
model (ADR 0045), and ledger reads LiteLLM's spend log rows as `GET /spend/logs` returns them, with the run in
`metadata.spend_logs_metadata."osf.run.id"` (ADR 0034). The harness adapters take a base URL and a key for their
model API (ADR 0052, ADR 0053). Modules may not import adapters (ISOLATION), so foreman needs a way to start the
gateway and get a key per run without a library call, as for the sandbox port (ADR 0054).

## Decision

- **The port is a command line plus the gateway's HTTP API.** An inference adapter is a program with five commands.
  Their shared behavior is the `@conformance` scenarios in `ports/inference/features/` (prefix `SCN-INFER`):
  - `start <config>` runs a gateway from the adapter's config and prints one JSON line `{"id", "url"}`. `url` is the
    base URL of the OpenAI-compatible API, ending in `/v1`.
  - `key <ID> <run ID> [--budget <USD>]` prints a key for one run. Calls with it are logged with the run's ID and
    are refused once the run's spend passed the budget.
  - `spend-log <ID>` prints one JSON line per call the gateway answered before the command started.
  - `stop <ID>` removes the gateway and all its data. `list` prints the IDs of the gateways.
  - A harness calls `POST <url>/chat/completions` with a routing alias as `model` and the run's key as bearer token.
    A call with another key gets 401, a call for an alias the config does not route gets 400 and names it.
- **The config is the adapter's own format.** Routing rules are what a gateway product configures best, and the
  factory already writes LiteLLM's format (taskcapture). The port does not add a format of its own to `contracts/`.
  A provider key is a reference to a variable of the adapter, never a value in the config.
- **The first adapter is `adapters/inference/litellm`** (`@opensoftware/inference-litellm`, core). `start` reads a
  LiteLLM proxy config (`model_list`, `router_settings`, `litellm_settings`) and runs two containers on their own
  Docker network: PostgreSQL (`postgres:18-alpine`, pinned by digest) and the LiteLLM proxy
  (`ghcr.io/berriai/litellm:v1.106.2`, pinned by digest). The adapter adds three settings: a master key it makes
  for this gateway, the database, and writing spend rows every second. It publishes the proxy on a free port of
  `127.0.0.1`. The master key and the database password live only in the containers' environment; the adapter
  keeps no state of its own and finds a gateway's parts by name and label, as the docker sandbox adapter does.
  - **Keys and budgets:** `key` makes a LiteLLM virtual key with `max_budget` and the key metadata
    `spend_logs_metadata: {"osf.run.id": <run ID>}`, so every spend row of the key names the run.
  - **Spend log:** `spend-log` prints the rows of `GET /spend/logs`, the format ledger already reads. LiteLLM
    writes rows in batches every one to six seconds, so the command waits seven seconds before it reads.
  - **Provider keys:** the config names them as LiteLLM does, `os.environ/<NAME>`. The adapter hands each named
    variable from its own environment to the proxy's container; the value is never on a command line.
  - **Tags:** a call's `tags` pick the deployment of an alias with that tag (LiteLLM's `enable_tag_filtering`), as
    `taskcapture route` configures it.
- **A company's own gateway** is a provider of the config: its URL as `api_base` and its key as `os.environ/<NAME>`.
  A company that wants no bundled gateway at all points the harness adapters at its gateway's URL; they already take
  one (`ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`), and `factory render --k8s` takes `FACTORY_INFERENCE_URL`.
- **Messages and Responses APIs** (Claude Code, Codex) are LiteLLM features too. They join the port's scenarios
  when foreman starts harnesses against the gateway (T-17).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A command line per adapter, LiteLLM with PostgreSQL | Same shape as the sandbox port; ISOLATION holds; keys, budgets and spend rows are LiteLLM's own, in the format ledger reads | Two containers and about 25 seconds to start; spend rows arrive in batches |
| LiteLLM without a database | One container, starts in seconds | No virtual keys, no budgets per key, no spend rows |
| A port format in `contracts/` for routes and budgets | Adapter-independent config | A second format next to LiteLLM's, which taskcapture already writes; a translation for each gateway product |
| A gateway of our own in TypeScript | No Python container | Rebuilds routing, provider APIs, pricing and budgets; "adopt before you build" |

## Prior art

- LiteLLM proxy (MIT, BerriAI, very active, v1.106.2 from October 2026): an OpenAI-compatible gateway for over a
  hundred providers, with routing aliases, tag routing, virtual keys with budgets and a spend log in PostgreSQL. The
  features used here are in the MIT part; nothing of its `enterprise` folder is used. Adopted as the bundled gateway,
  run from its official image with configuration only.
- PostgreSQL (PostgreSQL License, active, 18): LiteLLM's only supported database. Adopted from the official image.
- agentgateway (Apache-2.0, Linux Foundation, active): MCP and LLM gateway with routing and CEL policies. Checked, not
  adopted: no budgets per key and no spend rows in the format ledger reads. It stays a candidate for a community
  adapter of this port.
- Portkey AI Gateway (MIT, active), Bifrost (Apache-2.0, Maxim, active), Envoy AI Gateway (Apache-2.0, active), Kong
  AI Gateway (Apache-2.0 core): OpenAI-compatible gateways with routing. Checked: budgets per key and spend logs are
  in their hosted or paid parts, or need a second component. Left to community adapters.
- Docker CLI (Apache-2.0): the adapter's client, as in ADR 0054.

## Consequences

- foreman starts one gateway per factory, asks for a key per run with the run's budget, and hands the URL and key to
  the harness. ledger ingests the spend log as it is.
- A model change of one agent is one line of the config; a benchmark result is applied by starting the gateway with
  the config `taskcapture route` wrote.
- The gateway holds the provider keys. It runs outside every sandbox; a sandbox reaches it through its egress proxy,
  which puts in the run's key for the gateway's host.
- `spend-log` takes seven seconds. A caller reads it at the end of a run, not per call.
- A community adapter is any program that passes `ports/inference/features/` with `testkit conformance`.
- Revisit when LiteLLM writes spend rows on request, or when a second adapter needs a config format the port shares.
