---
status: accepted
date: 2026-11-14
---

# 0128. A paid run of the reference factory, started by a maintainer

## Context

T-27's last slice is a first run of the reference factory on a sample repository with a paid model. The owner
approved it with the OpenRouter key that the environment `smoke-paid` of GitHub Actions already holds (ADR 0077):
a task that a maintainer points at a branch and starts, ideally only maintainers and admins, and cheap.

## Decision

- **The workflow.** [`paid-reference-run.yml`](../../.github/workflows/paid-reference-run.yml) runs only on
  `workflow_dispatch`, never on a push, a pull request or a schedule. Inputs: `ref`, the branch or commit whose
  factory runs (default `main`), and `model`, the OpenRouter model (default `deepseek/deepseek-v4.1-flash-1017`, the
  one model of `weekly-paid.yml` and SMOKE-PAID).
- **Only maintainers and admins.** GitHub lets only people with write access dispatch a workflow. The first job
  `guard` narrows that: with the workflow's `GITHUB_TOKEN` (`contents: read`) it reads
  `GET /repos/{owner}/{repo}/collaborators/{actor}/permission` for `github.triggering_actor` and fails unless the
  permission is `admin` or `maintain`. The job `run` needs `guard`, and only it uses the environment `smoke-paid`.
- **A sample of the job.** `e2e/paid/reference/run.sh` starts Forgejo in a container of the job, creates a tiny
  sample repository (`math.js` with `subtract`, its `node --test` test, a README) and the issue "Add a function
  add(a, b)". So the run needs no token of another repository and pushes nowhere outside the job.
- **The factory.** The profile runs from the e2e image of the checked-out branch (ADR 0076), with the factory of
  `e2e/paid/reference/factory/`: the reference factory's implement stage alone, on opencode, through the profile's
  LiteLLM. The script submits the issue as a work item to intake and waits for its status.
- **Cost cap.** The factory's `inference.budget` is 0.50 USD: LiteLLM refuses the run's model calls once its key spent
  more (ADR 0108). The job's timeout is 30 minutes, the wait for the run 20 minutes. One stage on a cheap model and a
  task of a few lines costs about 0.01 to 0.05 USD. The key's own credit limit stays the hard limit (ADR 0077).
- **Secrets.** `OPENROUTER_API_KEY` is set only in the step that runs `run.sh`, and only the service `litellm` gets
  it; foreman and the agent get a LiteLLM key of the run. The Forgejo token and password are made in the job, masked
  in the log and gone with the job's containers. The agent pushes and opens the pull request with them through
  `~/.netrc` in foreman's container, so they are in no prompt.
- **Result.** The job succeeds when the work item is `complete` and the sample repository has an open pull request;
  the job summary shows the issue, the pull request and its diff. Otherwise it fails with the work item's status. The
  artifact `paid-reference-run` holds the summary, the logs of the services and foreman's data folder with the run's
  transcripts and run records.

Start it:

```sh
gh workflow run paid-reference-run.yml -f ref=<branch or commit>
gh workflow run paid-reference-run.yml -f ref=main -f model=<openrouter model>
```

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The released Compose profile, GitHub and the reference factory as is (Claude Code, every stage) | The full reference factory | Claude Code runs only on a person's subscription (ADR 0077), a sample on GitHub needs a token with write access to another repository, the spec gate needs a person in Slack, and six stages on Opus cost dollars |
| The e2e profile with Forgejo, the implement stage on opencode (chosen) | Self-contained, cheap, the key reaches one service, uses the branch's code | Not every stage of the reference factory; its implement prompt has a Forgejo variant without `gh` |
| A new system test with the testkit | The testkit starts Forgejo already | A paid run is no system test: no scenario, no fakes (as SMOKE-PAID) |

## Prior art

No new dependency or service: Forgejo (ADR 0016), opencode (ADR 0052), LiteLLM (ADR 0056) and OpenRouter
(ADR 0077) are in use already.

## Consequences

- A maintainer can run the reference factory with a real model on any branch for a few cents.
- T-27's slice is done when a maintainer's run of the workflow opens the pull request; it moved to T-21, the paid
  runs at the end of `TODO.md`, where it is also the foreman's slice: the foreman with a real harness and model.
- The factory implementing an issue of this repository is phase 3 (`docs/explanation/bootstrapping.md`), not this
  workflow.
- Revisit when the stages triage, review and ship can run on opencode, or when the profile runs a sample on GitHub
  with a token of its own.
