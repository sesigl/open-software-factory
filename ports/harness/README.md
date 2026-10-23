---
covers: [ports/harness/**]
---

# harness port

How the factory runs a coding agent headless: one protocol for every harness. Decisions:
[ADR 0050](../../docs/decisions/0050-harness-port.md), [ADR 0052](../../docs/decisions/0052-harness-claude-code.md).

## The interface

A harness adapter is a program that speaks the Agent Client Protocol (ACP) v1 on stdio, as an agent towards its
client. Its client (foreman, a script, a test) starts it and uses ACP as with any agent:

| Port operation | ACP |
| --- | --- |
| start | `initialize`, then `session/new` with the working folder |
| send | `session/prompt`; one sent while a turn runs is a steering message |
| stream events | `session/update` from the adapter |
| approve tool | `session/request_permission` from the adapter, answered by the client |
| cancel | `session/cancel`; the turn ends with `cancelled` within 5 seconds |
| export transcript | `<adapter> transcript <session ID>` writes `$OUTPUT/run-record.json` and `$OUTPUT/transcript.jsonl` |

On top of ACP every adapter refuses tool calls of kinds outside its `--allow` list without asking the client, stops
an agent that does not end a cancelled turn, and records each session for the transcript export. The adapters share
this code in the library [`harness-proxy`](../../packages/harness-proxy/README.md); each adapter adds what its
product needs.

## Conformance

The shared behavior is the `@conformance` scenarios in [`features/`](features/harness.feature) (prefix
`SCN-HARNESS`). Every adapter in `adapters/harness/<name>/` has one system test per scenario; what only one adapter
does is in its own `features/` folder. A community adapter
shows conformance with `testkit conformance <its copy of this features folder> --junit report.xml`.

## Adapters

| Adapter | Tier | What it runs |
| --- | --- | --- |
| [`acp`](../../adapters/harness/acp/README.md) | core | Any ACP agent named on its command line |
| [`claude-code`](../../adapters/harness/claude-code/README.md) | optional | Claude Code through its ACP bridge, asking before each edit and command |
| `codex`, `opencode` | optional | The products' ACP bridges with their own settings (planned, T-12) |

The scripted harness for deterministic runs is `acp` with the testkit's scripted agent (ADR 0052).
