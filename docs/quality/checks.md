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

The checks are scripts in `tools/checks/` (TODO item T-00), run with `osf check <ID>`; see
[`tools/README.md`](../../tools/README.md). BOUNDARY-RUNTIME and NOREAL are guards in the testkit; the testkit also records the coverage REACH reads.
From phase 2 on, the released `spec-trace` module replaces TRACE, STEPS and PASS.

CI runs `make verify` in `.github/workflows/verify.yml` for every pull request and every push to `main`.
Release pull requests are opened by release-please with `GITHUB_TOKEN`, and their `pull_request` run waits for a
person's approval. So `release-please.yml` also starts `verify` on each release branch it created or updated,
with `workflow_dispatch`, and that run needs no approval.

## Specification and traceability

| ID | What it checks | How |
| --- | --- | --- |
| SPEC | Every scenario has one `@id`, one `@status` (`planned`, `implemented`, `deprecated`), and the ID matches `^SCN-[A-Z][A-Z0-9]*-\d{3}$` with the module's registered prefix. IDs are unique in the repository. | Parse every `.feature` file with the official Gherkin parser. |
| TRACE | Every `implemented` scenario has exactly one system test; every system test names an existing scenario; `planned` scenarios may have a test that is expected to fail; `deprecated` scenarios have none. `@conformance` scenarios have exactly one test per adapter of the port. | Read `scenario("SCN-...")` calls from the TypeScript AST. Only string literals count. |
| STEPS | The labels of `given`, `when` and `then` calls match the scenario's steps, in order, word for word. Outline parameters `<name>` match any value. | Compare AST string literals with the parsed steps. |
| PASS | Every `implemented` scenario's test ran in this CI run and passed. Skipped, todo, retried-to-pass and missing results fail. | Join the JUnit XML results (each test case carries its scenario ID) with the scenario list. |

## Boundaries

| ID | What it checks | How |
| --- | --- | --- |
| BOUNDARY-STATIC | System tests import only `@opensoftware/testkit`, generated contract clients, test fixtures and the test framework. No import from `src/`, no database driver, no `fs` or `child_process` outside the testkit. | dependency-cruiser rules. |
| BOUNDARY-RUNTIME | The module under test runs as its built artifact in a separate process, with its own data folder that the test has no path into. | The testkit starts the module's `bin` and refuses a `bin` in `src/`; the module keeps its state in `OSF_DATA`, a folder outside `$INPUT` and `$OUTPUT` that `sut.files` refuses. Tests receive only URLs, a CLI handle and the documented input and output folders. |
| BOUNDARY-ENV | Tests set only environment variables that the module's README documents. | The testkit refuses undocumented variables; the list is generated from the module's config schema. |
| ISOLATION | No module imports another module's package or source. | dependency-cruiser on `modules/**`, `ports/**`, `adapters/**`. |
| ARCH | Every module with files in `src/` or `bin/` declares its layers in `architecture.json`; every source file is in a layer; no file imports a layer listed above its own (ADR 0014). | dependency-cruiser on each module's source files. |
| NOREAL | No real network, model, clock or randomness in system tests. | A network guard loaded into every Node process of the module refuses connections to anything but loopback and the testkit's containers and fails the scenario; the fake model gateway and the scripted harness fail on any unscripted call; the testkit injects a fixed clock and seed through documented config. |

## Test quality

| ID | What it checks | How |
| --- | --- | --- |
| ASSERT | Every `then` block contains at least one assertion on a value that came from `sut` or `fakes`. | AST data-flow check on the assertion arguments. |
| NOSKIP | No `.skip`, `.only`, `.todo` or `.fails` in system tests. | AST search. |
| REACH | A pull request adds no line to a module's `src/` or `bin/` that no system test reaches, and no source file that no system test loads (files of types only are exempt). | The testkit records V8 coverage in every Node process of the module (`reports/coverage/`); `osf check REACH` maps it to source lines with v8-to-istanbul, through source maps for built files, and compares it with the lines added since `OSF_BASE` (ADR 0019). |
| MUTATION | System tests notice small changes to the code they claim to cover. | Nightly Stryker on a sample of changed files; a falling score opens a ticket. Not a pull request gate, because it is slow. |
| FLAKE | A test that passed only on retry is a failure. | PASS reads the retry count from the results. |
| BUDGET | Each module's system tests finish inside the budget in its `AGENTS.md`. | Timing from the JUnit results; `make verify` runs one suite at a time, so suites do not slow each other. |

## Contracts and docs

| ID | What it checks | How |
| --- | --- | --- |
| CONTRACT | No breaking change to an API or schema without a major version. | `oasdiff` for OpenAPI; JSON Schema compatibility check against the last release; shared fixtures validate against every schema. |
| DOCS-GEN | Generated reference docs are current. | `make docs` and fail on any diff. |
| DOCS-AFFECTED | Every hand-written doc whose `covers:` paths changed is updated or listed as `docs-reviewed:` in the pull request. | Path match between the diff and the front matter. The files of a release (`CHANGELOG.md`, the release-please manifest, a `package.json` that only changes `version`) do not count. |
| DOCS-LINKS | Internal links and anchors resolve. | lychee in offline mode. |
| ADR | New modules, dependencies and services have an accepted ADR with a filled Prior art section. | Parse the ADR front matter and sections. |

## End-to-end

| ID | What it checks | How |
| --- | --- | --- |
| SMOKE | The scenarios in `e2e/features/` pass against the Compose profile with fakes. | `make smoke` in CI on every merge to `main` and before every release. |
| SMOKE-PAID | One real-model run per first-party harness completes a small task. | `make smoke-paid`, nightly and before a release; never on pull requests. |
