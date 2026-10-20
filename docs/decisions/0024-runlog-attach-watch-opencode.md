---
status: accepted
date: 2026-10-20
---

# 0024. runlog attaches, watches, reads OpenCode, links issues, writes Agent Trace and is released

## Context

ADR 0023 shipped the first slice of TODO item T-04: `runlog export` for Claude Code and Codex session files. The
item still lists `runlog watch` and `runlog attach`, OpenCode, the Collector config pack per harness, Agent Trace line
attribution, the npm release and the dogfood export of this repository's sessions. The vision scenarios ask that a
run links the issues and pull requests it created (SCN-FACTORY-DATA-003) and stores its full trace
(SCN-FACTORY-DATA-001).

Checked before this decision (October 2026):

- Claude Code reads `TRACEPARENT` from its environment in `claude -p` and Agent SDK sessions and starts its
  `claude_code.interaction` span in that trace. Bash subprocesses get a `TRACEPARENT` of the active tool span. A
  launcher can therefore give a stage one trace ID, and runlog can put the session file into the same trace.
- OpenCode's storage moved from JSON files under `storage/` to SQLite (`opencode.db`) and again to new tables in
  2.x. `opencode export <session id>` prints one session as JSON (`info` and `messages`, each with `info` and
  `parts`) and has stayed stable across these moves.
- Codex native traces carry internal span names and no token counts; Claude Code traces are beta and carry tokens
  only on `claude_code.llm_request`.

## Decision

This is the second slice of T-04.

- **`runlog attach <session file> [--outcome <outcome>]`** is the launcher's command for when a stage ends. It
  exports like `export`, but the run joins the trace in `TRACEPARENT` (W3C trace context): the trace ID comes from
  it, and the root span `invoke_agent` gets its span as parent. The native spans of a harness that honors
  `TRACEPARENT` and the session's spans then form one trace. `--outcome` sets `osf.outcome` to `succeeded`,
  `failed` or `cancelled` (default `succeeded`). attach without `TRACEPARENT` is refused, because then it would be
  `export`.
- **`runlog watch <folder>... [--idle <minutes>] [--passes <n>] [--interval <seconds>]`** looks at every session
  file below the folders and exports each session that has ended: its last event is at least `--idle` minutes
  (default 5) before now. It remembers in `OSF_DATA` (default `.runlog`) which files it exported at which size, so a
  session is exported once; a resumed session that grew is exported again with the same trace ID. It repeats every
  `--interval` seconds (default 60) until it has made `--passes` passes, or forever without `--passes`. Files that
  are no session are skipped. The current time is `OSF_NOW` when set.
- **OpenCode** sessions come from `opencode export <session id> > session.json`. runlog does not read OpenCode's
  database or storage folder, because their format moved twice in a year. The mapping: each assistant message is a
  `chat` span with its `modelID`, `providerID` and tokens; `tokens.input` excludes cached tokens, so runlog adds
  `cache.read` and `cache.write` (GenAI conventions). Each `tool` part is an `execute_tool` span from
  `state.time.start` to `state.time.end`. `watch` exports such files like any other session.
- **Issue links.** Next to pull request links, links to issues that a tool printed go into `osf.issue.urls` on the
  root span: GitHub and Forgejo `/issues/<n>`, GitLab `/-/issues/<n>` and Linear `linear.app/<team>/issue/<KEY-n>`.
- **Agent Trace.** `--agent-trace <file>` on `export` and `attach` writes an Agent Trace record (version `0.1.0`)
  of the lines the session wrote, and sets `osf.agent_trace.uri` on the root span to the file's `file:` URL. runlog
  takes the text of each write (Claude Code `Edit`, `MultiEdit` and `Write`; OpenCode `edit` and `write`; Codex
  `apply_patch` added lines), finds it in the file as it is now in the current folder, and records the line ranges
  with the contributor `ai` and the model as `<provider>/<model>`. Text that is no longer in the file is not
  attributed. The record's ID is a UUID from the trace ID, its revision is `HEAD`.
- **Release.** runlog is published to npm as `@opensoftware/runlog` like factory-spec (ADR 0022): release-please
  with the tag `runlog-v<version>`, `.github/workflows/publish-runlog.yml`, a trusted publisher, first version
  `0.1.0`.
- **Not in this slice:** the Collector config pack (`collector/`), which needs a real Collector in the system tests
  to prove the mapping, and the dogfood export of this repository's sessions on every pull request, which needs a
  decision on where this repository stores its runs.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| attach joins the trace from `TRACEPARENT` (chosen) | W3C standard; Claude Code already honors it; native and file spans meet in one trace | Needs a launcher that sets it |
| attach searches the trace store for the session ID | No launcher needed | Needs a query API per backend; runlog writes only OTLP |
| watch with file system events (`fs.watch`) | Reacts at once | Recursive watching is unreliable on Linux and network folders; an ended session is defined by time, not by a write |
| watch polls and decides "ended" by the last event's time (chosen) | Works on every file system; deterministic with `OSF_NOW` | Exports up to one interval late |
| Read OpenCode's `opencode.db` with SQLite | No manual export step | A native SQLite dependency; the schema changed twice in a year |
| Read `opencode export` JSON (chosen) | One file like the other harnesses; stable across storage moves | The user or launcher runs `opencode export` first |
| Agent Trace from `git blame` of the session's commits | Exact for committed lines | A session often ends before a commit; blame names the committer, not the agent |
| Agent Trace from the written text found in the current files (chosen) | Works before a commit; no extra state | Text that occurs twice is attributed at its first place |

## Prior art

- W3C Trace Context and the OpenTelemetry "environment variables as context propagation carriers" specification
  (Apache-2.0, active): the `TRACEPARENT` format runlog reads. Adopted; parsed by hand because the format is one
  line and `@opentelemetry/core`'s parser would be a new dependency for one regular expression.
- OpenTelemetry JavaScript SDK (Apache-2.0, active): already adopted in ADR 0023; no new package.
- Agent Trace specification by Cursor (CC BY 4.0, version 0.1.0-draft, January 2026, active; backed by several
  harness vendors): the record format. The reference implementation in its repository is not published as a
  package, so runlog writes the JSON itself. Adopted as a format.
- ccusage (MIT, active): reads OpenCode data for usage reports; confirmed the token fields. It writes no OTLP. Not
  adopted.
- codeburn (MIT, active): documents OpenCode's storage moves (JSON files, `opencode.db`, `session_v2`). It led to
  the choice of `opencode export`. Not adopted.
- chokidar (MIT, active): file watching. Not adopted, because watch polls by design (see options).
- OpenTelemetry Collector `filelog` receiver (Apache-2.0, active): tails files, but it does not know when a session
  ended or how to map one to spans. Not adopted.

## Consequences

- A launcher (the foreman, or a CI job) can wrap a stage: set `TRACEPARENT` and `OTEL_RESOURCE_ATTRIBUTES`, start
  the harness, then run `runlog attach` with the outcome. Everything of the stage is in one trace.
- A developer can run `runlog watch ~/.claude/projects ~/.codex/sessions` and get every local session into a trace
  store without changing how they work.
- OpenCode users run `opencode export` first; a later slice can read `opencode.db` if its schema settles.
- Agent Trace ranges are best effort: a line the agent wrote and a person changed later is no longer found and is
  not attributed.
- T-04 stays open for the Collector config pack and the dogfood export.
