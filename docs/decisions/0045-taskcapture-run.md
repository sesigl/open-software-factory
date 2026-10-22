---
status: accepted
date: 2026-10-22
---

# 0045. taskcapture runs the suite with Harbor, captures a run's pull request, and checks its own suite nightly

## Context

ADR 0043 built the first slice of TODO item T-09: `capture`, `report` and `route`. A team still had to call
`harbor run` once per configuration by hand and then call `report`. Three parts of T-09 were left:

- **`taskcapture run`**: the `harbor` CLI as a separate process for a matrix of models and configurations
  (SCN-FACTORY-BENCH-003), with no real side effects during a replay (BENCH-002).
- **A task from a run record**: "Add to benchmark" on a run (BENCH-001). A run record (ADR 0023) names the pull
  requests of its run in `osf.pull_request.urls`, but holds no prompt text.
- **The dogfood**: a suite from this repository's pull requests that runs nightly. T-09 is done when it does.

Harbor 0.24 decides the network of each phase of a trial from the task's `task.toml`: `[environment]` sets the
baseline, `[agent]` and `[verifier]` can override it with `network_mode` (`public`, `no-network`, `allowlist`).
`harbor run --allow-agent-host <host>` adds a host to the agent phase. On Docker, Harbor enforces this with an
egress control sidecar. The factory's own ports for chat and forge (T-15) do not exist yet, so there is no
factory adapter a replay could point at a fake.

## Decision

- **`taskcapture run --agent <agent> [--model <model>]... [--configuration <name>[=<file>]]... [--suite]
  [--jobs] [--allow-host <host>]...`** runs one Harbor job per configuration, one after the other:
  `harbor run --path <suite> --agent <agent> --model <model>... --job-name <name> --jobs-dir <jobs> --yes --quiet`,
  plus `--config <file>` when the configuration names a Harbor job config file (agent options, environment,
  attempts), and `--allow-agent-host <host>` for each `--allow-host`. Without `--configuration`, the one job is
  named `default`. The suite defaults to `$OUTPUT/suite`, the jobs to `$OUTPUT/jobs`. Harbor's output goes to
  standard error. After the last job, `run` writes the report of those jobs exactly like `report` (`--out`,
  `--markdown`, `--chart`). A job that exits with an error stops the run with exit code 1 and no report.
- **The Harbor command** is `harbor` on the `PATH`, or the executable in `TASKCAPTURE_HARBOR`. System tests set
  it to a scripted stand-in that records its arguments and writes trial results the way Harbor does. A Harbor that
  cannot start exits 1 and says how to install it (`uv tool install harbor`).
- **Replay without side effects.** `capture` writes `[agent] network_mode = "no-network"` into every task. During
  its run the agent reaches only the hosts of `--allow-host`, normally the model gateway. A call to a real chat or
  forge fails instead of posting or opening anything. Setup and the verifier keep the network of the environment,
  so `npm install` still works. A captured task carries no credential (ADR 0043). When the channel and forge ports
  exist (T-15), a replay also points them at the testkit fakes, so a task that must post or open a pull request
  can be scored on what it sent.
- **`capture --run <run record>`** reads the run record with `runSpans` from `@opensoftware/contracts` (ADR 0041)
  and captures the pull request it names. A run that names several pull requests needs the one to capture as the
  argument, and it must be one of them. The task's `[metadata]` gets `run_id`, `run_harness`, `run_model` and
  `run_cost_usd`, so the original run's model and cost stay next to the benchmark results. A run without a pull
  request, an argument the run does not name, and a file that is no run record exit 2.
- **The dogfood** is the workflow `.github/workflows/taskcapture-suite.yml`. Every night it captures a fixed list
  of this repository's merged pull requests whose system tests need no Docker, runs the suite with Harbor's
  `oracle` agent (the pull request's own change) and its `nop` agent (no change), and fails unless the oracle
  scores 1 and the no-op agent scores 0 on every task. This proves each task is solvable and that its hidden tests
  fail without the change. Both agents call no model, so the nightly run costs nothing. Runs with real models are
  a slice of T-21, after the owner names the models and the budget.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `harbor run` as a separate process | Harbor's own CLI and job folders; any Harbor environment and agent | Python must be installed next to Node |
| Harbor's Python API in a Python adapter | Finer control | A Python module in a TypeScript repository (ADR 0009 allows Python only for a Harbor agent plugin) |
| One Harbor job per configuration | The job folder names the configuration, which `report` already reads | Jobs run one after the other |
| Agent phase without network, `--allow-host` for the gateway | Harbor enforces it; no fake has to know Slack's or GitHub's API | A task that must post to chat cannot be scored on it yet |
| Fake chat and forge servers next to the agent | Records what the agent sent | The agent has no factory port to point at them yet; it would need agent-specific variables |
| Nightly with `oracle` and `nop` | Free; catches broken tasks | Measures the suite, not a model |
| Nightly with a real model | Measures a model | A paid call; the owner decides (T-21) |

## Prior art

- Harbor (Apache-2.0, Laude Institute, 0.24.0 of 2026-10-05, released often): `harbor run` with `--config`,
  `--job-name`, `--jobs-dir` and `--allow-agent-host`, the `oracle` and `nop` agents, and per-phase network
  policies with an egress sidecar on Docker. Adopted as the runner.
- SWE-bench's harness (MIT, active) validates each instance by running the gold patch and the empty patch. The
  nightly oracle and no-op runs do the same.
- Inspect (MIT, UK AISI, active) has sandboxes with network control. Not adopted, for the reason in ADR 0043.
- `@opensoftware/contracts` `runSpans` (ours, ADR 0041) reads the run record; no new dependency.

## Consequences

- One command runs the whole matrix and prints the pick.
- A replay cannot reach a real chat or forge, but a task cannot yet be scored on the messages it would have sent.
  Revisit with T-15.
- The nightly run shows when a task breaks, for example when an image or a lockfile no longer installs.
- Pull requests whose system tests need Docker cannot join the nightly suite, since a Harbor container has no
  Docker.
