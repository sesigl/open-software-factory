---
status: accepted
date: 2026-11-14
---

# 0120. Deep checks of console doctor

## Context

`console doctor` and the page `/health` (ADR 0086) check each server, its token, the factory definition and the
groups file. They do not show that the model routes answer, that the harness starts, that a sandbox refuses a denied
host, that an event reaches the foreman or that a span reaches the trace store (`TODO.md` T-25). Some of these checks
cost money (a model call) or start processes, so they must not run on every page load or health probe.

## Decision

- **`console doctor --deep`** adds the deep checks after the ordinary ones. `/health` and `console doctor` without
  `--deep` never run them, so a health probe or a page view never makes a paid call.
- **`model <route>`:** one chat completion with `max_tokens: 1` per distinct `model` of the factory definition's
  agents, through the OpenAI-compatible gateway in `CONSOLE_MODEL_URL` (LiteLLM in the profile), with
  `CONSOLE_MODEL_TOKEN`. A 2xx answer is ok; another status names the route in the gateway's config and its provider
  key; no answer names `CONSOLE_MODEL_URL`.
- **`harness`:** the command line in `CONSOLE_HARNESS_COMMAND` runs with `sh -c`, gets the ACP request `initialize`
  on stdin and must answer it within 10 seconds; then the console ends it. The console speaks the one JSON-RPC line
  itself and does not depend on the ACP SDK.
- **`traces`** (added later in T-25), only when `CONSOLE_TRACES_URL` is set: one span `console doctor` of the
  service `console`, with a fresh random trace ID, goes by OTLP/HTTP JSON to `CONSOLE_OTLP_URL/v1/traces` (the
  collector, or Jaeger's own OTLP receiver in the profile); then the console asks Jaeger's query API
  `GET CONSOLE_TRACES_URL/api/traces/{traceId}` every 250 ms for 5 seconds. A refused or unanswered send names
  `CONSOLE_OTLP_URL`; a span that does not arrive names the collector's exporter and `CONSOLE_TRACES_URL`. The
  query API is Jaeger's HTTP API that the profile's Jaeger v2 already serves, so this needs no new service. System
  tests use `fakes.traceStore()` of the testkit, an in-process OTLP receiver with that query route.
- **Not yet:** a sandbox that starts and refuses a denied host, and a test event that reaches the foreman, stay an
  open slice of T-25. The first needs a sandbox adapter command that runs a probe and reports the refusal, a port
  operation with its `@conformance` scenario in `ports/sandbox` and both adapters; the second needs a NATS client in
  the console and a foreman route that shows a received test event. The console has neither today, and a check that
  cannot see its result would only pretend.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `console doctor --deep` (chosen) | One command, one list, opt-in cost | The deep list is not on `/health` |
| Deep checks on `/health` | The console shows everything | A model call per page view and per probe |
| A separate `osf doctor` tool | Could reach every port | A new tool for two checks; console already lists the servers |

## Prior art

LiteLLM has `/health`, which calls every model of its config; it needs the master key and checks the gateway's
routes, not the factory's. We call only the factory's routes through the same OpenAI API the harnesses use.
`kubectl`'s and `brew doctor`'s pattern of one line per check with a fix is what ADR 0086 already follows.

## Consequences

A person can see in one command that each route and the harness work before the first run. The remaining two
checks need new adapter capabilities; revisit when the sandbox port gets a probe and the foreman shows a test event.
