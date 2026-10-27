# TODO

The work plan from an empty repository to the factory described in [`docs/vision/`](docs/vision/). One item per
module. Each item holds what an agent needs to start: purpose, surface, formats, what to adopt, which vision
scenarios it realizes, and the first scenarios to write. Work an item with `AGENTS.md` and the skills in
`skills/`.

How to use an item:
1. Read the item, the linked docs and the vision scenarios it lists.
2. `skills/new-module` (or extend the existing package), then write the listed scenarios with
   `skills/write-scenario`, each with `@realizes=` for the vision scenarios it covers.
3. Implement them one by one: `skills/write-system-test`, then `skills/implement-scenario`.
4. The item is done when its "Done when" list is true and `make verify` passes. Tick it here in the same PR.

Order: T-00 → T-01 → T-02 first (phase 0). Then waves 1 to 4 as listed. Items in the same wave can run in
parallel, one agent per item.

Shared context for every item: [principles](docs/principles.md) ·
[components](docs/architecture/components.md) · [internals](docs/architecture/internals.md) ·
[stack](docs/architecture/stack.md) · [testing strategy](docs/quality/testing-strategy.md) ·
[checks](docs/quality/checks.md) · [glossary](docs/reference/glossary.md) ·
[scenario prefixes](docs/reference/scenario-prefixes.md).

Seeds marked "child-apps-company" are working examples in the private repository `sesigl/child-apps-company`;
read them for ideas, do not copy their company-specific rules.

---

## Phase 0 · Foundation

### [x] T-00 · Repository tooling and checks

- **Path / prefix:** `Makefile`, `package.json`, `tools/checks/`, `.github/workflows/` · `SCN-REPO`
- **Language:** TypeScript (ADR 0009).
- **Purpose:** every later item depends on `make check`, `make verify` and the checks being real.
- **Build:**
  - pnpm workspace and Turborepo at the root (`pnpm-workspace.yaml`, `turbo.json` with `build`, `lint`,
    `typecheck`, `check`, `test:system`, `docs`); Node 24 (ADR 0005, 0009, 0010). `make` targets only call
    pnpm and turbo; affected runs use `--filter=...[origin/main]`. No Nx, moon or Bazel.
  - `make check`, `verify`, `smoke`, `smoke-paid`, `next-id`, `new-module`, `docs`, `docs-affected`,
    `test-scenario ID=…`, `agents-sync` (links `skills/` into `.claude/skills/` and other harness folders).
  - Checks from `docs/quality/checks.md` as scripts in `tools/checks/`, each printing its ID and file:line:
    SPEC, TRACE, STEPS, PASS, BOUNDARY-STATIC, BOUNDARY-ENV, ISOLATION, NOSKIP, ASSERT, FLAKE, BUDGET,
    CONTRACT, DOCS-GEN, DOCS-AFFECTED, DOCS-LINKS, ADR. BOUNDARY-RUNTIME, NOREAL and REACH come with T-02.
    MUTATION and SMOKE-PAID as nightly workflows.
  - ISOLATION allows a module to depend only on `@opensoftware/contracts`, `@opensoftware/testkit` (tests only), the
    libraries in `packages/` (ADR 0037) and external packages.
  - GitHub Actions: `verify` on every PR (required check), nightly mutation, release-please.
  - Biome, `tsc --strict`, dependency-cruiser, lychee configs.
- **Adopt:** pnpm, Turborepo, `@cucumber/gherkin` parser, ts-morph, JUnit XML reporters, oasdiff, lychee,
  release-please.
- **Seed:** child-apps-company `make specs-check`, `make traceability-check`, `scripts/lib/gherkin.ts`,
  `scripts/metrics/timed.py` (budgets).
- **First scenarios** (`tools/features/checks.feature`): SPEC rejects a duplicate ID; TRACE rejects an
  implemented scenario without a test; STEPS rejects a label that differs from the step; PASS rejects a skipped
  test; BOUNDARY-STATIC rejects an import from `src/`; DOCS-AFFECTED lists a doc whose `covers:` path changed.
  (SPECGUARD, the approval check for implemented scenarios, was removed by ADR 0013.)
- **Done when:** `make verify` passes on `modules/_template` (renamed to a real example module or kept as a
  fixture) with every listed check active, and CI requires `verify`.

### [x] T-01 · contracts

- **Tier / wave / language:** core · 0 · TypeSpec, generated TypeScript (the only client; ADR 0012)
- **Path / prefix:** `contracts/` · `SCN-CTR`
- **Purpose:** the five shared formats and every module API, as the single source of generated types.
- **Build:** TypeSpec sources for: factory definition (JSON Schema), work item event (CloudEvents data schema),
  run record attributes (OTel resource and span attributes on top of GenAI conventions), evidence bundle manifest,
  score (Langfuse-compatible). AsyncAPI for events (`work.received@v1`, `run.completed@v1`, `gate.requested@v1`,
  `gate.decided@v1`, `score.recorded@v1`, `pr.opened@v1`). Generated package `@opensoftware/contracts` (npm), the only client;
  clients for other languages are not built (ADR 0012). Valid and invalid fixtures per format.
- **Adopt:** TypeSpec, CloudEvents, OpenTelemetry GenAI semantic conventions (pin a version), Agent Trace,
  Langfuse score model (ADR 0006).
- **Realizes:** CODE-001 (schema side), DATA-001 (record shape), RUNTIME-008 (attribution fields).
- **First scenarios:** a valid factory definition validates; a definition with an unknown agent field is
  rejected with its path; a breaking change to a schema fails CONTRACT; generated TypeScript types round-trip every
  fixture.
- **From T-00:** CONTRACT compares with the pull request base and covers only removed properties, newly
  required fields, type changes, removed enum values and closed objects. Point it at the last `contracts-v*` release
  tag, replace the home-made JSON Schema diff with a full compatibility checker if one fits, and run oasdiff on the
  real OpenAPI files. Keep the fixture layout `contracts/<format>/fixtures/{valid,invalid}/` or change the check.
- **Done when:** `@opensoftware/contracts` publishes from CI; CONTRACT check runs against the last release.

### [x] T-02 · testkit

- **Tier / wave / language:** core · 0 · TypeScript (`@opensoftware/testkit`), one testkit for every module (ADR 0009)
- **Path / prefix:** `packages/testkit/` · `SCN-TK`
- **Purpose:** the only way system tests touch a module; also the conformance kit for community adapters.
- **Build:**
  - `scenario(id, fn)` with `given`, `when`, `then`; JUnit output carries the scenario ID. A module written
    in another language (only by ADR) is tested with this testkit through its CLI or API.
  - `sut`: starts the module's built artifact (CLI, server or container) in its own process with a private data
    folder; exposes only `cli`, `http` (generated client), `mcp`, `events`, `files` ($INPUT, $OUTPUT), `readme`.
    Refuses undocumented environment variables (BOUNDARY-ENV).
  - Fakes: scripted model gateway (OpenAI-compatible; fails on unscripted calls), scripted ACP harness (performs
    scripted file edits), fake Slack, Forgejo container helper, Testcontainers for Postgres, NATS, Temporal,
    SeaweedFS; fixed clock and seed passed through documented config.
  - Test network that reaches only fakes (NOREAL); process coverage collection (REACH).
  - `conformance(port, adapter)` runner for `ports/<port>/features`.
