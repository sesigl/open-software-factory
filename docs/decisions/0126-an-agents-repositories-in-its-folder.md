---
status: accepted
date: 2026-11-14
---

# 0126. An agent's repositories in its folder

## Context

T-44: an agent's `repositories` in `factory.yaml` ("clone URLs or `<owner>/<name>`") did nothing in a run of the
foreman; only `factory apply` read them, to register a webhook on each. The reference prompts (T-27) tell the agent to
clone the work item's repository itself with `gh repo clone`, so an agent that works on a second, fixed repository (a
shared library, a docs site, a factory's own repository) had to name it in its prompt. ADR 0112 already writes an
agent's skills into the session's folder before its turn, on the host and in a sandbox. The foreman has no Git token of
its own: the forge adapters hold the forge's token, and the agent gets its secrets only in its sandbox (ADR 0068).

## Decision

- Before a stage's turn, the foreman clones each repository its agent declares into the run's folder below
  `repositories/<name>`, with `git clone --depth 1`: the last commit of the default branch. `<name>` is the last
  segment of the URL without `.git`.
- An entry with a scheme (`https://…`, `file://…`, `ssh://…`) is cloned as it is; `<owner>/<name>` is
  `https://github.com/<owner>/<name>.git`.
- A folder that an earlier stage or an earlier run's take over left is kept, not cloned again: the stages of a run
  share their folder, and an agent's changes to it stay.
- The clone happens before the folder is copied into a sandbox, so a sandboxed agent finds it too, and its egress
  needs no Git host.
- A clone that fails fails the stage's activity; Temporal tries it three times, then the run fails with Git's message.
- The foreman passes no credential to Git. A private repository needs a URL that Git on the foreman's host can read on
  its own (a credential helper or an SSH key of the host); none is written into a URL or a file of the run.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Shallow clone into `repositories/<name>` before the turn (chosen) | The field takes effect for every harness and sandbox; no new dependency | A private repository needs Git credentials on the host |
| `factory lint` warns that `repositories` has no effect | No code in the foreman | The field stays declared without effect; T-44 prefers effect |
| Clone with the forge adapter's token | Private repositories of the forge work | The token would reach Git's config or a URL in the run's folder, which a sandbox copies |

## Prior art

GitHub Actions' `actions/checkout` and Jenkins' multi-SCM checkouts clone extra repositories into subfolders of the
job's workspace, shallow by default in `actions/checkout`. Nothing new is adopted: the foreman runs `git`, which it
already runs for the factory's commit (ADR 0124).

## Consequences

- An agent's `repositories` take effect in each run, on the host and in a sandbox.
- A run does not pin a declared repository's commit; two runs of one factory commit can see two commits of it.
- `<owner>/<name>` means GitHub. A factory on Forgejo or GitHub Enterprise Server names the clone URL.
- Revisit credentials when a forge adapter can hand out a short-lived read token for a clone.
