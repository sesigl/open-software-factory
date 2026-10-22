---
name: fix-mutation-and-duplication
description: Fix a MUTATION or DUP finding without unit tests or mocks. Use when osf check MUTATION or DUP fails, or a nightly mutation ticket is open.
---

# Fix a MUTATION or DUP finding

The checks are in `docs/quality/checks.md`; the reasons are in ADR 0037.

## A mutant that no test notices

Each finding names `file:line` and the change Stryker made. Decide which of these it is, in this order:

1. **Behavior no scenario specifies.** The code does something a user can see, but no scenario says what.
   Write the missing scenario (`skills/write-scenario`), then its system test (`skills/write-system-test`). The
   test drives the module from the outside, like every other system test.
2. **A scenario that does not check enough.** The behavior is in a scenario, but its `then` steps do not look at
   the value the mutant changes. Write a new scenario with the stricter `then` step and `@replaces=` the old one.
   Never edit the steps of an `implemented` scenario.
3. **Code that does nothing a user can see.** A default that is never used, a branch that cannot happen, a check
   another check already makes. Delete the code. Less code is the best fix.
4. **An equivalent mutant.** The changed code behaves exactly like the original, for example `<` and `<=` at a
   bound that cannot be reached. Rewrite the code so the mutant cannot exist, or, only if that makes it worse, add
   `// Stryker disable next-line <Mutator>: <why it is equivalent>` above the line.

Never fix a mutant with a unit test, a mock, a test that imports from `src/`, or an assertion on an internal
detail. Those make the score go up without proving any behavior.

Then rerun only the changed lines: `make mutation` (with `OSF_BASE` set, as `make` does).

## A clone

- **Inside a unit:** extract the repeated code into one function in the lowest layer both places may import.
- **Across units:** move the code into a library in `packages/` (no CLI, no state, its own scenarios) or, when it
  reads or writes a shared format, into `contracts/`. Check the existing libraries first: `@opensoftware/cli`
  (commands, exit codes, input and output files), `@opensoftware/spec-files` (feature files, JUnit reports),
  `@opensoftware/testkit/readme` (README rules) and `runSpans` in `@opensoftware/contracts` (run records). A new
  library follows the layout in ADR 0039 (`packages/cli` is an example) and needs its own ADR
  (`skills/write-adr`). Then delete the copies.
- There is no baseline of allowed clones: DUP fails every clone across units.

## Keep the tests fast

A mutation run reruns a module's whole suite once per mutant, so suite time multiplies. When a suite is slow:

- Find the slowest scenarios in `reports/junit/`. A container start often costs more than the test itself.
- Prefer a fake in `@opensoftware/testkit` that keeps the same behavior in memory over a container, when the
  module's port allows it. Keep one container scenario per adapter for its conformance scenarios.
- Never drop a `then` step or a scenario to save time.
