---
status: accepted
date: 2026-11-10
---

# 0099. foreman starts the inference gateway in the background

## Context

`foreman serve` started its inference gateway first (ADR 0070), and exited with code 1 when the adapter's `start`
failed. With the config `osf.proxy`, the start attaches to the profile's or the chart's LiteLLM, and fails while
LiteLLM is not ready. So the Compose profile makes foreman depend on a healthy `litellm`, and the chart gives foreman an
init container that waits for it. foreman's own start (Temporal, NATS, its worker and API) comes only after LiteLLM is
ready, and every start of the profile or the chart pays both one after the other. This made the deploy suite's chart
scenarios about twice as slow on CI when the chart got LiteLLM.

## Decision

- `foreman serve` starts the gateway in the background and takes work at once. A failed `start` is a warning, and the
  server tries again after `FOREMAN_INFERENCE_RETRY_MS` (default 1000 ms) until a start succeeds or the server stops.
- A stage waits for the gateway before it asks for the run's key.
- `/v1/health` has the check `inference`, which fails with the last failed start's message until the gateway runs. So
  a readiness probe or a health check that reads `/v1/health` sees foreman ready only when it can serve a stage.
- After the release of this foreman, the profile and the chart drop their waits for LiteLLM, so foreman and LiteLLM
  start side by side.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Start in the background, with retries and a health check | foreman and LiteLLM start side by side; the reason of a failure stays visible on `/v1/health` | A wrong config no longer stops the server; it shows only as a failing health check and warnings |
| Start first, exit on failure (before) | A wrong config stops the server at once | foreman's start waits for LiteLLM's every time |
| Retry inside the inference adapter's `start` | No change in foreman | Each adapter would need its own retries, and foreman would still wait before it serves |

## Prior art

No new dependency. Waiting for a dependency in the background while health reports it is the pattern of Kubernetes
readiness probes, which the chart already uses.

## Consequences

A factory whose gateway never starts keeps a running, unready foreman that names the failure on `/v1/health`, instead
of a container that exits and restarts. A stage started before the gateway runs waits for it. SCN-FORE-056 is replaced
by SCN-FORE-086.