- **Adopt:** Vitest, Testcontainers, Forgejo image.
- **First scenarios:** a test that imports from `src/` fails BOUNDARY-STATIC; an unscripted model call fails the
  test with the request shown; `sut.files` refuses a path outside $INPUT/$OUTPUT; a scenario's JUnit result
  carries its ID; the scripted harness applies its edit and reports completion over ACP.
- **From T-00:** `packages/testkit` holds a bootstrap subset (`scenario`, step labels, `sut.cli`, `sut.files`,
  `sut.git`, `fakes.fixture`, `fakes.fromRepository`); extend it, do not replace it. BOUNDARY-ENV reads the
  documented variables from README backticks; generate them from the module's config schema instead. The
  `@conformance` part of TRACE is untested until the first port; add its scenario with the `conformance` runner.
- **Release:** add `packages/testkit` back to `release-please-config.json` and give it a publish workflow like
  `publish-contracts.yml` when it is ready for users; until then it is not released.
- **Done when:** `modules/_template`'s quick-start test runs green through the testkit.
- **Slices** (a few large pull requests; "a test that imports from `src/` fails BOUNDARY-STATIC" is already
  `SCN-REPO-006`):
  - [x] `testkit run` writes a JUnit report whose test case carries the scenario ID (`SCN-TK-001`); the
    testkit's own features, system tests, README and AGENTS.md.
  - [x] `sut.files` refuses a path outside `$INPUT`/`$OUTPUT` (`SCN-TK-002`); `sut.cli` runs in `$INPUT`.
  - [x] Declared module layers: `architecture.json` and the ARCH check (ADR 0014, `SCN-REPO-026` to `-028`);
    the testkit split into layers. ISOLATION and BOUNDARY-STATIC now see every import (`SCN-REPO-029`).
  - [x] Drive a module: `sut.readme`, `sut.files.clear`, a fixed clock and seed (`SCN-TK-003` to `-005`); the
    scripted model gateway (`SCN-TK-006`, `-007`); `modules/_template` is a working module whose quick start
    `SCN-TEMPLATE-001` runs green through the testkit (ADR 0015). BOUNDARY-ENV keeps reading the README:
    `make docs` generates its Configuration table from `src/config.schema.json`, and DOCS-GEN keeps them equal.
  - [x] Servers and services: `sut.http` (with an openapi-fetch client), `sut.mcp`, `sut.events`
    (`SCN-TK-014` to `-018`, ADR 0017); Postgres, NATS, Temporal, SeaweedFS, the Forgejo helper, fake Slack
    (`SCN-TK-008` to `-013`, ADR 0016).
  - [x] Harness and ports: the scripted ACP harness applies its edit and reports completion (`SCN-TK-019`,
    `-020`, ADR 0018); `testkit conformance <port features>` is the conformance runner (`SCN-TK-021`, `-022`);
    TRACE's `@conformance` rule has its scenario (`SCN-REPO-030`).
  - [x] Runtime guards and release: BOUNDARY-RUNTIME (a private `OSF_DATA` folder, only a built `bin`;
    `SCN-TK-023`, `-024`), NOREAL (a network guard in every module process; `SCN-TK-025`); a
    `release-please-config.json` entry, a `dist/` build and `publish-testkit.yml`.
  - [x] REACH: the testkit records coverage in every module process (`SCN-TK-026`); `osf check REACH` fails on
    added lines and files no system test reaches (`SCN-REPO-031` to `-034`, ADR 0019).

---

## Wave 1 · Record

### [x] T-03 · factory-spec

- **Tier / language / path / prefix:** core · TS · `modules/factory-spec/` · `SCN-FSPEC`
- **Alone:** one agent configuration rendered for every harness; lint and diff in CI; plan and apply a factory.
- **Public surface:** CLI `factory lint | diff | render | plan | apply`; library export of the resolved
  definition (JSON matching `contracts/`).
- **Reads → writes:** `factory.yaml`, prompts, skills, policies, `factory.lock` → `AGENTS.md`, `CLAUDE.md`,
  `.mcp.json`, Codex `config.toml`, gh-aw workflow files, Kubernetes manifests (kagent Agent, ModelConfig,
  MCPServer; agent-sandbox templates), a plan file, applied state.
- **Adopt:** JSON Schema from T-01; MCP Registry and ACP Registry lookups at plan time (pin, never live).
- **Realizes:** CODE-001, CODE-003, CODE-004 (plan diff of two versions), CODE-005 (rollback = apply older
  version), OPEN-001, OPEN-002 (declaration side), LOOP-011, LOOP-013, RUNTIME-007 (declaration side),
  AUTO-002 (declaration side), E2E-005.
- **First scenarios:** quick start renders `AGENTS.md` and `.mcp.json` from a sample `factory.yaml`; lint
  reports a reference to an undeclared secret with file and line; render for Codex writes `config.toml` with the
  declared MCP servers; plan shows a model change as one diff line; plan reports a manually changed webhook as
  drift (against a fake forge); the lock file pins an MCP server to an exact registry version.
- **Not in scope:** running agents (foreman), approvals (gatekeeper).
- **From T-00:** the first module with a CLI: generate the README `Commands` section from its CLI help in
  `make docs` (DOCS-GEN generates only Scenarios and Configuration today).
- **Done when:** this repository's own `AGENTS.md` skill links are produced by `factory render`.
- **Slices:**
  - [x] Lint, render, plan, apply, diff and resolve (ADR 0020, `SCN-FSPEC-001` to `-032`): render for Claude Code,
    Codex and OpenCode with skill links; MCP Registry pins in `factory.lock` (testkit `fakes.http`, ADR 0021);
    plan against the applied state with file drift; the README Commands section generated from `factory --help`
    (`SCN-REPO-035`). This repository's `factory.yaml` produces its skill links through `make agents-sync`.
  - [x] Forge webhooks for automations, applied and checked for drift against the Forgejo fake; `render --k8s`
    (kagent Agent, ModelConfig, MCPServer, RemoteMCPServer); gh-aw workflow files; a release of the module (ADR 0022,
    `SCN-FSPEC-033` to `-047`). Moved: agent-sandbox templates to T-13, GitHub webhooks to T-15, ACP Registry pins
    to T-12.

### [x] T-04 · runlog

- **Tier / language / path / prefix:** core · TypeScript · `modules/runlog/` · `SCN-RUN`
- **Alone:** every Claude Code, Codex or OpenCode session of a team in one trace store, with cost and PR links.
- **Public surface:** CLI `runlog export | watch | attach`; an OTel Collector config pack per harness
  (`collector/`); OTLP output.
- **Reads → writes:** harness session files (`~/.claude/projects`, `~/.codex/sessions`, OpenCode storage),
  native harness OTel → run records (OTLP) with `osf.run.id`, `osf.work_item.id`, `osf.factory.version`, `osf.stage`, cost,
  model, harness, links.
- **Adopt:** OTel JavaScript SDK and Collector (transform processor for per-harness span mapping), Agent Trace for
  line attribution. Check each harness's native OTel first (see internals) and only read files for what is
  missing.
- **Seed:** child-apps-company `scripts/observability/hermes_transcript.py`.
- **Realizes:** DATA-001, DATA-002, DATA-003, RUNTIME-008, DATA-006 (export only to configured sinks).
- **First scenarios:** quick start exports a sample Claude Code session to a JSONL run record; a Codex session
  maps to the same record shape; `OTEL_RESOURCE_ATTRIBUTES` from the launch end up on every span; prompt content
  is excluded unless `--include-content` is set; export to a fake OTLP endpoint retries after an outage.
