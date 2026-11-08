---
status: accepted
date: 2026-11-08
---

# 0091. Mutation on a pull request reuses the reports of unchanged units and the results of unchanged mutants

## Context

`mutation.yml` keys each shard's report on the base commit and a hash of every file of the checkout except `runs/`
(ADR 0066). Every other change runs every shard of every changed unit again:

- A push that changes one unit runs the shards of all the other changed units again, also when none of their inputs
  changed. A merge of `main` into the branch changes the base, so it also runs every shard again.
- A push that changes a few lines of a unit runs all its mutants again, also the mutants in lines that the push did
  not change and that only scenarios in unchanged files reach.
- A pull request with many pushes pays the whole run for each push. On a pull request with six pushes on
  8 November 2026, four runs took 21 to 91 minutes; the shard of inference-litellm alone took 89 minutes, and two runs
  were cancelled by the next push.

Stryker's incremental mode (ADR 0066, "Options considered") keeps the result of each mutant whose code and tests did
not change. It compares only the mutated files and the test files. A change to anything else the tests read, such as
the testkit, a dependency or a helper of the tests, does not reach it, and a stale result can pass a weak test.

## Decision

- `osf mutation-plan --keys` runs `turbo run mutation --dry=json` once for all units of the plan and gives each shard
  two hashes:
  - `key`: turbo's hash of the unit's `mutation` task (its files, the builds it depends on, the global dependencies
    and the mutation tooling, as in ADR 0084) and the line ranges that the change adds to it. A shard restores the
    report of an earlier push for the same key and skips its setup and its run. A change to another unit, or a new
    base that leaves the unit's added lines the same, keeps the key (SCN-REPO-094).
  - `guard`: a hash of what the unit's tests read beyond what Stryker compares itself: turbo's global inputs, the
    unit's external dependencies, the turbo hashes of the builds it depends on, and the unit's input files except its
    TypeScript sources and, for a module or an adapter, its `system-tests/**/*.test.ts` files. A library's command
    runner reports no test files to Stryker, so a library's test files stay in its guard (SCN-REPO-095).
- A shard without a report for its key runs `osf mutation --incremental <file>`, with the unit's mutant results from
  the last finished run of the same pull request for the same guard. Stryker reuses the result of each mutant whose
  mutated code, covering scenarios and test files did not change, and runs the others. A new guard has no file, and
  the shard runs every mutant. The test runner gives Stryker the file of each scenario, so that a changed test file
  runs its scenarios again.
- The `mutation` job joins the shard reports of each unit whose shards all have a report into the unit's file for its
  guard (`osf mutation-merge`, SCN-REPO-096), and saves the files of the pull request to `actions/cache`. A unit with
  a missing shard keeps its earlier file. Each shard keeps only its own mutants, so the joined file holds each mutant
  once, whatever the number of shards was.
- A draft pull request runs no mutation. Marking it ready starts the run (`ready_for_review`).
- inference-litellm cuts 25 added lines per shard (`osf.mutationLinesPerShard`), as forge-forgejo does: each of its
  scenarios starts a LiteLLM container.

The nightly run does not change: it mutates every line and keeps its own keys (ADR 0084). Its weekly fresh run of
every shard finds a stale result that the guard did not catch.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Key on turbo's task hash and the added lines (chosen) | Reuses each unit that did not change; turbo already hashes the builds a unit depends on | Needs one `turbo --dry=json` in the plan job, about 4 seconds |
| Key on the base and the whole tree (ADR 0066, before) | Simple | Any change runs every shard of every unit again |
| Stryker's incremental mode with a guard (chosen) | Runs only the mutants whose code or scenarios changed; a changed dependency or helper discards the results | A change to a source file of the unit that Stryker does not mutate keeps the results of mutants in other files; the weekly fresh run finds such a result |
| Stryker's incremental mode without a guard | No hashes | A change to the testkit or a dependency keeps results that it can change |
| A stable shard for each mutant from a hash of its file, position and mutator | A mutant keeps its shard over pushes | Not needed: the joined file holds the results of all shards, so a shard reuses any mutant's result, whichever shard ran it before |
| Start mutation only after `verify` passes | Saves the runners of a pull request whose `verify` fails | Adds the time of `verify` to every pull request; a failed `verify` usually leaves the mutated lines as they are, so their results stay reusable |
| Per-file test selection from an import graph | Fewer scenarios per mutant | ADR 0061 already reruns only the scenarios whose module processes ran the mutant, which is more exact than imports |

## Prior art

- StrykerJS incremental mode (`@stryker-mutator/core` 10.0.0, Apache-2.0, ADR 0037): adopted. It identifies a
  mutant by its file, mutator, replacement and location, and a test by its file, name and location; it moves both
  with a diff of the old and the new source. Its documentation states that it does not see changes outside the
  mutated files and the test files.
- Turborepo `--dry=json` (`turbo` 2.11.7, MIT, ADR 0081): adopted. It prints each task's hash, its external
  dependencies, the hashes of the tasks it depends on and the hash of each input file, without running a task.
- `actions/cache` (`restore@v4`, `save@v4`, MIT): adopted further. A restore key prefix gives the newest cache of the
  pull request.

## Consequences

- Measured on CI, on a pull request that changed lines of intake and gatekeeper, with three pushes. Before this
  decision, pushes 2 and 3 changed the tree, so each ran every shard again, as push 1 did.

  | Push | Change | intake shard | gatekeeper shard | Whole run |
  | --- | --- | --- | --- | --- |
  | 1 | lines of intake and gatekeeper | 139 s, every mutant | 77 s, every mutant | 272 s |
  | 2 | one more line of gatekeeper | 8 s, report restored | 93 s, 6 of 7 mutant results reused | 165 s |
  | 3 | `README.md` only | 6 s, report restored | 7 s, report restored | 90 s |

  A shard that runs still pays its setup, the build and the first test run: gatekeeper's shard took about as long
  with 6 of 7 results reused. The reuse of single results saves most on a unit with many slow mutants.
- A push that changes one unit runs only that unit's shards; the shards of the other units restore their reports.
- A push that changes some lines of a unit runs the mutants that those lines and the changed test files reach. The
  shards still build the unit and run the first test run.
- A change to a library that many units depend on, such as the testkit, gives each of them a new guard, and they run
  every mutant again.
- A run cancelled by the next push saves no mutant results; the shards it finished still saved their reports.
- `runs/` stays out of every hash: turbo ignores it, since no package holds it.
