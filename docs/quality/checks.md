---
covers: [tools/checks/**, Makefile, .github/workflows/**]
---

# Checks

Every check is deterministic: the same commit gives the same result, with no model call and no network. Each
failure prints its check ID and the file and line to fix. The tables list each check in one line; the sections
below them say what each check reads, what fails and how to fix it.

## Where the checks run

The column "Runs in" of the tables uses these names.

| Name | What runs the check |
| --- | --- |
| fast | `make check-fast`, `make check` and `make verify`: `spec-trace check --only SPEC,TRACE,STEPS` and `osf check` (the fast set of `tools/checks/run.ts`). The Claude Code `Stop` hook runs `make check-fast`. |
| verify | `make verify` only (its part `verify-checks`): `spec-trace check` and `osf check --all`, on the test results in `reports/`. |
| tests | A guard in the testkit, while the system tests run. |
| mutation | `make mutation`, `mutation.yml` on every pull request, and the nightly run. Not part of `make verify`. |
| smoke | `make smoke`, `make smoke-paid` and their CI runs. |

SPEC, TRACE, STEPS and PASS run with the module `spec-trace` ([ADR 0030](../decisions/0030-spec-trace.md),
[ADR 0031](../decisions/0031-spec-trace-action-and-dogfood.md)) and the root `spec-trace.json`. The other checks are
scripts in `tools/checks/` (TODO item T-00), run with `osf check <ID>`; see [`tools/README.md`](../../tools/README.md).
BOUNDARY-RUNTIME and NOREAL are guards in the testkit; the testkit also records the coverage REACH reads.

Some checks compare with a base commit, `OSF_BASE`. `make` sets it to `git merge-base HEAD origin/main`; CI sets it
to the base of the pull request. Without it, a check that needs it prints "skipped", and `osf check --all` fails.

### What the checks read

- SPEC, TRACE, STEPS and PASS apply to the feature files that `spec-trace.json` lists: `modules/*/features/`,
  `ports/*/features/`, `adapters/*/*/features/`, `packages/*/features/`, `contracts/features/`, `tools/features/`,
  `deploy/features/` and `e2e/features/`.
- The factory-level requirements in `docs/vision/` are source material. Module scenarios link to them with
  `@realizes=SCN-FACTORY-...`, and VISION keeps their status lines.
- The checks read the files that `git ls-files -co --exclude-standard` lists: committed or not, but not ignored.
  Outside a Git repository they read every file except in `.git/` and `node_modules/`.
- A nested Git checkout is not part of the repository: a folder below the root with a `.git` file (a worktree, such
  as a subagent's in `.claude/worktrees/`) or a `.git` folder (a clone). Git leaves it out, and so do the checks,
  `make docs` (DOCS-GEN) and `make next-id` (SCN-REPO-159 to -161).

### In CI

- `.github/workflows/verify.yml` runs `make verify` for every pull request and every push to `main`.
- It runs the three parts of `make verify` as jobs: `verify-static` (lint, typecheck, build) and one `verify-tests`
  job per test suite of `.github/test-suites.yml`, side by side, each on its own runner. A package without its own
  suite runs in the suite `rest`. The `verify` job then collects their JUnit and coverage results and runs
  `verify-checks`; it fails when any part failed, and PASS fails every scenario of a suite whose results are missing.
- The small suites share two runners (ADR 0163): `osf suite-plan` turns the suites that run into the jobs of the
  matrix. A suite whose units' budgets add up to at most 80 s (under 40 s of tests, as a budget is twice the measured
  time), whose filter names its packages and that starts no kind cluster goes into one of two shared jobs, longest
  first into the job with the smaller sum. A shared job is named after its suites, `tests (tools+ledger+...)`, and
  runs their filters in one `make verify-tests`, one test task at a time, so BUDGET reads each unit's own wall time.
  A new suite or a changed budget moves between the jobs without a change in the workflow.
- On a pull request, the job `plan` starts a runner only for a suite with a test task that is no turbo cache hit,
  and replays the results of the other suites itself. Lint, typecheck and build replay the results of unchanged
  packages (ADR 0081, ADR 0094).
- On `main` and locally everything runs, and `main` stores its results under the hash a pull request computes, so a
  pull request's first push replays the suites that `main` proved for the same inputs (ADR 0154). AFFECTED keeps the
  hash complete.
- A new push to a pull request cancels its running `verify`. A push to `main` never cancels the run of the commit
  before it, so every commit of `main` gets a finished run.
- Release pull requests are opened by release-please with `GITHUB_TOKEN`, and their `pull_request` run waits for a
  person's approval. So after each push to `main`, `release-please.yml` also starts `verify` on every open release
  pull request with `workflow_dispatch`. That run needs no approval. It uses `verify.yml` from `main`, merges the
  pull request into `main` before it tests, and reports the result as the `verify` commit status on the pull
  request's head.
- On each pull request from this repository, the `verify` job runs the proof GitHub Action on the JUnit results of
  every suite ([ADR 0029](../decisions/0029-proof-capture-and-action.md)): one proof comment and the commit status
  `proof`.
- The `verify` job also runs the spec-trace GitHub Action for its report: the job summary lists the scenarios a pull
  request adds, removes or changes, and the artifact `spec-trace` holds the JSON report.
- Both actions run the release from npm at the version of the module's `package.json`, so a change to proof or
  spec-trace reaches this check after its release.
- Suites with extra setup: the `proof` suite's job installs Chromium for the capture scenarios. The `deploy` suite's
  job pulls the images of the Compose profile while it builds (ADR 0074) and starts kind with agent-sandbox; its
  `test:system` builds the module images of the commit and loads the images of the Helm chart into kind before the
  timed tests (ADR 0075, ADR 0156). The `testkit` suite's job starts kind for `sut.helm`.
- A job with kind starts its cluster in the background right after the pinned tools are restored, while Node, the
  install and the pulls run (`.github/scripts/kind-start.sh`, ADR 0163). With agent-sandbox, that start also applies
  its manifest once. Each line of its log carries the time it was written. kind and the suite's `pull` images come
  from their registries: a cache of their archives made the setup slower (ADR 0167).
- `.github/workflows/released-images.yml` runs after each successful `publish-images`, on the commit it published,
  and by hand: the deploy suite's Compose scenarios on the images in GHCR, pulled by `scripts/images.ts` with
  `OSF_DEPLOY_IMAGES=released` (ADR 0169). It runs Vitest in `deploy/` without turbo, so it writes nothing into the
  test cache and no wall time for BUDGET; AFFECTED fails another workflow that sets `OSF_TEST_CACHE` or writes the
  cache `turbo-tests-`. When it fails, it opens or comments on the issue "The released images fail the deploy
  scenarios" with the run and the failed scenarios; `skills/release-packages` says what to do.
- `.github/workflows/mutation.yml` runs MUTATION for every pull request as a separate check, one runner per shard of
  about 100 added lines of each changed unit (see [MUTATION](#mutation)).

## The checks

### Specification and traceability

| ID | Rule | Runs in |
| --- | --- | --- |
| SPEC | Every scenario has one unique, well-formed `@id` and one `@status`. | fast |
| TRACE | Every `implemented` scenario has exactly one system test, and every test names a scenario. | fast |
| STEPS | The labels of `given`, `when` and `then` match the scenario's steps word for word. | fast |
| PASS | Every `implemented` scenario's test passed in this run, or was replayed for the same inputs. | verify |
| VISION | A vision scenario is `implemented` exactly when its realizing module scenarios are. | fast |
| TODO | No open item of `TODO.md` has every slice ticked. | fast |

### Boundaries

| ID | Rule | Runs in |
| --- | --- | --- |
| BOUNDARY-STATIC | System tests import only the testkit, contract clients, fixtures and the test framework. | fast |
| BOUNDARY-RUNTIME | The module under test runs as its built artifact in its own process with its own data folder. | tests |
| BOUNDARY-ENV | Tests set only environment variables that the module's README documents. | fast, tests |
| ISOLATION | No module imports another module's package or source. | fast |
| DUP | Duplicated source lines stay under each unit's limit; no long clone across units. | fast |
| AFFECTED | The turbo hash of each suite's system tests covers everything they use. | fast |
| RELEASE | Every published package has its publish workflow and release entries as `osf release-files` writes them. | fast |
| DEPS | A dependency that needs an exact version of a peer has that peer at that version. | fast |
| DEPS-RUNTIME | A published package loads at run time only what npm installs with it. | fast |
| PROFILE | The Compose profile, the Helm chart and the CI pulls of their images stay in step. | fast |
| ARCH | Every module declares its layers, and no file imports a layer above its own. | fast |
| NOREAL | No real network, model, clock or randomness in system tests. | tests |

### Test quality

| ID | Rule | Runs in |
| --- | --- | --- |
| ASSERT | Every `then` block asserts on a value that came from `sut` or `fakes`. | fast |
| NOSKIP | No `.skip`, `.only`, `.todo` or `.fails` in system tests. | fast |
| SURFACE | Every value a published package exports is named in its `AGENTS.md`. | fast |
| TEMPLATE | An Astro template holds no logic. | fast |
| CONTRAST | Every text token has at least 4.5:1 contrast on every background token. | fast |
| TOKENS | The UI sources name no colour value and no font outside the tokens. | fast |
| UI-QUERY | A UI test finds elements only by role, label or text. | fast |
| REACH | A pull request adds no module source line that no system test reaches. | verify |
| MUTATION | System tests notice mutants in the lines a change adds, and in all lines. | mutation |
| BUDGET | Each unit's system tests finish inside the wall time of their budget. | verify |

### Contracts and docs

| ID | Rule | Runs in |
| --- | --- | --- |
| CONTRACT | No breaking change to an API or schema without a major version. | verify |
| DOCS-GEN | Generated reference docs are current. | fast |
| DOCS-AFFECTED | Every hand-written doc whose `covers:` paths changed is updated or marked reviewed. | verify |
| DOCS-LINKS | Internal links and anchors resolve. | fast |
| ADR | Every unit, new dependency and new package has an accepted ADR with the sections it needs. | fast |
| RUNS | Every run record in `runs/` matches the `run-record` contract and holds no prompt content. | verify |

### End-to-end

| ID | Rule | Runs in |
| --- | --- | --- |
| SMOKE | The scenarios in `e2e/features/` pass against the Compose profile with fakes. | smoke, verify |
| SMOKE-PAID | A real-model run of a harness completes a small task. | smoke |

## Specification and traceability checks

### SPEC

- **Reads:** every `.feature` file of the scope, with the official Gherkin parser.
- **Fails:** a scenario without exactly one `@id` and one `@status` (`planned`, `implemented`, `deprecated`); an ID
  that does not match `^SCN-[A-Z][A-Z0-9]*-\d{3}$` with the module's prefix registered in
  `docs/reference/scenario-prefixes.md`; an ID used twice in the repository; more than one `@kind`, or a `@kind` other
  than `journey` (ADR 0131).
- **Passes:** other tags, such as `@shared=<name>` for a group of scenarios with one shared start (ADR 0157).
- **Fix:** `make next-id MODULE=<name>` gives the next free ID.

### TRACE

- **Reads:** the `scenario("SCN-...")` calls of the system tests, from the TypeScript AST. Only string literals count.
- **Fails:** an `implemented` scenario without exactly one system test; a test that names no existing scenario; a
  `deprecated` scenario that still has a test; a `@conformance` scenario without exactly one test per adapter of the
  port.
- **Passes:** a `planned` scenario may have a test that is expected to fail.

### STEPS

- **Reads:** the string literals of the `given`, `when` and `then` calls, and the parsed steps.
- **Fails:** a label that differs from its step, word for word and in order. An outline parameter `<name>` matches
  any value.
- **Fix:** copy the step text. When an implemented scenario's wording changes in place, change the labels in the same
  commit (ADR 0157).

### PASS

- **Reads:** the JUnit XML results, in which each test case carries its scenario ID, joined with the scenario list.
- **Fails:** an `implemented` scenario whose test did not run and pass in this run, unless turbo replayed its passed
  result for the same inputs (ADR 0081). Skipped, todo and missing results fail.
- **No retry:** every package's Vitest config sets `retry: 0`, which AFFECTED keeps true, so a passed result passed on
  its first run.
- **Outline:** a Scenario Outline's test runs every row of its `Examples` and is one test case, which fails when
  any row failed.

### VISION

- **Reads:** the tag lines of `docs/vision/software-factory.feature` (it holds several features, which Gherkin does not
  parse) and the `@realizes=` tags of every parsed scenario.
- **Fails:** a vision scenario whose status is wrong. It says `@status=implemented` when at least one module scenario
  realizes it and every realizing scenario that is not `deprecated` is `implemented`; otherwise it says `planned`
  ([ADR 0117](../decisions/0117-vision-status-from-realizing-scenarios.md)).
- **Also:** `make docs` writes the vision scenarios with their realizing scenarios to `docs/vision/README.md`, and
  DOCS-GEN keeps it current.

### TODO

- **Reads:** each item of `TODO.md`, up to the next heading or `---`.
- **Fails:** an open item (`### [ ] T-..`) whose slices are all ticked.
- **Passes:** an item without slices; it is not cut into slices yet (ADR 0117).
- **Fix:** tick the item, or add the slice that is left.

## Boundary checks

### BOUNDARY-STATIC

- **Reads:** the import graph of the system tests, with dependency-cruiser rules. BOUNDARY-STATIC, ISOLATION and ARCH
  read one import graph of the system tests and of every unit's files, which `osf check` cruises once.
- **Allowed:** `@opensoftware/testkit`, generated contract clients, test fixtures and the test framework. The tests of
  a library in `packages/` also import the library by its package name (ADR 0039).
- **Fails:** an import from `src/`, a database driver, `fs` or `child_process` outside the testkit.

### BOUNDARY-RUNTIME

- **How:** the testkit starts the module's `bin` and refuses a `bin` in `src/`. The module keeps its state in
  `OSF_DATA`, a folder outside `$INPUT` and `$OUTPUT` that `sut.files` refuses. Tests receive only URLs, a CLI handle
  and the documented input and output folders.
- **Fails:** the scenario whose test the testkit refuses.

### BOUNDARY-ENV

- **Reads:** the module's README; the list of documented variables is generated from the module's config schema. A
  name ending in `*`, such as `OSF_SECRET_*`, documents every variable with that prefix.
- **Fails, during the test:** the testkit refuses an undocumented variable that a test passes to the module.
- **Fails, before any test runs:** `osf check BOUNDARY-ENV` finds the variables of every `env: {...}` of a test, and
  also the variables a test sets in its own process with `vi.stubEnv` or `process.env.X =`. The guard does not see
  those, and they reach a library that its tests call in their process (ADR 0039).

### ISOLATION

- **Reads:** the imports of `modules/**`, `ports/**` and `adapters/**`, with dependency-cruiser.
- **Fails:** a module that imports another module's package or source.
- **Allowed:** `@opensoftware/contracts`; `@opensoftware/testkit` and the adapters its system tests start, in
  `devDependencies` (ADR 0081); a library, which is a package in `packages/` without a `bin` (ADR 0037, ADR 0039).

### DUP

- **Reads:** the source files of every unit (module, package, adapter or `tools/`), Astro templates among them (ADR
  0132), with jscpd; clones of 50 tokens or more. System tests are not checked: each repeats its setup on purpose.
- **Fails inside a unit:** the share of source lines that belong to a clone is over the limit in the unit's
  `AGENTS.md` ("Duplication: at most 3%").
- **Across units:** a clone of at most 15 lines counts toward each unit's share, with that unit's side only. A longer
  clone fails.
- **Not counted:** clones of `modules/_template`, since every new module starts as its copy (ADR 0037).
- **Fix:** an existing library whose job it fits, or `contracts/`, since a new package must earn its place (ADR 0159);
  see `skills/fix-mutation-and-duplication`. The baseline of clones that existed when the check started is gone: they
  moved into libraries (ADR 0040, ADR 0041, ADR 0042).

### AFFECTED

- **Reads:** with ts-morph, `system-tests/` and the scripts of `test:system`; the workspace's `package.json` and
  `turbo.json` files, the `Makefile`, the workflows in `.github/workflows/` and `.github/test-suites.yml`.
- **Why:** the turbo hash of each suite's system tests must cover what they use (ADR 0081), or a replay hides a
  change.
- **Fails, when a test uses something its hash does not cover:**
  - every adapter a test starts with `sut.adapter(...)`, every `@opensoftware/*` package it imports and every package
    a path relative to the test leads into must be declared in its `package.json`, or the file must be in
    `globalDependencies`;
  - a folder a test takes with `fakes.fromRepository("<path>")`, and a path from the root that a script named with
    `node <file>` in the package's `test:system` script reads (a string literal such as `"deploy/images"` that names a
    file or folder of the repository), must be in the package or a package it declares, match a `$TURBO_ROOT$/` input
    of `test:system` in the package's own `turbo.json`, or be in `globalDependencies`.
- **Fails, when the suites are wrong:** each package with system tests runs in exactly one suite of
  `.github/test-suites.yml`; each filter of a suite names a package with system tests; the suite of a package whose
  system tests open pages with `sut.browser` has `browser: chromium` (ADR 0131); the job `plan` of `verify.yml` reads
  the suites, its tests job runs only the planned suites, and the jobs `plan`, `tests` and `cache` keep `.turbo/cache`
  in the cache `turbo-tests-` (ADR 0094).
- **Fails, when results could pass on a retry or miss the hash:** each package writes its JUnit results to its own
  `reports/junit.xml` and sets `retry: 0` in its Vitest config, so no test passes on a retry; `turbo.json` caches
  `test:system` with the inputs `$TURBO_DEFAULT$`, the outputs `reports/**`, no env (so a pull request computes the
  hash of main's results, ADR 0154), the `cacheDir` `.turbo/cache` and the repository-wide files in
  `globalDependencies`, `.github/test-suites.yml` among them.
- **Fails, when the cache is used where it must not be:** `make verify-tests` runs the system tests and
  `make verify-static` runs lint, typecheck and build with `--force` unless `OSF_TEST_CACHE` is set; only pull requests
  set it, in any workflow; no workflow besides `verify.yml` writes the cache `turbo-tests-` with `actions/cache` or
  `actions/cache/save` (ADR 0169); no run of `test:system` uses `--only`.

### RELEASE

- **Reads:** every published workspace package (every package that is not `private`), the template
  `tools/scaffold/publish-workflow.yml`, `release-please-config.json` and `.release-please-manifest.json`. It renders
  the template per package and compares, and parses the two JSON files.
- **Fails:** a package without `.github/workflows/publish-<name>.yml` exactly as the template renders it, without an
  entry in `release-please-config.json` with `release-type` `node`, its `package-name` and its `component`, or without
  its version from `package.json` in `.release-please-manifest.json`; a generated workflow or release entry that names
  a package that is not published.
- **Fix:** `osf release-files`; see `skills/release-packages`.

### DEPS

- **Reads:** `pnpm-lock.yaml`: the resolved versions of each workspace package and the peers of each dependency.
- **Fails:** a dependency that needs an exact version of a peer, such as `@electric-sql/pglite-prepopulatedfs` (ADR
  0093), in a package that does not have that peer as a direct dependency at that version. An optional peer must
  match only when the package declares it (ADR 0094).

### DEPS-RUNTIME

- **Reads:** with the TypeScript parser of ts-morph, the sources a published package ships: no build, no
  `node_modules`. The code it ships is the TypeScript sources that its `bin`, `main` and `exports` (`dist/x.js` is
  `src/x.ts`) reach through relative imports. Tests, scripts and the files a bundler builds, such as Astro templates,
  no entry point reaches.
- **Fails:** a package that the shipped code imports, re-exports, imports with `import("x")` or looks up with
  `require("x")`, `createRequire(...)("x")` or `.resolve("x")` of a require or of `import.meta`, and that is not in its
  `dependencies`, `peerDependencies` or `optionalDependencies`, not a Node built-in and not the package itself (ADR
  0138). `import type` and `export type` do not load.
- **Bundles:** a package whose build script runs `tools/bin/bundle.ts` holds its imports in the bundle (ADR 0079), so
  only its lookups count.
- **Fix:** move the package to `dependencies`, or stop loading it at run time.

### PROFILE

- **Reads:** the profile, the stages of `deploy/images/Dockerfile`, the chart and `.github/test-suites.yml`. It renders
  the pins again and compares, and compares with `OSF_BASE`.
- **Fails, when the pins are not as `osf profile-pins` writes them (ADR 0095):** `compose.yaml`, `values.yaml`,
  `Chart.yaml` and the factories of `deploy/` pin each package at the workspace's version and each agents' template at
  the profile's tag of its image (ADR 0096); each package that the reference factory's workflows `factory` run is at
  the workspace's version (ADR 0150); a module image's tag is the version of its own package, with or without `-r<n>`.
- **Fails, compared with `OSF_BASE`:** an image whose packages changed has no new tag; an image whose stage of
  `deploy/images/Dockerfile` changed (or a stage or global `ARG` it builds on; comments do not count) has no new tag;
  a changed chart has no new version.
- **Fails, when chart, profile and CI disagree:** each image of the chart is an image of the profile, pulled or built
  (ADR 0098); the `pull` list of a suite holds each image of the Compose files its tests start, and its other entries
  are named in the files of the suite's packages or their workspace dependencies; `deploy/package.json` declares each
  package that `compose.yaml` installs, since the deploy suite builds the module images from them (ADR 0156).
- **Fix:** `osf profile-pins`; for a changed stage, the next `-r<n>` tag; for a missing declaration, a `workspace:*`
  devDependency.

### ARCH

- **Reads:** each module's `architecture.json` and source files, with dependency-cruiser (ADR 0014).
- **Fails:** a module with files in `src/` or `bin/` and no `architecture.json`; a source file in no layer; a file that
  imports a layer listed above its own.

### NOREAL

- **How:** a network guard loaded into every Node process of the module refuses connections to anything but loopback
  and the testkit's containers and fails the scenario. The fake model gateway and the scripted harness fail on any
  unscripted call. The testkit injects a fixed clock and seed through documented config.

## Test quality checks

### ASSERT

- **Reads:** the assertions of every `then` block, with an AST data-flow check on their arguments.
- **Fails:** a `then` block without an assertion on a value that came from `sut` or `fakes`.
- **Libraries and contracts:** in their tests, a value from a call of the package's own exports, or of its subpath
  exports, counts too (ADR 0039, ADR 0042).

### NOSKIP

- **Reads:** the system tests, with an AST search. NOSKIP, ASSERT, UI-QUERY and BOUNDARY-ENV read one scan of the
  system tests.
- **Fails:** `.skip`, `.only`, `.todo` or `.fails`. PASS fails a skipped scenario too, but only after the run, and a
  `.fails` test passes in JUnit.

### SURFACE

- **Reads:** with ts-morph, the export statements of each entry point (`exports` of `package.json`) of a published
  package, and the "Public surface" of its `AGENTS.md`.
- **Fails:** an exported value that is not named in backticks in the "Public surface"; types need no entry. An entry
  point that uses `export *` (ADR 0135).

### TEMPLATE

- **Reads:** every Astro template (`src/**/*.astro` of a module, library or adapter), with `@astrojs/compiler-rs`,
  Astro's own parser, and the unit's `architecture.json`.
- **Allowed in the frontmatter:** imports of components, type imports, the page's data (`Astro.locals.page`,
  `Astro.props`) and its status. A type import stays in the unit and reaches no layer above the template's (ADR 0132).
- **Allowed in the markup:** an expression that reads a property, maps a list with an arrow that returns markup, or
  switches with `?:` or `&&` on a value.
- **Allowed `<script>`:** no attributes, and only an import of an island's mount script, a `.tsx` file in
  `src/islands/` of the unit. Astro bundles it into an external file, and the island's logic stays where MUTATION
  counts it (ADR 0152).
- **Fails:** anything else. REACH and MUTATION do not count templates, since they hold no logic.

### CONTRAST

- **Reads:** `packages/ui/assets/tokens.css`, and computes the W3C's relative luminance of each `#rrggbb` value.
- **Fails:** a text token (`--osf-text*`, `--osf-signal`, `--osf-state-*`) with less than 4.5:1 contrast (WCAG 2.2 AA)
  on a background token (`--osf-bg-*`), or `--osf-on-<name>` with less on `--osf-<name>`, in the dark or the light
  theme (ADR 0133).

### TOKENS

- **Reads:** every line of the sources of `packages/ui/src/` and `modules/console/src/`.
- **Fails:** a colour value (a hex colour or a colour function), or a font declared without `var(--osf-font-*)`. A page
  names the tokens (ADR 0133). The brand files are pictures and keep their colours.

### UI-QUERY

- **Reads:** the calls in system tests, with an AST search.
- **Allowed:** finding elements by role, label or text, and reading the page reader's facts of the document.
- **Fails:** a CSS selector, XPath or test ID (`locator`, `querySelector`, `$`, `getByTestId`, `waitForSelector`); a
  script in the page (`evaluate`); a wait for time to pass (`waitForTimeout`); a size other than a named viewport
  (`setViewportSize`) (ADR 0131).

### REACH

- **Reads:** the V8 coverage that the testkit records in every Node process of the module (`reports/coverage/`).
  `osf check REACH` maps it to source lines with v8-to-istanbul, through source maps for built files, and compares it
  with the lines added since `OSF_BASE` (ADR 0019).
- **Fails:** a line added to a module's `src/` or `bin/` (`.ts`, `.tsx`, `.js`, `.mjs`) that no system test reaches, or
  a source file that no system test loads. Files of types only are exempt.
- **Islands:** a module's `.tsx` that runs only in a browser is reached by no process: an island belongs in
  `packages/ui` (ADR 0152).
- **Left to MUTATION:** a library's tests call it in their own process, which records no coverage, so MUTATION covers
  its lines (ADR 0039). Code that ran only after a tool such as Vitest transformed it, like a testkit fake inside a
  test, has no line map and is left to MUTATION too.

### MUTATION

- **Limits:** each module's and each library's `AGENTS.md` sets two limits under "Quality limits": a score for the
  mutants in the lines a change adds and a score for all mutants. Every module and every library has a `mutation`
  script and both limits (ADR 0037, ADR 0039).
- **How Stryker runs:** `osf mutation` runs Stryker, which mutates `.ts` and `.tsx` files, so the lines of an island
  count (ADR 0152). Stryker builds the mutated module once and reruns its system tests per mutant with
  `__STRYKER_ACTIVE_MUTANT__`. The testkit passes it to the module's process, and `sut.browser` sets it in every page
  before its first script as `globalThis.__stryker__.activeMutant`, so a mutant of an island is active in Chromium (ADR
  0152).
- **Which tests a mutant reruns:** for a module or an adapter, the first run records which mutants each scenario's
  module processes ran (`OSF_TESTKIT_MUTANTS`), and each mutant reruns only those scenarios; a mutant that no scenario
  ran is NoCoverage. The first run leaves out every journey scenario (`@kind=journey`, ADR 0131), so no mutant reruns a
  journey: page scenarios notice the server's code. A library reruns all its tests per mutant (ADR 0061).
- **Fails:** `osf check MUTATION` scores the reports in `reports/mutation/`, the reports of all shards of a unit
  together, and names the file and line of each missed mutant.
- **On pull requests:** `mutation.yml` does both for the changed lines on every pull request that is no draft, after
  the job `verify` of `verify.yml` passed (ADR 0092). Each mutant reruns the unit's system tests, so it gives each
  changed unit one runner per about 100 added lines (at most 10), or per the `osf.mutationLinesPerShard` lines its
  `package.json` sets when each of its scenarios starts a slow service, as forge-forgejo's Forgejo container does.
  Each runner mutates all the lines and tests every n-th mutant (`osf mutation --shard i/n`). It reuses its report of
  an earlier push when turbo's hash of the unit and its added lines did not change; otherwise Stryker reuses the result
  of each mutant whose code and tests did not change, while the unit's other inputs and the builds it depends on stayed
  the same (`osf mutation-plan --keys`, `osf mutation-merge`, ADR 0066, ADR 0091). Its `mutation` job scores all
  reports.
- **Nightly:** the nightly run mutates every line of every unit, one runner per shard of about 600 lines
  (`osf mutation-plan --all`, or the `osf.mutationAllLinesPerShard` lines a `package.json` sets), and replays the
  report of a shard whose turbo hash did not change. Sunday's run mutates every shard again, and a run with a failed
  shard retries it once in a new run (ADR 0084). It runs `osf check MUTATION --total` and keeps one open ticket while a
  unit is below its total limit.
- **Not part of `make verify`,** because it takes minutes.
- **Fix:** `skills/fix-mutation-and-duplication`.

### BUDGET

- **Reads:** the line `System tests: N seconds of wall time` in each unit's `AGENTS.md`, and the wall time in
  `reports/run-time/`. `testkit timed` measures the wall time of the test command, from its start to its end, and
  `osf collect-reports` copies it to `reports/run-time/` (ADR 0155).
- **Fails:** a unit whose system tests take longer than the budget; a unit with JUnit results and no wall time; a
  package with system tests whose `test:system` does not run them with `testkit timed`; a budget section of more than
  three lines (the budget line and what dominates the time).
- **Measured alone:** `make verify` runs one test task at a time, and CI gives each suite its own runner or, for the
  small suites, one of two shared runners that run one test task at a time too, so suites do not slow each other.
- **The size of a budget:** the measured wall time times 2, rounded up to the next 10 s, at least 45 s: the runners'
  speed spreads by a factor of 1.8.
- **Fix:** make the suite faster first (root `AGENTS.md`, Hard rules). Raise the budget only with the measured reason in
  the commit message.

## Contract and docs checks

### CONTRACT

- **Reads:** the schemas and APIs of `contracts/`, compared with the last `contracts-v*` release tag, or with
  `OSF_BASE` when there is none; `oasdiff` for OpenAPI and a JSON Schema compatibility check for schemas. The shared
  fixtures validate against every schema; that part needs no base.
- **Fails:** a breaking change to an API or schema without a major version; a fixture that does not agree with its
  schema.

### DOCS-GEN

- **How:** runs `make docs` and fails on any diff.
- **Fix:** run `make docs` and commit what it writes.

### DOCS-AFFECTED

- **Reads:** the files changed since `OSF_BASE`, the `covers:` paths in the front matter of every hand-written doc, and
  the pull request description from the file that `OSF_PR_BODY` names.
- **Fails:** a doc whose `covers:` paths changed and that is neither changed itself nor listed as
  `docs-reviewed: <path>` in the description.
- **Not counted:** the files of a release: `CHANGELOG.md`, the release-please manifest, a `package.json` that only
  changes `version`, a JSON extra file of `release-please-config.json` that only changes the value at its `jsonpath`,
  and a file of the profile or the chart that is exactly what `osf profile-pins` writes from the base commit's file.
- **Fix:** `make docs-affected` lists the docs; see `skills/keep-docs-evergreen`.

### DOCS-LINKS

- **How:** lychee in offline mode, with fragments.
- **Fails:** an internal link or anchor that does not resolve.

### ADR

- **Reads:** the front matter and sections of every ADR in `docs/decisions/`, and the manifests compared with
  `OSF_BASE`.
- **Fails, for each ADR:** a status that is not `proposed`, `accepted`, `rejected`, `deprecated` or
  `superseded by NNNN`; no date; a number that another ADR uses; a title that does not start with `# NNNN. `; no
  `## Decision`; an empty Prior art section, or one with the template's text; an empty `## Why a package`, or one with
  the template's text (ADR 0159); a `topic:` that is missing or not one of `process`, `stack`, `packages`, `testing`,
  `ports`, `tools`, `factory`, `runs`, `console`, `install` and `design-note` (ADR 0161).
- **Index:** `make docs` writes the index in `docs/decisions/README.md` from the topics and status lines; DOCS-GEN
  keeps it current.
- **Fails, for each unit:** a module, port or adapter that no accepted ADR with a filled Prior art section names.
- **Fails, compared with the base:** a new dependency in a `package.json` or `pyproject.toml` that no accepted ADR
  with a filled Prior art section names; a package under `modules/`, `packages/` or `adapters/` that is published now
  and was not at the base, without an accepted ADR that names its folder or npm name and has a filled
  `## Why a package` section (ADR 0159).
- **Not checked:** a new service. The rule to write an ADR for one (`skills/write-adr`) holds, but no check finds it.
- **Fix:** `skills/write-adr`.

### RUNS

- **Reads:** every line of `runs/*.jsonl`, validated with `@opensoftware/contracts`.
- **Fails:** a line that is not a run whose root span `invoke_agent` matches the `run-record` contract, or that holds
  prompt or tool content (ADR 0027).
- **Passes:** a change that adds no file to `runs/`. No change has to add or change one (ADR 0153), and RUNS needs no
  base.
- **Fix:** export the record again with `make run-record` (without `--include-content`), or remove the line.

## End-to-end checks

### SMOKE

- **How:** `make smoke` runs the scenarios in `e2e/features/` against the Compose profile with fakes. In CI they run as
  the suite `e2e` of `make verify` on every pull request and every merge to `main` (ADR 0076).

### SMOKE-PAID

- **How:** `make smoke-paid` runs `e2e/paid/`: a real-model run of opencode, and of claude-code on a developer's
  subscription, completes a small task. opencode runs weekly in `weekly-paid.yml` and before a release; never on pull
  requests (ADR 0077). Run it only when asked: it is a paid call.