- **Done when:** this repository's own agent sessions are exported on every PR (phase 1 dogfood).
- **Slices:**
  - [x] `runlog export` for Claude Code and Codex session files (ADR 0023, `SCN-RUN-001` to `-021`): root span
    `invoke_agent` with session token usage and pull request links, `chat` and `execute_tool` spans, attribution from
    `OTEL_RESOURCE_ATTRIBUTES` and Git checked against the `run-record` contract, content only with
    `--include-content`, `runs.jsonl` or an OTLP/HTTP endpoint with retries. testkit `fakes.http` gained `times`
    and `received()`.
  - [x] `runlog attach` into the launcher's `TRACEPARENT` trace with `--outcome`, `runlog watch` of session folders,
    OpenCode sessions from `opencode export`, issue links in `osf.issue.urls`, Agent Trace records with
    `--agent-trace`, and the npm release (ADR 0024, `SCN-RUN-022` to `-043`; `SCN-RUN-019` replaced by `-025`).
  - [x] The Collector config pack per harness (`collector/`, `runlog collector <harness>`), proven against the real
    Collector Contrib in the system tests through the new testkit `fakes.collector` (ADR 0025, `SCN-RUN-044` to `-054`,
    `SCN-TK-031`).
  - [x] The dogfood export of this repository's sessions on every PR: `runlog export --latest --per-run`,
    `make run-record` into `runs/`, and the check RUNS (ADR 0027, `SCN-RUN-055` to `-059`, `SCN-REPO-038` to `-042`).

### [x] T-05 · proof

- **Tier / language / path / prefix:** core · TS · `modules/proof/` · `SCN-PROOF`
- **Alone:** any PR shows screenshots, video and test results for each claimed behavior.
- **Public surface:** CLI `proof capture | bundle | attach | verify`; GitHub Action; evidence bundle format
  (T-01).
- **Reads → writes:** Playwright traces and videos, JUnit XML, scenario IDs → evidence bundle in S3-compatible
  storage or a folder, PR comment, check run (through the forge port).
- **Adopt:** Playwright and Playwright MCP for computer use.
- **Seed:** child-apps-company `qa-scenarios` and `human-feedback-batch` skills.
- **Realizes:** LOOP-008, part of LOOP-009 (check run), principle P10.
- **First scenarios:** quick start bundles a Playwright trace into a folder with a manifest; attach posts a
  comment and a check "proof" on a Forgejo PR; verify fails when a listed scenario has no evidence; a bundle
  records the scenario IDs it proves; attach is idempotent on re-run.
- **Done when:** every PR in this repository carries a proof check from the released tool.
- **Slices:**
  - [x] `proof bundle` from Playwright JSON and JUnit XML reports, `proof verify`, `proof attach` with one marker
    comment and the commit status `proof` on GitHub and Forgejo, upload to an S3-compatible store, and the npm release
    (ADR 0028, `SCN-PROOF-001` to `-034`).
  - [x] `proof capture` (screenshots, video and a trace of a running product with Playwright, and the files of a
    Playwright MCP session), the GitHub Action `modules/proof/action.yml`, `sut.action` in the testkit, and the
    dogfood: a proof check on every pull request of this repository from the build of the checkout (ADR 0029,
    `SCN-PROOF-035` to `-046`, `SCN-TK-033` to `-040`).
  - [x] The dogfood from the released tool: the step `proof` in `.github/workflows/verify.yml` runs
    `@opensoftware/proof` from npm, at the version of `modules/proof/package.json`.

---

## Wave 2 · Measure

### [x] T-06 · spec-trace

- **Tier / language / path / prefix:** optional (mandatory here) · TS · `modules/spec-trace/` · `SCN-TRACE`
- **Alone:** requirements traceability for any repository with feature files.
- **Public surface:** CLI `spec-trace check | report | next-id`; GitHub Action; JSON report.
- **Reads → writes:** feature files, test ASTs, JUnit results, evidence bundles, base/head diff → report,
  required check.
- **Seed:** T-00's `tools/checks/` scripts; replace them in phase 2.
- **Realizes:** checks SPEC, TRACE, STEPS, PASS as a product; principle P10 with proof.
- **First scenarios:** quick start reports scenario coverage of a sample repository; same cases as T-00's
  checks, now from the released CLI; configurable ID pattern and prefixes; outline examples counted once per
  test.
- **Done when:** this repository's CI uses spec-trace instead of the bootstrap scripts.
- **Slices:**
  - [x] `spec-trace check` (SPEC, TRACE, STEPS, PASS with the cases and messages of `tools/checks/`), `spec-trace
    report` (JSON, with proof bundles), `spec-trace next-id`, the settings file `spec-trace.json` (ID pattern,
    prefixes, folders, test function, conformance), and the npm release (ADR 0030, `SCN-TRACE-001` to `-049`).
  - [x] The GitHub Action `modules/spec-trace/action.yml`, `report --base` (the scenarios added, removed or changed
    since a base commit) and `report --summary`, `sut.action`'s job summary in the testkit, and the dogfood: a root
    `spec-trace.json`, `make check`, `make verify` and CI run spec-trace instead of `tools/checks/` for SPEC, TRACE,
    STEPS and PASS (ADR 0031, `SCN-TRACE-050` to `-064`, `SCN-TK-041`, `SCN-REPO-043`).
  - [x] The dogfood from the released tool: the step `spec-trace` in `.github/workflows/verify.yml` runs
    `@opensoftware/spec-trace` from npm, at the version of `modules/spec-trace/package.json`.

### [x] T-07 · scorekit

- **Tier / language / path / prefix:** optional · TypeScript · `modules/scorekit/` · `SCN-SCORE`
- **Alone:** grade a team's agent sessions on concrete failure modes, with judges calibrated against human labels.
- **Public surface:** CLI `scorekit score | calibrate | report`; scorer definition format (Markdown judge prompt
  + YAML: sample rate, pass criterion, judge model); export as Langfuse evaluators.
- **Reads → writes:** run records → scores (T-01), calibration report (agreement with labeled runs).
- **Adopt:** Langfuse evaluators as runtime when present (Langfuse TypeScript SDK); the inference port for judge
  calls.
- **Realizes:** SCORE-001…004, CODE-006.
- **First scenarios:** quick start scores 10 sample runs with the scorer "redundant-tests" through the scripted
  model gateway; sampling at 20 percent with a fixed seed scores the expected runs; calibrate reports agreement
  with 20 labeled runs; scorer cost is recorded; a scorer pack ships: redundant-tests, change-requested,
  scope-creep, skipped-checks, needless-human-question.
- **Done when:** the scorer pack, calibration and Langfuse export are released. Scoring our own sessions nightly
  with a paid judge model moved to T-21.
- **Slices:**
  - [x] `scorekit score` (hash-based sampling with a seed, the judge cost from the token usage and the scorer's price,
    reruns skip scored runs), `scorekit calibrate` (agreement, Cohen's kappa and disagreements against `ANNOTATION`
    labels), `scorekit report` (JSON and Markdown, pass rate per day), `scorekit push` to Langfuse's score API, the
    scorer file format, the pack of five scorers, the testkit's token usage and request headers, and the npm release
    (ADR 0032, `SCN-SCORE-001` to `-032`, `SCN-TK-042`, `SCN-TK-043`).
  - [x] `scorekit export`: the scorers as Langfuse LLM-as-a-judge evaluators with their evaluation rules, written to
    `evaluators.json` or, with `--push`, created or updated through Langfuse's public API v2 (ADR 0033,
    `SCN-SCORE-033` to `-045`).

### [x] T-08 · ledger

