---
status: accepted
date: 2026-11-10
---

# 0100. Jaeger as the trace store of the Compose profile, and foreman does not wait for it

## Context

The Compose profile ran Arize Phoenix as its trace store (ADR 0074, ADR 0087). foreman sends each run as one trace
with a span for each stage, by OTLP/HTTP, and the console links each run to its trace by a URL template with
`{traceId}`. No module uses a feature that only Phoenix has: no LLM span view, no evaluations, no score API.

Two facts made Phoenix a poor fit:

- **License.** Phoenix has the Elastic License 2.0, which is not an open-source license. It forbids offering Phoenix
  as a hosted or managed service. A faster image of Phoenix of our own would make this project distribute a changed
  copy of it.
- **Start time.** After ADR 0098 and ADR 0099, Phoenix was the last service of the profile to be ready: 13.4 s on a
  developer's machine, because its image compiles its 15884 Python files at each start. foreman waited until it was
  healthy, so Phoenix was the critical path of `docker compose up --wait`, which the deploy and e2e suites run 11
  times.

## Decision

- The profile runs Jaeger v2 (`jaegertracing/jaeger:<version>`) as its trace store, with the configuration in
  `deploy/compose/jaeger/config.yaml`: OTLP/HTTP on port 4318, its traces in Badger on the volume `jaeger` for 30 days,
  and its UI on `JAEGER_PORT` (16686). foreman sends to `http://jaeger:4318`; the console links `/trace/{traceId}`.
- foreman waits until Jaeger has started, not until it is healthy: it sends a span when a stage or a run ends, and a
  span that it cannot send is a warning. `docker compose up --wait` still waits until Jaeger is healthy.
- Phoenix leaves the profile with its database.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Jaeger v2 | Apache-2.0, a CNCF graduated project; one Go program with OTLP and a UI; healthy 0.05 s after its start; storage on a volume | Traces only: no LLM views and no scores |
| Phoenix, with our image with compiled bytecode | LLM views; 6.6 s start | Elastic License 2.0; we would distribute a changed copy |
| Phoenix as it is | Nothing to change | Elastic License 2.0; 13.4 s start, the critical path of the profile |
| Langfuse | MIT for its core; LLM views and scores | Needs ClickHouse, Redis and S3; its `ee/` folders have a commercial license |
| Grafana Tempo | Mature | AGPL-3.0, and Grafana for its UI |

## Prior art

Jaeger (Apache-2.0, CNCF graduated, a release each month) is the trace store of many OpenTelemetry installations.
Its v2 is built on the OpenTelemetry Collector and takes OTLP directly. Checked as above: Phoenix (Elastic License 2.0),
Langfuse (MIT core, commercial `ee/`), Grafana Tempo (AGPL-3.0), SigNoz (MIT core with enterprise parts, ClickHouse).

## Consequences

The profile is ready sooner, and it holds no software with a license that forbids a hosted service. Jaeger shows the
traces of runs, but no LLM details; a span of a stage that ends in the first moment after a start, before Jaeger
listens, is lost with a warning in foreman's log. The traces of an installation that ran Phoenix stay in its
database `phoenix`, which the profile no longer uses. Revisit when a module needs scores or LLM views in the trace
store: then Langfuse, outside or inside the profile.
