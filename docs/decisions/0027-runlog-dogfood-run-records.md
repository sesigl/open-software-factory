---
status: accepted
date: 2026-10-20
---

# 0027. Every agent pull request in this repository commits the run of its session

## Context

TODO item T-04 is done when this repository's own agent sessions are exported on every pull request (phase 1
dogfood). ADR 0025 left one question open: where the runs are stored.

A session exists only where the agent runs: a cloud container, a laptop. CI never sees the session file. So the
agent has to export its own session before it pushes. The person who owns this repository chose between three places
on 2026-10-20:

1. A file in the pull request, checked by CI.
2. A CI artifact, removed before merge.
3. A hosted trace store such as Langfuse Cloud.

They chose the file in the pull request.

## Decision

This is the fourth and last slice of T-04.

- **`runlog export --latest <folder>...`** exports the session below the folders whose last event is the latest,
  instead of a named file. It reads Claude Code, Codex and OpenCode files like `watch`. Without a session it exits
  with code 1.
- **`runlog export --per-run`** writes the run to `$OUTPUT/<run id>.jsonl` and replaces that file, instead of
  appending to `$OUTPUT/runs.jsonl`. The run ID is `osf.run.id` with every character other than letters, digits,
  `.`, `_` and `-` replaced by `-`. A session exported twice keeps one line; two sessions on one branch keep two
  files; a branch name used again never overwrites an older run.
- **`make run-record`** runs `runlog export --latest --per-run` with `OUTPUT=runs` on the Claude Code project
  folder of this checkout (`~/.claude/projects/<path with every other character as ->`) and `~/.codex/sessions`.
  `RUN_SESSIONS=<folder>` overrides the folders. No prompt or tool content is exported.
- **The rule.** `AGENTS.md` tells every agent to run `make run-record` and commit `runs/` before it pushes.
- **The check RUNS** (`make verify`):
  - every line of every `runs/*.jsonl` is an OTLP/JSON export request with one root span `invoke_agent`; its
    resource and root span attributes match the `run-record` contract;
  - no span carries content: `gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.system_instructions`,
    `gen_ai.tool.call.arguments` or `gen_ai.tool.call.result`;
  - when a commit since `OSF_BASE` has a `Co-Authored-By:` trailer that names Claude, Codex or OpenCode, the change
    adds or changes a file in `runs/`. Without `OSF_BASE` this part is skipped.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A file in the pull request (chosen) | Free, no account, kept for good, reviewable, proves runlog on its own output | Run metadata (tool names, tokens, timings, models) is public in Git history; about 50 to 100 KB per session |
| A CI artifact | Nothing stays in history | Expires after 90 days; the agent still has to push the file first |
| A hosted trace store | Dashboards across sessions | A new service with an account and a secret |
| One file per branch | Easy to find | A reused branch name overwrites the run of a merged pull request |
| Find the session by its `cwd` | Exact for Codex, which keeps every project in one folder | A system test cannot write the absolute path of `$INPUT` into a session file |
| A Claude Code hook that exports on every push | Nothing to remember | Only for Claude Code; a hook cannot add a commit to the push it runs in |

## Prior art

- runlog itself (ADR 0023, ADR 0024): adopted. The record is what `runlog export` already writes.
- ccusage (MIT, active): reports token usage and cost of local Claude Code and Codex sessions. It prints a report,
  not a run record in a trace format. Not adopted.
- Agent Trace (ADR 0024): records which lines an agent wrote. It is a different record and stays opt-in with
  `--agent-trace`.

## Consequences

- Every agent pull request carries the run of its session under `runs/`, and CI rejects one that does not.
- A pull request made only by a person needs no run. A person who works with an agent and keeps its trailer runs
  `make run-record` too.
- The record covers the session up to its last export. Work after the final push is not in it.
- On a laptop with Codex, `--latest` takes the newest Codex session of any project. `RUN_SESSIONS` narrows it.
- `runs/` grows with every pull request. Revisit when it passes 50 MB, for example by moving old runs to a release
  asset or to a trace store.
- T-04 is done.