- **Tier / language / path / prefix:** optional · SQL + TypeScript CLI · `modules/ledger/` · `SCN-LEDGER`
- **Alone:** cost per PR and flow metrics for any team using agents.
- **Public surface:** CLI `ledger ingest | report`; SQL views for DuckDB and PostgreSQL; Grafana dashboard JSON.
- **Reads → writes:** LiteLLM spend logs, run records, forge PR events, work item events → views, dashboards.
- **Adopt:** DuckDB and PostgreSQL (Node drivers), Grafana.
- **Seed:** child-apps-company metrics pipeline (ADR 0029), `company-metrics` dashboard.
- **Realizes:** METRIC-001…008, OUTCOME-001, OUTCOME-002, ROLE-002 (measurement side).
- **First scenarios:** quick start computes cost per PR from sample files with DuckDB; cycle-time segments from
  PR events; spend by source, user, agent and model; top 20 PRs by attributed cost; revert rate next to
  throughput; unattributed spend is reported as its own line.
- **Done when:** our own cost per PR is visible on a dashboard.
- **Slices:**
  - [x] `ledger ingest` (LiteLLM spend log rows, runlog's OTLP/JSON runs and the CloudEvents `work.received`,
    `pr.opened`, `pr.reviewed` and `pr.closed`, each checked against its contract) into a DuckDB file, the views
    `run_cost`, `spend_attributed`, `pr_runs`, `pr_flow` and `pr_cost`, `ledger report` (cost per pull request split into
    inference, compute and platform, the gap to a target, spend by source, user, agent and model with the unattributed
    rest, the 20 most expensive pull requests, throughput, cycle time by segment, human interactions, runs by agent
    type and the revert rate, as JSON and Markdown), the new events `pr.reviewed@v1` and `pr.closed@v1`, and the npm
    release (ADR 0034, `SCN-LEDGER-001` to `-029`).
  - [x] The same tables and views for PostgreSQL (`--db` or `LEDGER_DB` takes a `postgres://` URL, the report is the
    same on both engines, the password is never printed), `ledger query`, and `ledger dashboard`: a Grafana dashboard
    JSON over the views with a PostgreSQL data source input (ADR 0035, `SCN-LEDGER-030` to `-038`).
  - [x] `ledger import`: the pull requests, reviews and comments of a GitHub or Forgejo repository as `pr.opened@v1`,
    `pr.reviewed@v1` and `pr.closed@v1` events in a JSON Lines file for `ledger ingest`, for teams without forge
    adapters (ADR 0036, `SCN-LEDGER-039` to `-050`).
  - [x] The dogfood: `--prices` (token usage at LiteLLM's list prices), `report --html` (one static dashboard page), a
    run's cost split only over pull requests in the ledger, and the nightly workflow `ledger-dashboard.yml` that
    publishes this repository's page on Vercel, linked from the README (ADR 0044, `SCN-LEDGER-051` to `-064`).

---

## Wave 3 · Improve

### [x] T-09 · taskcapture

- **Tier / language / path / prefix:** optional · TypeScript · `modules/taskcapture/` · `SCN-TASK`
- **Alone:** a private benchmark from a team's merged PRs, with a correctness-versus-cost report.
- **Public surface:** CLI `taskcapture capture | run | report | route`.
- **Reads → writes:** merged PR (base commit, diff, tests), run record → Harbor task; Harbor results →
  report (Pareto chart data), LiteLLM routing config.
- **Adopt:** Harbor (task format, `harbor` CLI as a separate process, Docker and cloud environments). Use
  Harbor's built-in agents for Claude Code, Codex and OpenHands. Only if a run must go through our harness port,
  add the optional Python Harbor agent plugin in `adapters/harbor/` (ADR 0009 allows it), tested through the
  `harbor` CLI.
- **Realizes:** BENCH-001…006, CODE-004 (benchmarking a factory version).
- **First scenarios:** quick start captures a merged Forgejo PR as a Harbor task whose hidden tests come from the
  PR; replay uses fakes for chat and forge (no side effects); a matrix of 2 scripted models × 2 configs yields
  correctness and cost per cell; incomplete scoring is flagged; `route` writes a LiteLLM rule for the chosen
  model; a prompt-injection task is included in every suite.
- **Done when:** a suite from this repository's own PRs runs nightly.
- **Slices:**
  - [x] `taskcapture capture` (a merged GitHub or Forgejo pull request as a Harbor task: the repository before the
    merge, the pull request's tests hidden in `tests/`, the rest of its change as the oracle's solution), the
    `prompt-injection` task in every suite, `taskcapture report` (correctness and average cost per configuration and
    model from Harbor's trial results, incomplete scoring with the `harbor job resume` command, the best, lowest-cost
    and most efficient cell, the Pareto front, Markdown and a Vega-Lite chart), `taskcapture route` (a LiteLLM tag
    routing config), `fakes.forge` merging a pull request in the testkit, and the npm release (ADR 0043,
    `SCN-TASK-001` to `-041`, `SCN-TK-049`).
  - [x] `taskcapture run`: the `harbor` CLI as a separate process, one job per configuration with every model, then
    the report; the agent of a captured task has no network except `--allow-host` (no side effects in a replay);
    `capture --run` captures the pull request of a run record (ADR 0045, `SCN-TASK-042` to `-058`).
  - [x] The dogfood: `taskcapture-suite.yml` captures some of this repository's pull requests and runs them nightly
    with Harbor's `oracle` and `nop` agents, so every task is shown solvable and its tests fail without the change.

### [x] T-10 · observer

- **Tier / language / path / prefix:** optional · TypeScript · `modules/observer/` · `SCN-OBS`
- **Alone:** point it at session logs and agent instructions; it proposes reviewed fixes and later reports
  whether the failure rate fell.
- **Public surface:** CLI `observer analyze | propose | check`.
- **Reads → writes:** scores, run records, factory definition or `AGENTS.md` → PR with Problem, Solution,
  Evidence (run links); before/after report.
- **Adopt:** backpass for instruction-file edits if it fits after evaluation (record in the ADR); inference port.
- **Seed:** child-apps-company `agent-cleaner` agent and `efficiency-ticket` skill.
- **Realizes:** IMPROVE-001…005, principle P15, E2E-003.
- **First scenarios:** quick start groups 30 failed scores into one problem with its count; propose opens a PR
  on Forgejo with the three sections; it never pushes to the default branch; check compares the failure rate
  before and after a merged change with a minimum sample size; a proposal touching a protected path is marked
  "needs human".
- **Done when:** analyze, propose and check are released. The dogfood (one merged observer PR to this repository
  with a measured effect) needs scores from a paid judge and a paid model, so it moved to T-21.
- **Slices:**
  - [x] `observer analyze` (failed `BOOLEAN` scores grouped by scorer into problems with counts, reasons and run
    links), `observer propose` (the model's exact-text edits of the instruction files on a branch `observer/*`, a pull
    request on GitHub or Forgejo with Problem, Solution and Evidence, `[needs human]` for protected paths, never a push
    to the default branch), `observer check` (failure rate before and after a merge, minimum runs, two-proportion
    z-test, comment on the pull request), `fakes.forge` showing opened pull requests and branch files, and the npm
    release (ADR 0046, `SCN-OBS-001` to `-033`, `SCN-TK-050`).

### [x] T-11 · gatekeeper

- **Tier / language / path / prefix:** core · TS · `modules/gatekeeper/` · `SCN-GATE`
- **Alone:** rule-based human approvals for any automation or CI job.
- **Public surface:** CLI `gatekeeper request | status`; HTTP API; events `gate.requested`, `gate.decided`;
  GitHub Action.
- **Reads → writes:** change summary + OPA policy → approval request through the channel port; decision →
  signed approval record (who, when, what).
- **Adopt:** OPA (or Cedar), Vercel Chat SDK through the channel port. Re-check existing human-approval SDKs
  before building.
- **Seed:** child-apps-company `docs/company/controls.json`, `wf.sh pr merge`.
- **Realizes:** ORCH-003, LOOP-005 (approval side), LOOP-010, IMPROVE-003, RUNTIME-009, E2E-002.
- **First scenarios:** quick start asks for approval in fake Slack and returns the decision; the policy picks
  the approver group by risk class; a decision by a person outside the group is refused; the record names
  approver and time; a timeout escalates to a second group.
- **Done when:** merges to `main` in this repository need a gatekeeper record for factory-made PRs.
- **Slices:**
  - [x] `gatekeeper request | status | verify`: a Rego policy evaluated by OPA picks the approver groups by risk, the
    groups file names their members, Slack threads and pull request comments as channels with the channel as the only
    store, refusal of anyone outside the groups, escalation after a timeout, expiry, Ed25519-signed records, the events
    `gate.requested@v1` and `gate.decided@v1` on NATS, the commit status `gatekeeper`, the GitHub Action, the dogfood
    workflow `gatekeeper.yml` with `.github/gatekeeper/` (factory-made pull requests need a maintainer), fake Slack's
    `auth.test`, and the npm release (ADR 0047, `SCN-GATE-001` to `-040`, `SCN-TK-051`).
  - [x] Require the commit status `gatekeeper` on `main` in the branch protection of this repository (a setting of the
    owner).
  - [x] HTTP API with its OpenAPI in `contracts/` (`gatekeeper serve`): requests over HTTP, Slack's Events API and
    buttons instead of polling, the Postgres outbox for the events, `fakes.slack` signing and pressing buttons,
    `sut.http.stop`, and the `gate-record` format (ADR 0048, `SCN-GATE-041` to `-058`, `SCN-TK-052` to `-055`,
    `SCN-REPO-062`).
  - Moved: the channel port with Vercel Chat SDK in place of the direct Slack and forge calls, to T-15.

### [x] T-12 · harness port and adapters

- **Tier / language / path / prefix:** core (`acp`, `scripted`) and optional (`claude-code`, `codex`,
  `opencode`) · TS · `ports/harness/`, `adapters/harness/<name>/` · `SCN-HARNESS`
- **Alone:** run any coding agent headless with one API.
- **Interface:** start · send · stream events · approve tool · cancel · export transcript.
- **Adopt:** Agent Client Protocol SDK; Claude Agent SDK; Codex SDK or `codex exec --json`; `opencode serve`;
  Coder's agentapi as fallback.
- **Realizes:** OPEN-002, ORCH-002 (sub-agent permission), ORCH-006, ORCH-007.
- **First scenarios (`@conformance`):** a session starts in a working folder and edits a file on request; a tool
  call outside the allowlist is refused; a steering message reaches a running session; cancel stops the session
  within 5 seconds; the transcript export matches the run record shape.
- **Done when:** all five adapters pass conformance; claude-code, codex and opencode also in SMOKE-PAID. Done:
  `acp` (with the scripted harness, ADR 0052), `claude-code`, `codex` and `opencode` pass conformance; the
  SMOKE-PAID runs moved to T-21.
- **From T-03:** `factory plan` pins harnesses by ACP Registry ID in `factory.lock` (ADR 0022).
- **Slices:**
  - [x] The port as ACP on stdio with adapters as ACP proxies, its thirteen `@conformance` scenarios (session in a working
    folder, allowlist refusal and client approval, steering, cancel within 5 seconds also for an agent that ignores it, the next prompt after a cancel,
    the transcript export as a run record with its outcomes, the allowlist's and the client's decisions in the transcript), the generic adapter
    `adapters/harness/acp` with its npm release, `sut.acp` and the scripted harness's tool calls, steering, cancel and
    stop reasons in the testkit (ADR 0050, `SCN-HARNESS-001` to `-013`, `SCN-TK-056` to `-064`).
  - [x] `scripted` (core): done by ADR 0052. The scripted harness is the `acp` adapter with the testkit's scripted
    agent behind it; a separate package would copy the testkit or depend on it in a cycle.
  - [x] The proxy library `packages/harness-proxy` with its npm release, usage and cost in the run record, and
    `claude-code` (optional): the pinned `claude-agent-acp` behind the proxy in Claude Code's mode `default`, its
    own settings folder and the model gateway settings; conformance against the real Claude Code with the testkit's
    new Anthropic Messages API (ADR 0052, `SCN-HPROXY-001` to `-017`, `SCN-HCLAUDE-001` to `-004`,
    `SCN-HARNESS-014`, `SCN-HACP-001` and `-002`, `SCN-TK-065` to `-071`).
  - [x] `codex`, `opencode` (optional): Codex through `codex-acp` in its mode `read-only` with its own `CODEX_HOME`
    and steering by `_session/steering`, and opencode through `opencode acp` with every tool but reading asking, above
    any folder settings; conformance against the real CLIs with the testkit's new Responses API and streamed chat
    completions; SCN-HARNESS-009 leaves the port, since Codex never ends a turn with `refusal` (ADR 0053,
    `SCN-HCODEX-001` to `-005`, `SCN-HOPENCODE-001` to `-006`, `SCN-HCLAUDE-005`, `SCN-HPROXY-018`, `SCN-TK-072` to
    `-077`).
  - [x] The SMOKE-PAID runs for claude-code, codex and opencode moved to T-21.

### [x] T-13 · sandbox port, egress and MCP gateway wiring

- **Tier / language / path / prefix:** core (`docker`) and optional (`kubernetes`) · TS ·
  `ports/sandbox/`, `adapters/sandbox/<name>/`, `ports/secrets/` · `SCN-SANDBOX`, `SCN-SECRET`
- **Alone:** start isolated, resource-limited environments for agents with no secrets inside.
- **Interface:** create(template, resources, network policy) · exec · copy · snapshot · destroy;
  secrets resolve(reference) at the egress proxy.
- **Adopt:** Docker; kubernetes-sigs/agent-sandbox (templates, claims, warm pools; gVisor or Kata); iron-proxy
  (or agentgateway) for credential injection; agentgateway as MCP gateway with per-agent allowlists; OpenBao.
- **Realizes:** RUNTIME-003…007, OPEN-006, DATA-004.
- **First scenarios (`@conformance`):** a sandbox gets the declared CPU and memory; network egress outside the
  allowlist fails; the sandbox environment contains placeholders, never the real secret; a call through the
  egress proxy reaches a fake API with the real secret; an undeclared MCP server is refused and logged; destroy
  removes all data.
- **Done when:** docker and kubernetes adapters pass conformance (kubernetes on kind in CI).
- **From T-03:** `factory render --k8s` also writes an agent-sandbox `SandboxTemplate` for `agents.<name>.sandbox`
  (ADR 0022).
- **Slices:**
  - [x] The port as a command line (`create | exec | copy | snapshot | destroy | list | egress-log`), its fifteen
    `@conformance` scenarios, the `sandbox-spec` format in contracts, and the `docker` adapter with its npm release:
    a container per sandbox on an internal network behind an iron-proxy container that refuses other hosts, swaps
    secret placeholders (`ref:file/...` from `OSF_SECRETS_DIR`) and allows only the declared MCP tools; the secrets
    port's reference scheme; `fakes.http` for containers in the testkit (ADR 0054, `SCN-SANDBOX-001` to `-015`,
    `SCN-SDOCKER-001` to `-005`, `SCN-TK-078`).
  - [x] `kubernetes` (optional) with its npm release: an agent-sandbox `SandboxTemplate`, `SandboxWarmPool` and
    `SandboxClaim` per sandbox, whose NetworkPolicy lets it reach only its own iron-proxy egress pod, conformance on
    kind in CI; the library `sandbox-egress` with what both adapters share; the secret providers `env`
    (`OSF_SECRET_<NAME>`) and `openbao` (KV v2 through iron-proxy's `vault_kv`) in both adapters as `@conformance`
    scenarios of the sandbox port; `factory render --k8s` writes a `SandboxTemplate` per agent sandbox; testkit
    documents a variable prefix as `OSF_SECRET_*` (ADR 0055, `SCN-SANDBOX-016` to `-022`, `SCN-SEGRESS-001` to
    `-021`, `SCN-SKUBE-001` to `-003`, `SCN-FSPEC-048`, `SCN-TK-079`; `SCN-SDOCKER-002` deprecated).

### [x] T-14 · inference port

- **Tier / language / path / prefix:** core · TypeScript + LiteLLM config · `ports/inference/`, `adapters/inference/litellm/`
  · `SCN-INFER`
- **Alone:** one OpenAI-compatible endpoint for every harness with budgets, routing and spend logs.
- **Adopt:** LiteLLM (configuration, not a fork).
- **Realizes:** OPEN-001, OPEN-003, OPEN-004, BENCH-006 (routing), principle "cost is bounded".
- **First scenarios:** a request with a routing alias reaches the configured model; a run over its budget is
  stopped with a clear error; every call writes a spend log line with `osf.run.id`; a bring-your-own gateway URL is
  used instead of the bundled one.
- **Done when:** taskcapture's `route` output is applied by this adapter in E2E-004. Done: the `litellm` adapter
  passes the port's conformance, SCN-INFER-003 runs a gateway from a config in the shape `route` writes; E2E-004 itself
  moved to T-20, which builds the end-to-end suite.
- **Slices:**
  - [x] The port as a command line (`start | key | spend-log | stop | list`) plus the gateway's OpenAI-compatible
    chat completions API, its eleven `@conformance` scenarios (alias routing, a fine-tuned model, one alias per agent,
    tag routing, a budget per run, spend rows with `osf.run.id`, unknown keys and aliases, provider keys from
    `OSF_SECRET_*`, stop), and the `litellm` adapter with its npm release: the LiteLLM proxy with PostgreSQL on Docker,
    a virtual key with `max_budget` per run, `GET /spend/logs` rows as the spend log (ADR 0056, `SCN-INFER-001` to
    `-011`). A bring-your-own gateway is a provider of the config, or the harnesses' own base URL with no adapter.
  - [x] The Messages and Responses APIs (Claude Code, Codex) through the gateway moved to T-17, which starts harnesses
    against it.

---

## Wave 4 · Automate

### [x] T-15 · channel and forge ports

- **Tier / language / path / prefix:** core (`github`, `forgejo` forge) and optional (`slack`, `teams`,
  `github`, `linear` channels) · TS · `ports/channel/`, `ports/forge/`, `adapters/…` · `SCN-CHANNEL`, `SCN-FORGE`
- **Interface:** channel: receive → WorkItem · reply(thread, message or card) · ask(approval) → decision;
  forge: branch · PR · checks · comments · merge rules · webhooks.
- **Adopt:** Vercel Chat SDK and its adapters; GitHub and Forgejo REST APIs.
- **Realizes:** OPEN-005, ACCESS-001 (per surface), LOOP-009.
- **First scenarios (`@conformance`):** a mention becomes a WorkItem with an origin link; a reply lands in the
  same thread; an approval card returns the decision with the person's identity; the forge adapter opens a PR,
  posts a check and reads merge state.
- **Done when:** forgejo and github forge adapters and slack and github channels pass conformance.
- **From T-03:** factory-spec registers the webhooks of `github.*` automations through the forge port, as it does
  for Forgejo today (ADR 0022).
- **From T-11:** gatekeeper asks for approvals and posts its records through the channel and forge ports (Vercel
  Chat SDK) in place of its direct Slack and forge calls (ADR 0047, ADR 0048).
- **Slices:**
  - [x] The forge port as a command line (`branch | open-pr | pr | check | comment | protect | merge | webhook |
    event`), its twenty-one `@conformance` scenarios (branches, pull requests, checks as commit statuses, comments, merge
    state, a conflict, merge rules for checks and approvals and setting them again, one webhook per URL, deliveries as `pr.opened`, `pr.reviewed` and
    `pr.closed` CloudEvents with a checked signature, a refused token, a missing repository), and the `forgejo` adapter
    with its npm release; `fakes.forge` delivers webhooks to a fake for containers, creates branches, lists branches
    and webhooks and reviews as `reviewer`, and `fakes.http` gives each body's text (ADR 0057, `SCN-FORGE-001` to
    `-021`, `SCN-TK-080` to `-083`).
  - [x] The `github` forge adapter with its npm release, against the same conformance scenarios: GitHub's REST API
    with `fetch`, branches as refs, checks as commit statuses, branch protection with `enforce_admins`, webhooks for
    `pull_request`, `pull_request_review` and `issue_comment` signed with `X-Hub-Signature-256`; the testkit's
    `fakes.github`, an in-process fake of GitHub's REST API with the `Forge` interface (ADR 0058, `SCN-FORGE-001` to
    `-021`, `SCN-TK-084` to `-089`). vercel-labs/emulate was checked: no commit statuses, no conflicts.
  - [x] The channel port as a command line (`receive | reply | ask`) on Vercel Chat SDK, its nine `@conformance`
    scenarios (a mention as a work item with a link to the message, no work from a message without a mention or from
    the bot, a refused signature, a reply and an approval card in the thread, a choice as a decision with the
    person's identity, a choice the card does not offer, a refused token), and the `slack` and `github` channels with
    their npm releases: Slack's buttons, and on GitHub a card in a pull request's conversation answered with
    `/<choice>`; the library `channel-kit` holds their shared commands; `fakes.slack` answers `users.info` and `chat.getPermalink`, and `fakes.github` answers `GET /user`,
    lists a pull request's comments and lets a person `say` a comment (ADR 0059, `SCN-CHANNEL-001` to `-009`,
    `SCN-CSLACK-001`, `SCN-CKIT-001` to `-007`, `SCN-TK-090` to `-092`).
    vercel-labs/emulate was checked again: no signed interactivity.
  - [x] factory-spec's webhooks of `forgejo.*` and `github.*` automations through the forge port: `webhook` takes the
    port's event names with `--event`, and the new commands `hooks` and `unhook` list and remove webhooks, in both
    adapters; factory-spec runs the adapter named in `FACTORY_FORGEJO_ADAPTER` or `FACTORY_GITHUB_ADAPTER` and
    signs webhooks with `FACTORY_WEBHOOK_SECRET`; `sut.adapter` gives a module's test the built adapter, and
    `fakes.github` deletes webhooks (ADR 0060, `SCN-FORGE-022` to `-026`, `SCN-FSPEC-049` to `-056`, `SCN-TK-093` to
    `-095`).
  - [x] gatekeeper's approvals and records through the channel and forge ports: the channel port reads a thread or a
    channel with `messages` and starts a thread in a channel; the forge port's `pr` names the author, labels, draft
    and changed paths, and `comments` lists a pull request's conversation; gatekeeper runs the adapters named in
    `GATEKEEPER_SLACK_ADAPTER` and `GATEKEEPER_FORGE_ADAPTER` and keeps no Slack or forge client of its own;
    `fakes.github` lists changed files and has an Actions token, and `fakes.slack` lists a channel's top-level
    messages newest first (ADR 0062, `SCN-CHANNEL-010`, `SCN-CSLACK-002` to `-004`, `SCN-CKIT-008` to `-009`,
    `SCN-FORGE-027` to `-029`, `SCN-FGITHUB-001`, `SCN-GATE-059` to `-062`, `SCN-TK-097` to `-100`).

