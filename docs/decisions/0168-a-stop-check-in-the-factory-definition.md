---
status: accepted
topic: factory
date: 2026-11-17
---

# 0168. A stop check in the factory definition

## Context

This repository declares its own agent in `factory.yaml`, and `factory render` writes the files each harness reads
from it (ADR 0020). One file stayed hand-written: the Claude Code `Stop` hook in `.claude/settings.json`, which runs
`make check-fast` before the agent ends a turn in which the working tree changed (ADR 0090). It ends with code 2 and the
check's output when the check fails, so the agent goes on once; it does nothing on a clean tree; and it lets the agent
stop when a Stop hook already blocked this stop (`stop_hook_active`), so an agent that cannot fix a check can stop and
ask (T-76). A factory that wants the same for its agents had to write it by hand too, in Claude Code's words.

## Decision

- The contract `factory-definition` gets an optional field on the agent: `stopCheck: { command: <shell command> }`.
  Its meaning is harness-neutral: before the agent ends a turn in which it changed files, its harness runs the command
  in the repository's folder; when the command fails, the agent gets its output once and goes on; a turn that changed
  nothing, or one that the check already sent back, ends as it would without it. The command has a character that is
  not white space; `factory lint` refuses a blank one with its line and column. It is an object, so a later field
  (a time limit, say) stays additive. It is named by what it does, not by Claude's word "hook".
- `factory render` writes it for Claude Code as the one entry of `hooks.Stop` in `.claude/settings.json`:
  `grep -Eq '"stop_hook_active": *true' && exit 0; [ -z "$(git status --porcelain)" ] && exit 0; { <command>; } >&2 ||
  { echo 'the stop check failed: …' >&2; exit 2; }`. Render reads the file first and keeps every other key and every
  other hook event a person wrote; the rendered entry takes the place of every Stop hook of the file. Without a stop
  check, render leaves the file alone. The file is a rendered file like the others, so `factory plan` reports a changed
  Stop hook as drift after `factory apply`.
- Codex, opencode and the ACP adapter run no stop check: nothing in this repository describes a hook of theirs that
  runs before a turn ends. Render writes nothing for them and prints one line per such harness,
  `<harness> runs no stop check, so factory render writes none for it`.
- This repository's `factory.yaml` declares `stopCheck: { command: make check-fast --quiet }`, and `make agents-sync`,
  which runs the workspace build of `factory render`, writes `.claude/settings.json`.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `stopCheck` on the agent | The agent is what a harness runs; the field sits beside its harness, prompt and skills | A factory with many agents repeats it per agent |
| A field on a workflow stage | Stages already name checks | A stage's checks are forge checks after the run (ADR 0069); the stop check runs inside the agent's turn, also without a workflow, as in this repository |
| A plain string `stopCheck: make check-fast` | Shorter | A later field would change its type, a breaking change |
| `hooks: { Stop: … }` in Claude Code's own format | Every Claude hook at once | Not harness-neutral; the factory definition would carry one product's format |
| Keep the hook hand-written | No contract change | Every factory writes the same shell line by hand, and drift goes unseen |

## Prior art

- Claude Code's hooks: a `Stop` hook gets JSON on stdin with `stop_hook_active`, and code 2 blocks the stop with the
  error output for the agent. The rendered hook is the hand-written one of this repository (T-76), with the check
  command in braces so a command with `&&` sends all its output to the error output.
- The harness adapters of this repository (`adapters/harness/*`) describe no stop hook for Codex, opencode or ACP, so
  render writes none for them; when one of those products gains one, its entry in `HARNESSES` of factory-spec gains a
  `stopCheck` writer.

## Consequences

- `AGENTS.md` no longer says that the hook is written by hand; `make agents-sync` renders it.
- The system tests prove the rendered command and the merge from outside, through the CLI and the rendered file. They
  do not run the shell command: a system test may not start a process outside the testkit, and the testkit has no
  runner for a harness hook yet. The command is the hand-written one this repository ran under T-76.
- Revisit when another harness gains a hook before a turn ends, or when a factory needs a stop check per stage.
