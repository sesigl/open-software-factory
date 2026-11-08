---
status: accepted
date: 2026-11-08
---

# 0090. No leaked containers from local runs

## Context

On a developer's machine, 170 containers ran after one working day: whole Compose profiles of the deploy scenarios
(`osf-sut-*`) and LiteLLM gateways of the foreman's scenarios (`osf-inference-*`). Three causes:

- The Claude Code `Stop` hook ran `make check` at the end of every turn. `make check` runs the system tests of every
  unit changed since `OSF_BASE`; on a long branch that is nearly all, with a Compose profile per deploy scenario.
- A run that ends without its teardown, because a hook ends, a worker is killed or a person stops it, never runs
  `docker compose down`. The next run did not know about the old projects.
- A foreman that is killed never stops its gateway, also in production.

CI's mutation runner already removes the containers of a run that ended (ADR 0084), but only for its own runs.

## Decision

- **A fast Stop hook.** `make check-fast` runs the affected lint and typecheck and the repository checks: no system
  test, no container, seconds. The `Stop` hook runs it. `make check` keeps its meaning; `make verify` and CI run every
  system test, so nothing is checked less before a merge.
- **Projects name their owner.** `sut.compose` writes the ID of the process that owns each project to
  `~/.cache/osf-testkit/compose-owners/<project>.pid`, below the user's own home, so nested runs with their own `HOME`
  and `TMPDIR` share it. Before its first project, a process takes down every `osf-sut-*` project whose file is
  missing or names a process that no longer runs, with its volumes.
- **Gateways name their owner.** The inference port's `start` takes `OSF_INFERENCE_OWNER`, the launcher's process ID;
  the foreman sets it to its own. inference-litellm labels the gateway with it and its host, and its `start` removes the gateways
  whose owner on the same host no longer runs, once they are older than `OSF_INFERENCE_ORPHAN_AGE` seconds (120). The
  age leaves a gateway alone while a parallel `start` still creates it. A gateway without the label, or of another
  host, is never touched.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Owner files and labels, swept by the next run (chosen) | Works when a process is killed with SIGKILL; no daemon | A leak lives until the next run on that machine |
| testcontainers' Ryuk for Compose projects | Removes at once when the process dies | Needs a label on every service, network and volume of a Compose file the test does not own; Ryuk is shared across Stryker processes (ADR 0084) |
| Only the fast Stop hook | Small | Killed runs still leak; the gateway leak stays in production |

## Prior art

- **testcontainers Ryuk** (MIT): the same goal by labels and a reaper container; see the options.
- **The mutation runner's run labels** (ADR 0084): labels per run, removed when the run ends.
- **PID files** of Unix daemons, with signal 0 to test whether the process lives.

## Consequences

- An agent's turn ends in seconds, and no container starts at the end of a turn.
- A leak from a killed run is removed by the next run that starts a project or a gateway on the same machine.
- A process ID that the system gave to a new process keeps an old project until that process ends.