### [x] T-16 · intake

- **Tier / language / path / prefix:** optional · TS · `modules/intake/` · `SCN-INTAKE`
- **Alone:** one deduplicated inbox for agent work from all tools, with links back to the origin.
- **Public surface:** HTTP API (submit, status); Factory MCP server (submit work, read run status, fetch
  evidence); webhook endpoints; events `work.received`.
- **Adopt:** channel port adapters, MCP SDK, Postgres outbox to NATS (ADR 0003).
- **Realizes:** LOOP-001…003, ACCESS-001…003, AUTO-001, RUNTIME-002.
- **First scenarios:** quick start submits work through the API and reads it back; a Slack mention and a GitHub
  label for the same issue become one work item; a Sentry fatal webhook becomes a bug work item linked to the
  error; a local agent submits work through the Factory MCP server; every work item event is delivered once even
  when NATS restarts.
- **Done when:** issues labeled `factory` in this repository create work items.
- **Slices:**
  - [x] The inbox (ADR 0063, `SCN-INTAKE-001` to `-020`): `intake serve` with `POST /v1/work-items` and
    `GET /v1/work-items/{id}` in `contracts/`, one work item per dedupe key with every request and origin, PostgreSQL or
    an embedded PGlite, `work.received@v1` through a PostgreSQL outbox to NATS, Slack mentions through the channel
    port's `slack` adapter with a reply in the thread, and `intake mcp`, the Factory MCP server with `submit_work`
    and `work_status`.
  - [x] Issues, surfaces and alerts (ADR 0065, `SCN-INTAKE-021` to `-028`, `SCN-FORGE-030`, `SCN-TK-102` to `-103`):
    the event `issue.labeled@v1` from both forge adapters; `POST /forge/events` runs the forge adapter in
    `INTAKE_FORGE_ADAPTER`, and an issue labeled `factory` becomes a work item with the issue's link as its dedupe key;
    a Slack mention that links an issue joins that issue's work item; `POST /sentry/events` turns a fatal Sentry alert
    into a `bug` that links the error and the change; `fakes.github` and `fakes.forge` open and label issues.
  - Moved: this repository's issues reach intake (the "Done when"), to T-21, because it needs intake at a public
    URL, and the owner chose to defer hosting until the foreman acts on work items.
  - Moved: the Factory MCP server fetches a run's evidence, to T-17, because only the foreman records runs.

