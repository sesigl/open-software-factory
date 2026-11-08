---
status: accepted
date: 2026-11-08
---

# 0092. Mutation starts only after verify passed

## Context

`mutation.yml` ran on every push of a pull request at the same time as `verify.yml`. When `verify` failed, the
mutation shards still ran to their end, and the next push, which fixed the failure, ran them again. A pull request
whose checks fail cannot merge, so these runs gave no result that anyone used. Each shard pays its setup, the build of
its unit and the first test run, also when it reuses its mutant results (ADR 0091).

## Decision

- `mutation.yml` is a reusable workflow (`workflow_call`). `verify.yml` calls it in its job `mutation`, which needs
  the job `verify`, and runs only on a pull request that is no draft and only when `verify` passed.
- `verify.yml` also starts on `ready_for_review`, so marking a draft ready starts mutation.
- The run of `mutation.yml` is part of `verify`'s run, so `verify`'s concurrency group cancels both on a new push. A
  run started by an edit of the description runs mutation again; the shards that finished before restore their
  reports by their keys (ADR 0091).
- `mutation.yml` stays its own file: `verify.yml` is a global dependency of turbo (ADR 0081), and a change to the
  mutation jobs then does not change the hash of every task.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A reusable workflow that `verify.yml` calls after `verify` (chosen) | No mutation runner for a failing pull request; one run, one concurrency group | The time of `verify` comes before the mutation run; the check names start with `mutation / ` |
| Jobs in `verify.yml` | One file | Each change to the mutation jobs changes turbo's global hash |
| `workflow_run` on `verify` | Separate workflow | The run belongs to the default branch, not to the pull request: it reports no check on the pull request, and it runs the pull request's code with the token of the base branch |
| A first job that waits for the check `verify` | No change to `verify.yml` | A runner waits for the whole `verify` run |
| Start at the same time (ADR 0066, before) | Shortest time to a result | Runs mutation on pull requests whose checks fail |

## Consequences

- A pull request gets its mutation result after `verify`, not at the same time. With the reports and mutant results
  of ADR 0091, most pushes restore most shards, so the added time is mostly that of `verify`.
- A pull request whose `verify` fails starts no mutation runner.
- Branch protection requires only `gatekeeper`, so the new check names need no change of a setting.
