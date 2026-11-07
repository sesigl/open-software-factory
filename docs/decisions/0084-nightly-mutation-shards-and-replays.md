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

## Decision

- `osf mutation-plan` prints the shards of a run as JSON, from the units that `osf check MUTATION` scores. With
  `--all` it cuts every unit with a mutation script into shards of about 300 lines, or of the
  `osf.mutationAllLinesPerShard` lines its `package.json` sets, at most 20 (SCN-REPO-092). intake, gatekeeper and
  foreman set smaller shards, because each of their scenarios starts slow services. Without `--all` it cuts each unit
  that a change adds lines to, as `mutation.yml` did in its own script (SCN-REPO-093). A new unit joins both runs
  without a change to a workflow. Each shard tests every n-th mutant (ADR 0066).
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
  runner stays reachable and keeps the log. Every two minutes it prints the free memory and the largest processes.
  turbo streams the output.
- The test runner ends a mutant's run itself at Stryker's timeout and kills its process group. It keeps the last
  64 KiB of the output. It and the command runner of a library start Vitest's entry with Node, not with `pnpm exec`.
  The first run may take 30 minutes, not Stryker's default of 5.
- The nightly run keeps one open ticket: a failed run comments on it with the units below their limit, and a passing
  run closes it.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Shards by lines, reports under turbo's hash (chosen) | A night without changes takes minutes; the key is the one AFFECTED already enforces; the shard count does not change unless the code changes | A shard count from lines is a rough estimate of the cost; each shard repeats the unit's first run |
| Turbo task cache with `outputs` | No extra cache step | The reports are in the root `reports/mutation/`, and an output glob cannot name the unit's report; moving the reports changes SCN-REPO-051 |
| Shards by the duration of the last run | Better balanced shards | The shard count changes from run to run, so the keys change, and nothing is replayed |
| Stryker incremental mode | Keeps the results of unchanged mutants in a changed unit | ADR 0066: it does not see changes to the testkit or a dependency |
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
