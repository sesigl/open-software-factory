---
status: accepted
date: 2026-10-26
---

# 0065. Mutation shards deal out mutants, and a shard reuses its report when only runs/ changed

## Context

The mutation check is the slowest part of a pull request. On pull request #117 (intake, T-16), `verify` took about
6 minutes and `mutation` 33 minutes, over seven shards of the 609 lines intake added. The seven shards took 3.5, 7.5,
8, 9, 13, 13 and 31 minutes for their step "turbo run mutation":

- `osf mutation --shard i/n` took the i-th of n consecutive slices of the added lines. Shard 5 held most of
  `commands/mcp.ts` and some of `commands/serve.ts`: 91 mutants, many of which survived. A survivor reruns every
  scenario that reached it (ADR 0061), about 80 seconds each with two Stryker workers. The other shards waited for it.
- Every push started all shards from zero. Agents push a session record to `runs/` after their code (ADR 0027), and
  the review loop pushes again, so #117 started mutation six times. Four runs were cancelled after 6 to 24 minutes,
  and the next one tested the same source lines again.

Cutting the lines into finer or interleaved slices does not work: Stryker mutates a node only when it lies wholly
inside one of the `mutate` ranges, so every cut drops the mutants that span it, such as a block statement.

## Decision

- Each shard of `osf mutation --shard i/n` mutates all the lines, as an unsharded run does, and Stryker numbers the
  mutants the same way in every shard, in the order of the source. A shard tests only the mutants whose number
  modulo n is i - 1. For a module or an adapter the test runner (`tools/scaffold/mutation-runner.ts`) takes the shard
  as its Stryker option `osfShard` and passes the other mutants without a test. For a library the command runner's
  command does the same with `__STRYKER_ACTIVE_MUTANT__`. When Stryker is done, `osf mutation` removes the other
  shards' mutants from the shard's report, so the reports of all shards hold each mutant once.
  `osf mutation --list --shard i/n` lists every line range (SCN-REPO-065 replaces SCN-REPO-063).
- `mutation.yml` keeps one shard per about 100 added lines, at most 10. Each shard keys its report on the package,
  the shard, the base commit and a hash of every file of the checkout except `runs/`. It restores the report with
  `actions/cache/restore` and then skips the setup and the run. Otherwise it runs, and saves the report with
  `actions/cache/save`. The `mutation` job scores the reports as before.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Deal out mutants by number (chosen) | A costly file spreads over all shards; no mutant is lost; the report and the score stay the same | Each shard builds the unit and runs the first test run, which takes about 40 seconds for intake |
| Interleave the line ranges | No change to the runners | Every cut drops the mutants that span it |
| Weight the shards by the cost of the lines | Shards stay small | Cost is known only after a run: survivors cost the most, and nothing tells which mutants survive |
| More, smaller shards | No code | Shard 5 was 87 lines; a smaller slice still holds the costly file, and the runners count against the 20 jobs that run at the same time |
| Reuse the report on a key of all files except `runs/` (chosen) | The check runs again only when something it reads changed; a session record costs a minute | `runs/` must stay unread by builds and tests |
| Stryker incremental mode | Keeps the results of unchanged mutants, also after a code change | ADR 0061: it sees only changes to source and test files, not to the testkit or a dependency, so a stale result can pass a weak test |
| `paths-ignore: runs/**` on the workflow | No cache | `mutation` is a required check: a skipped workflow leaves it pending |

## Prior art

- StrykerJS (`@stryker-mutator/core` 10.0.0, Apache-2.0, ADR 0037): adopted further. A plugin may declare its own
  options with `strykerValidationSchema`, so `osfShard` reaches the test runner without a warning. Stryker has no
  option to test part of the mutants; its `mutate` ranges work on lines, with the loss described above.
- `actions/cache` (`restore@v4`, `save@v4`, MIT, maintained by GitHub): adopted. A pull request's runs can read the
  caches of earlier runs of the same pull request and of the base branch.
- Vitest `--shard` (MIT): checked, not used. It splits test files, not mutants.

## Consequences

- Measured locally, one run each, with the reports of the shards compared to the report of an unsharded run:

  | Unit | Run | Mutants | Shard 1/2 | Shard 2/2 | Union of the shards |
  | --- | --- | --- | --- | --- | --- |
  | `packages/spec-files` (command runner) | `--all` | 129 (122 killed, 7 survived) | 66 | 63 | the same 129 mutants with the same results |
  | `modules/spec-trace` (scenario runner) | the lines added since `13e53ec^` | 7 (7 killed) | 4 | 3 | the same 7 mutants with the same results |

- The slowest shard now takes about its share of the unit's mutants plus one first run. On #117 the 91 mutants of shard
  5 would have gone to all seven shards, with about 13 per shard. Every shard pays the build and the first test run of
  the unit, so the runner minutes rise by that much per shard.
- A push that only changes `runs/` restores every report and finishes in about a minute. Any other change, including
  a change to the base, runs every shard again.
- A build or a test must never read `runs/`. If one ever does, `runs/` comes back into the key.
- A report from a flaky run is reused until the next change. A flake makes a mutant look killed or survived once; it
  is the same risk as a single run today.