### [x] T-17 · foreman

- **Tier / language / path / prefix:** core · TS · `modules/foreman/` · `SCN-FORE`
- **Alone:** run any declared multi-agent pipeline with retries, pauses and human gates, without writing workflow
  code.
- **Public surface:** HTTP API (runs, state, signals: steer, take over, cancel); events `run.started`,
  `run.completed`; Temporal UI for history.
- **Reads → writes:** work item events + resolved factory definition (from factory-spec) → sandbox runs through
  the harness and sandbox ports, gate requests, run state; sets `OTEL_RESOURCE_ATTRIBUTES` on every run.
- **Adopt:** Temporal TypeScript SDK (ADR 0004); stage logic in plain functions (DBOS backend stays possible).
  OpenHands may be added later as one more harness, not as the core.
- **Realizes:** ORCH-001…008, LOOP-004…007, LOOP-011, RUNTIME-001, AUTO-001 (execution side), E2E-001,
  E2E-002.
- **First scenarios:** quick start runs a two-stage factory with the scripted harness on Docker; a stage with a
  gate waits until a `gate.decided` event arrives; a failing CI check stops the ship stage; a steering signal
  reaches the running stage; a crash of the worker resumes the workflow from history; every run carries the
  factory version hash.
- **From T-14:** foreman starts one gateway per factory with the inference port, asks for a key per run with
  the run's budget, and hands the URL and key to the harness. Claude Code calls the Messages API and Codex the
  Responses API: add `@conformance` scenarios for both to the inference port (ADR 0056).
