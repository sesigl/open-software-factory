---
status: accepted
topic: design-note
date: 2026-11-17
---

# 0174. The release pull request gets its gate and its proof by workflow_dispatch, and merges without --admin

## Context

The branch protection of `main` requires the commit statuses `verify`, `proof` and `gatekeeper`. release-please opens
and updates the release pull request with `GITHUB_TOKEN`, and events caused by that token start no workflow, so the
release pull request got no `pull_request` run of `verify` and no `pull_request_target` run of `gatekeeper`.
`release-please.yml` already started `verify` on it with `workflow_dispatch`, which reported `verify`; nothing reported
`proof` (the proof step of `verify.yml` runs only on `pull_request` events) or `gatekeeper`. Release pull request #371
showed only `verify: success` on its head `9ca5001`, its `mergeable_state` was `blocked`, and every release was merged
with `gh pr merge --admin` (`skills/release-packages`, TODO.md T-72). An admin merge passes every rule, also a red
`verify`.

## Decision

- **The gate by number.** `gatekeeper.yml` takes `workflow_dispatch` with the input `pr`, the number of a pull request.
  Such a run evaluates the same policy (`.github/gatekeeper/merge.rego`) with the same groups for that pull request and
  sets the commit status `gatekeeper` on its head, as the `pull_request_target` path does. The policy decides:
  release-please's branch `release-please--branches--main` is no factory branch and has no label `factory`, so the
  policy asks no group (risk `low`) and gatekeeper approves it "by the policy", as it approves every pull request that
  a person opens. A factory-made pull request still waits for a maintainer's `/approve`, whoever starts the run. The
  policy is unchanged.
- **Trusted code only.** A dispatched run checks out the default branch, as the `pull_request_target` path does, and
  never the pull request: the policy, the groups, gatekeeper and the forge adapter come from `main`. The job runs only
  when the run's ref is the default branch, so a dispatch from another branch does nothing. The input is only used as
  a number: the step refuses anything but 1 to 10 digits, gets it through `env`, never through `${{ }}` in the script,
  and builds the pull request's URL from `GITHUB_SERVER_URL` and `GITHUB_REPOSITORY`. gatekeeper reads the pull
  request's branch, labels and paths from the forge's API as data for the policy.
- **The steps of the action, not the action.** The gatekeeper and proof actions read the pull request from the event,
  and a `workflow_dispatch` event has none. The dispatched paths run the same commands as the actions' scripts:
  setup-opa and `install-opa.sh`, then `gatekeeper request` and `status` with `--pull-request`; and `proof bundle`
  with `--commit` and `--pull-request`, `verify` and `attach`. Neither module changes.
- **Proof on the dispatched verify.** The `verify` job of a dispatched run bundles the JUnit results of every suite
  with the head that the job merged, attaches the bundle to the release pull request and so sets the status `proof`
  on that head. The status `verify` also goes to that head, no longer to the head that `gh pr view` reads at the end.
- **Both starts after each push to main.** `release-please.yml` starts `verify.yml` and `gatekeeper.yml` with
  `--ref main -f pr=<n>` for every open release pull request. RELEASE fails when `release-please.yml` starts one of
  them without `--ref main` and `-f pr=`, or when one of them has no `workflow_dispatch` input `pr` (SCN-REPO-235
  to -237).
- The release pull request is merged with `gh pr merge <n> --squash`, without `--admin`, once all three statuses are
  green. The merge still publishes every package, so an agent asks the maintainer first (root `AGENTS.md`).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `workflow_dispatch` paths in gatekeeper.yml and verify.yml (chosen) | the same files and policy as on every pull request; no module changes; a maintainer can rerun a gate by hand | the dispatched steps repeat what the two actions' scripts run, about 15 lines each |
| A `pull-request` input of the gatekeeper and proof actions | no repeated steps; other repositories with release-please need it too | two module changes with scenarios and releases for one repository's CI; worth it once another user asks |
| A personal access token or a GitHub App for release-please | its events start the normal runs | a credential to keep and rotate; a person's token ties the releases to that person |
| A rule in `merge.rego` that passes release-please's pull requests | explicit | not needed, as the policy passes them already; a rule that passes by branch name hard-codes trust in a branch |
| Take `gatekeeper` and `proof` out of the required statuses for release pull requests | nothing to build | branch protection cannot require statuses per branch of the head; the admin merge stays |
| Keep `--admin` | nothing to build | an admin merge ignores a red `verify`, and every release needs the owner's rights |

## Consequences

- A release pull request gets `verify`, `proof` and `gatekeeper` on its head and merges with a normal merge. Only the
  next release pull request proves it: GitHub Actions does not run locally.
- A maintainer can start the gate for any pull request with `gh workflow run gatekeeper.yml --ref main -f pr=<n>`,
  also when its `pull_request_target` run ended in `startup_failure` (six runs in November 2026, on three
  branches; issue_comment runs of the same workflow file succeeded in the same hours, and GitHub's API shows no cause).
- Anyone who may start workflows may already set any commit status with their own token, so the dispatch path adds no
  way around the gate. A dispatched `verify` runs the code of the pull request it names, as before this record.
- When the gatekeeper or proof action changes what it runs, the dispatched steps must change with it. Revisit with an
  input of the actions when another repository needs this.
