---
status: accepted
date: 2026-11-12
---

# 0104. forge-github reads the check runs of GitHub Actions next to the commit statuses

## Context

ADR 0057 decided that a check is a commit status, and ADR 0058 that `pr` of `forge-github` reads only the combined
status of the head commit. A job of GitHub Actions does not post a commit status: it is a check run of GitHub's
checks API (`GET /commits/<sha>/check-runs`). On a repository whose CI does not post a status by hand, `pr` lists no
check, and a foreman stage with `checks: [verify]` waits forever (TODO item T-37). ADR 0057 also says that the checks
API needs a GitHub App. That holds for writing check runs, not for reading them: any token with the permission
`Checks: read` may read them.

## Decision

This ADR supersedes the part "checks are commit statuses" of ADR 0057 and ADR 0058 for what `pr` of `forge-github`
reads. `check` still writes a commit status, and the merge rules still require checks by name.

- `pr` reads the commit statuses and the check runs of the head commit, 100 check runs per page, every page.
- A check run's state:

  | Check run | State |
  | --- | --- |
  | `status` not `completed` (`queued`, `in_progress`, `waiting`, `requested`, `pending`) | `pending` |
  | conclusion `success`, `neutral` or `skipped` | `success` |
  | conclusion `failure` | `failure` |
  | any other conclusion (`timed_out`, `cancelled`, `action_required`, `stale`, `startup_failure`) | `error` |

  `neutral` and `skipped` count as passing because GitHub's branch protection counts them as passing. Nothing else
  that did not succeed counts as success. `error` is the commit statuses' state for a check that could not finish.
- Of several check runs with one name, as after a re-run, the newest counts: the one with the highest ID.
- Of a commit status and a check run with one name, the worse state counts, in the order `success`, `pending`,
  `failure`, `error`. A check counts as passed only when everything of that name passed.
- A check run's `description` is its output's title, and its `url` its page on GitHub.
- A token that may not read check runs (GitHub answers 403) makes `pr` exit 1 with
  `the token may not read the check runs of <repo>: give it the permission "Checks: read"`.
- `fakes.github` keeps check runs that a test adds with `checkRun`, lists them by page, and has `noChecksToken`, a
  token whose call for check runs answers 403.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Check runs next to statuses, the worse state wins | Works with GitHub Actions and with CI that posts statuses; no check passes while a part of it fails | Two calls, and pages of check runs |
| Check runs only | One call | Breaks CI that posts commit statuses, like gatekeeper's own status |
| The check run wins over a status of the same name | Simple | A failing status would be hidden by a passing job |
| `GET /commits/<sha>/check-suites` | Fewer entries | A suite is a whole workflow; a stage names a job |

## Prior art

- GitHub's branch protection reads both commit statuses and check runs as "status checks", by name, and treats
  `neutral` and `skipped` as passing.
- `gh pr checks` of GitHub's CLI (MIT, maintained) lists check runs and commit statuses of a pull request together.
  It is a program for people, not a library a TypeScript adapter can call, so the adapter makes the two calls itself.
- vercel-labs/emulate (Apache-2.0, maintained; ADR 0058) serves check runs but no commit statuses, so we extend
  `fakes.github` again instead of adopting it.

## Consequences

- A stage with `checks: [<job name>]` starts once that job of GitHub Actions succeeded, without a status posted by
  hand.
- The token of `pr` needs `Checks: read` too. A token without it fails with that name, not with a stage that waits.
- The forgejo adapter is unchanged: Forgejo's Actions post commit statuses.
