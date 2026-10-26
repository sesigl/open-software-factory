---
status: accepted
date: 2026-10-26
---

# 0069. foreman waits for a pull request's checks before a stage

## Context

TODO item T-17 lists the next slice of the foreman: a failing CI check stops the ship stage. The vision scenario
ORCH-004 says it plainly: "Given a pull request whose required CI checks fail, Then the factory does not ship the
change". ADR 0067 and ADR 0068 run the stages of `workflow` one after the other, with gates and sandboxes, but a stage
starts as soon as the one before it succeeded.

Much of it exists:

- The forge port (ADR 0057) has `pr <repo> <number>`, which prints the pull request with `checks`: the name, state
  (`pending`, `success`, `failure`, `error`), description and URL of each check of its head commit. The forgejo and
  github adapters pass its conformance scenarios.
- The testkit has `fakes.github`, a fake of GitHub's REST API with commit statuses, and the forge-github adapter runs
  against it (ADR 0058).
- runlog already takes the run's pull requests from the links that a tool printed in the session (`osf.pull_request.urls`).

Three things are missing: a way to say in `factory.yaml` which checks a stage waits for, a way for the foreman to know
the run's pull request, and the wait itself.

## Decision

- **`checks` on a stage.** The factory definition gets `workflow[].checks`: the names of the checks that must succeed
  on the run's pull request before the stage starts, for example `checks: [verify]`. A name is the check's name on the
  forge (a commit status context), any non-empty text. The field is optional, so the contract change is a minor one.
- **The run's pull request** is the last pull request link that an agent of an earlier stage wrote: in its messages or
  in the output of its tool calls, which the foreman sees as the ACP client. A link is `https://<host>/<owner>/<name>/pull/<n>`
  (GitHub) or `/pulls/<n>` (Forgejo), as runlog reads it. The agent's prompt says to end with the link. The foreman
  keeps it in the run's view as `pullRequest`, adds a line `Pull request: <link>` to the prompt of every later stage,
  and lists it in `run.completed@v1` under `pullRequests`.
- **The forge adapter.** The factory names it under `providers.forge`. A factory with a stage that has `checks` must
  name exactly one; otherwise `foreman serve` exits 2 with `/workflow/<i>/checks: name one forge adapter under
  providers.forge`. Its command line comes from `FOREMAN_FORGES`, a JSON object from adapter name to command line, like
  `FOREMAN_HARNESSES` and `FOREMAN_SANDBOXES`; an adapter it does not name runs `npx -y @opensoftware/forge-<name>`.
  The adapter gets `FORGE_URL` and `FORGE_TOKEN` from `FOREMAN_FORGE_URL` and `FOREMAN_FORGE_TOKEN`.
- **The wait.** Before a stage with `checks` (and before its gate, so no person is asked to approve a change whose
  checks fail), the foreman runs `pr <owner>/<name> <n>` and reads the named checks:
  - every one `success`: the stage goes on to its gate or starts;
  - one `failure` or `error`: the stage is `failed` without running its agent, and the run is `failed`;
  - otherwise (a check `pending`, or one the pull request does not have yet): the run and the stage are `blocked`, and
    the foreman asks again after `FOREMAN_CHECK_POLL_MS` (default 30000) with a Temporal timer. A cancel ends the wait.
  The stage's view lists the checks as last read under `checks`, each with `name` and `state`.
  - Without a pull request link from an earlier stage, the stage is `failed` with the reason `no earlier stage linked a
    pull request`. A stage's view gets `reason`: why it ended without success, when the foreman knows.
  - An adapter that fails (the forge is down, the token is wrong) fails the activity; Temporal retries it up to 3 times,
    as it does a stage, then the run is `failed`.
- **Contracts.** `Stage.checks` in `factory-definition`; `RunView.pullRequest`, `StageView.checks` (the new model
  `CheckView`) and `StageView.reason` in `foreman.tsp`. All are optional fields: minor changes.
- **Layers.** `domain` finds the links, reads the checks into a fact and decides the next step; `adapters/forge.ts` runs
  the adapter's `pr`; the workflow only asks for the step, waits on the timer and hands over the fact.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `checks` on the stage in `factory.yaml` | The factory says what blocks what; any stage, not only one named "ship" | One more field in the contract |
| A fixed stage name "ship" that waits for all checks | No contract change | Hidden rule; a factory cannot name the checks that matter |
| The forge's merge rules alone (`protect --check`) | Already in the port | Stops only the merge, not the stage's agent, and needs admin rights on the repository |
| The pull request from the last link an agent wrote | Works with every harness and agent; runlog reads links the same way | An agent that writes another pull request's link last misleads the foreman |
| The foreman opens the pull request itself | The foreman knows its number | Takes the branch and the title away from the agent; a later slice can add it |
| A file the agent writes, like `.osf/pull-request` | Explicit | A convention every prompt and harness must follow; the file ends up in the repository |
| Poll the forge with a Temporal timer | Works with every forge adapter; durable across restarts | One `pr` call per interval while a stage waits |
| Wait for a check event | No polling | The forge port has no check event yet; a later slice can add one and keep the timer as a fallback |

## Prior art

- The forge port and its adapters (ADR 0057, ADR 0058): adopted as they are. This slice changes neither the port nor
  an adapter.
- Temporal's durable timers (MIT, Temporal Technologies, very active), already used by the foreman (ADR 0067): adopted
  for the wait.
- GitHub Actions' `needs` and required status checks, and Argo Workflows' `when` conditions (Apache-2.0, active):
  checked for the shape of the rule. Both name what a step waits for in the step itself, as `checks` does.
- Mergify and Kodiak (Apache-2.0 and MIT, active) merge a pull request once its checks pass. Checked: they act on the
  merge, not on the start of an agent's stage, and they are services of their own. A factory can still use one behind
  its ship agent.

No new dependency.

## Consequences

- A factory can keep an agent from shipping a change whose CI fails, and the run says which check failed.
- A stage waits as long as a check is pending; only a cancel ends that wait. Revisit with a timeout per stage when a
  real factory needs one.
- An agent must write its pull request's link; the README's prompt shows how. Revisit when the foreman opens pull
  requests itself.
- A factory that works on two forges cannot use `checks` yet.
