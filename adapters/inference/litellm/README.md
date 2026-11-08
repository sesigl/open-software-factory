---
covers: [adapters/inference/litellm/src/**]
---

# inference-litellm

One OpenAI-compatible model endpoint for every harness behind the factory's inference port: routing aliases, a key
and a budget per run, and a spend log line per call that names the run. It runs the
[LiteLLM proxy](https://github.com/BerriAI/litellm) with PostgreSQL on Docker, from your LiteLLM config.
Decision: [ADR 0056](../../../docs/decisions/0056-inference-port.md). The port's scenarios are in
[`ports/inference/features/`](../../../ports/inference/features/inference.feature), the adapter's own in
[`features/`](features/attach.feature).

## Quick start

Write a LiteLLM proxy config. Each `model_name` is a routing alias that agents name as their model:

```yaml
model_list:
  - model_name: routes/triage
    litellm_params:
      model: anthropic/claude-haiku-5-5
      api_key: os.environ/OSF_SECRET_ANTHROPIC_API_KEY
  - model_name: routes/implement
    litellm_params:
      model: openai/gpt-5.5
      api_key: os.environ/OSF_SECRET_OPENAI_API_KEY
```

Then:

```sh
export OSF_SECRET_ANTHROPIC_API_KEY=... OSF_SECRET_OPENAI_API_KEY=...
npx @opensoftware/inference-litellm start litellm-config.yaml   # {"id":"3f2a...","url":"http://127.0.0.1:32768/v1"}
key=$(npx @opensoftware/inference-litellm key 3f2a... run-7 --budget 2.5)
curl -H "authorization: Bearer $key" http://127.0.0.1:32768/v1/chat/completions \
  -d '{"model": "routes/triage", "messages": [{"role": "user", "content": "hello"}]}'
npx @opensoftware/inference-litellm spend-log 3f2a... > spend.jsonl   # ledger ingest reads it
npx @opensoftware/inference-litellm stop 3f2a...
```

A config that `taskcapture route` wrote works as it is: a call for its alias with `"tags": ["front-end"]` goes to
the model the benchmark chose.

## How it behaves

- **Two containers per gateway** on a network of their own: `osf-inference-<ID>` runs LiteLLM
  (`ghcr.io/berriai/litellm:v1.106.2`) and `osf-inference-<ID>-db` runs PostgreSQL 18. The proxy is published on a
  free port of `127.0.0.1`; `start` prints its base URL. The ID is 12 random hex digits.
- **The config** is yours, with three settings added: a master key made for this gateway, the database, and spend
  rows written every second (`proxy_batch_write_at: 1`). The master key and the database password are only in the
  containers' environment, never on a command line or in a file.
- **Provider keys** are named in the config as `os.environ/OSF_SECRET_<NAME>`, the variable of the secrets port's env
  provider. The Docker CLI hands each named variable from the adapter's environment to the LiteLLM container. Other
  variables of the adapter never reach it.
- **Keys and budgets.** `key` makes a LiteLLM virtual key with the run's budget as `max_budget` and the metadata
  `spend_logs_metadata: {"osf.run.id": <run ID>}`. Once the run's spend passed the budget, LiteLLM answers its calls
  with HTTP 400 or 422, the error type `budget_exceeded` and `Budget has been exceeded`. A key the gateway did not
  make gets 401, an alias the config does not route gets 400 with its name.
- **The spend log** is LiteLLM's spend rows as `GET /spend/logs` returns them, one JSON line each, oldest first: the
  format ledger reads. `metadata.spend_logs_metadata."osf.run.id"` names the run. LiteLLM writes rows every one to
  six seconds, so `spend-log` waits eight seconds before it reads.
- **Three APIs, one key.** Besides chat completions, the gateway serves the Anthropic Messages API at
  `<URL without /v1>/v1/messages` (the key as `x-api-key`), which Claude Code calls, and the OpenAI Responses API at
  `<URL>/responses`, which Codex calls. LiteLLM translates them for the provider; for an `openai/` model it calls the
  provider's Responses API.
- **A company gateway** is a provider like any other: its URL as `api_base` and its key as
  `os.environ/OSF_SECRET_<NAME>`. A company that wants no bundled gateway points the harnesses at its own URL instead.
- **No gateway of a launcher that ended.** With `OSF_INFERENCE_OWNER` (the process ID of the launcher, which the
  foreman sets), `start` labels the gateway with its owner and this host and first removes every gateway whose owner on this host no longer
  runs, like a foreman that was killed ([ADR 0090](../../../docs/decisions/0090-no-leaked-containers.md)).
- **No state of its own.** `stop` removes both containers, the database's volume and the network. Only an attached
  gateway has a record in `OSF_DATA` (see below).

## Attach to a running proxy

A client that runs in a container without Docker, such as foreman in the Compose profile, cannot start containers.
It attaches to a LiteLLM proxy that already runs instead, such as the profile's `litellm` service (ADR 0080). A config
whose top level has `osf.proxy` makes `start` attach:

```yaml
osf:
  proxy:
    url: http://litellm:4000
    master_key: os.environ/OSF_SECRET_LITELLM_MASTER_KEY
```

```sh
export OSF_SECRET_LITELLM_MASTER_KEY=...   # the proxy's master key
npx @opensoftware/inference-litellm start attach.yaml   # {"id":"3f2a...","url":"http://litellm:4000/v1"}
```

- **No container.** `start` starts nothing. It checks the proxy, its database and the master key with one call,
  `GET /key/list`. A proxy that does not answer exits 1. A key that the proxy refuses exits 1 with LiteLLM's status,
  such as 401. `start` does not wait for a proxy that is still starting; in Compose, let the client's service depend
  on the health check of the `litellm` service.
- **The master key** is a variable of the adapter that matches `OSF_SECRET_<NAME>`, named as
  `os.environ/OSF_SECRET_<NAME>`. Another name exits 2. Each command reads the key from that variable, so set it for
  `key`, `spend-log` and `stop` too.
- **The model routes are the proxy's own config.** `start` does not read or change them; the rest of the config is
  not used. Change the routes in the proxy's config.
- **The record.** `start` writes the gateway's ID, the proxy's URL and the name of the master key's variable to
  `OSF_DATA/gateways/<ID>.json`, never the key's value. `key`, `spend-log`, `stop` and `list` look there first, then on
  the Docker host.
- **Shared proxy.** Other clients can use the same proxy. `spend-log` prints only the calls of the run keys that this
  gateway made. `stop` deletes these keys with `POST /key/delete` and removes the record; the proxy and its spend
  rows stay.

Without `osf.proxy`, `start` runs its own LiteLLM and PostgreSQL as above.

## Commands

| Command | What it does |
| --- | --- |
| `inference-litellm start <config.yaml>` | Start a gateway from the LiteLLM config and print `{"id", "url"}` once LiteLLM answers and reaches its database. With `osf.proxy`, attach to that proxy instead. |
| `inference-litellm key <ID> <run ID> [--budget <USD>]` | Print a key for the run, refused once its spend passed the budget. |
| `inference-litellm spend-log <ID>` | Print one JSON line per call the gateway answered. |
| `inference-litellm stop <ID>` | Remove the gateway with its keys and spend log. For an attached gateway: delete its run keys and its record. |
| `inference-litellm list` | Print the IDs of the attached gateways and of the gateways on the Docker host. |

An unknown gateway ID exits 1 with `no gateway <ID>`.

## Releases

release-please opens a release pull request from the Conventional Commits under `adapters/inference/litellm/`.
Merging it creates the tag `inference-litellm-v<version>`. The workflow
`.github/workflows/publish-inference-litellm.yml` then builds the package and publishes it to npm as
`@opensoftware/inference-litellm`. The first release is `0.1.0`; until `1.0.0`, a breaking change raises the minor
version. The one-time setup is the same as for contracts ([`contracts/README.md`](../../../contracts/README.md#releases)).
No credential is stored in the repository.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `DOCKER_HOST` | string |  | The Docker daemon to use, as for any docker command. Default: the Docker CLI's current context. |
| `OSF_DATA` | string | `".inference-litellm"` | Folder where start records each gateway that it attached to a running proxy, as gateways/<ID>.json with the proxy's URL and the name of the master key's variable, and the hashed tokens of its run keys as gateways/<ID>.keys. It never holds a key's value. |
| `OSF_SECRET_*` | string |  | OSF_SECRET_<NAME> holds a value the config names as os.environ/OSF_SECRET_<NAME>, such as a provider key, or the master key of a running proxy that osf.proxy.master_key names. The Docker CLI hands a provider key to the LiteLLM container only; it is never in the config. |
| `OSF_INFERENCE_OWNER` | string |  | start: the process ID of the launcher that owns the gateway, like the foreman's. start labels the gateway with it and with this host, and removes the gateways whose owner on this host no longer runs (ADR 0090). Unset: the gateway has no owner and is never removed that way. |
