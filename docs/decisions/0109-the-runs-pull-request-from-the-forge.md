---
status: accepted
date: 2026-11-13
---

# 0109. The run's pull request comes from the forge, or from a line the agent states

## Context

The run's pull request is the last pull request link that an agent of the run wrote (ADR 0069, `lastPullRequestIn`).
An agent that names another pull request after its own, for example one it read for context, gives the run the wrong
one. The checks of a later stage (ADR 0069), proof's check (ADR 0088), the gate's links (ADR 0080) and
`run.completed@v1` then all read that pull request. A link of another repository than the work item's is taken as well
(`TODO.md` T-42).

What exists:

- The forge port has `prs <repo> [--head <prefix>] [--state open|closed|all]` (ADR 0073), which both core adapters,
  `forgejo` and `github`, implement and pass its conformance scenarios with (SCN-FORGE-031 to -033). Each line has the
  pull request's `head` branch.
- A work item from a forge, as intake makes it from a labeled issue (ADR 0065), has the issue's page as
  `origin.url`: `<forge>/<owner>/<name>/issues/<n>`. The work item contract has no repository field.
- A run has no branch of its own; the agent picks a branch name.

## Decision

- **The work item's repository** is the repository of its `origin.url` when that is a forge page of an issue or a pull
  request: `<forge>/<owner>/<name>/issues/<n>`, `/pull/<n>` or `/pulls/<n>`. It is the forge's host with
  `<owner>/<name>`. Any other origin names no repository.
- **The run's branch** is `osf/<run ID>`. When the factory names a forge adapter and the work item has a repository,
  the prompt of every stage gets the line `Branch: osf/<run ID>` after the work item, so the agent pushes its change
  there.
- **The run's pull request**, at the end of each stage that ran an agent, when the factory names a forge adapter and
  the work item has a repository:
  1. the pull request that the forge adapter's `prs <owner>/<name> --head osf/<run ID> --state all` lists with exactly
     that head, the highest number first: what the forge knows, not what the model wrote;
  2. else the link of the agent's last line of the stated form `Pull request: <link>`, the same line the foreman gives
     the later stages (ADR 0069);
  3. else the run keeps the pull request it had.
  A link of another repository than the work item's is refused, also a stated one. A link that the agent only
  mentions is not taken. When the stage refuses a link, or the run has no pull request after the stage, the stage's
  view says why in the new optional field `StageView.note`: the refused link, the branch the forge has no pull request
  for, or the adapter's error. A
  `prs` that fails is that note, not a failed stage, because Temporal would run the stage's agent again.
- **Without a forge adapter or a repository** the run takes the last link the agent wrote, as before: nothing can check
  it, and runs that only show their link keep working. The factory's `repositories` of an agent is not read for this;
  T-44 decides what that field does.
- **Contracts.** `StageView.note` is an optional field: a minor change. The forge port does not change.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The forge's `prs` for the run's branch, then a stated line (chosen) | The forge knows which pull request has the run's branch; no port change; the line is the one the foreman already writes | Needs the work item's repository, which only a forge origin gives today |
| Only a stated line `Pull request: <link>` | No forge call; works without a repository | Still what the model wrote; an agent can state a wrong link |
| A file in the run's folder, like `pull-request.json` | Easy to parse | Still what the model wrote; a sandboxed stage must copy it out; one more convention for every prompt |
| A work item field `repository` | States the repository for every origin | A contract change in every producer (intake, console, the API) for one consumer |
| A new port command `pr-for <repo> <branch>` | One call | `prs --head` already lists it; every adapter would need a new command and conformance scenarios |

## Prior art

No new module, dependency or service. GitHub's own API answers "the pull request of a branch" with
`GET /repos/{owner}/{repo}/pulls?head=<owner>:<branch>`, and the `gh pr view <branch>` command looks a pull request up
by its head branch the same way; Renovate and Dependabot name their branches by a fixed prefix and find their pull
requests by it. The forge port's `prs --head` (ADR 0073) already does this for every adapter.

## Consequences

- A run of a forge's issue reads the checks and asks the gate on the pull request of its own branch, whatever else the
  agent links.
- A reference prompt should push to the branch the prompt names; an agent may state its pull request in the line
  `Pull request: <link>`.
- A run whose work item has no forge origin still guesses its pull request; revisit when T-44 gives the agents'
  `repositories` an effect, or when a work item names its repository.
- A run of a work item again (ADR 0105) has a new run ID and so a new branch; it keeps the pull request of the run
  before until a stage gives it another.
