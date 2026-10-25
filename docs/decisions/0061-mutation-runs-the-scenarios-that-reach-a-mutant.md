---
status: accepted
date: 2026-10-25
---

# 0061. Mutation reruns only the scenarios that ran the mutant

## Context

ADR 0037 runs Stryker with its command runner. For every mutant, the command runner reruns the unit's whole system
test suite, because Stryker cannot see which test ran which line: the code runs in the module's own process, not in
the test process. ADR 0037 named the way out: map the mutants to the scenarios that reach them.

The mutation check had become the slowest part of a pull request. On pull request #105, `verify` took about four
minutes and the mutation check 26 minutes. One runner mutated the 10 changed line ranges of `forge-forgejo`: 65
mutants, each rerunning all 26 Forgejo scenarios, for 25 minutes. Another needed 19 minutes for its half of
`factory-spec`. Most of a mutant's run went to scenarios that never ran the mutated line.

Stryker's own answer is per-test coverage: its instrumented code counts each mutant it reaches in the global
`__stryker__.mutantCoverage`, and a test runner reports those counts per test after the first run. Then Stryker
runs each mutant only against the tests that reached it, and marks a mutant that no test reached as NoCoverage
without running anything. Its Vitest runner reads the counts in the test process, where our system tests never
run the module's code.

## Decision

- The testkit records the mutants each scenario ran. When `OSF_TESTKIT_MUTANTS` names a folder, the testkit passes
  `<folder>/<scenario ID>` on to every process of the module. The coverage recorder that REACH already loads into
  those processes writes the IDs in `__stryker__.mutantCoverage` there when the process exits or stops on SIGTERM
  (SCN-TK-096).
- `osf mutation` runs a small Stryker test runner, `tools/scaffold/mutation-runner.ts`, for every unit in
  `modules/` and `adapters/`. Its first run runs the whole suite once with `OSF_TESTKIT_MUTANTS`, then reports each
  scenario file as a test with the mutants its processes ran. Stryker uses `coverageAnalysis: "perTest"`: each
  mutant reruns `vitest run --bail=1` on only the scenario files that ran it. `timeoutMS` is 60 seconds, because
  a scenario's time in the first run leaves out the start of Vitest.
- A library in `packages/` keeps the command runner and reruns all its tests per mutant: its tests call it in the
  test process, which records no mutants per scenario.
- Nothing else changes. The score, the limits, the shards, `osf check MUTATION` and the workflows stay as they are.

The selection can only make the check stricter, never weaker. A scenario is left out of a mutant's run only when
none of its module processes ran the mutant. Code that runs where the recorder cannot see it (a process that is
killed, a process started with a clean environment, code in a container) records nothing, so its mutants count
as NoCoverage or are tested by fewer scenarios. Either way the score drops and the check names the line; it never
counts a mutant as detected that the full suite would miss.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Per-scenario mutant coverage from the module's processes, a small runner | Each mutant runs the few scenarios that reach it; the same system tests; Stryker plans and scores as before | About 100 lines of runner; a mutant whose code runs only in a container is NoCoverage |
| Map mutants to scenarios with the V8 coverage of REACH | Data exists already | Needs coverage per scenario, source maps from mutant positions to built lines, and a test filter per mutant outside Stryker |
| Shards weighted by suite time | No new code path | Spreads the same work over more runners; costs runner minutes |
| Stryker incremental mode across pushes | Skips unchanged mutants on a new push | Stryker sees only changes to test and source files, not to the testkit or a dependency, so a stale result can pass a weak test |
| Larger GitHub runners | No code | A paid service |

## Prior art

- StrykerJS (`@stryker-mutator/core` 10.0.0, Apache-2.0, ADR 0037): adopted further. Its plugin API takes a test
  runner by file path, and its planner does the per-test selection, the NoCoverage results and the timeouts. The
  runner only runs Vitest and reports what the module's processes recorded.
- `@stryker-mutator/vitest-runner` (Apache-2.0, same maintainers): checked, not used. It collects mutant coverage
  in the Vitest worker, which never runs a module's code in this repository.
- Stryker's command runner (ADR 0037): kept for libraries.

## Consequences

- A mutant's run costs the time of the scenarios that reach it, not of the whole suite. Measured on the changes of
  pull request #105, on a 4-core machine with the same commit and base, one run after the other:

  | Unit | Mutants | Before | After | Detected before | Detected after |
  | --- | --- | --- | --- | --- | --- |
  | `forge-forgejo` (26 scenarios) | 65 | 39 min 48 s | 24 min 10 s | 51 (5 of them timeouts) | 50 |
  | `factory-spec`, shard 2/2 (55 scenarios) | 94 | 24 min 41 s | 12 min 17 s | 72 | 72 |

  The five timeouts before were mutants that ran into the whole suite's time limit without a failing scenario.
  After, four failed a scenario and one survived: it drops a sort whose result is sorted again. The old count was
  too kind, not the new one. In `factory-spec`, two mutants that survived before are NoCoverage after; both count
  as missed either way.

  On CI, the same lines of #105 mutated again on the head of #105 plus this change (draft pull request #111),
  against #105's own run, step "turbo run mutation" of each shard:

  | Shard | #105 | #111 |
  | --- | --- | --- |
  | `forge-forgejo` 1/1 | 24 min 45 s | 16 min 6 s |
  | `factory-spec` 2/2 | 18 min 38 s | 6 min 5 s |
  | `factory-spec` 1/2 | 8 min 28 s | 7 min 39 s |
  | `forge-github` 1/1 | 3 min 28 s | 2 min 20 s |
  | Whole check, start to end | 26 min 4 s | 18 min 16 s |
  | Runner minutes of the four shards | 55 min | 32 min |

  MUTATION passed on both.
- Mutants in code that every process runs when it loads, such as a constant table, still rerun every scenario. They
  are the rest of the time.
- The first run is the normal suite once, plus one small file per module process.
- A scenario's cost now matters for each mutant it reaches. Many small scenarios are cheaper than a few broad ones,
  and a module that does its work in its own processes, on the host, is cheaper than one that does it in a container.
  `docs/quality/testing-strategy.md` holds these rules.
- Module processes that serve several scenarios, such as a server started once per file, would record their mutants
  under no scenario. The testkit starts every module process inside a scenario, so none does today.
- Revisit when a library's mutation run gets slow: the testkit could set `__stryker__.currentTestId` in the test
  process for each scenario, so libraries get per-scenario coverage too.