- **From T-16:** the Factory MCP server (`intake mcp`) gets a tool that fetches a run's evidence, once the foreman
  records runs (ADR 0063).
- **Done when:** E2E-001 passes and this repository's `factory` issues are implemented by the foreman (phase 3).
- **Slices:**
  - [x] Runs, gates and signals (ADR 0067, `SCN-FORE-001` to `-023`): `foreman serve` with `POST /v1/runs`,
    `GET /v1/runs/{runId}` and `POST /v1/runs/{runId}/signals` in `contracts/`, one Temporal workflow per work item
    whose stages run their agents through the harness port, gates requested at gatekeeper and decided by
    `gate.decided@v1`, steering and cancel, recovery after a restart, `work.received@v1` in and the new
    `run.started@v1` and `run.completed@v1` out; the factory version is the commit of `factory.yaml`. The testkit runs
    Temporal and NATS as pinned binaries without Docker.
  - [x] Sandboxes (ADR 0068, `SCN-FORE-032` to `-041`, `SCN-TK-105` to `-108`): a stage whose agent declares `sandbox`
    runs in a fresh sandbox of the adapter under `providers.sandbox` (`docker` by default, `FOREMAN_SANDBOXES`), built
    from the agent's sandbox and secrets; the run's folder is copied in and out, the harness runs with `exec`, and the
    sandbox is destroyed when the stage ends. `fakes.sandbox()` runs the port's commands on host folders.
  - [x] Checks (ADR 0069, `SCN-FORE-042` to `-049`): a stage with `checks` in `factory.yaml` starts only when those
    checks succeeded on the run's pull request, the last pull request link an agent of an earlier stage wrote. The
    foreman reads them with the forge adapter under `providers.forge` (`FOREMAN_FORGES`); a failing check fails the
    stage and the run, a pending one blocks the run until it succeeds. The run shows `pullRequest`, later prompts name
    it, and `run.completed@v1` lists it.
  - [x] Inference gateway and take over (ADR 0070, `SCN-FORE-050` to `-063`, `SCN-INFER-012` and `-013`, `SCN-TK-109`
    to `-112`): a factory names its inference adapter under `providers.inference` and its config and run budget under
    `inference` (`FOREMAN_INFERENCES`); `foreman serve` starts one gateway, makes one key per run with the budget, and
    hands each stage's agent the URL, the key and the agent's `model` as `OPENAI_*` and `ANTHROPIC_*` variables. The
    port's scenarios cover the Messages and Responses APIs. The signals `take-over` and `hand-back` let a person take
    the running stage over in the run's `folder` and hand the run back. `fakes.inference()` fakes the port.
  - [x] Runs listed and filtered by state, work item status and evidence (ADR 0071, `SCN-FORE-064` to `-067`,
    `SCN-INTAKE-030` to `-038`): `GET /v1/runs` lists the runs, running ones first, and `?state=` filters them (ORCH-008);
    `intake serve` follows `run.started@v1` and `run.completed@v1`, so a work item shows `running`, `complete`,
    `failed` or `cancelled` and its `runId`; the Factory MCP server's tool `run_evidence` fetches the run's view from the
    foreman at `INTAKE_FOREMAN_URL`.
  - Moved: E2E-001 (the "Done when"), to T-20, whose smoke suite runs it against the Compose profile.
  - Moved: this repository's `factory` issues implemented by the foreman, to T-21, because it needs intake at a
    public URL (T-21's intake slice) and a real model.

### [x] T-18 · console

- **Tier / language / path / prefix:** optional · TS (web) · `modules/console/` · `SCN-CONSOLE`
- **Alone:** a read-only web view of a factory: live runs, their origin and evidence, the self-improvement
  inbox, links to dashboards.
- **Public surface:** web UI; reads only public APIs of intake, foreman, runlog's trace store, gatekeeper,
  observer.
- **Adopt:** an existing UI framework; Langfuse, Temporal and Grafana UIs are linked, not rebuilt.
- **Realizes:** VIS-001, VIS-002, CODE-002, IMPROVE-004, ORCH-008 (view side).
- **First scenarios:** the runs page lists running runs with source, requester and PR; a run page links its
  Slack origin, trace and evidence; configuration pages are read-only with a link to the file in Git; the inbox
  lists observer PRs by state.
- **Done when:** a maintainer can follow all factory work in this repository without opening Temporal directly.
- **Slices:**
  - [x] Runs, run pages and configuration (ADR 0072, `SCN-CONSOLE-001` to `-029`): `console serve` renders HTML on the
    server with Preact and htm. `/` lists the runs of every foreman in `CONSOLE_FOREMAN_URL` with title, factory,
    state, source, requester, pull request and age, filters them by state and reloads itself; `/runs/<runId>` shows the
    origin, every request from intake, the stages with their transcript, gate from gatekeeper, checks and reason, and
    links the trace and the Temporal history; `/factory` and `/factory/agents/<name>` show `factory.yaml` read-only
    with the link to the file and branch in Git; every page links the dashboards in `CONSOLE_LINKS`.
  - [x] The self-improvement inbox (ADR 0073, `SCN-CONSOLE-030` to `-035`, `SCN-FORGE-031` to `-033`): the forge
    port's `prs <repo> [--head <prefix>] [--state open|closed|all]` lists pull requests by branch prefix with their
    review state, in both forge adapters; `/inbox` lists the open pull requests of `CONSOLE_INBOX_REPOSITORY` from
    `observer/` branches with their age and the state "needs review", "approved" or "changes requested".

### [x] T-19 · distribution

- **Tier / language / path / prefix:** optional · YAML · `deploy/compose/`, `deploy/helm/` · `SCN-DIST`
- **Alone:** install a complete factory with one command.
- **Build:** Compose profile (Postgres with Temporal and pgvector, SeaweedFS, NATS, Phoenix, LiteLLM, the
  modules); Helm chart (managed Postgres, object storage, NATS, Temporal, Langfuse, OpenBao, agent-sandbox);
  a reference `factory.yaml` with the loop triage → spec (gate) → implement → review → verify (evidence) → ship.
  Signed images, SBOMs, SLSA provenance.
- **Realizes:** OPEN-006, DATA-006, RUNTIME-001, LOOP-013.
- **First scenarios:** `docker compose up` reaches a healthy state within the budget; the reference factory
  plans and applies cleanly; `helm install` on kind passes the same smoke subset.
- **Done when:** the Compose profile and the Helm chart pass their scenarios. `make smoke` against the profile is
  T-20's: it needs the `e2e/` package.
- **Slices:**
  - [x] The Compose profile and the reference factory (ADR 0074, `SCN-DIST-001` to `-006`, `SCN-TK-114`):
    `deploy/compose/compose.yaml` starts PostgreSQL with pgvector, Temporal on it, NATS, SeaweedFS, Phoenix, LiteLLM,
    gatekeeper, intake, foreman and console with one `docker compose up --detach --wait`; the module images are built
    from npm releases by `deploy/images/Dockerfile`; `.env` holds every secret and a missing one is named;
    `deploy/compose/factory/` is the reference factory, and `docker compose run --rm factory plan` and `apply` run on
    it. The testkit's `sut.compose` drives the profile, and the CI suite `deploy` runs it.
  - [x] The Helm chart and the published images (ADR 0075, `SCN-DIST-007` to `-013`, `SCN-TK-115`): `deploy/helm/osf/`
    installs gatekeeper, intake, foreman and console with the reference factory, and PostgreSQL, NATS and Temporal
    unless the values name the team's own; secrets come from the values or an existing Secret; `helm test` plans the
    factory. The testkit's `sut.helm` drives it on kind in CI. The workflow `publish-images` publishes the module
    images of `compose.yaml` to GHCR for amd64 and arm64 with SBOMs and SLSA provenance, signs them and the chart with
    cosign, and the Compose profile pulls them. The verify stage of the reference factory waits for the check
    `verify` (factory-spec 0.5.0).

### [ ] T-20 · end-to-end smoke suite

- **Path / prefix:** `e2e/` · `SCN-E2E`
- **Build:** implement the five scenarios in `e2e/features/smoke.feature` against the Compose profile with the
  testkit fakes; add `SMOKE-PAID` (one small real task per first-party harness with a real model, nightly).
- **From T-00:** `make smoke` and `make smoke-paid` run Turborepo tasks that no package defines yet, so they run
  nothing. Give `e2e/` a package with `test:system` and `test:paid` scripts; the nightly workflow already calls
  them. (`make mutation` runs in every module since ADR 0037.)
- **From T-14:** E2E-004 starts the gateway with `inference-litellm start` on the config `taskcapture route` wrote
  and checks that a call for the alias with the tag reaches the cheaper model (ADR 0056).
- **Done when:** all five pass on every merge to `main`; SMOKE-PAID runs nightly.

### [ ] T-21 · dogfood with paid services

Slices that need a paid model call or a paid service. They come last, so the plan does not wait for them. Ask the
owner before each slice: which model or service, and its budget.

- **Slices:**
  - [ ] scorekit (from T-07): score this repository's `runs/` nightly with a real judge model and link the report
    from the README.
  - [ ] taskcapture (from T-09): run `taskcapture-suite.yml` with real models next to the oracle, publish the report,
    and route with its pick.
  - [ ] observer (from T-10): a nightly job runs `observer analyze` on the scores of the scorekit slice above and
    `observer propose` for the top problem with a real model; done when one observer pull request to this repository
    is merged and `observer check` measures its effect (ADR 0046).
  - [ ] foreman (from T-17): run `foreman serve` with a real harness and model next to the public intake below; done
    when an issue labeled `factory` in this repository is implemented by the foreman (phase 3).
  - [ ] intake (from T-16): run `intake serve` at a public URL and point the `issues` webhook of
    `sesigl/open-software-factory` at its `/forge/events`; done when an issue labeled `factory` here creates a work
    item (ADR 0065). Ask the owner where intake runs.
  - [ ] harness (from T-12): one SMOKE-PAID run each for claude-code, codex and opencode with a real model; done when
    `make smoke-paid` passes for the three adapters (ADR 0052, ADR 0053).

---

## After the plan: phase 3 and 4

When T-17 is done, follow `docs/explanation/bootstrapping.md`: the factory implements this repository's
`factory` issues with people at the gates, then observer improves our own `factory.yaml`. Add each new
requirement as a vision scenario first, then as module scenarios and a new item here.
