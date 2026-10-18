# AGENTS.md

Rules for every agent and every person who changes this repository. Keep this file short and stable.
Details live in `skills/` and `docs/`. Claude Code also reads `CLAUDE.md`, which imports this file.

## What this repository is

A family of independent open-source tools that together form a software factory.

- Each tool is a module in `modules/<name>/` with its own version and release.
- Modules share data only through the formats in `contracts/`. A module never imports another module's code.
- Ports (interfaces to outside systems) and their `@conformance` scenarios live in `ports/<port>/`. Adapters
  live in `adapters/<port>/<adapter>/`.
- The goal is the factory described in `docs/vision/`. The work plan is `TODO.md`.

## Current phase

Phase 0: nothing is built yet. The first work is `TODO.md` items T-00 to T-02 (repository tooling, contracts,
testkit). Until T-00 is done, the `make` commands below do not exist; build them first. Every pull request is
reviewed by a person. `docs/explanation/bootstrapping.md` describes the phases and what changes in each.

## Typical requests

| Request | Do this |
| --- | --- |
| "Implement this feature file" | For each `planned` scenario in it: `skills/write-system-test`, then `skills/implement-scenario`. |
| "Start module X" | Read its item in `TODO.md`, then `skills/new-module`. Write the scenarios the item lists before any code. |
| "Read the context" | `README.md`, `docs/vision/talk-analysis.md`, `docs/principles.md`, `docs/architecture/`. |

## Definition of done

A change is done only when `make verify` passes. `docs/quality/checks.md` lists every check. In short:

| Check | Rule |
| --- | --- |
| SPEC | Every scenario has one unique `@id=SCN-<MODULE>-<NNN>` and one `@status`. |
| TRACE | Every `implemented` scenario has exactly one system test. No test without a scenario. |
| STEPS | The test's `given`, `when` and `then` labels match the scenario's steps. |
| PASS | Every `implemented` scenario's test ran and passed in this run. Skipped counts as failed. |
| BOUNDARY | System tests reach the module only through its public surface. |
| ISOLATION | No module imports another module. |
| CONTRACT | No breaking change to `contracts/` without a major version. |
| DOCS | Generated docs are current; docs that cover changed code were reviewed. |
| BUDGET | Each module's system tests finish inside their time budget. |

## How to work

Follow this loop for every behavior change. Each step has a skill.

1. Find or write the scenario first: `skills/write-scenario`.
2. Write its one system test and watch it fail for the right reason: `skills/write-system-test`.
3. Implement until it passes: `skills/implement-scenario`.
4. Update the docs in the same change: `skills/keep-docs-evergreen`.
5. Run `make verify` and report its result.

A new module starts with `skills/new-module`. A new dependency or service starts with `skills/write-adr`.

## Hard rules

- Specify behavior in Gherkin. The scenario is the requirement; the system test is its proof.
- Do not write unit tests by default. A unit test is allowed only for a pure algorithm with many edge cases
  (a parser, a scheduler), in `src/**/__unit__/`, and only when the module's `AGENTS.md` allows it.
  Unit tests never replace a system test and never count for any check.
- Test from the outside only: the module's CLI, HTTP API, MCP server, published events or published files.
  Never import from `src/`. Never read or write the module's database, cache or private files.
- No real network, model, clock or randomness in system tests. Use the fakes in `@osf/testkit`.
- Never change the text of an `implemented` scenario to make a test pass. A scenario change needs a person.
- Never skip, delete or weaken the test of an `implemented` scenario. To remove behavior, a person marks the
  scenario `deprecated`.
- Never change `features/**`, `contracts/**`, `docs/quality/**`, budgets or CI workflows without a person's
  approval. CODEOWNERS enforces it.
- Adopt before you build. Check for an existing open-source project first and record what you found.
- Never write a credential into code, tests, fixtures, logs or documents.

## Commands

```text
make check                 fast checks for the modules you changed (seconds)
make verify                all checks; required before you report done
make smoke                 the deterministic end-to-end scenarios in e2e/ (minutes)
make smoke-paid            one real-model run per harness; only when asked
make next-id MODULE=proof  print the next free scenario ID for a module
make new-module NAME=x     create a module from modules/_template
make docs                  regenerate generated docs
```

## Where to find things

| Question | Read |
| --- | --- |
| What the whole factory must do | `docs/vision/software-factory.feature` (source for module scenarios) |
| What to build next, per module | `TODO.md` |
| Principles for undecided questions | `docs/principles.md` |
| Architecture, adapters, protocols, stack | `docs/architecture/` |
| Terms | `docs/reference/glossary.md` |
| What a module must do | `modules/<name>/features/*.feature` |
| How a module is used | `modules/<name>/README.md` |
| Rules for one module | `modules/<name>/AGENTS.md` |
| Shared formats and APIs | `contracts/` |
| Why a decision was made | `docs/decisions/` |
| What each check does | `docs/quality/checks.md` |
| Module tiers (core, optional, community) | `docs/explanation/module-tiers.md` |

## When to stop and ask a person

Stop when a scenario is unclear or contradicts another, when a scenario or contract must change, when a change
needs a new service, dependency, permission or paid call, or when a check fails for a reason you cannot fix
inside the module. Ask one clear question with the options and their effects.
