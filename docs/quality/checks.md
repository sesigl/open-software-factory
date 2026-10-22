---
covers: [tools/checks/**, Makefile, .github/workflows/**]
---

# Checks

Every check is deterministic: the same commit gives the same result, with no model call and no network.
`make check` runs the fast checks for changed modules. `make verify` runs all of them. Each failure prints its
check ID and the file and line to fix.

Scope: SPEC, TRACE, STEPS and PASS apply to `modules/*/features/`, `ports/*/features/`, `packages/*/features/`,
`tools/features/`, `deploy/features/` and `e2e/features/`. The factory-level requirements in `docs/vision/` are
source material and are not checked; module scenarios link to them with `@realizes=SCN-FACTORY-...`.

SPEC, TRACE, STEPS and PASS run with the module `spec-trace` ([ADR 0030](../decisions/0030-spec-trace.md),
[ADR 0031](../decisions/0031-spec-trace-action-and-dogfood.md)) and the root `spec-trace.json`: `make check` runs
`spec-trace check --only SPEC,TRACE,STEPS`, `make verify` runs `spec-trace check`. The other checks are scripts in
`tools/checks/` (TODO item T-00), run with `osf check <ID>`; see [`tools/README.md`](../../tools/README.md).
BOUNDARY-RUNTIME and NOREAL are guards in the testkit; the testkit also records the coverage REACH reads.

CI runs `make verify` in `.github/workflows/verify.yml` for every pull request and every push to `main`. It runs
MUTATION in `.github/workflows/mutation.yml` for every pull request, one runner per changed unit, as a separate check. It runs
the three parts of `make verify` as jobs: `verify-static` (lint, typecheck, build) and one `verify-tests` job per
test suite run side by side, each on its own runner. The `verify` job then collects their JUnit and coverage results
and runs `verify-checks`; it fails when any part failed. A package without its own job runs in the `rest` job.
Release pull requests are opened by release-please with `GITHUB_TOKEN`, and their `pull_request` run waits for a
person's approval. So after each push to `main`, `release-please.yml` also starts `verify` on every open release
pull request with `workflow_dispatch`. That run needs no approval. It uses `verify.yml` from `main`, merges the pull
request into `main` before it tests, and reports the result as the `verify` commit status on the pull request's head.
On each pull request from this repository, the `verify` job also runs the proof GitHub Action on the JUnit results of
every suite ([ADR 0029](../decisions/0029-proof-capture-and-action.md)): one proof comment and the commit status
`proof`. The `proof` suite's job installs Chromium for the capture scenarios. The `verify` job also runs the spec-trace
GitHub Action for its report: the job summary lists the scenarios a pull request adds, removes or changes, and the
artifact `spec-trace` holds the JSON report. Until `@opensoftware/spec-trace` and `@opensoftware/proof` are on npm,
both actions run the build of the checkout.

## Specification and traceability

| ID | What it checks | How |
| --- | --- | --- |
| SPEC | Every scenario has one `@id`, one `@status` (`planned`, `implemented`, `deprecated`), and the ID matches `^SCN-[A-Z][A-Z0-9]*-\d{3}$` with the module's registered prefix. IDs are unique in the repository. | Parse every `.feature` file with the official Gherkin parser. |
| TRACE | Every `implemented` scenario has exactly one system test; every system test names an existing scenario; `planned` scenarios may have a test that is expected to fail; `deprecated` scenarios have none. `@conformance` scenarios have exactly one test per adapter of the port. | Read `scenario("SCN-...")` calls from the TypeScript AST. Only string literals count. |
| STEPS | The labels of `given`, `when` and `then` calls match the scenario's steps, in order, word for word. Outline parameters `<name>` match any value. | Compare AST string literals with the parsed steps. |
| PASS | Every `implemented` scenario's test ran in this CI run and passed. Skipped, todo and missing results fail; FLAKE fails retried-to-pass results. | Join the JUnit XML results (each test case carries its scenario ID) with the scenario list. |

## Boundaries

| ID | What it checks | How |
| --- | --- | --- |
| BOUNDARY-STATIC | System tests import only `@opensoftware/testkit`, generated contract clients, test fixtures and the test framework. The tests of a library in `packages/` also import the library by its package name (ADR 0039). No import from `src/`, no database driver, no `fs` or `child_process` outside the testkit. | dependency-cruiser rules. |
| BOUNDARY-RUNTIME | The module under test runs as its built artifact in a separate process, with its own data folder that the test has no path into. | The testkit starts the module's `bin` and refuses a `bin` in `src/`; the module keeps its state in `OSF_DATA`, a folder outside `$INPUT` and `$OUTPUT` that `sut.files` refuses. Tests receive only URLs, a CLI handle and the documented input and output folders. |
| BOUNDARY-ENV | Tests set only environment variables that the module's README documents. | The testkit refuses undocumented variables; the list is generated from the module's config schema. |
| ISOLATION | No module imports another module's package or source. A module may depend on `@opensoftware/contracts`, on `@opensoftware/testkit` in `devDependencies` and on a library: a package in `packages/` without a `bin` (ADR 0037, ADR 0039). | dependency-cruiser on `modules/**`, `ports/**`, `adapters/**`. |
| DUP | Inside a unit (module, package, adapter or `tools/`), the share of source lines that belong to a clone stays under the limit in its `AGENTS.md` ("Duplication: at most 3%"). No clone across units: shared code moves into a package in `packages/` or into `contracts/`. Clones of `modules/_template` do not count, since every new module starts as its copy (ADR 0037). The baseline of clones that existed when the check started is gone: they moved into libraries (ADR 0040, ADR 0041, ADR 0042). | jscpd on the source files of every unit, clones of 50 tokens or more. System tests are not checked: each repeats its setup on purpose. |
| ARCH | Every module with files in `src/` or `bin/` declares its layers in `architecture.json`; every source file is in a layer; no file imports a layer listed above its own (ADR 0014). | dependency-cruiser on each module's source files. |
| NOREAL | No real network, model, clock or randomness in system tests. | A network guard loaded into every Node process of the module refuses connections to anything but loopback and the testkit's containers and fails the scenario; the fake model gateway and the scripted harness fail on any unscripted call; the testkit injects a fixed clock and seed through documented config. |

## Test quality

| ID | What it checks | How |
| --- | --- | --- |
| ASSERT | Every `then` block contains at least one assertion on a value that came from `sut` or `fakes`. In the tests of a library or of the contracts, a value from a call of the package's own exports, or of its subpath exports, counts too (ADR 0039, ADR 0042). | AST data-flow check on the assertion arguments. |
| NOSKIP | No `.skip`, `.only`, `.todo` or `.fails` in system tests. | AST search. |
| REACH | A pull request adds no line to a module's `src/` or `bin/` that no system test reaches, and no source file that no system test loads (files of types only are exempt). A library's tests call it in their own process, which records no coverage; MUTATION covers its lines instead (ADR 0039). | The testkit records V8 coverage in every Node process of the module (`reports/coverage/`); `osf check REACH` maps it to source lines with v8-to-istanbul, through source maps for built files, and compares it with the lines added since `OSF_BASE` (ADR 0019). |
| MUTATION | System tests notice small changes to the code they cover. Each module's and each library's `AGENTS.md` sets two limits under "Quality limits": a score for the mutants in the lines a change adds and a score for all mutants. Every module and every library has a `mutation` script and both limits (ADR 0037, ADR 0039). | `osf mutation` runs Stryker with its command runner. Stryker builds the mutated module once and reruns its system tests per mutant with `__STRYKER_ACTIVE_MUTANT__`, which the testkit passes to the module's process. `osf check MUTATION` scores the reports in `reports/mutation/` and names the file and line of each missed mutant. `mutation.yml` does both for the changed lines on every pull request, one runner per changed unit, and its `mutation` job scores all reports. The nightly run mutates every line, one runner per module, runs `osf check MUTATION --total` and opens a ticket when a module falls below its total limit. Not part of `make verify`, because it takes minutes. |
| FLAKE | A test that passed only on retry is a failure. | `osf check FLAKE` reads the retry count from the JUnit results. |
| BUDGET | Each module's system tests finish inside the budget in its `AGENTS.md`. | Timing from the JUnit results; `make verify` runs one suite at a time and CI gives each suite its own runner, so suites do not slow each other. |

## Contracts and docs

| ID | What it checks | How |
| --- | --- | --- |
| CONTRACT | No breaking change to an API or schema without a major version. | `oasdiff` for OpenAPI; JSON Schema compatibility check against the last release; shared fixtures validate against every schema. |
| DOCS-GEN | Generated reference docs are current. | `make docs` and fail on any diff. |
| DOCS-AFFECTED | Every hand-written doc whose `covers:` paths changed is updated or listed as `docs-reviewed:` in the pull request. | Path match between the diff and the front matter. The files of a release (`CHANGELOG.md`, the release-please manifest, a `package.json` that only changes `version`, a JSON extra file of `release-please-config.json` that only changes the value at its `jsonpath`) do not count. |
| DOCS-LINKS | Internal links and anchors resolve. | lychee in offline mode. |
| ADR | New modules, dependencies and services have an accepted ADR with a filled Prior art section. | Parse the ADR front matter and sections. |
| RUNS | Every `runs/*.jsonl` line is a run whose root span `invoke_agent` matches the `run-record` contract and that holds no prompt or tool content; a change with a commit since `OSF_BASE` whose `Co-Authored-By:` trailer names Claude, Codex or OpenCode adds or changes a file in `runs/` (ADR 0027). | Parse each line, validate with `@opensoftware/contracts`; `git log` for the trailers. Fix: `make run-record`, then commit `runs/`. |

## End-to-end

| ID | What it checks | How |
| --- | --- | --- |
| SMOKE | The scenarios in `e2e/features/` pass against the Compose profile with fakes. | `make smoke` in CI on every merge to `main` and before every release. |
| SMOKE-PAID | One real-model run per first-party harness completes a small task. | `make smoke-paid`, nightly and before a release; never on pull requests. |
