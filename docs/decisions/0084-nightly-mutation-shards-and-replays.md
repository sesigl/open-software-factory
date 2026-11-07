---
status: accepted
date: 2026-11-07
---

# 0084. The nightly mutation run cuts every unit into shards and replays the shards whose inputs did not change

## Context

The nightly run mutates every line (ADR 0037) and runs `osf check MUTATION --total`. Between 26 October and
6 November it failed every night, and each failure opened a new ticket: 15 open tickets with the same title.

- It ran only the 13 units in `modules/`, but `--total` scores every unit that MUTATION covers: 30 units with the
  adapters and the libraries (ADR 0039). The 17 units without a report failed the check every night.
- One runner per unit. intake took 165 to 200 minutes, gatekeeper 100 to 270, and foreman reached the 5-hour limit
  of GitHub every night. factory-spec and observer, and on some nights proof and gatekeeper, ended with "The hosted
  runner lost communication with the server": the runner had no free memory, and GitHub kept no log of the job.
- turbo printed the output of the task only when it ended, so a job that reached the limit showed no progress.
- Every night mutated every line again, also when nothing changed since the night before.
- Each mutant started Vitest through `pnpm exec`, which costs about 0.3 seconds more than starting Vitest's entry.
- Each mutant's run started Vitest with its default pool of workers, which ran the scenario files longest first. Most
  mutants are killed, and the run stops at the first failure: the CPUs ran long scenarios of a mutant that a short
  one kills, and the rest of the cancelled files. Stryker started half as many workers as the runner has CPUs.
- Every module process of every mutant recorded V8 coverage for REACH and wrote it to `reports/coverage/`. A mutation
  run does not read it, and it costs 5 to 10 % of each run (ledger and intake, measured on a laptop).

## Decision

- `osf mutation-plan` prints the shards of a run as JSON, from the units that `osf check MUTATION` scores. With
  `--all` it cuts every unit with a mutation script into shards of about 600 lines, or of the
  `osf.mutationAllLinesPerShard` lines its `package.json` sets, at most 20 (SCN-REPO-092). The units whose scenarios
  start slow services set smaller shards, from the lines per minute of measured runs: intake, gatekeeper, foreman,
  proof, observer, sandbox-kubernetes, inference-litellm, forge-forgejo and harness-opencode. The plan job starts the
  shards that took longest in the last completed nightly run first, and a shard without a time first of all; without
  times, the shards of the units with the fewest lines per shard start first. Only the order depends on the times, so
  the keys do not change. A run at night uses all 20 jobs that GitHub runs at the same time, and a run started by hand
  leaves 4 free for pull requests. The plan warns when a unit needs more than 20 shards. The units that start
  containers, whose runs wait for the Docker daemon more than for the CPUs, set two Stryker workers in
  `osf.mutationConcurrency`. Without `--all` it cuts each unit that a change adds lines to, as `mutation.yml` did in
  its own script (SCN-REPO-093). A new unit joins both runs without a change to a workflow. Each shard tests every
  n-th mutant (ADR 0066).
- The nightly run keys each shard's report on turbo's hash of the unit's `mutation` task, the shard and a scheme
  version. The hash covers the unit's files, the builds of its declared dependencies (which the check AFFECTED keeps
  complete, ADR 0081), the global dependencies of `turbo.json`, and the mutation tooling and its workflow files in the
  task's `inputs`. A shard with a known key restores its report from `actions/cache` and skips its setup and its run.
  Each run saves under its own key, and a restore takes the newest report of the same hash.
- Sunday's run, and a run started by hand with `fresh`, mutate every shard again. They find an input that the hash
  does not cover, such as a timing that changed a Timeout, within a week. A run started by hand with `packages` mutates
  only those packages.
- `.github/actions/mutation-shard` holds the setup and the run of one shard for both workflows. It turns off swap and
  gives Stryker and the tests the highest OOM score, so that the kernel ends a mutant that fills the memory, and the
  runner stays reachable and keeps the log. Every two minutes it prints the free memory and disk, the number of
  containers and the largest processes. turbo streams the output.
