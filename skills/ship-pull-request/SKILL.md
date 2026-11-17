---
name: ship-pull-request
description: Open a pull request and bring its checks to green. Use when you push a branch, write a pull request description, or a check of a pull request fails (DOCS-AFFECTED, gate, BUDGET, a missing workflow run).
---

# Ship a pull request

## Before you push

- Work on a branch, as root `AGENTS.md` ("How to work") says.
- Run `make check`; `make verify` must pass before you report the change done. No pull request needs a run record in
  `runs/` (ADR 0153).

## The description

Write it for a busy reviewer: two or three sentences on why and what, a few bullets at most, then the
`docs-reviewed:` lines. No measurement tables, no history of the session; those go into commits, the ADR or the
docs. The result of `make verify`, the failure line of a new test and what did not work the first time go into the
commits or your report, not into the description. Never add a `Co-Authored-By` line or a "Generated with" line.

## When a check fails

- **DOCS-AFFECTED**: open each doc it names. Update it when the change makes it wrong; otherwise add
  `docs-reviewed: <path>` to the description. Editing the description starts a new `verify` run.
- **A workflow run is missing after a push**: a pull request with a merge conflict starts no `pull_request`
  workflow. Check `gh pr view <n> --json mergeable`, merge `main` into the branch and push.
- **gate**: it runs as `pull_request_target`, with the workflow from `main`. A pull request that fixes the gate
  workflow cannot pass its own gate; merging it needs `--admin` (root `AGENTS.md`, "When to stop and ask"). When its
  run ended in `startup_failure` and no status `gatekeeper` came, start the gate again from `main`:
  `gh workflow run gatekeeper.yml --ref main -f pr=<n>` (ADR 0174), or comment on the pull request.
- **BUDGET**: it compares the wall time of a suite's run with its budget (ADR 0155). Follow the BUDGET rule of root
  `AGENTS.md` ("Hard rules"): measure where the time goes (the JUnit times, the start of each process) and make the
  suite faster first. The budget section keeps at most three lines: the budget and what dominates the time.
- **A replayed result looks wrong**: see ADR 0081. Main runs every suite without the cache.

## Merging

Merge only what the maintainer asked for (root `AGENTS.md`, "When to stop and ask"). Merge the pull requests that
others depend on first, then merge `main` into the rest and wait for their checks again.
