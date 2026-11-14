---
status: accepted
date: 2026-11-14
---

# 0136. The forge port commits, merges when green, reads merge rules and closes pull requests

## Context

T-58 makes a change to the factory from the console a pull request: the console edits `factory.yaml`, commits it to
a new branch, opens a pull request and asks the forge to merge it once the check `factory` passes. The forge port
(ADR 0057) can create a branch, open, list and merge a pull request, post a check and write merge rules, but it
cannot commit a file, cannot merge when green, cannot read a branch's rules and cannot close a pull request. The
console keeps no state, so everything it needs to know about a change must come from the forge.

## Decision

Five changes to the forge port, each with `@conformance` scenarios in `ports/forge/features/` that both adapters and
`fakes.github` pass:

| Port operation | Command |
| --- | --- |
| commit | `<adapter> commit <repo> <branch> --message <text> <path>=<file>...` writes one commit with these files, the contents of the local files, to a branch that exists, on top of its head; prints `{"sha"}`. A branch the repository does not have exits 1 with `no branch <repo>:<branch>`. |
| branch from a commit | `branch <repo> <branch> --from <ref>` takes a commit SHA as well as a branch name. |
| merge when green | `merge <repo> <number> --when-green` asks the forge to merge once the required checks pass; it merges at once when they already did, and prints `{"sha"}` then or `{"queued": true}`. A forge that cannot do it for the repository exits 1 with `the forge cannot merge <repo>#<number> when its checks pass`. |
| merge rules | `rules <repo> <branch>` prints `{"checks", "approvals"}`: the names of the checks and the number of approvals the branch requires; a branch without rules prints `{"checks": [], "approvals": 0}`. It only reads. `protect` stays the only command that writes rules, and the console never runs it. |
| close | `close <repo> <number> [--delete-branch]` closes the pull request without merging and prints `{"number", "state"}`; with `--delete-branch` it also deletes its head branch. |
| list | `prs` gets `--limit <n>` and, for a merged pull request, `mergeCommit`. |

How the adapters do it, with the forges' own APIs and no Git checkout:

- **GitHub:** `commit` uses the Git Data API (blobs, a tree on the head's tree, a commit, and moving the branch's
  ref without force), so one call writes several files as one commit. `--when-green` uses auto-merge (the GraphQL
  mutation `enablePullRequestAutoMerge`), which the repository must allow; a pull request whose checks already
  passed merges at once through the REST merge. `rules` reads the branch's protection and the rulesets that apply to
  it: the required status checks and the required approving reviews.
- **Forgejo:** `commit` uses the API that changes several files in one commit (`POST /repos/{owner}/{repo}/contents`);
  `--when-green` uses the merge option `merge_when_checks_succeed`; `rules` reads the branch protection that matches
  the branch (its status check contexts and required approvals).
- `close` sets the pull request's state to closed and, with `--delete-branch`, deletes the branch's ref.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Commands of the forge port on the forges' APIs (chosen) | One way for every client; testable against `fakes.github` and a Forgejo container; no clone | Two APIs per operation |
| A Git checkout in the console that pushes the branch | Works with any Git server | A clone per change, Git credentials in the console, and the forge's merge-when-green is still an API call |
| The console calls the forges' APIs itself | Fewer processes | Breaks the port (ADR 0057): every client would grow forge code |
| Merge in the console once the check passes | Works on every forge | Needs a process that watches; the console keeps no state; the forge's own merge-when-green already exists |

## Prior art

- **GitHub REST and GraphQL API** (Git Data API, auto-merge, branch protection, rulesets): the forge's own features,
  used through `fetch` as forge-github does today.
- **Forgejo API** 11 (`/contents` for several files, `merge_when_checks_succeed`, branch protections): used through
  `fetch` as forge-forgejo does today.
- **Octokit** (MIT, active): checked; forge-github stays on plain `fetch` (ADR 0057), and the few calls do not need it.

## Consequences

- The console can make a change without a clone and without state: the branch, the pull request, its checks and the
  rules tell it everything.
- A repository on GitHub must allow auto-merge for `--when-green`; the console says so when it does not (T-58).
- `fakes.github` gets the commit, auto-merge, rules and close, so the console's scenarios run without a real forge.
