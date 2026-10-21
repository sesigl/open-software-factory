---
status: accepted
date: 2026-10-21
---

# 0035. Mutation testing with Stryker and duplication limits with jscpd

## Context

REACH proves that a system test runs a line. It does not prove that a test would notice if the line were wrong.
`docs/quality/checks.md` planned MUTATION as a nightly Stryker run, but no module had a `mutation` script, so the
nightly job ran nothing. Nothing limited duplicated code, inside a module or across modules.

The goal is the cleanest architecture for people and agents. Both limits must apply to every current and future
module without a person setting them up.

Two facts shape the design:

- System tests start the module's built artifact in its own process (BOUNDARY-RUNTIME). Stryker cannot see which
  test covers which line there. Every mutant reruns the module's whole suite: 18 seconds for ledger and 37 seconds
  for spec-trace, measured on a 4-core machine.
- ISOLATION forbids imports between modules. Code that two modules need belongs in a package in `packages/` or in
  `contracts/`. A copy is a sign that such a package is missing.

## Decision

**MUTATION**

- `osf mutation <module>` runs Stryker on one module. It mutates only the lines of `src/` that the change adds
  since `OSF_BASE`. With `--all` it mutates every line. `--list` prints the ranges and runs nothing.
- Stryker uses its command test runner. It runs `vitest run --bail=1` per mutant, in place, after `pnpm run build`
  of the mutated sources. The instrumented code reads the active mutant from `__STRYKER_ACTIVE_MUTANT__`. The
  testkit passes that variable on to the module's process, so the built artifact runs the mutant.
- Every module has the script `"mutation": "node ../../tools/bin/osf.ts mutation ."`. The template has it, so
  `make new-module` gives it to new modules.
- `osf check MUTATION` reads the Stryker JSON reports in `reports/mutation/`. Killed and timed-out mutants count
  as detected; survived and uncovered mutants count as missed. Each module states its limits in its `AGENTS.md`
  under "Quality limits": "Mutation score: at least 70% of the mutants in changed lines, 80% in total". A module
  without the script or the limit fails.
- A pull request fails when the score of the mutants in its changed lines is below the module's first limit
  (workflow `mutation.yml`). The nightly run mutates every line of every module, one runner per module. It opens an
  issue when a module's total score is below the second limit.

**DUP**

- `osf check DUP` runs jscpd once on the source files of every unit: modules, packages, adapters and `tools/`. A
  clone is at least 50 tokens. It runs in well under a second, so it is part of `make check`.
- Inside a unit, the share of source lines that belong to a clone must stay under the unit's limit, "Duplication:
  at most 3%". System tests are not checked: one test per scenario repeats its setup on purpose.
- Across units, no clone is allowed, except with `modules/_template`: every new module starts as its copy. The fix is a shared package in `packages/` or a helper in `contracts/`. The
  nine clones that existed when the check started are listed in `docs/quality/duplication-baseline.json`. An entry
  whose clone is gone fails the check until it is removed, so the list only shrinks.
- ISOLATION lets a module depend on a library in `packages/`, besides `@opensoftware/contracts` and the testkit in
  `devDependencies`. A library is a package that is not a module: no CLI of its own, no state, and its own
  scenarios. Before, ISOLATION treated every `@opensoftware/` package as another module, so a clone had nowhere to go.

**How findings are fixed**

- A missed mutant is fixed by a scenario and its system test, by a stricter `then` step in a replacing scenario,
  or by deleting code no user can see. Never by a unit test, a mock or an assertion on internals. An equivalent
  mutant is rewritten away, or disabled on its line with the reason. `skills/fix-mutation-and-duplication`
  holds the steps.
- Because each mutant reruns the whole suite, suite time matters more than before. Slow scenarios should use an
  in-memory fake with the same behavior instead of a container where the port allows it.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Mutation of changed lines per pull request, full run nightly | Weak tests fail in the pull request that wrote them; minutes per pull request | Needs a second workflow |
| Nightly mutation only | Pull requests stay fast | A weak test is found a day later, by someone else |
| Full mutation on every pull request | Strictest | About 45 to 90 minutes per module |
| Stryker vitest runner with per-test coverage | Fewer test runs per mutant | Cannot see code that runs in the module's own process |
| Duplication across units as a report only | No baseline file | Copies keep growing; the motive to extract a package is lost |
| Fix the nine existing clones in this change | No baseline | Touches five modules and the tooling at once; each extraction needs its own design |

## Prior art

- StrykerJS (`@stryker-mutator/core` 10.0.0, Apache-2.0, released August 2026, maintained by the Stryker
  organization): adopted. Its command runner fits tests that start a separate process.
- jscpd (5.4.1, MIT, a Rust engine with releases every few weeks): adopted. It reads TypeScript, reports JSON and
  takes explicit file lists.
- Considered and not adopted: SonarQube or SonarCloud duplication (needs a server or a hosted service and an
  account), Biome (has no clone detection), knip (finds unused code, not copies), and mutation testing via
  `@vitest/coverage-v8` (has none).

## Consequences

- An agent sees the file and line of each missed mutant and each clone, and the fix to make.
- A pull request that changes a module's `src/` waits for the mutation job: about 20 seconds per mutant divided by
  the runner's workers. A change of 100 lines makes about 50 mutants, so about 10 minutes.
- After a mutation run, `osf mutation` builds the module again, because Stryker leaves the build of the mutated
  sources in `dist/`.
- Each existing cross-unit clone is a candidate for a library in `packages/`: run-record decoding (ledger,
  scorekit), JUnit and Gherkin reading (proof, spec-trace, tools) and CLI error handling (four modules).
- `packages/testkit` and `tools/` have DUP but no mutation run: their tests do not start them through the testkit.
- Revisit when a module's full run gets close to the 6-hour job limit. Map mutants to scenarios with the REACH
  coverage, so each mutant reruns only the tests that reach it.
