---
name: ship-pull-request
description: Open a pull request and bring its checks to green. Use when you push a branch, write a pull request description, or a check of a pull request fails (DOCS-AFFECTED, gate, BUDGET, a missing run).
---

# Ship a pull request

## Before you push

- Work on a branch in the main checkout, not in a git worktree: turbo then keeps one cache for all branches.
- Run `make check`, then `make run-record`, and commit `runs/`.

## The description

Write it for a busy reviewer: two or three sentences on why and what, a few bullets at most, then the
`docs-reviewed:` lines. No measurement tables, no history of the session; those go into commits, the ADR or the
docs. Never add a `Co-Authored-By` line or a "Generated with" line.

## When a check fails

- **DOCS-AFFECTED**: open each doc it names. Update it when the change makes it wrong; otherwise add
  `docs-reviewed: <path>` to the description. Editing the description starts a new `verify` run.
- **A run is missing after a push**: a pull request with a merge conflict starts no `pull_request` workflow. Check
  `gh pr view <n> --json mergeable`, merge `main` into the branch and push.
- **A conflict in `runs/<session>.jsonl`**: every pull request of one session writes that file. Take either side,
  run `make run-record` (it writes the whole file again) and commit.
- **gate**: it runs as `pull_request_target`, with the workflow from `main`. A pull request that fixes the gate
  workflow cannot pass its own gate; merging it needs `--admin`, so ask the maintainer.
- **BUDGET**: measure where the time goes (the JUnit times, the start of each process) and make the suite faster
  first. Raise a budget only with the measured reason in the module's `AGENTS.md`.
- **A replayed result looks wrong**: see ADR 0081. Main runs every suite without the cache.

## Merging

Merge only what the maintainer asked for. Merge the pull requests that others depend on first, then merge `main`
into the rest and wait for their checks again.
