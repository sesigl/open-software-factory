# AGENTS.md

Rules for every agent and every person who changes this repository. Keep this file short and stable.
Details live in `skills/` and `docs/`. This repository declares its own agent in `factory.yaml`; `make agents-sync`
renders `CLAUDE.md`, the MCP files and the skill links of every harness from it with `factory render`.

## What this repository is

A family of independent open-source tools that together form a software factory.

- Each tool is a module in `modules/<name>/` with its own version and release.
- Modules share data only through the formats in `contracts/`. A module never imports another module's code.
- Ports (interfaces to outside systems) and their `@conformance` scenarios live in `ports/<port>/`. Adapters
  live in `adapters/<port>/<adapter>/`.
- The goal is the factory described in `docs/vision/`. The work plan is `TODO.md`.

## Current phase

Phase 0: the foundation is being built, `TODO.md` items T-00 to T-02 (repository tooling, contracts,
testkit). T-00 provides `make` and the checks; run `make install` once after cloning (Node 24, pnpm). The
tooling is described in `tools/README.md`. Every pull request is reviewed by a person.
`docs/explanation/bootstrapping.md` describes the phases and what changes in each.

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
| ARCH | Every module declares its layers in `architecture.json`; no file imports a layer above its own. |
| CONTRACT | No breaking change to `contracts/` without a major version. |
| DOCS | Generated docs are current; docs that cover changed code were reviewed. |
| BUDGET | Each module's system tests finish inside their time budget. |
| RUNS | An agent's pull request commits the run of its session to `runs/`, without prompt content. |

## How to work

Follow this loop for every behavior change. Each step has a skill.

1. Find or write the scenario first: `skills/write-scenario`.
2. Write its one system test and watch it fail for the right reason: `skills/write-system-test`.
3. Implement until it passes: `skills/implement-scenario`.
4. Update the docs in the same change: `skills/keep-docs-evergreen`.
5. Run `make verify` and report its result.
6. Before you push, run `make run-record` and commit `runs/` (ADR 0027).

A new module starts with `skills/new-module`. A new dependency or service starts with `skills/write-adr`.

## Hard rules

- Specify behavior in Gherkin. The scenario is the requirement; the system test is its proof.
- Do not write unit tests by default. A unit test is allowed only for a pure algorithm with many edge cases
  (a parser, a scheduler), in `src/**/__unit__/`, and only when the module's `AGENTS.md` allows it.
  Unit tests never replace a system test and never count for any check.
- Test from the outside only: the module's CLI, HTTP API, MCP server, published events or published files.
  Never import from `src/`. Never read or write the module's database, cache or private files.
- No real network, model, clock or randomness in system tests. Use the fakes in `@opensoftware/testkit`.
- Never change the text of an `implemented` scenario to make a test pass. To change behavior on purpose, write
  a new scenario with `@replaces=SCN-...`, mark the old one `deprecated` and delete its test in the same change.
- Never skip or weaken the test of an `implemented` scenario. To remove behavior, mark the scenario `deprecated`
  and delete its test in the same change.
- Adopt before you build. Check for an existing open-source project first and record what you found.
- Never write a credential into code, tests, fixtures, logs or documents.

## Commands

```text
make install               install dependencies and the pinned lychee and oasdiff binaries
make check                 lint and the static checks (seconds)
make verify                all checks; required before you report done
make test-scenario ID=…    run the one system test of a scenario
make smoke                 the deterministic end-to-end scenarios in e2e/ (minutes)
make smoke-paid            one real-model run per harness; only when asked
make next-id MODULE=proof  print the next free scenario ID for a module
make new-module NAME=x     create a module from modules/_template
make docs                  regenerate generated docs
make docs-affected         list hand-written docs whose covers: paths your change touched
make agents-sync           render factory.yaml: CLAUDE.md, MCP files, skill links of every harness
make run-record            export your session's run to runs/<run id>.jsonl; commit it before you push
```

When a check fails, its output starts with the check ID and the file and line to fix.

## Harness notes

- Skills live in `skills/` and are declared in `factory.yaml`. Run `make agents-sync` after you add or remove one.
- Claude Code: a `Stop` hook in `.claude/settings.json` runs `make check` before you end a turn. Use plan mode
  before a change that touches `contracts/` or more than one module. Use subagents for independent modules; never
  let two agents change the same module at the same time.
- When `make check` fails, read the check ID in the output (for example `BOUNDARY`) and open
  `docs/quality/checks.md` for the fix. Do not work around a check. CI runs `make verify` for every harness.

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

## When to stop and ask

Stop when a requirement is unclear or contradicts another, when a change needs a new paid service or a paid
call, or when a check fails for a reason you cannot fix. Ask one clear question with the options and their
effects. Everything else, including scenarios, contracts, checks and workflows, you change yourself in the pull
request; its review is the approval.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
