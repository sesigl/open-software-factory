---
status: accepted
date: 2026-11-08
---

# 0087. Each run is one trace

## Context

The foreman runs every stage of a run, but it records nothing outside Temporal's history. runlog can export an agent
session as a run record, and `runlog attach` puts it into the trace of the launcher's `TRACEPARENT` (ADR 0027), but
no launcher sets that variable. So the trace store of the Compose profile stays empty, the console's trace link leads
nowhere, and the improvement path sees a factory run only when a person exports its session by hand (principle P6).
The review of the whole stack marked this as a P0 gap for v1 (`TODO.md` T-24).

## Decision

- **One trace per run.** With `OTEL_EXPORTER_OTLP_ENDPOINT` (or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`), `foreman serve`
  sends OTLP/JSON to the receiver: a span `stage <stage>` when a stage ends, and a span `run <factory>` when the run
  ends. The stage spans are children of the run's span.
- **IDs from the run's ID.** The trace ID is the first 32 hex digits of the SHA-256 of the run's ID; the run's span ID
  the next 16; a stage's span ID the first 16 of the SHA-256 of `<run ID>:<stage index>`. A foreman that restarts, and
  every tool that knows the run's ID, names the same trace without a store.
- **The harness joins the trace.** Each stage's harness gets `TRACEPARENT=00-<trace ID>-<stage span ID>-01`, in the
  sandbox too. Claude Code puts its own spans below it, and `runlog attach` puts the session's run record there.
- **What the spans hold.** The resource has `service.name` `foreman`, `osf.run.id`, `osf.work_item.id`,
  `osf.factory.version` and, on a stage span, `osf.stage`. A stage span has `osf.stage`, `osf.agent`,
  `osf.harness.name`, `gen_ai.request.model`, `osf.effort`, `gen_ai.conversation.id` (the harness session) and
  `osf.outcome`; the run's span has `osf.factory`, `osf.pull_request` and `osf.outcome`. No prompt and no secret.
- **Never a failed stage.** A receiver that refuses a span or does not answer within 5 seconds is a warning.
- **Standard variables.** The receiver comes from the OpenTelemetry variables, with `OTEL_EXPORTER_OTLP_HEADERS`, so
  the profile points the foreman at Phoenix or Langfuse without a variable of our own.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The foreman sends its own spans (chosen) | It knows every stage, agent, model and outcome; no new process | The foreman builds OTLP/JSON itself |
| The OpenTelemetry SDK for Node | Batching, retries, the standard API | A large dependency and a global provider for two spans per stage; the IDs must still come from the run |
| Only `TRACEPARENT`, and the harness exports | No code in the foreman | A harness that exports nothing leaves no trace; the run's own span and the stage outcomes are missing |
| runlog watches the harness folders in the profile | Reuses runlog | One more service; a trace per session, not per run |

## Prior art

- **OpenTelemetry OTLP/HTTP with JSON** (CNCF, Apache-2.0): the wire format; every trace store of the profile takes it.
- **W3C Trace Context** (`traceparent`): the variable that Claude Code and runlog read.
- **OpenTelemetry JS SDK** (Apache-2.0, maintained): checked, not adopted; see the options.
- **Temporal's OpenTelemetry interceptors** (`@temporalio/interceptors-opentelemetry`, MIT): trace the workflow and
  activity calls, not stages and agents, and need the SDK. Not adopted for the same reason.

## Consequences

- With the endpoint set, every run shows up in the trace store with its stages, and the console's trace link can find
  it by `osf.run.id`.
- A stage span is sent once per attempt of its activity; a retried stage shows as two spans with the same span ID.
- The session's tokens and cost join the stage span through the harness's `transcript`, not runlog's `attach`
  (ADR 0121).
