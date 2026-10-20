---
status: accepted
date: 2026-10-20
---

# 0025. runlog ships a Collector config per harness, proven against a real Collector

## Context

ADR 0023 and ADR 0024 shipped `runlog export`, `attach` and `watch`: runlog reads session files and writes runs.
TODO item T-04 also asks for an OpenTelemetry Collector config pack per harness. Its job is step 2 of the three
steps in [`internals.md`](../architecture/internals.md): the native telemetry of a harness goes through a Collector,
and a per-harness mapping renames its spans to the GenAI conventions that the session-file runs already use. Then a
trace store sees one shape, whether a span came from the harness or from runlog.

Checked before this decision (October 2026):

- Claude Code traces are beta (`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`, `OTEL_TRACES_EXPORTER=otlp`). The spans are
  `claude_code.interaction`, `claude_code.llm_request`, `claude_code.tool`, `claude_code.tool.execution`,
  `claude_code.tool.blocked_on_user` and `claude_code.hook`. Every span has `session.id`. `llm_request` has `model`,
  `input_tokens`, `output_tokens`, `cache_read_tokens` and `cache_creation_tokens`; `tool` has `tool_name` and
  `gen_ai.tool.call.id`; `interaction` has `user_prompt` (redacted unless `OTEL_LOG_USER_PROMPTS=1`). Source: the
  Claude Code monitoring documentation.
- Codex exports its internal tracing spans (`session_loop`, `handle_responses`, `turn/start`, `codex.exec` and
  others) under `[otel.trace_exporter.otlp-http]`. Model, tokens and prompts are on span events and log events, not
  on the spans. Source: the Opik Codex integration guide; the Codex source names the same spans.
- OpenCode traces come from the Vercel AI SDK telemetry: `ai.streamText` per agent step, `ai.streamText.doStream`
  per model call with `gen_ai.request.model` and `gen_ai.usage.*`, and `ai.toolCall` with `ai.toolCall.name`,
  `ai.toolCall.id`, `ai.toolCall.args` and `ai.toolCall.result`. Source: the AI SDK telemetry documentation.

## Decision

This is the third slice of T-04.

- **The pack.** `modules/runlog/collector/` holds one complete Collector config per harness: `claude-code.yaml`,
  `codex.yaml` and `opencode.yaml`. Each has an OTLP receiver (gRPC on `0.0.0.0:4317`, HTTP on `0.0.0.0:4318`), a
  `transform` processor with the mapping, and an `otlphttp` exporter with JSON encoding to
  `${env:OTEL_EXPORTER_OTLP_ENDPOINT}`, the same variable and encoding as `runlog export`. The files ship in the npm
  package.
- **`runlog collector <harness>`** copies the config of `claude-code`, `codex` or `opencode` to
  `$OUTPUT/collector.yaml` and prints its path. Any other harness exits with code 2 and names the three.
- **The mapping.** The root span of a turn becomes `invoke_agent` (`claude_code.interaction`, `session_loop`,
  `ai.streamText`), a model call becomes `chat <model>` (`claude_code.llm_request`, `handle_responses`,
  `ai.streamText.doStream`), a tool call becomes `execute_tool <tool>` (`claude_code.tool`, `ai.toolCall`), each with
  `gen_ai.operation.name`. Token counts go to `gen_ai.usage.*`, the session ID to `gen_ai.conversation.id`. The
  resource gets `osf.harness.name` unless the launch set it. Other spans and the resource attributes of the launch
  (`OTEL_RESOURCE_ATTRIBUTES`) pass through unchanged.
- **Content.** Like `runlog export` without `--include-content`, the pack deletes prompt and tool content:
  `user_prompt` (Claude Code), `ai.prompt`, `ai.prompt.messages`, `ai.response.text`, `ai.response.toolCalls`,
  `ai.toolCall.args` and `ai.toolCall.result` (OpenCode). The deletions sit in their own processor
  `transform/content`; to keep content, remove it from the pipeline.
- **Codex tool calls.** Codex has no tool span with the tool's name, so the pack maps none. Tool calls of a Codex
  stage come from its session file through `runlog attach` (ADR 0024).
- **Proof.** The testkit gets `fakes.collector(config)`: the real OpenTelemetry Collector Contrib
  (`otel/opentelemetry-collector-contrib:0.148.0`) in a container, like the service fakes of ADR 0016. `send(request)`
  posts OTLP/JSON to the config's OTLP/HTTP receiver on port 4318; the fake sets `OTEL_EXPORTER_OTLP_ENDPOINT` to its
  own receiver on the host and `exported({ count })` waits for what the Collector sent there. Each runlog scenario
  sends the native spans of a harness and checks the exported spans.
- **Not in this slice:** the dogfood export of this repository's sessions on every pull request. It needs a
  decision on where this repository keeps its runs; the pull request of this slice asks for it.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A static config file per harness, copied by `runlog collector` (chosen) | Readable YAML a team can fetch and edit; the CLI makes it testable | A team with two harnesses runs two pipelines or merges two files |
| One config for every harness, routed by span name | One Collector for a team | Every statement needs a harness condition; a new harness touches every user's config |
| Generate the YAML in TypeScript with options | Options such as `--include-content` | A YAML writer or dependency for a file a team edits anyway |
| Prove the mapping by reading the YAML in a test | No container | Proves nothing about OTTL; a wrong statement is silently skipped with `error_mode: ignore` |
| The Collector binary from `make install` instead of a container | No Docker | 50 to 100 MB per platform to pin and check; the other service fakes already use Docker |

## Prior art

- OpenTelemetry Collector Contrib (Apache-2.0, active) with the `transform` processor and OTTL: adopted. Its image is
  the proof in the system tests; teams run the same image.
- OpenTelemetry GenAI semantic conventions (Apache-2.0, active, development status): the target names, as pinned in
  `contracts/run-record/`.
- Opik's Codex integration (Apache-2.0, active) and SigNoz's OpenCode guide: send native traces to one vendor as
  they are. No mapping to the GenAI conventions. Not adopted.
- `@gcornut/opencode-otel` (an OpenCode plugin, active): emits its own spans from inside OpenCode. A plugin per
  harness, not a Collector config; license not checked. Not adopted.
- OpenLLMetry by Traceloop (Apache-2.0, active): instruments SDK calls inside an application. It cannot instrument a
  harness binary. Not adopted.

## Consequences

- A team points a harness at a Collector with the pack and gets `invoke_agent`, `chat` and `execute_tool` spans in
  its trace store, the same names that `runlog export` writes.
- Harness span names change while their traces are beta. The system tests pin the names this ADR lists; a renamed
  span passes through unmapped until the pack follows.
- runlog's system tests need Docker for the Collector scenarios, like the testkit's service fakes. The runlog budget
  rises from 60 to 120 seconds.
- T-04 stays open for the dogfood export.
