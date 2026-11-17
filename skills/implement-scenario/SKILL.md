---
name: implement-scenario
description: Implement one planned scenario until its system test passes, then mark it implemented. Use when a scenario and its failing system test exist.
---

# Implement a scenario

## Steps

1. Confirm the scenario is `@status=planned` and its system test fails for the right reason.
2. Read the module's `AGENTS.md` and `README.md`. Read only the source files you need.
3. Implement the smallest change that makes the test pass. Keep ports and adapters separate: domain logic must
   not import an adapter.
4. Run the one test: `make test-scenario ID=SCN-PROOF-004`. Repeat until it passes.
5. Set `@status=implemented` on the scenario.
6. Run `make check` and fix every failure; open `docs/quality/checks.md` for the check ID it names.
7. Update the docs: `skills/keep-docs-evergreen`.
8. Run `make verify` and report its result (root `AGENTS.md`, "How to work").

## Rules

- One scenario per pull request when possible, and one module when possible. A change across modules or to
  `contracts/` starts in plan mode (root `AGENTS.md`, "Harness notes").
- Do not add behavior that no scenario asks for. If you need it, write a `planned` scenario first
  (`skills/write-scenario`).
- When the test can pass only if the scenario says something else, the requirement is unclear: stop and ask (root
  `AGENTS.md`, "When to stop and ask"). Never change the scenario to fit the code (ADR 0157).
- A check that fails outside the module you changed is yours to fix in the same pull request, unless the root
  `AGENTS.md` says to stop and ask.
- What did not work the first time is a learning: propose it, with the file it belongs in, in your report to the
  maintainer (root `AGENTS.md`, "How to work"). It does not go into the pull request description.
