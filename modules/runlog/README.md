---
covers: [modules/runlog/src/**, modules/runlog/collector/**]
---

# runlog

Every agent session as one run record. runlog reads the session file of Claude Code, Codex or OpenCode and writes the
run as OpenTelemetry spans with the GenAI attribute names and the factory attributes of the `run-record` contract
([`contracts/`](../../contracts/README.md)). Any OTLP backend can store and show it. Decisions:
[ADR 0023](../../docs/decisions/0023-runlog.md), [ADR 0024](../../docs/decisions/0024-runlog-attach-watch-opencode.md),
[ADR 0025](../../docs/decisions/0025-runlog-collector-config-pack.md) and
[ADR 0027](../../docs/decisions/0027-runlog-dogfood-run-records.md).

## Quick start

This quick start is scenario `SCN-RUN-001` and is tested on every change. In a Git repository with at least one
commit, save a short Claude Code session:

```jsonl session.jsonl
{"type":"user","sessionId":"0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5","version":"2.1.0","timestamp":"2026-01-01T09:00:00.000Z","message":{"role":"user","content":"List the files"}}
{"type":"assistant","sessionId":"0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5","version":"2.1.0","timestamp":"2026-01-01T09:00:03.000Z","message":{"id":"msg_01","role":"assistant","model":"claude-sonnet-5-5","content":[{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"ls"}}],"usage":{"input_tokens":900,"output_tokens":30}}}
{"type":"user","sessionId":"0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5","version":"2.1.0","timestamp":"2026-01-01T09:00:04.000Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01","content":"README.md"}]}}
{"type":"assistant","sessionId":"0f6c1d2e-3a4b-4c5d-8e9f-a0b1c2d3e4f5","version":"2.1.0","timestamp":"2026-01-01T09:00:06.000Z","message":{"id":"msg_02","role":"assistant","model":"claude-sonnet-5-5","content":[{"type":"text","text":"One file: README.md."}],"usage":{"input_tokens":960,"output_tokens":12}}}
```

Then export it:

```sh
npx @opensoftware/runlog export session.jsonl
```

It appends one line to `$OUTPUT/runs.jsonl`: the run as an OTLP/JSON export request, with the root span
`invoke_agent`, two `chat claude-sonnet-5-5` spans and one `execute_tool Bash` span. Your own sessions are in
`~/.claude/projects/<project>/` and `~/.codex/sessions/`. For OpenCode, export a session first:
`opencode export <session id> > session.json`.

## What a run holds

| Span | Attributes |
| --- | --- |
| `invoke_agent` (root) | `gen_ai.conversation.id` (the session ID), `gen_ai.provider.name`, `gen_ai.request.model` (of the first response), the token usage of the whole session, `osf.outcome` (`succeeded`, or what `attach --outcome` says), `osf.pull_request.urls` and `osf.issue.urls` (links that a tool printed), `osf.agent_trace.uri` (with `--agent-trace`) |
| `chat <model>`, one per model response | `gen_ai.request.model`, `gen_ai.response.id` (Claude Code, OpenCode), the token usage of the response |
| `execute_tool <name>`, one per tool call | `gen_ai.tool.name`, `gen_ai.tool.call.id`; the span lasts from the call to its result |

Issue links are GitHub and Forgejo `/issues/<n>`, GitLab `/-/issues/<n>` and Linear `linear.app/<team>/issue/<KEY-n>`
(without the title). Input tokens include cached tokens, as the GenAI conventions ask; `gen_ai.usage.cache_read.input_tokens` and
`gen_ai.usage.cache_write.input_tokens` show the cached part. The trace and span IDs come from the session ID, so a
second export of the same session gives the same trace.

The resource carries the attributes of the launch from `OTEL_RESOURCE_ATTRIBUTES`. runlog fills what is missing:
`osf.run.id` and `osf.work_item.id` become the session ID, `osf.requester.id` becomes `git:<author email>`,
`osf.source` becomes `cli` and `osf.factory.version` becomes the commit of the Git repository in the current
folder. A run that still breaks the `run-record` contract is not exported, and the error names the attribute.

## Attach a session to its launch

A launcher (the foreman, or a CI job) starts the harness with a W3C `TRACEPARENT` and `OTEL_RESOURCE_ATTRIBUTES`.
When the stage ends, it runs:

```sh
runlog attach session.jsonl --outcome failed
```

attach exports the session like `export`, but the trace ID comes from `TRACEPARENT` and the root span `invoke_agent`
is a child of its span. Claude Code honors `TRACEPARENT` in `claude -p` and Agent SDK sessions, so its native spans
and the session's spans end up in one trace. `--outcome` is `succeeded` (default), `failed` or `cancelled`. attach
without a valid `TRACEPARENT` exits with code 1.

## Watch session folders

```sh
runlog watch ~/.claude/projects ~/.codex/sessions
```

watch looks at every `.jsonl` and `.json` file below the folders every `--interval` seconds (60) and exports each
session whose last event is at least `--idle` minutes (5) old. It remembers each file it exported, with its size, in
`watch.json` in `OSF_DATA`, so a session is exported once; a resumed session that grew is exported again, with the
same trace ID. A file that is no session, and the transcript of a Claude Code subagent, is skipped. A session it cannot export, for example because the OTLP
endpoint refused it, is named on the error output and tried again in the next pass. `--passes <n>` stops after n
passes.

## Export the newest session

```sh
runlog export --latest ~/.claude/projects ~/.codex/sessions --per-run
```

`--latest <folder>...` takes the place of the session file: runlog reads every `.jsonl` and `.json` file below the
folders and exports the session whose last event is the latest. Without one it exits with code 1. `--per-run`
writes the run to `$OUTPUT/<run id>.jsonl` and replaces that file, instead of appending to `$OUTPUT/runs.jsonl`. The
run ID is `osf.run.id`, with every character other than letters, digits, `.`, `_` and `-` turned into `-`. This
repository commits the run of each agent session this way
([ADR 0027](../../docs/decisions/0027-runlog-dogfood-run-records.md)).

## Agent Trace

`--agent-trace <file>` on `export` and `attach` writes an [Agent Trace](https://agent-trace.dev) record (version
`0.1.0`) of the lines the session wrote and puts its `file:` URL into `osf.agent_trace.uri`. runlog takes the text of
each write (Claude Code `Edit`, `MultiEdit` and `Write`, OpenCode `edit` and `write`, the added lines of a Codex
`apply_patch`) and finds it in the file as it is now in the current folder. The ranges get the contributor `ai` and
the model as `<provider>/<model>`; the record's revision is `HEAD`. Text a person changed since is not attributed.

## Prompt content

Prompts, answers, tool arguments and tool results stay out of the run. `--include-content` adds them:
`gen_ai.input.messages` (the user messages before the response) and `gen_ai.output.messages` on `chat` spans,
`gen_ai.tool.call.arguments` and `gen_ai.tool.call.result` on `execute_tool` spans.

## Sending to a collector

Set `OTEL_EXPORTER_OTLP_ENDPOINT` (and `OTEL_EXPORTER_OTLP_HEADERS` for a token) to send the run as OTLP/HTTP JSON
to `<endpoint>/v1/traces` instead of writing `runs.jsonl`. The exporter of the OpenTelemetry JavaScript SDK retries
while the endpoint answers 429, 502, 503 or 504; any other error exits with code 1. runlog sends nothing anywhere
else.

## Collector config pack

A harness that sends its own traces can go through an OpenTelemetry Collector with the config of
[`collector/`](collector/): `claude-code.yaml`, `codex.yaml` and `opencode.yaml`. Each config receives OTLP on ports
4317 (gRPC) and 4318 (HTTP), renames the native spans and sends them as OTLP/HTTP JSON to the Collector's
`OTEL_EXPORTER_OTLP_ENDPOINT`. The trace store then sees the same span names as from `runlog export`:

| Harness | Native span | Exported span |
| --- | --- | --- |
| Claude Code | `claude_code.interaction` | `invoke_agent`, with `session.id` as `gen_ai.conversation.id` |
| Claude Code | `claude_code.llm_request` | `chat <model>`, with the token counts as `gen_ai.usage.*` |
| Claude Code | `claude_code.tool` | `execute_tool <tool>` |
| Codex | `session_loop` | `invoke_agent`, with `conversation.id` as `gen_ai.conversation.id` |
| Codex | `handle_responses` | `chat` |
| OpenCode | `ai.streamText` | `invoke_agent`, with `ai.model.provider` as `gen_ai.provider.name` |
| OpenCode | `ai.streamText.doStream` | `chat <model>` |
| OpenCode | `ai.toolCall` | `execute_tool <tool>` |

Other spans pass through. The resource gets `osf.harness.name` unless the launch set it in
`OTEL_RESOURCE_ATTRIBUTES`. The processor `transform/content` deletes prompts and tool arguments and results; remove
it from the pipeline to keep them. Codex has no tool span with the tool's name; `runlog attach` adds the tool calls
from its session file. To get a config:

```sh
npx @opensoftware/runlog collector claude-code
docker run -v "$PWD/collector.yaml:/etc/otelcol-contrib/config.yaml" -p 4317:4317 -p 4318:4318 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://trace-store:4318 otel/opentelemetry-collector-contrib:0.148.0
```

The system tests run each mapping in this Collector image.

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/runlog/`. Merging it
creates the tag `runlog-v<version>`, and `.github/workflows/publish-runlog.yml` builds `dist/` and publishes
`@opensoftware/runlog` to npm. The first release is `0.1.0`; until `1.0.0`, a breaking change raises the minor
version. The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)),
with a trusted publisher for `publish-runlog.yml`. No credential is stored in the repository.

## Commands

<!-- generated by make docs from src/cli.ts --help: do not edit -->

| Command | What it does |
| --- | --- |
| `export <session file> [--include-content] [--agent-trace <file>] [--per-run]` | Write a Claude Code, Codex or OpenCode session as an OTLP run to $OUTPUT/runs.jsonl, or send it to OTEL_EXPORTER_OTLP_ENDPOINT. --agent-trace also writes the Agent Trace record of the lines it wrote. --per-run writes $OUTPUT/<run id>.jsonl and replaces it. |
| `export --latest <folder>... [options]` | Export like export the session below the folders whose last event is the latest. |
| `attach <session file> [--outcome <outcome>] [--include-content] [--agent-trace <file>]` | Export like export, but into the trace of the launcher's TRACEPARENT, with the outcome succeeded, failed or cancelled. |
| `watch <folder>... [--idle <minutes>] [--passes <n>] [--interval <seconds>] [--include-content]` | Export each session below the folders once, when its last event is --idle minutes (5) old; repeat every --interval seconds (60). |
| `collector <harness>` | Write the OpenTelemetry Collector config of claude-code, codex or opencode to $OUTPUT/collector.yaml. It renames the harness's native spans to invoke_agent, chat and execute_tool and sends them to OTEL_EXPORTER_OTLP_ENDPOINT. |

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OUTPUT` | string | `"."` | Folder that export, attach and watch append runs.jsonl to when no OTLP endpoint is set. |
| `OTEL_RESOURCE_ATTRIBUTES` | string |  | Resource attributes of the run as key=value pairs, set by the launcher, for example osf.run.id=…,osf.work_item.id=…,osf.factory.version=…,osf.stage=…. They override what runlog finds itself. |
| `OTEL_SERVICE_NAME` | string |  | The service.name of the run. Default: the harness, for example claude-code. |
| `TRACEPARENT` | string |  | W3C trace context of the stage, set by the launcher, for example 00-<trace id>-<span id>-01. attach puts the run into this trace, below this span. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | string |  | Base URL of an OTLP/HTTP receiver, for example http://collector:4318. When set, export sends the run to <url>/v1/traces instead of writing runs.jsonl. |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | string |  | Full URL of the OTLP/HTTP traces endpoint; takes precedence over OTEL_EXPORTER_OTLP_ENDPOINT. |
| `OTEL_EXPORTER_OTLP_HEADERS` | string |  | Headers for the OTLP endpoint as key=value pairs, for example a token from a secret store. Never write the value into a file. |
| `OSF_DATA` | string | `".runlog"` | Folder where watch remembers which session files it exported. |
| `OSF_NOW` | string |  | The current time as an ISO 8601 timestamp, for watch to decide whether a session has ended. Default: the system clock. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-RUN-001 | implemented | A new user exports the sample Claude Code session from the README |
| SCN-RUN-002 | implemented | The help lists every command |
| SCN-RUN-003 | implemented | The root span of a Claude Code run carries the model and the token usage of the whole session |
| SCN-RUN-004 | implemented | Each model response of a Claude Code run becomes one chat span |
| SCN-RUN-005 | implemented | Each tool call of a Claude Code run becomes one execute_tool span that lasts until its result |
| SCN-RUN-006 | implemented | A pull request link that a tool printed ends up on the root span |
| SCN-RUN-007 | implemented | A second export appends a second run to runs.jsonl |
| SCN-RUN-008 | implemented | A Codex run has the same root span as a Claude Code run |
| SCN-RUN-009 | implemented | Each model response of a Codex run becomes one chat span |
| SCN-RUN-010 | implemented | Each tool call of a Codex run becomes one execute_tool span |
| SCN-RUN-011 | implemented | The attributes in OTEL_RESOURCE_ATTRIBUTES from the launch end up on every span |
| SCN-RUN-012 | implemented | A run without launch attributes is attributed to the Git author and the commit of the current folder |
| SCN-RUN-013 | implemented | A run that breaks the run-record contract is not exported |
| SCN-RUN-014 | implemented | The run leaves out prompt content by default |
| SCN-RUN-015 | deprecated | --include-content adds the messages and the tool calls |
| SCN-RUN-016 | implemented | The run goes to the configured OTLP endpoint |
| SCN-RUN-017 | implemented | The export retries after an outage of the OTLP endpoint |
| SCN-RUN-018 | implemented | An export the OTLP endpoint refuses fails |
| SCN-RUN-019 | deprecated | A file that is no session is refused |
| SCN-RUN-020 | implemented | A missing session file is named |
| SCN-RUN-021 | implemented | A run outside a Git repository with a commit has no factory version and is not exported |
| SCN-RUN-022 | implemented | An OpenCode run has the same root span as a Claude Code run |
| SCN-RUN-023 | implemented | Each assistant message of an OpenCode run becomes one chat span |
| SCN-RUN-024 | implemented | Each tool part of an OpenCode run becomes one execute_tool span that lasts from its start to its end |
| SCN-RUN-025 | implemented | A file that is no session of a known harness is refused |
| SCN-RUN-026 | implemented | Issue links that a tool printed end up on the root span |
| SCN-RUN-027 | implemented | attach puts the run into the trace of the launch |
| SCN-RUN-028 | implemented | attach records the outcome of the stage |
| SCN-RUN-029 | implemented | attach without a TRACEPARENT is refused |
| SCN-RUN-030 | implemented | An outcome the run-record contract does not know is refused |
| SCN-RUN-031 | implemented | watch exports a session that has ended |
| SCN-RUN-032 | implemented | watch leaves a session that is still running for a later pass |
| SCN-RUN-033 | implemented | --idle sets how long a session must be quiet before watch exports it |
| SCN-RUN-034 | implemented | A second watch does not export a session again |
| SCN-RUN-035 | implemented | watch repeats its pass and exports each session once |
| SCN-RUN-036 | implemented | watch skips files that are no session |
| SCN-RUN-037 | implemented | The lines a Claude Code session wrote are attributed to its model |
| SCN-RUN-038 | implemented | The lines a Codex patch added are attributed to its model |
| SCN-RUN-039 | implemented | The lines an OpenCode edit wrote are attributed to its model |
| SCN-RUN-040 | implemented | The root span links the Agent Trace record |
| SCN-RUN-041 | implemented | Text that the session wrote and a person changed later is not attributed |
| SCN-RUN-042 | implemented | watch names a session it could not export and exports it in a later pass |
| SCN-RUN-043 | implemented | watch skips the transcript of a Claude Code subagent |
| SCN-RUN-044 | implemented | A Claude Code interaction becomes the root span "invoke_agent" |
| SCN-RUN-045 | implemented | A Claude Code model request becomes a chat span with its token usage |
| SCN-RUN-046 | implemented | A Claude Code tool span becomes an execute_tool span |
| SCN-RUN-047 | implemented | The Claude Code config drops the prompt text |
| SCN-RUN-048 | implemented | The launch attributes of a harness pass through the Collector |
| SCN-RUN-049 | implemented | A Codex session loop becomes the root span "invoke_agent" |
| SCN-RUN-050 | implemented | A Codex response handler becomes a chat span |
| SCN-RUN-051 | implemented | An OpenCode model call becomes a chat span with its token usage |
| SCN-RUN-052 | implemented | An OpenCode step becomes the root span "invoke_agent" |
| SCN-RUN-053 | implemented | An OpenCode tool call becomes an execute_tool span without its arguments |
| SCN-RUN-054 | implemented | The Collector config of an unknown harness is refused |
| SCN-RUN-055 | implemented | --latest exports the session whose last event is the latest |
| SCN-RUN-056 | implemented | --latest without a session below the folders fails |
| SCN-RUN-057 | implemented | --per-run writes the run to a file named after its run ID |
| SCN-RUN-058 | implemented | A second --per-run export of the same session replaces its file |
| SCN-RUN-059 | implemented | --per-run turns the characters of a run ID that a file name cannot hold into hyphens |
| SCN-RUN-060 | implemented | export names the run and the file it wrote |
| SCN-RUN-061 | implemented | A command without its file prints the usage |
| SCN-RUN-062 | implemented | An error starts with the name of the program |
| SCN-RUN-063 | implemented | --include-content adds every message and every tool call of a Claude Code run |
| SCN-RUN-064 | implemented | --include-content adds every message and every tool call of a Codex run |
| SCN-RUN-065 | implemented | --include-content adds every message and every tool call of an OpenCode run |
| SCN-RUN-066 | implemented | A Claude Code run has one span for the session, each response and each tool call, and no other span |
| SCN-RUN-067 | implemented | The spans of a run keep the milliseconds of the session's times |
| SCN-RUN-068 | implemented | A Codex run has one span for the session, each response and each tool call, and no other span |
| SCN-RUN-069 | implemented | An OpenCode run has one span for the session, each assistant message and each tool part, and no other span |
| SCN-RUN-070 | implemented | Every span names runlog and its version as the instrumentation scope |
| SCN-RUN-071 | implemented | Overlapping and touching ranges of a file are joined, and the files are in the order of their paths |
| SCN-RUN-072 | implemented | The Agent Trace record names the harness and carries the trace ID of the run |
| SCN-RUN-073 | implemented | Each block of lines that a Codex patch added is attributed on its own |
| SCN-RUN-074 | implemented | The lines an OpenCode write call wrote are attributed to its model |
| SCN-RUN-075 | implemented | Links over http and with numbers of several digits end up on the root span once each |
| SCN-RUN-076 | implemented | attach refuses a TRACEPARENT whose trace ID is only zeros |
| SCN-RUN-077 | implemented | attach refuses a TRACEPARENT whose parent span ID is only zeros |
| SCN-RUN-078 | implemented | attach accepts trace and span IDs that start or end with zeros |
| SCN-RUN-079 | implemented | A JSON file with messages but without a session ID is refused |
| SCN-RUN-080 | implemented | --latest exports the latest session also when its file comes last |
| SCN-RUN-081 | implemented | watch reads .jsonl and .json files and no others |
| SCN-RUN-082 | implemented | watch names each run it exported |
