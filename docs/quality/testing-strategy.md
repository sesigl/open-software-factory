---
covers: [modules/*/system-tests/**, e2e/**, tools/checks/**, packages/testkit/**]
---

# Testing strategy

How this repository proves that everything works when agents write the code.

## Kinds of tests

Use these names. The column "Elsewhere" gives the common name of the same kind outside this repository.

| Kind | What it runs | Outside systems | Deterministic | Runs in | Counts for checks | Elsewhere |
| --- | --- | --- | --- | --- | --- | --- |
| Static check | The checks of `tools/checks/` on the files of the repository; nothing starts | none | yes | `make check-fast`, `verify` | is a check | lint, static analysis |
| Unit test | One pure function of `src/`, imported; only where a module's `AGENTS.md` allows it | none | yes | the module's own script | no | unit test |
| System test | One built module or adapter from outside, for one scenario | fakes of the testkit | yes | `make check`, `verify` | TRACE, PASS, BUDGET, MUTATION | component test, black-box test |
| Conformance scenario | A system test of an adapter for a scenario of its port | fakes of the testkit | yes | `make check`, `verify` | as a system test | contract test of an implementation |
| Deployment scenario | The Compose profile with `sut.compose`, or the Helm chart on kind with `sut.helm` | fakes of the testkit | yes | `make check`, `verify` | as a system test | deployment test |
| Smoke scenario | The whole factory on the Compose profile, every module from the workspace image (`e2e/features/`) | fakes of the testkit on the Docker host | yes | `make smoke`, `verify` | as a system test | hermetic end-to-end test |
| Live test | A harness adapter with a real model, through the real service (`e2e/paid/`) | real, paid | no | `make smoke-paid` only | no | live integration test, provider contract test |

- **Mutation testing** is no kind of test: MUTATION measures how many mutants the system tests detect.
- A **scenario** is the requirement. Each system test, conformance scenario, deployment scenario and smoke scenario
  proves one scenario. A live test has no scenario.
- A **fake** stands in for an outside system and behaves like it for what the module uses (ADR 0049). A **live**
  test uses the outside system itself, so it shows what no fake can: that the real service still accepts what the
  factory sends. Such a test fails when the service changes, not only when this repository changes.

### Live tests

The live tests are the paid smoke run `SMOKE-PAID` (ADR 0077). They are no system tests: they have no scenario, no
fakes and no network guard, `make verify` never runs them, and no check counts them. They are not run once: a new
version of a harness or a change of the provider can break them at any time.

| Live test | Proves | When it runs |
| --- | --- | --- |
| opencode | opencode fixes a typo with a real model through OpenRouter. | Every week in `weekly-paid.yml`, and before a release. |
| claude-code | Claude Code fixes a typo on a developer's subscription. | By hand only; a subscription is one person's, never CI's. |
| claude-code in a sandbox | Claude Code runs in a sandbox of the agents' template, holds only the placeholder of `CLAUDE_CODE_OAUTH_TOKEN`, and reaches Anthropic through the egress proxy, which puts the token in (ADR 0096). | By hand only, as claude-code. |
| reference run | The reference factory's implement stage, on opencode through LiteLLM, turns an issue of a sample repository in a Forgejo of the job into a pull request (ADR 0128). | By hand only: `paid-reference-run.yml`, started by a maintainer or an admin. |
| factory run | The same stage turns an issue of this repository labeled `factory` into a pull request on `factory/issue-<n>` (ADR 0128). | By hand only: `paid-factory-run.yml`, started by a maintainer or an admin. |

Run the claude-code live tests again when one of these changes: the template of the reference factory's sandboxes,
the version of `@opensoftware/harness-claude-code` or of Claude Code in it, or the egress hosts of the reference
factory. Run them also before a release of the profile or the chart, and when a stage fails at its first turn with
an error of authentication.

## The boundary

A system test drives the **built** module from outside and checks only what the module produces. Everything
the module calls is a fake the test controls.

```mermaid
flowchart LR
  subgraph Test process
    T[system test SCN-…] --> K["@opensoftware/testkit: sut handle, fakes, clock"]
  end
  subgraph Module under test, own process or container
    A[built artifact]
    S[src/ private]
    D[(database, data folder)]
  end
  K -->|CLI args, exit code, stdout| A
  K -->|HTTP API, MCP, ACP via generated clients| A
  A -->|published events| K
  K -->|$INPUT / $OUTPUT folders| A
  A -->|calls| F[fakes: scripted model gateway, scripted ACP harness, fake Slack, fake GitHub, Forgejo, Postgres, NATS, Temporal, S3, OTel Collector, fixed clock]
  T -. "✕ import from src/ (BOUNDARY-STATIC)" .-> S
  T -. "✕ read or write its data (BOUNDARY-RUNTIME)" .-> D
```

Because the module runs as its artifact in its own process, a test cannot pass by reaching inside it.

A library in `packages/` (ADR 0039) has no artifact to start: its system tests import its built package by name,
`@opensoftware/<name>`, and call its exports in the test's process. That import is the only one BOUNDARY-STATIC
adds for them; an import from its `src/` still fails. For ASSERT, what its exports return counts as coming from
the system under test. Files still go through `sut.files`, and
`sut.files.path("$INPUT/...")` gives a library function the absolute path. MUTATION covers libraries like modules
and takes the place of REACH for them.

## Layout

```text
modules/proof/
  README.md            how to use; generated sections
  AGENTS.md            public surface, exceptions, budget, scenario prefix
  features/            requirements (implemented steps never change; replace them)
  system-tests/        one file per scenario: SCN-PROOF-004.test.ts
  src/                 private
  adapters/github/     runs ports/forge @conformance scenarios
ports/<port>/features/ shared adapter behavior (@conformance)
e2e/features/          cross-module smoke scenarios
docs/vision/           factory-level requirements; source for module scenarios, not checked by SPEC
```

## Rules

- One Gherkin scenario per behavior, with `@id=SCN-<PREFIX>-NNN` and `@status`.
- Exactly one system test per implemented scenario; `given`, `when`, `then` labels repeat the steps.
- Every module's `-001` is its README quick start.
- No real network, model, clock or randomness. The forge in tests is a real Forgejo container, or for GitHub the
  testkit's in-process fake of its REST API (ADR 0058); the chat is the testkit's fake Slack, or the conversation
  of a pull request in its fake GitHub (ADR 0059); the harness is
  the scripted ACP agent from the testkit, or a real harness such as Claude Code against the scripted gateway
  (ADR 0052); models come from the scripted gateway, which fails on unscripted calls.
- Outside systems in tests are fast stand-ins that the module cannot tell from the real system (ADR 0049): the
  real system in memory or in process where one exists (PostgreSQL is PGlite), a small test-only stand-in in the
  testkit where none exists and the real system is slow (Slack, the model gateway), a container otherwise. The
  module reaches each through its documented configuration; switching a stand-in changes only the testkit.
- A module that runs a port adapter as a program gets the built adapter of this repository with `sut.adapter`, so its
  tests prove the module and the adapter together against the same fakes (ADR 0060).
- A sandbox adapter's tests run real sandboxes, since isolation is what they prove. The APIs and MCP servers a
  sandbox calls are `fakes.http(routes, { containers: true })`, which the sandbox reaches at `host.docker.internal`
  through its egress proxy (ADR 0054). The kubernetes adapter's tests run on kind with agent-sandbox in CI; the egress
  pod reaches the runner as `host.docker.internal` through `OSF_SANDBOX_HOST_ALIASES` (ADR 0055).
- A scenario of an adapter without a command line, which the foreman runs with `npx` at the factory's range, puts a
  script named `npx` first on `PATH` that logs its arguments and runs the fake adapter, so no package is downloaded
  (ADR 0110).
- A module that drives the sandbox port, such as the foreman, gets `fakes.sandbox()`, whose sandboxes are folders on
  the host, and not the built docker adapter: a real sandbox would need Docker and an image with the module's harness
  in it, and the adapters' own scenarios already prove isolation (ADR 0068). One end-to-end scenario runs the scripted
  agent in a real docker sandbox of the workspace image, with `fakes.harness(script, { sandboxes })`, to prove that
  the agent holds no token of the foreman (ADR 0096).
- Scenario files share Vitest workers (ADR 0051): a worker imports the testkit once and runs many files, so a test
  keeps all its state inside its scenario and never changes the test process's environment or globals.
- No unit tests by default (ADR 0007). A module's `AGENTS.md` may allow them for a pure algorithm.

## Test speed

System tests are the only tests, so their speed is the speed of every pull request. Speed comes from how the
tests run and how scenarios are written, never from testing less: no unit tests, mocks or skipped scenarios. A pull
request replays the passed result of a suite whose inputs did not change, from the turbo cache; `main` and `make verify`
run every suite (ADR 0081). The check AFFECTED keeps the inputs of each suite complete.

Where the time went, and what each step changed:

| When | Cost | Change |
| --- | --- | --- |
| ADR 0026 | `make verify` ran every suite one after the other | CI runs each suite on its own runner, side by side |
| ADR 0049 | Containers for systems that have a fast stand-in | PGlite, in-process fakes of Slack, GitHub and the model gateway |
| ADR 0067 | NATS and Temporal containers, about 5 s each | The same servers as pinned binaries on the host, about 1 s each |
| ADR 0051 | Every scenario file imported the testkit again, 0.7 s each | Files share Vitest workers |
| ADR 0081 | A pull request that changed one README ran all 17 suites: 8 minutes | Pull requests replay the results of unchanged suites and skip their setup |
| ADR 0061 | Every mutant reran the whole suite: 25 minutes for one forge adapter change of 65 mutants | Each mutant reruns only the scenarios whose module processes ran it |
| ADR 0084 | The nightly mutation run took one runner per unit, up to the 5-hour limit, and failed every night | Shards of about 600 lines, shortest scenarios first, no coverage during mutation; unchanged shards replay their reports |
| ADR 0094 | A pull request started 17 test jobs, and the jobs of unchanged suites spent 1 to 2 minutes each to replay | One job plans the suites and replays the unchanged ones; only suites with work start a runner |

In October 2026 a full pull request run took about 4 minutes for `verify`. The longest suites were
inference-litellm (each scenario starts LiteLLM and PostgreSQL), sandbox-kubernetes (kind) and the catch-all
`rest` job, each about 160 seconds on one runner. MUTATION was the slowest check, so it is where speed matters
most.

Rules for new scenarios, tests and test tooling:

- A mutant reruns every scenario that reached its line. A scenario that starts the module only to set up state
  for another behavior reaches that code too, so keep scenarios small and set state up through the cheapest
  surface (files in `$INPUT`, a fake's state), not through a long chain of module commands.
- Do the module's work in its own Node processes on the host, started by the testkit inside the scenario. The
  testkit records coverage (REACH) and mutants (MUTATION) only there. Code that runs only in a container, or in a
  process started without the module's environment, counts as never reached: REACH fails its lines and its
  mutants count as missed.
- Never share a module process across scenarios, for example a server started in a Vitest `globalSetup`. Its
  coverage and its mutants belong to no scenario.
- Use the fastest stand-in the port allows (ADR 0049). A container start of 20 to 30 seconds is paid again for
  each mutant of the lines it reaches.
- Never wait for time to pass. When a module flushes or polls on an interval, make the interval configurable and
  short in the test's config, or wait for the result the module produces.
- A new suite's time counts against its `AGENTS.md` budget (BUDGET), a time on the reference runner: on CI, BUDGET
  divides the time by the slowdown that `testkit timed` measured on the runner of the same run (ADR 0103). When a
  suite gets close to it, split slow scenarios or find a faster stand-in before raising the budget.
- Measure before you change how tests run: the JUnit times in `reports/junit/` show each scenario, the `verify` job
  list shows each suite that ran, and the job `plan` lists the suites it replayed.

## Why no unit tests, and what replaces their safety

| Unit tests give | Cost with agents | Replaced by |
| --- | --- | --- |
| Fast feedback | Many turns spent keeping hundreds of tests in step with refactors | Fast system tests: one artifact start per module, parallel files in shared workers, fakes, BUDGET check |
| Edge cases | Tests pin implementation details | Scenario Outlines with examples, from the outside |
| Confidence that code is exercised | Coverage numbers agents learn to game | REACH (coverage of the running module) and MUTATION (the changed lines of each pull request, every line nightly) |

Limits: STEPS proves the test follows the scenario's words, not their meaning. ASSERT, MUTATION and human
review of the first tests in each module close most of the gap. Edits to implemented scenarios show up in the
pull request diff, where the review catches them.

## Smoke tests

The deterministic smoke scenarios in [`e2e/features/smoke.feature`](../../e2e/features/smoke.feature) run on the
Compose profile. The live tests of [`e2e/paid/`](../../e2e/paid/harness.paid.ts) are described in
[Live tests](#live-tests). The smoke scenarios run every module from one image built from the workspace,
with the testkit's fakes on the Docker host: the scripted agent runs inside foreman's container, and a turn's
`commands` push a branch and open a pull request on Forgejo like a coding agent's tools (ADR 0076). The profile's own scenarios in [`deploy/features/`](../../deploy/features/compose.feature)
start it with `sut.compose`, each as a Compose project of its own, and check that every service is healthy and wired
(ADR 0074). The Helm chart's scenarios install it with `sut.helm` on kind with agent-sandbox, each release in a namespace of
its own, and check the same subset: every workload ready, the console wired to foreman, `helm test` planning the
reference factory (ADR 0075), and a sandbox that the chart's foreman starts (ADR 0097).

## Evergreen docs

| Kind | Where | How it stays current | Check |
| --- | --- | --- | --- |
| Reference | CLI help, config, API, events, scenario lists | generated by `make docs` | DOCS-GEN |
| Requirements | `features/` | the scenarios themselves | SPEC, PASS |
| How-to and tutorial | READMEs, `docs/how-to/` | front matter `covers:`; updated or marked reviewed when covered paths change | DOCS-AFFECTED |
| Explanation | `docs/explanation/`, `docs/architecture/`, ADRs | ADRs are superseded, never edited after acceptance | ADR, DOCS-LINKS |

All checks: [`checks.md`](checks.md).
