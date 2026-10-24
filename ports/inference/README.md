---
covers: [ports/inference/**]
---

# inference port

How every harness of the factory reaches a model: one OpenAI-compatible endpoint with routing aliases, a key and a
budget per run, and a spend log line per call that names the run. Decision:
[ADR 0056](../../docs/decisions/0056-inference-port.md).

## The interface

An inference adapter is a program with these commands. Its client (foreman, a script, a test) runs them as any
command line:

| Port operation | Command |
| --- | --- |
| start a gateway | `<adapter> start <config>` prints one JSON line `{"id", "url"}`; `url` ends in `/v1` |
| a key per run | `<adapter> key <ID> <run ID> [--budget <USD>]` prints the run's key |
| spend log | `<adapter> spend-log <ID>` prints one JSON line per call the gateway answered |
| stop | `<adapter> stop <ID>` removes the gateway and all its data |
| list | `<adapter> list` prints the IDs of the gateways |

The config is the adapter's own format: for [`litellm`](../../adapters/inference/litellm/README.md), a LiteLLM
proxy config, the format `taskcapture route` writes. An unknown gateway ID exits 1 with `no gateway <ID>`.

## What every adapter guarantees

- `POST <url>/chat/completions` with a routing alias as `model` reaches the model the config routes the alias to.
  Each alias keeps its own model, and a call's `tags` pick the alias's model for that tag.
- A call needs a key from `key`: another key gets 401. An alias the config does not route gets 400 with its name.
- A run's calls are refused with a 4xx status and the error type `budget_exceeded` once its spend passed its budget.
  The gateway counts a call's spend just after its answer, so a call sent at that moment may still pass; by the time
  the spend log shows the run past its budget, every further call is refused.
- Every call is a spend log line whose `metadata.spend_logs_metadata."osf.run.id"` is the run's ID, in the format of
  LiteLLM's spend rows that [ledger](../../modules/ledger/README.md) reads.
- A provider key is a variable of the adapter, `OSF_SECRET_<NAME>` as the secrets port's `env` provider names it,
  never a value in the config.
- `stop` removes the gateway's keys and spend log.

A company with its own gateway names it as a provider of the config, or points the harness adapters at its URL and
runs no inference adapter.

## Conformance

The shared behavior is the `@conformance` scenarios in [`features/`](features/inference.feature) (prefix
`SCN-INFER`). Every adapter in `adapters/inference/<name>/` has one system test per scenario. The test provider is
`fakes.http(routes, { containers: true })` at `host.docker.internal`, scripted with chat completions answers. A
community adapter shows conformance with `testkit conformance <its copy of this features folder> --junit report.xml`.

## Adapters

| Adapter | Tier | What it runs |
| --- | --- | --- |
| [`litellm`](../../adapters/inference/litellm/README.md) | core | The LiteLLM proxy with PostgreSQL on Docker, a virtual key with a budget per run |
