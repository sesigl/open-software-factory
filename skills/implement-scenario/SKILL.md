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
6. Run `make check`. Fix every failure in this module. Never weaken a check to make it pass; fix the cause.
7. Update the docs: `skills/keep-docs-evergreen`.
8. Run `make verify` and put the summary into the pull request.

## Rules

- One scenario per pull request when possible; at most one module per pull request.
- Do not add behavior that no scenario asks for. If you need it, stop and write a `planned` scenario first.
- Do not add a unit test unless the module's `AGENTS.md` allows it for this code.
- If the test can only pass by changing the scenario, replace the scenario (`skills/write-scenario`) and say why
  in the pull request.
- If a check fails outside the module you changed, stop and report it. Do not fix it in the same pull request.
- Retro at the end: write what did not work the first time into the pull request under "Friction".
