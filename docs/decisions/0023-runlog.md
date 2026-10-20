---
status: accepted
date: 2026-10-20
---

# 0023. runlog exports harness session files as OTLP run records

## Context

TODO item T-04 asks for runlog: every Claude Code, Codex or OpenCode session of a team in one trace store, with
cost and pull request links. The `run-record` contract (ADR 0012) fixes the attribute names: the factory attributes
on the resource, GenAI names on the root span `invoke_agent`, all carried as OTLP. internals.md describes three
steps: correlate at launch with `OTEL_RESOURCE_ATTRIBUTES`, normalize native harness telemetry in the Collector,
and complete the run from the session file. Native traces are still beta (Claude Code) or use internal span names
(Codex), and a developer's local sessions have no telemetry at all. The session files are the one source every
harness writes.

This change is the first slice of T-04: `runlog export` for Claude Code and Codex session files.

## Decision

- **New core module `modules/runlog`** (TypeScript, prefix `SCN-RUN`), published later as `@opensoftware/runlog`.
  Layers: `entry` (`src/cli.ts`) → `commands` → `adapters` → `domain`. `domain` holds the pure mapping from a
  session file to a run; `adapters` read the file, ask Git and write or send OTLP.
- **`runlog export <session file> [--include-content]`** detects the harness from the file (a `session_meta` line
  means Codex; lines with `sessionId` and type `user` or `assistant` mean Claude Code) and maps it to one trace:
  the root span `invoke_agent`, one `chat <model>` span per model response and one `execute_tool <name>` span per
  tool call, with the GenAI attribute names pinned in the contract. Claude Code writes each content block of a
  response on its own line with the same message ID and usage; runlog counts the response once. Codex ends each
  response with a `token_count` event and sometimes repeats it; runlog skips a repeat with the same total.
- **Input tokens include cached tokens**, as the GenAI conventions ask. For Claude Code that is
  `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`; Codex already counts them that way.
- **Deterministic IDs.** The trace ID is the first 16 bytes of SHA-256 of `<harness>:<session ID>`; span IDs hash
  the trace ID with the response index or the tool call ID. Exporting a session twice gives the same trace, so a
  backend can deduplicate, and system tests need no seed.
- **Attribution.** `OTEL_RESOURCE_ATTRIBUTES` wins (read with the SDK's `envDetector`). What it lacks, runlog fills:
  `osf.run.id` and `osf.work_item.id` from the session ID, `osf.requester.id` as `git:<author email>`,
  `osf.source` as `cli`, `osf.factory.version` as `HEAD` of the Git repository in the current folder. The run is
  validated against the `run-record` contract before it leaves; a broken run is not exported.
- **Pull request links.** URLs ending in `/pull/<n>` or `/pulls/<n>` in tool results become
  `osf.pull_request.urls` on the root span. They are metadata, so they are kept without `--include-content`.
- **Prompt content is opt-in.** Without `--include-content`, no prompt, answer, tool argument or tool result
  leaves the machine. With it, they go into `gen_ai.input.messages`, `gen_ai.output.messages`,
  `gen_ai.tool.call.arguments` and `gen_ai.tool.call.result`.
- **Sinks.** Without an endpoint, export appends one OTLP/JSON `ExportTraceServiceRequest` per run to
  `$OUTPUT/runs.jsonl` (the line format of the Collector's `file` exporter and `otlpjsonfile` receiver). With
  `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, it sends the run with the SDK's OTLP/HTTP
  JSON exporter, which retries on 429, 502, 503 and 504. runlog reaches no other host.
- **`osf.outcome` is `succeeded`.** A session file does not say whether the work succeeded; the launcher that knows
  it (the foreman) will set the outcome when it attaches the run.
- **testkit `fakes.http`** gets `times` on a route (answer only that many requests, then the next matching route)
  and `received()` (every request with its JSON body), so a system test can script an outage and read what a
  module sent (`SCN-TK-029`, `SCN-TK-030`).
- **Later slices of T-04:** `runlog watch` and `runlog attach` (complete a native OTel run from its session file
  when the stage ends), OpenCode storage, the Collector config pack per harness (`collector/`), Agent Trace line
  attribution, the npm release and the dogfood export of this repository's sessions.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Read session files, write OTLP (chosen) | Works for every harness today, also for local sessions without telemetry; full transcript available | Session formats are not documented and can change; one parser per harness |
| Only native harness OTel through a Collector | No parsing; vendor-maintained | Claude Code traces are beta, Codex uses internal span names, OpenCode is experimental; local sessions have nothing |
| A custom JSON run format | Simple to write | The contract says OTLP; every backend reads OTLP |
| Random span IDs from the SDK's tracer | Standard SDK path | Re-exports duplicate the run; tests need a seeded ID generator |
| Build `ReadableSpan` objects directly (chosen) | Exact start and end times from the file, deterministic IDs; the SDK still serializes and exports | Bypasses the tracer API |

## Prior art

- OpenTelemetry JavaScript SDK (Apache-2.0, CNCF, active, monthly releases). Adopted:
  `@opentelemetry/api` 1.9.1, `@opentelemetry/resources` 2.12.0 (`envDetector` for `OTEL_RESOURCE_ATTRIBUTES`),
  `@opentelemetry/sdk-trace-base` 2.12.0 (the `ReadableSpan` type),
  `@opentelemetry/otlp-transformer` 0.223.0 (OTLP/JSON for `runs.jsonl`) and
  `@opentelemetry/exporter-trace-otlp-http` 0.223.0 (sending with retries). Versions released 2026-10-06.
- OpenTelemetry Collector (Apache-2.0, active): the `file` exporter and `otlpjsonfile` receiver read the same
  JSON lines as `runs.jsonl`. The per-harness Collector config pack follows in a later slice.
- OpenTelemetry GenAI semantic conventions (Apache-2.0, Development status): attribute and span names, pinned in
  `contracts/run-record`.
- ccusage (MIT, active): reads Claude Code and Codex session files for token usage and cost reports. It confirmed
  the file locations and the usage fields, but it reports in a terminal and writes no OTLP. Not adopted.
- Claudescope and agentlogs (MIT, active): viewers of Claude Code transcripts. No OTLP export. Not adopted.
- Langfuse and Arize Phoenix integrations for Claude Code (MIT and Elastic-2.0): hook-based tracing into their own
  backends, not a vendor-neutral exporter. Not adopted.
- Agent Trace (line attribution): deferred to a later slice of T-04.

## Consequences

- A developer can turn any local Claude Code or Codex session into a run record in one command and send it to any
  OTLP backend, without a server or another module.
- The session file formats are undocumented. A harness update can break the mapping; the system tests pin the
  shapes runlog reads, and a new shape needs a new scenario.
- Cost (`osf.cost.usd`) is not in the session files; it comes from the inference gateway (ledger, T-08).
- Revisit when Claude Code traces leave beta: the Collector path may then replace parts of the file mapping.