- Each run of Vitest in a mutation run has an ID in `OSF_TESTKIT_RUN`, and the testkit labels every container of its
  fakes with it (SCN-TK-129). When the run ends, the runner removes the containers with its label. Ryuk does not:
  testcontainers lets every process of a Stryker run share one Ryuk, which removes the containers only when the last
  process ends. On a shard of forge-forgejo, the Forgejo of each mutant's run stayed, 123 containers of about 220 MB,
  until the kernel ended Stryker.
- A module under test, such as inference-litellm, starts containers with the Docker CLI, without the label, and its
  scenario stops them; when a mutant's run is killed at its first failure or its timeout, they stay. On the first
  sharded run, LiteLLM containers of about 590 MB each stayed for up to 43 minutes, until the runner had 854 MB free
  and GitHub lost it. Each test runner process of Stryker writes the start of its live run into a folder, and every
  30 seconds the shard removes each container that was created after Stryker started and before the oldest live run
  started: no live run can use it. kind's cluster is older than Stryker, and Ryuk serves every run, so both stay.
  Stryker's command runner of a library writes no live runs, so for a library the shard removes nothing.
- Stryker starts one worker per CPU, or the `osf.mutationConcurrency` a `package.json` sets, and each mutant's run
  uses one Vitest worker, or `osf.mutationWorkers`. The first run writes the time of each scenario file, and each
  mutant's run takes the files shortest first, through a sequencer in a Vitest config in Stryker's temporary folder
  that extends the unit's own. On scorekit, with 6 Stryker workers for both, a shard of 62 mutants took 36 seconds
  instead of 85, with the same result for each mutant.
- The testkit records no coverage while `__STRYKER_ACTIVE_MUTANT__` or `OSF_TESTKIT_MUTANTS` is set (SCN-TK-128).
- The test runner ends a mutant's run itself at Stryker's timeout and kills its process group. It keeps the last
  64 KiB of the output. It and the command runner of a library start Vitest's entry with Node, not with `pnpm exec`.
  The first run may take 30 minutes, not Stryker's default of 5. Stryker's timeout factor is 2.5, not 1.5: a mutant
  that survives reruns all its scenarios in one worker while the other workers load the CPUs, and with 1.5, 7 of
  about 3,800 mutants of intake, ledger, scorekit and runlog ended as Timeout, which counts as detected. turbo builds only the unit's dependencies before
  `osf mutation`, since Stryker builds the unit itself, and on CI `osf mutation` does not build it again at the end.
- The nightly run keeps one open ticket: a failed run comments on it with the units below their limit, and a passing
  run closes it. A run in which a shard failed fails its score: the reports of the other shards leave out mutants.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Shards by lines, reports under turbo's hash (chosen) | A night without changes takes minutes; the key is the one AFFECTED already enforces; the shard count does not change unless the code changes | A shard count from lines is a rough estimate of the cost; each shard repeats the unit's first run |
| Turbo task cache with `outputs` | No extra cache step | The reports are in the root `reports/mutation/`, and an output glob cannot name the unit's report; moving the reports changes SCN-REPO-051 |
| Shards by the duration of the last run | Better balanced shards | The shard count changes from run to run, so the keys change, and nothing is replayed |
| Stryker incremental mode | Keeps the results of unchanged mutants in a changed unit | ADR 0066: it does not see changes to the testkit or a dependency |
| One Vitest process per Stryker worker that stays up between mutants | Saves Vitest's start and the testkit's import for each mutant, about 1 to 2 seconds | The active mutant must reach the module's processes another way than the environment; a run stopped at its first failure leaves processes that only a new process group ends |
| A larger runner | Fewer shards | A paid service |

## Prior art

- Turborepo (MIT, maintained by Vercel), already in use: `turbo run --dry=json` gives the hash of each task without
  running it.
- `actions/cache` (MIT, maintained by GitHub), already in use by `mutation.yml` and `verify.yml`.
- Stryker (Apache-2.0, maintained), already in use: its `timeout` option of a mutant run and `dryRunTimeoutMinutes`.

## Consequences

- A night without changes restores every shard. A change to one unit mutates only that unit's shards; a change to
  the testkit or to the mutation tooling mutates all of them.
- A first run, and Sunday's run, start about 90 runners, which queue for the 20 jobs that run at the same time.
- The score of a unit that is below its limit still fails the run and keeps the ticket open: the run is now complete
  and reliable, and the ticket names the units to fix (`skills/fix-mutation-and-duplication`).
