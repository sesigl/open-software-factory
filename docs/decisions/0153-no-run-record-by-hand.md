---
status: accepted
topic: process
date: 2026-11-16
---

# 0153. No pull request has to commit a run record

## Context

ADR 0027 made every agent pull request of this repository commit the run of its session: the agent runs
`make run-record` before it pushes and commits `runs/`, and the check RUNS fails a change whose commits since
`OSF_BASE` carry a `Co-Authored-By:` trailer of Claude, Codex or OpenCode but change no file in `runs/`.

Five weeks later:

- `runs/` holds 63 files and 25 MB, and grows with every pull request. ADR 0027 said to revisit at 50 MB.
- The rule proves little. RUNS accepts any changed file in `runs/`, so a run record of another session, or one
  exported again with nothing new, satisfies it. A run of a cloud session that ends after the last push is not in it.
- It costs every pull request a step and a commit after the code, a second CI run (ADR 0066), and merge conflicts in
  `runs/<session>.jsonl` when one session opens several pull requests.
- In phase 3 the factory itself implements this repository's issues. foreman already puts each stage's run record into
  the run's trace (ADR 0121), so a file in the pull request is no longer the only place a run is kept.

The owner decided in November 2026 (`TODO.md`, T-80): nobody adds a file to `runs/` by hand any more.

## Decision

This supersedes the rule of ADR 0027 and the part of RUNS that enforces it. The rest of ADR 0027 stays.

- **No rule.** `AGENTS.md`, its loop and the skills no longer tell an agent to run `make run-record` or to commit
  `runs/`. The dogfood factory's implement agent (`deploy/dogfood/factory/agents/implement.md`) does not either.
- **RUNS validates what is there.** Every line of every `runs/*.jsonl` is still an OTLP/JSON export request with one
  root span `invoke_agent` whose resource and root span match the `run-record` contract, and no span carries prompt
  or tool content. RUNS no longer reads the commits or compares with `OSF_BASE`: a change with an agent's trailer
  and no file in `runs/` passes (SCN-REPO-177, which replaces SCN-REPO-040; SCN-REPO-042 is deprecated with it).
- **`make run-record` stays, as an optional tool.** It still exports this checkout's newest session to
  `runs/<run id>.jsonl` with `runlog export --latest --per-run`, for a person who wants a run in the repository; RUNS
  checks such a file like any other. runlog's `--latest` and `--per-run` stay as they are.
- **`runs/` stays.** The files committed so far stay where they are; nothing deletes or moves them.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Drop the rule, keep validating `runs/` (chosen) | No step and no conflict per pull request; `runs/` stops growing; the records that exist stay valid | ledger's and scorekit's numbers of this repository stop growing |
| Keep the rule | ledger and scorekit keep getting data | 25 MB and growing; the check accepts any file, so it proves little |
| Make RUNS stricter: the run of this session, with a span after the last commit | The record would mean something | Harder for every agent, and still a file per pull request in Git |
| Move the records to a CI artifact or a release asset | Nothing in Git history | The agent still has to push the file first (ADR 0027); artifacts expire after 90 days |
| Send the runs to a hosted trace store now | Dashboards across sessions | A new paid service with an account and a secret; not asked for |
| Delete `runs/` too | A smaller checkout | ledger and scorekit lose the history they read today; Git history keeps the bytes anyway |

## Prior art

No new module, dependency or service: this removes a rule. Where run records could come from later, checked today:

- foreman's run traces (ADR 0087, ADR 0121): every stage of a factory run already carries its session's run record
  in the trace store of the profile (Jaeger, ADR 0100). A source for the factory's own runs in phase 3; not wired
  to ledger or scorekit here.
- Langfuse (MIT core, active) and other OTLP trace stores: option 3 of ADR 0027. Still a hosted service with a
  secret. Not adopted.
- Git LFS: would move the bytes out of the packfile but keep the step per pull request. Not adopted.

## Consequences

- An agent's pull request needs no file in `runs/`, and CI does not ask for one. Its loop has five steps.
- `runs/` stops growing, and with it the numbers that read it. `.github/workflows/ledger-dashboard.yml` builds the
  ledger page (ADR 0044) from `runs/`, and runs on a push to `runs/**`: the page's cost per pull request covers only the
  pull requests up to this decision, and newer pull requests show no cost. `.github/workflows/weekly-paid.yml` scores
  `runs/` with scorekit and gives the failed scores to observer (ADR 0077): once every run of `runs/` is scored, the
  weekly scores repeat from the cache and observer sees no new failed run. Both stay as they are, and their numbers
  stand still until run records come from somewhere else, for example foreman's traces. That source is not built
  here.
- A person or agent who still runs `make run-record` and commits the file gets it checked by RUNS as before.
- RUNS needs no base any more: without `OSF_BASE` it prints `RUNS ok`, not "skipped".
- Revisit when phase 3's factory runs should feed ledger and scorekit: then decide where their run records go.
