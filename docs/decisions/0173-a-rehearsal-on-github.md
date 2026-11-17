---
status: accepted
topic: factory
date: 2026-11-17
---

# 0173. A rehearsal on GitHub with the scripted agent

## Context

Phase 3 (`docs/explanation/bootstrapping.md`) runs the factory of `deploy/dogfood/factory/` on this repository's issues
with Claude Code. Every part of its path is proven against fakes: the smoke suite (ADR 0076) runs stages with the
testkit's scripted agent against a Forgejo of the test, gatekeeper's scenarios ask on pull requests of `fakes.github`,
and the paid reference run (ADR 0128) runs one stage with a real model on a Forgejo of the job. Nothing has run the six
stages, triage, spec, the gate, implement and review, verify and ship, on the real GitHub. T-95 asks for that once,
started by a maintainer, without a paid model call.

What Step 1 of T-95 found:

- **How an issue gets in.** intake takes GitHub issues only as webhook deliveries at `/forge/events` (an issue that
  gets the label `factory`), or as `POST /v1/work-items`. A GitHub runner has no public URL for a webhook, and intake
  does not poll.
- **How the gate is answered.** With `GATEKEEPER_FORGE_TOKEN`, gatekeeper asks on the pull request that the request
  links and decides on a later comment `/approve` of a member of the gate's groups. The forge adapter marks the
  token's own comments `mine` (ADR 0062), and gatekeeper skips them: they are its requests. So when gatekeeper's token
  is the approver's own, as `deploy/README.md` set up this repository's factory ("the same token"), the approver's
  `/approve` never counts and the gate stays pending. One identity cannot ask and answer.
- **What the tokens must do.** The agents clone, push a branch, open a draft pull request, label it and mark it
  ready (GraphQL `markPullRequestReadyForReview`). gatekeeper comments on the pull request, sets its commit status
  and reads its checks; foreman lists the pull requests of the run's branch and reads the check runs and statuses of
  the head commit (`Checks: read`). A pull request opened with a workflow's `GITHUB_TOKEN` starts no workflow, so its
  check `verify` would never run.

## Decision

- The rehearsal is the workflow `rehearsal` of the scratch repository, `workflow_dispatch` only, from
  `deploy/dogfood/rehearsal/seed/` of this repository, which also holds the scratch repository's `README.md`, a tiny
  Node library and `verify.yml` (the check run `verify`, and proof's action for the status `proof`). A maintainer
  copies the seed to the scratch repository's `main` and starts the workflow with the `ref` of this repository to
  rehearse.
- It runs on two identities. The agents and the issue use the secret `REHEARSAL_TOKEN`, a fine-grained token of the
  scratch repository only (Contents, Issues and Pull requests: read and write), so their pull request starts
  `verify.yml`. gatekeeper and foreman use the scratch repository's `GITHUB_TOKEN`, `github-actions[bot]`, with
  `issues`, `pull-requests` and `statuses: write` and `checks: read`. A maintainer comments `/approve` by hand; with
  the input `gate: token` the workflow comments it with `REHEARSAL_TOKEN`, and the summary says that no person
  answered.
- It runs the modules from the e2e image of that commit (ADR 0076), not the released images: the image holds the
  scripted agent, and the rehearsal tests the commit that phase 3 would run. It uses the e2e Compose override, so the
  agents run in foreman's container without a sandbox, with the override's fixed clock.
- `osf rehearsal factory` writes the factory from `deploy/dogfood/factory/`: its workflow and prompts as they are, its
  agents on the harness `acp` (the scripted agent) without a sandbox, and the maintainer who started it as the only
  member of `maintainers`; and the scripted agent's turns, one per agent, matched by the first line of its prompt,
  which work with Git, curl and the helper `deploy/dogfood/rehearsal/agent/github.mjs`.
- `osf rehearsal run` opens the issue with the labels `factory` and `rehearsal` and posts its `labeled` event to
  intake's `/forge/events`, signed with the run's webhook secret, as a relay like smee.io forwards GitHub's delivery.
  It follows the run at foreman, writes the summary and the run as the job summary and an artifact, and fails with the
  stage and its reason. Both commands refuse `sesigl/open-software-factory`.
- Everything the rehearsal leaves on the scratch repository is labeled `rehearsal`; the maintainer closes it.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A workflow in this repository with one token for everything | One place, the preferred form of T-95 | gatekeeper would skip the approver's `/approve` as its own comment; the gate cannot be answered |
| The same, with a second account's or a GitHub App's token as a second secret | The factory's real identity, the answer of T-99 | Needs the owner's decision of T-99 first; an App's installation token cannot call `GET /user`, so the forge adapter would name `github-actions[bot]` as itself |
| The workflow in the scratch repository, its `GITHUB_TOKEN` for gatekeeper and foreman (chosen) | A second identity without a new account; the scratch repository's own checks; one secret | The workflow lives outside this repository, from a seed the maintainer copies; the agents still act as the token's owner |
| A webhook relay (smee.io) from the scratch repository to the runner | Proves GitHub's delivery | A third-party service in the path, and a webhook that a person sets up per run |
| `POST /v1/work-items` in place of the event | No signature needed | Skips intake's GitHub path and the forge adapter's parsing of a real issue |
| The released images | What users run | Do not hold the scripted agent; a rehearsal of a branch would test other code |
| A script on a maintainer's machine only | Docker and the token stay local | Not one action; `run.sh` stays the fallback |

## Prior art

- The paid reference run (ADR 0128, `e2e/paid/reference/run.sh`) starts the profile from the e2e image with a factory
  of its own and submits one work item; the rehearsal follows it, on GitHub and with the scripted agent.
- GitHub's own docs: events that `GITHUB_TOKEN` causes start no workflow, except `workflow_dispatch` and
  `repository_dispatch`, which is why the agents push with a personal token; and fine-grained tokens can be limited to
  one repository with per-permission access.
- smee.io (MIT, maintained by Probot) forwards webhook deliveries; the rehearsal posts the same delivery itself, so no
  service of a third party sits in the path. No new dependency or service.

## Consequences

- Phase 3 has a run on the real GitHub before the first real one: a regression of the GitHub path shows in a run that
  costs nothing but runner minutes.
- The rehearsal does not prove GitHub's webhook delivery to intake, the sandboxes and the image `dogfood-agent`,
  Claude Code and its model, or the released images. The smoke suite (SCN-E2E-006) and SCN-DIST-070 cover the
  sandboxes; the paid runs cover the harnesses.
- The finding about gatekeeper's own comments holds for this repository's factory too: with the owner's token as
  `GATEKEEPER_FORGE_TOKEN`, the owner's `/approve` never counts. Phase 3 needs gatekeeper on another identity than the
  approver, which is T-99.
- Revisit when T-99 gives the factory its own identity: then the workflow can move to this repository with that
  identity's token as its second secret.
