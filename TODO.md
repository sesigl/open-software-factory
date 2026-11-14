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
    MUTATION as a nightly workflow, SMOKE-PAID as a weekly one (ADR 0077).
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
- **Done when:** the scorer pack, calibration and Langfuse export are released. Scoring our own sessions weekly
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

### [x] T-20 · end-to-end smoke suite

- **Path / prefix:** `e2e/` · `SCN-E2E`
- **Build:** implement the five scenarios in `e2e/features/smoke.feature` against the Compose profile with the
  testkit fakes; add `SMOKE-PAID` (one small real task per first-party harness with a real model, weekly).
- **Done (ADR 0076):** `e2e/` is the package `@opensoftware/e2e`; its `test:system` builds one image of the workspace
  and runs the five scenarios on the profile with the fakes, as the suite `e2e` of `make verify` on every pull
  request and every merge to `main`. E2E-004 uses the profile's LiteLLM with the config `taskcapture route` wrote,
  not `inference-litellm start`. `SMOKE-PAID` and the package's `test:paid` need paid model calls: they are the
  harness slice of T-21.

## Wave 5 · v1: a simple factory that people can trust

The parts exist and are tested. This wave makes the assembled factory keep its own promises and makes it easy to set up.
The v1 promise covers the delivery loop and its record: intake, foreman, gatekeeper, console, factory-spec, runlog and
proof, with one adapter per port (claude-code, docker, github, litellm). The other modules stay released CLIs outside
the v1 promise. P0 items come first: without them, people cannot trust the factory with real work.

### [x] T-22 · durable events (P0)

- **Problem:** intake, foreman and gatekeeper send events on core NATS subjects. A consumer that is down loses work
  items and gate decisions.
- **Build:** a JetStream stream `OSF` on `osf.>`; publishers wait for the stream's acknowledgement; each consumer has a
  durable consumer and acknowledges a message only after it handled it.
- **Done when:** a work item and a gate decision sent while the foreman is down reach it when it starts, and a run
  event sent while intake is down reaches intake.
- **Slices:**
  - [x] The stream `OSF`, JetStream publishes with the event ID as message ID in intake, gatekeeper and the foreman,
    and the durable consumers `foreman` and `intake` (ADR 0085, `SCN-FORE-073`, `-074`, `SCN-INTAKE-043`).
  - [x] Move the image pins of the Compose profile and the Helm chart to the releases with durable events; each
    release moves them from now on (ADR 0095).

### [x] T-23 · sandbox on by default (P0)

- **Problem:** the profile runs agents in the foreman container, with every token in its environment (P11).
- **Done when:** every stage of the reference factory runs in the Docker sandbox adapter in the Compose profile, and
  the agent's environment holds no forge or model token of the foreman.
- **Slices** (ADR 0096):
  - [x] The egress proxy swaps a secret's placeholder also in git's Basic credentials, so git and `gh` clone and push
    from a sandbox with the placeholder as their token (`SCN-SANDBOX-023`, `SCN-SEGRESS-022`).
  - [x] A factory that names no sandbox adapter runs its sandboxes with the foreman's `FOREMAN_SANDBOX` (`docker`), so
    the profile and the chart share the reference factory (`SCN-FORE-084`, `-085`).
  - [x] The profile: wollomatic/socket-proxy with only the Docker API paths of the adapter and no bind mount, the
    foreman image with the Docker CLI and `sandbox-docker`, and the image `harness-claude-code` as the agents'
    template; a sandbox of it reaches `litellm` and nothing else of the profile (`SCN-DIST-017`).
  - [x] The reference factory runs each stage in a sandbox that reaches LiteLLM with the run's key and GitHub with a
    placeholder, and an end-to-end scenario shows that the agent's environment holds no token of the foreman
    (`SCN-E2E-006`). Its template pin in `factory.yaml` is moved by `osf profile-pins` and checked by PROFILE. The
    chart runs LiteLLM, which the factory attaches to (`SCN-DIST-019`).
  - [x] A live test of `make smoke-paid`: Claude Code in a sandbox of the agents' template runs on the subscription
    with the placeholder of `CLAUDE_CODE_OAUTH_TOKEN`; it runs again by hand when the template or its egress changes.
  - [x] The chart: the foreman runs the sandboxes with the kubernetes adapter (`FOREMAN_SANDBOX: kubernetes`), with
    rights only in the sandboxes' own namespace, and agent-sandbox as a documented prerequisite (ADR 0097,
    `SCN-DIST-022`, `SCN-TK-137`).

### [x] T-24 · a record of every factory run (P0)

- **Problem:** the improvement path sees a factory run only when someone exports its session by hand (P6).
- **Done when:** the foreman gives each stage a `TRACEPARENT` and exports the stage's session with runlog to the trace
  store of the profile; the console links each stage to its trace.
- **Slices:**
  - [x] With `OTEL_EXPORTER_OTLP_ENDPOINT`, one trace per run: a span per stage and one for the run, and the stage's
    `TRACEPARENT` for its harness (ADR 0087, `SCN-FORE-076`, `-077`, `SCN-TK-133`).
  - [x] After each stage, the session's run record (tokens, cost) joins the stage span through the harness's
    `transcript`, the run's view names each stage's span, and the console links each stage to it with `CONSOLE_SPAN_URL`
    (ADR 0121, `SCN-FORE-155`, `SCN-CONSOLE-070`).
  - [x] The profile sets the endpoint to its trace store, Jaeger (ADR 0100; Phoenix before it), and the console links
    each run to its trace.

### [x] T-25 · doctor and a health page (P0)

- **Problem:** the health signals exist, but they are spread over several tools, and a health check accepts any status
  below 500.
- **Done when:** one command checks each service, token, model route, harness, sandbox, event path and trace store in
  order and prints one fix per failure; the console shows the same list; health routes check their dependencies.
- **Slices:**
  - [x] `GET /v1/health` on intake, gatekeeper and the foreman, with one check per dependency and its fix, without a
    token; `healthOf` in `@opensoftware/cli` (ADR 0086, `SCN-CLI-017` to `-019`, `SCN-INTAKE-044`, `-045`,
    `SCN-GATE-091`, `-092`, `SCN-FORE-075`).
  - [x] `console doctor` and the console page `/health`: each server's health and token, and the factory definition,
    with one fix per failure (`SCN-CONSOLE-037` to `-040`).
  - [x] The Compose profile and the Helm chart probe `/v1/health` and want a 2xx answer, and the quick start of
    `deploy/README.md` runs `docker compose run --rm console console doctor` (`SCN-DIST-016`).
  - [x] Deep checks with `console doctor --deep`: one model call per route through LiteLLM and the harness answers ACP
    `initialize` (ADR 0120, `SCN-CONSOLE-064` to `-069`).
  - [x] A test span reaches the trace store: `console doctor --deep` sends one span by OTLP and finds it with Jaeger's
    query API (ADR 0120, `SCN-CONSOLE-100` to `-102`, `fakes.traceStore`, `SCN-TK-149`).
  - [x] A sandbox starts and refuses a denied host: the port operation `probe <template> <host>` in both adapters,
    and `console doctor --deep` with `CONSOLE_SANDBOX_COMMAND` (ADR 0120, `SCN-SANDBOX-024`, `SCN-CONSOLE-120` to
    `-123`, `SCN-TK-150`, `-151`).
  - [x] A test event reaches the foreman (ADR 0120): `console doctor --deep` with `CONSOLE_NATS_URL` publishes
    `doctor.ping@v1` and finds it at the foreman's `GET /v1/doctor/pings/{id}` (`SCN-CONSOLE-130` to `-134`,
    `SCN-FORE-162`).

### [x] T-26 · evidence in the loop (P1)

- **Done when:** a stage with `evidence: required` fails without a proof evidence bundle for its pull request.
- **Slices:**
  - [x] `evidence: required` adds the check `proof` to the stage's checks; without a forge adapter the server does not
    start (ADR 0088, `SCN-FORE-078` to `-080`).
  - [x] `deploy/README.md` says to run proof in the target repository's CI, as the profile pins the foreman with this
    change.

### [x] T-27 · a reference factory that works on any repository (P1)

- **Done when:** the work item or the factory names the repository, and the reference factory implements an issue of
  any GitHub repository with one token.
- **Slices:**
  - [x] The reference prompts clone the repository of the issue in the origin link, follow the repository's own
    instructions and checks, and stop when a work item names no repository.
  - [x] Its paid slice, a first run on a sample repository with a paid model, moved to T-21 in
    [Paid runs](#paid-runs-last-started-by-a-maintainer-manual).

### [x] T-28 · console actions and the work inbox (P1)

- **Done when:** the console lists work items (an intake list route), submits work, approves or rejects a gate, and
  steers, cancels, takes over and hands back a run, each through the existing APIs with the person's identity.
- **Slices:**
  - [x] intake's `GET /v1/inbox` and the console page `/work` (`SCN-INTAKE-046` to `-048`, `SCN-CONSOLE-043`, `-044`).
  - [x] Actions behind the sign-in proxy's identity header, off by default; the form "submit work" on `/work`
    (ADR 0089, `SCN-CONSOLE-045` to `-047`).
  - [x] Steer, cancel, take over and hand back a run, and decide a gate, from the console; each API records the
    person who acted first (ADR 0118, `SCN-FORE-149`, `SCN-GATE-095` to `-097`, `SCN-CONSOLE-060` to `-063`).

### [x] T-29 · one trace store (P1)

- **Done when:** the profile runs one trace store, and runlog, scorekit and the console use the same one. An adopted
  service without a consumer leaves the profile.
- **Decision:** Jaeger (ADR 0100), which replaced Phoenix (Elastic License 2.0, a slow start). It is one container
  that takes OTLP and keeps its traces on a volume; Langfuse needs ClickHouse, Redis and S3 more. scorekit and
  observer keep Langfuse as an option outside the profile.
- **Slices:**
  - [x] The run's view names its `traceId`, and `CONSOLE_TRACE_URL` takes `{traceId}` (`SCN-FORE-081`,
    `SCN-CONSOLE-041`, `-042`).
  - [x] The profile: the foreman sends to Phoenix, the console links Phoenix's trace by `{traceId}`, and SeaweedFS
    leaves the profile (no consumer, ADR 0088). Jaeger then replaced Phoenix in the same places (ADR 0100).

### [x] T-30 · simple setup (P1)

- **Done when:** `osf init`, `osf up` and `osf doctor` (or their Compose equivalents) take a new team from a clone to a
  healthy factory, and one tutorial describes the first run.
- **Slices:**
  - [x] `osf init` writes `deploy/compose/.env` from `.env.example` with the factory's own secrets generated and the
    rest empty, keeps an existing `.env`, and with `--factory <dir>` copies the reference factory for the team
    (SCN-REPO-132 to -134, ADR 0119).
  - [x] `osf up` refuses a missing `.env`, an empty value that `compose.yaml` requires and gatekeeper without Slack or
    a forge token, and otherwise runs `docker compose up --detach --wait` in `deploy/compose/` (SCN-REPO-135, -136).
  - [x] `osf doctor` runs `console doctor` in the profile and exits with its code (SCN-REPO-137).
  - [x] The tutorial `docs/tutorials/first-run.md`, linked from "Run a factory" in `README.md` and from the quick
    start of `deploy/README.md`.

### [x] T-31 · the improvement path in the profile (P2)

- **Done when:** scheduled jobs run runlog, scorekit, ledger and observer on the factory's own runs, and the console
  shows cost and scores.
- **Slices:**
  - [x] The console page `/improvement` shows each scorer's scored runs, passes, pass rate and judge cost, and each
    run's stages with their outcome and cost, from the run records and scores in `CONSOLE_IMPROVE_DIR`
    (SCN-CONSOLE-090 to SCN-CONSOLE-092, ADR 0123).
  - [x] A Compose service `improve` (profile `improve`) that copies the foreman's run records and runs `scorekit score`
    and `report`, `ledger report` and `observer analyze` on a schedule into the volume the console reads, in the image
    `observer` with the released observer, scorekit and ledger; `scorekit score` only for the scorers of
    `IMPROVE_SCORERS`, as judging is a paid call (ADR 0123, `SCN-DIST-034`).
  - [x] A chart CronJob with the same commands, `improve.enabled`, and the chart version 0.4.0 (`SCN-DIST-035`).
  - [x] DIST scenarios in `deploy/features/` for both, which run in CI with Docker and kind.
  - [x] The run records of stages in a sandbox reach the foreman's `transcripts/`, so the jobs see the reference
    factory's stages: the foreman runs the harness's `transcript` in the sandbox and copies it out (SCN-FORE-163,
    ADR 0121, ADR 0123).

### [x] T-32 · factory version from Git and public intake (P2)

- **Done when:** the foreman reads `factory.yaml` from a Git remote at a commit, and the docs describe one way to give
  intake a public URL without a relay.
- [x] `FOREMAN_FACTORY=git+<url>#<ref>`: the foreman fetches the ref into its data folder and runs at that commit as
  the factory version, without the clean-folder check; a ref it cannot fetch stops the server (SCN-FORE-156, 157,
  ADR 0124).
- [x] `docs/how-to/public-intake.md`: intake's webhook paths behind Cloudflare Tunnel (or Tailscale Funnel or a
  reverse proxy with TLS), what to secure, linked from `deploy/README.md`.

### [x] T-33 · current status lines (P2)

- **Done when:** `README.md` and `AGENTS.md` describe the current phase as `TODO.md` does.

### [x] T-34 · faster mutation tests (P2)

- **Done when:** a second push of the same pull request runs no mutant again whose unit, test and changed lines did
  not change, and the before and after times of one pull request are in the ADR. No mutator is removed and the
  MUTATION limit stays.
- **Slices:**
  - [x] Each unit's shard report has the key of turbo's hash of the unit's mutation task and its changed line ranges,
    not the base commit and the whole tree (ADR 0091, `SCN-REPO-094`).
  - [x] Stryker's incremental mode per unit, with a guard of the unit's other inputs and the builds it depends on. The
    weekly full run stays (ADR 0091, `SCN-REPO-095`, `-096`).
  - [x] No mutation run on a draft pull request.
  - [x] inference-litellm: 25 added lines per shard. Its runs already take the shortest scenario first (ADR 0084).
  - [x] The times of one pull request before and after, in ADR 0091.
  - [x] Mutation starts only after `verify` passed (ADR 0092).
  - Not done, with the reason in ADR 0091: a stable shard per mutant (the joined results serve every shard).

**Review of the assembled factory (T-36 to T-50).** A review on 2026-11-12 read the code of the delivery loop against
[`docs/vision/`](docs/vision/). These items are defects and gaps in what exists. A new feature is not here: it starts
as a vision scenario. Each item names the place in the code, so start there, and write the scenario before the fix.

### [x] T-36 · the reference factory asks for approval of the spec (P0)

- **Problem:** a gate comes before its stage (`nextStep` in `modules/foreman/src/domain/run.ts`), and the reference
  factory has its gate on `spec`. A maintainer is asked before the spec exists, and `implement` starts without an
  approval of it. `agents/spec.md`, `agents/implement.md` and `deploy/README.md` say that a maintainer approved the
  scenarios. The dogfood factory has the gate on `implement`.
- **Done when:** a run of the reference factory waits after `spec`, its approval request links the spec's pull request,
  and `implement` starts only after the approval.
- **Slices:**
  - [x] The gate moves to `implement` in `deploy/compose/factory/factory.yaml` and in the chart's copy under
    `deploy/helm/osf/files/factory/`; the comment of `policy/spec.rego` and `deploy/README.md` follow.
  - [x] A scenario of the distribution shows the gate's place in the resolved factory (`SCN-DIST-028`). It runs no
    factory: the foreman's `SCN-FORE-072` shows that a gate before `implement` asks with the pull request of the stage
    before it, and a run of the whole reference factory is T-27's.

### [x] T-37 · checks from GitHub Actions (P0)

- **Problem:** the forge adapter `github` reads only commit statuses (`GET /commits/<sha>/status` in
  `adapters/forge/github/src/commands/pulls.ts`). A job of GitHub Actions is a check run, not a commit status. A stage
  with `checks: [verify]` waits forever on a repository whose CI does not post a status by hand, as `verify.yml` of this
  repository does. T-27 promises any GitHub repository.
- **Done when:** `pr` of `forge-github` lists the check runs of the head commit next to its commit statuses, and a
  stage starts after a job of GitHub Actions with the check's name succeeded.
- **Slices:**
  - [x] `pr` reads `GET /commits/<sha>/check-runs` and maps each conclusion to `success`, `failure`, `error` or
    `pending` (`SCN-FGITHUB`); `fakes.github` serves check runs. Done (ADR 0104): the mapping SCN-FGITHUB-005, the
    newest re-run SCN-FGITHUB-006, the worse of a status and a check run SCN-FGITHUB-007, every page SCN-FGITHUB-008,
    a token without `Checks: read` SCN-FGITHUB-009; `fakes.github` serves check runs by page SCN-TK-143 and refuses
    them to `noChecksToken` SCN-TK-144. That a stage starts once `pr` reports its check as `success` is foreman's
    existing scenarios; no scenario runs a real GitHub Actions job.
  - [x] The forge port's README says what a check is on each forge, and `deploy/README.md` says which name to put under
    `checks`.

### [x] T-38 · run a work item again (P0)

- **Problem:** the foreman starts one run per work item, also after the run ended (`REJECT_DUPLICATE` in
  `modules/foreman/src/commands/runs.ts`), and intake gives an issue the same work item each time. A run that failed
  or was cancelled can never run again; the only way is a new issue.
- **Done when:** a person starts a work item's run again through the API and the console, the new run names the run
  before it, and intake's work item follows the new run; and putting the label on an issue again starts the run again.
- **Slices** (ADR 0105):
  - [x] An ADR: the ID of a second run, which stage it starts at, and what it keeps of the run's folder and pull
    request; the planned scenarios of the foreman, intake and the console.
  - [x] The contract and the foreman's retry: `RunRetry`, `POST /v1/runs/<run ID>/retry`, `attempt`, `retryOf` and
    `retriedBy` in `RunView`; `runIdOf(workItemId, n)`, the
    copied stages, the moved folder, the run in the gate request's `change`, `gate.decided@v1` routed to the newest run, `POST /v1/runs`
    answering the newest run, the line "Run before:" in the first stage's prompt (`SCN-FORE-088` to `-101`, `-103`,
    `-106` to `-111`, implemented). The budget is 390 s, with the measured reason in `modules/foreman/AGENTS.md`.
  - [x] The foreman's events of a second run: `retryOf` in its events, and the event `work.retry-requested@v1` in the
    contract with the foreman as its consumer (`SCN-FORE-102`, `-104`, `-105`, implemented).
  - [x] intake follows the newest run (`SCN-INTAKE-050` to `-052`, implemented).
  - [x] The label put on an issue again publishes `work.retry-requested@v1` (`SCN-INTAKE-053` to `-056`,
    implemented; `fakes.github` removes a label, `SCN-TK-145`).
  - [x] The console's form "run again" and the link to the run before (`SCN-CONSOLE-050` to `-054`, implemented).

### [x] T-39 · waits that end (P1)

- **Problem:** a stage reads pending checks every `FOREMAN_CHECK_POLL_MS` without a limit, and waits for a gate until
  a decision comes (`await condition` in `modules/foreman/src/workflows/run.ts`). A check with a wrong name, or a gate
  whose policy has no `expire_after`, blocks a run forever, and the run does not say what it waits for.
- **Done when:** a stage that waited longer than its limit fails with a reason that names the check or the gate, and
  the run's view shows since when it waits.
- **Slices:**
  - [x] A limit for the wait for checks, as a setting of the foreman with a default, and per stage if the contract
    gets the field (`SCN-FORE-112`, `SCN-FORE-114`; ADR 0106 leaves the per-stage limit for later).
  - [x] A check that the pull request's head commit does not have at all is named as missing in the stage's reason,
    apart from one that is pending (`SCN-FORE-113`).
  - [x] A gate without a decision after the foreman's own limit ends as `expired`, also when the policy names none
    (`SCN-FORE-115`, `SCN-FORE-116`).

### [x] T-40 · a verify stage that runs no second implement session (P1)

- **Problem:** the stage `verify` of the reference factory has `agent: implement`, because every stage runs an agent.
  After the checks passed, the implement agent runs again with the implement prompt: a second full session, which may
  push commits that no check has seen. `ship` does not read the checks again.
- **Done when:** the reference factory waits for the checks and the evidence without a model call, and `ship` starts
  only when the checks of the pull request's head commit succeeded.
- **Slices:**
  - [x] An ADR: a stage without an agent, or an agent `verify` with a prompt of its own that changes no file
    ([ADR 0107](docs/decisions/0107-a-stage-that-only-waits.md): `wait: true`; `SCN-FSPEC-059` to `-062`,
    `SCN-FORE-117` to `-119`).
  - [x] The reference factory and the dogfood factory use it, and `ship` has the same `checks` (`SCN-DIST`, `SCN-FORE`).
    `ship` has the checks `[verify]` and `evidence: required` in both (`SCN-DIST-029`, `-030`). `verify` has
    `wait: true` since the release of contracts 2.4.0, factory-spec 0.8.0 and foreman 0.10.0 (`SCN-DIST-031`, `-032`).

### [x] T-41 · one key and one budget per run (P1)

- **Problem:** the foreman keeps each run's key of the gateway in memory (`keys` in
  `modules/foreman/src/workflows/activities.ts`). After a restart it asks for a new key, and `inference.budget`
  starts again from zero. A run's keys live until the gateway stops.
- **Done when:** a run spends at most its budget across restarts of the foreman, and its key stops working when the run
  ended.
- **Slices:**
  - [x] The inference port's `key` answers the same key for the same run, or the budget is on the run and not on the
    key (`SCN-INFER`, `SCN-INFLITE`). ADR 0108: the same key, SCN-INFER-014 and -015, SCN-INFLITE-018 to -020.
  - [x] The foreman revokes the run's key when the run ended (`SCN-FORE`). SCN-FORE-121 to -125.

### [x] T-42 · the run's pull request, stated and not guessed (P1)

- **Problem:** the run's pull request is the last pull request link in what the stage's agent wrote
  (`lastPullRequestIn`). An agent that names another pull request after its own gives the run the wrong one, and the
  checks and the gate then read that one.
- **Done when:** a run takes only a pull request of the work item's repository whose head is the run's branch, or one
  that the agent names in a stated form, and says so when it finds none.
- **Slices:**
  - [x] An ADR: how a stage states its results (a line of a fixed form, a file in the run's folder, or the forge
    adapter's `prs` for the run's branch). ADR 0109: the forge's `prs` for the branch `osf/<run ID>`, else the line
    `Pull request: <link>` (SCN-FORE-126, SCN-FORE-127).
  - [x] The foreman refuses a link of another repository than the work item's (SCN-FORE-128), and a stage says so
    when it finds none (SCN-FORE-129). Only for a work item whose origin is a forge's issue or pull request; any
    other origin keeps the last link (ADR 0109).

### [x] T-43 · versions a run can trust (P1)

- **Problem:** the factory version is the commit of `HEAD` also when `factory.yaml` or a prompt has changes that are
  not committed (`modules/foreman/src/adapters/factory.ts`), so a run can name a version that it did not run. An
  adapter without a command line in `FOREMAN_HARNESSES`, `FOREMAN_SANDBOXES`, `FOREMAN_FORGES` or
  `FOREMAN_INFERENCES` runs `npx -y @opensoftware/<port>-<name>` at the newest version; the ranges under `providers`
  are not read. A command line is split at each space, so a path with a space breaks it.
- **Done when:** the foreman refuses a factory with changes that are not committed, each adapter runs at a version
  inside the factory's range, and the run's view names the versions.
- **Slices:**
  - [x] `foreman serve` and a run's start fail with the changed files named when the factory's folder is not clean
    (SCN-FORE-131, SCN-FORE-132, ADR 0110); a prompt or inference config that Git does not track counts too, and the
    paths come sorted (SCN-FORE-135, SCN-FORE-138).
  - [x] The fallback command line takes the version that `factory plan` pinned in `factory.lock`, or the range of
    `providers` (`SCN-FORE`, `SCN-FSPEC`). The range of `providers`, and the run's `adapters` name it with the
    command line (SCN-FORE-133), for every port, and npx runs each package at its range (SCN-FORE-136,
    SCN-FORE-137), or without one for an adapter the factory does not name (SCN-FORE-139). `factory plan --adapters`
    pins each adapter in `factory.lock`, the contract `factory-lock` (SCN-FSPEC-066 to SCN-FSPEC-069, ADR 0125), and
    the fallback runs the pin while its range holds (SCN-FORE-158).
  - [x] The adapter maps take a command line as a list of arguments too (SCN-FORE-134).

### [x] T-44 · what factory.yaml declares takes effect (P1)

- **Problem:** a factory declares more than a run uses. The foreman opens each session with `mcpServers: []` and gives
  the agent only its prompt, so an agent's `mcp`, `skills` and `repositories` do nothing in a run. A `cron` automation
  is only rendered for gh-aw. `benchmarks` is only linted. A stage's result does not reach the next stage: it gets the
  work item, the pull request link and the shared folder, so what triage found is lost.
- **Done when:** each field of the factory definition takes effect in a run of the foreman, or `factory lint` and
  `factory plan` name it as declared without effect.
- **Slices:**
  - [x] The foreman gives the stage's agent its MCP servers in its ACP session and writes its skills into the
    session's folder, also in a sandbox, whose egress allows the remote MCP servers' hosts (ADR 0112, `SCN-FORE-142`,
    `SCN-FORE-143`). It resolves them itself, not with factory-spec, which it may not import.
  - [x] The next stage's prompt holds the last message of the stage before it, or a file of the run's folder that the
    reference prompts name.
  - [x] `factory lint` warns about a `cron` automation without `--gh-aw`, and about `benchmarks` and `scorers` that no
    job of the profile runs (until T-31).
  - [x] An agent's `repositories` take effect in a run: the foreman clones each one, shallow, below `repositories/<name>`
    of the session's folder before the turn, also in a sandbox (ADR 0126, `SCN-FORE-159`).

### [x] T-45 · the requester hears about the run (P1)

- **Problem:** intake answers a Slack mention with the work item's ID and, when the run finished, with its pull
  request. A person hears nothing when the run starts, waits at a gate or fails, and an issue gets no comment at all.
- **Done when:** the origin of each request of a work item, a Slack thread or an issue, gets one message when its run
  is blocked and one when it ended, with the reason of a failure and a link to the run in the console.
- **Slices:**
  - [x] `run.completed@v1` with the outcome `failed` or `cancelled` adds a reply with the failed stage (SCN-INTAKE-057).
  - [x] A comment on the issue of a work item through the forge port (SCN-INTAKE-059, SCN-FORGE-034).
  - [x] An event when a run blocks at a gate or at checks: a gate through `gate.requested@v1` (SCN-INTAKE-058, ADR
    0113), checks through the foreman's `run.blocked@v1` (SCN-FORE-160, SCN-INTAKE-066, ADR 0127).
  - [x] The reason of a failure: `run.completed@v1` has the failed stage's `reason`, and the reply names it
    (SCN-FORE-160, SCN-INTAKE-066, ADR 0127).

### [x] T-46 · the dogfood factory in sandboxes (P1)

- **Problem:** the agents of `deploy/dogfood/factory/` declare no sandbox. They run in the foreman's container with
  its forge tokens and the master key of `litellm`, against P11, and `deploy/README.md` says so.
- **Done when:** every stage of the dogfood factory runs in a sandbox as the reference factory's stages do, and the
  warning leaves `deploy/README.md`.
- **Slices:**
  - [x] The agents get `sandbox` and `secrets`; the egress allows what `make install` and `make verify` of this
    repository need.
  - [x] SCN-DIST-015 plans the changed factory.

### [x] T-47 · a first run without guessing (P1)

- **Problem:** next to T-30: the root `README.md` has no path to a running factory. The reference `groups.json` names
  a Slack user that does not exist, so the first gate asks nobody. The chart requires the Slack secrets, while the
  Compose profile takes gates on pull requests alone.
- **Done when:** the root README leads to the quick start in three lines, `console doctor` fails on an approver group
  without a real member, and the chart installs with `secrets.forgeToken` and without Slack.
- **Slices:**
  - [x] "Run a factory" in `README.md`, with a link to `deploy/README.md`.
  - [x] `console doctor` and gatekeeper's start name a group whose members are the example's (`SCN-CONSOLE`,
    `SCN-GATE`).
  - [x] The chart takes Slack, a forge token or both, as `compose.yaml` does (`SCN-DIST`).

### [x] T-48 · lists that stay fast (P2)

- **Problem:** `GET /v1/runs` asks Temporal once for each run and has no page (`list` in
  `modules/foreman/src/commands/runs.ts`); the console calls it every 10 seconds. intake's inbox is cut at 50 work
  items without a way to the next ones (`latest` in `modules/intake/src/adapters/store.ts`).
- **Done when:** both lists take a page size and a cursor, and the console's runs page loads 1000 runs' first page in
  under a second in a measured run.
- **Slices:**
  - [x] `limit` and `cursor` on `GET /v1/runs` and `GET /v1/inbox` (`contracts/typespec/`, SCN-FORE-144 to -146,
    SCN-INTAKE-060 to -062, ADR 0115).
  - [x] The run list reads what it shows from Temporal's visibility, without a query per run: each run keeps its view
    in its memo (ADR 0115).
  - [x] The console's pages link the next page (SCN-CONSOLE-057, -058).

### [x] T-49 · events that are not lost without a trace (P2)

- **Problem:** the stream `OSF` has no limit of age or size, so it grows until the disk is full. An event that failed
  5 times is dropped with a warning in the log only, and intake's outbox keeps every published row.
- **Done when:** the stream has a limit, a dropped event can be found and sent again, and a health check fails while
  dropped events wait.
- **Slices:**
  - [x] `max_age` of the stream as a setting, with a default in the profile and the chart (ADR 0116).
  - [x] A subject for events that reached `max_deliver`, and a check of `/v1/health` on intake and the foreman.
  - [x] intake removes published rows of the outbox after a time.

### [x] T-50 · current status lines, again (P2)

- **Problem:** all 82 scenarios of `docs/vision/software-factory.feature` are `@status=planned`, and 14 of them have
  no module scenario with `@realizes=` for them. T-22, T-26 and T-29 are open with every slice ticked. T-24 and T-29
  name Phoenix, which Jaeger replaced (ADR 0100). T-33 fixed the status lines once; nothing keeps them right.
- **Done when:** a check fails when a vision scenario's status differs from the module scenarios that realize it, and
  this file's open items have an open slice.
- **Slices:**
  - [x] A report of the vision scenarios with the module scenarios that realize each, from spec-trace's parser
    `@opensoftware/spec-files`, in `make docs`: `docs/vision/README.md` (ADR 0117, SCN-REPO-127).
  - [x] A check on that report, and on an item of this file that is open without an open slice (`SCN-REPO`): VISION
    and TODO (ADR 0117, SCN-REPO-128 to -131). The 68 vision scenarios with realizing scenarios that are all
    implemented say `implemented`; the 14 without one stay `planned`.
  - [x] Tick or correct T-22, T-26 and T-29, and name Jaeger in T-24 and T-29.

## Wave 6 · the factory UI: sign in, secrets, skills

The console becomes the face of the product. A person signs in, stores the secrets the agents need and gives agents
their skills, in a UI that looks and feels like one product. The wave starts small: every screen that ships works. No
placeholder, no "coming soon", no empty menu entry.

### Decided by the owner (November 2026)

Do not reopen these in an item. Change one only with the owner, and then here first.

| Question | Decision |
| --- | --- |
| A change to the factory from the UI | Git stays the source of truth (P3). The UI opens a pull request on the factory's repository, and the forge merges it when its checks are green. The UI shows the state of each change and links the pull request when it fails. The signed-in person is the approver and needs the role `admin` or `factory-engineer`; the pull request names the person. |
| UI stack | Astro, with pages rendered on the server. An island (SolidJS) only where the browser must react without loading a page. Tailwind CSS. No single-page app; keep the frontend simple. |
| Sign-in | The console's own sign-in with OpenID Connect (Google, a company's provider) and GitHub. No password, no mail server. |
| Who may sign in | A file with people and roles in the factory's Git repository. |
| Where secret values live | OpenBao, in the Compose profile and in the chart. |
| First installation | A laptop or a private network: `localhost`, no TLS and no public URL in this wave. |
| Look | "Precise industrial": dense, calm, almost one colour with one signal colour, a monospace face for IDs, states and versions. Dark by default, with a light theme. |
| Design system | Mock-ups first, approved by the owner. Then tokens and components as code in a shared package. |
| Tests | Pages over HTTP, as today. A browser only for the main user flows and for islands. An island is tested as a whole, never the components inside it. No pixel comparison. |
| First release | Sign-in, the shell, the runs list, Secrets and Skills. The other pages keep their URLs and their old look and move one at a time. |
| Where skills come from | Folders in the factory's repository, and skills of other Git repositories pinned by commit in `factory.lock`. |

### How the parts connect

```text
browser ─────────────▶ console            the only server a browser reaches: pages, forms, the session cookie
                         ├─ HTTP with a service token and the person ─▶ foreman, intake, gatekeeper (as today)
                         ├─ secrets adapter, a program ─▶ OpenBao       writes values, lists names, cannot read a value
                         ├─ forge adapter, a program ───▶ the forge     commit, pull request, merge when green
                         └─ git fetch ──────────────────▶ the factory's repository: factory.yaml, access.yaml, skills
identity provider ◀──── redirects of the sign-in ────▶ console
sandbox's egress proxy ─ reads ─▶ OpenBao  as today: it swaps the placeholder for the value on the way out
```

- **No API gateway, and no module API that a browser calls.** The console is the backend of the browser: it holds the
  session and every service token, and calls the modules on the internal network. The modules keep their HTTP APIs
  and tokens as they are. A team's own UI or script uses those APIs with a token, as today
  (SCN-FACTORY-ACCESS-002). A gateway product is one more service to run and configure for one browser client;
  revisit it when a second browser client or a public API for many callers exists.
- **The console keeps no database.** The session is an encrypted cookie. Who may sign in is a file in Git. A secret's
  value is in OpenBao. The state of a change is its pull request on the forge. Each of these has one owner outside the
  console, so the console scales by starting it twice and loses nothing when it restarts.
- **A page renders on the server and works without script.** A form is an HTML form that answers with a redirect. An
  island adds comfort, like a live state or a menu on a phone; no feature depends on one.
- **Each feature belongs to the part that owns its subject.** The secret store's operations belong to the secrets port
  and its adapter. The rules of a skill and of the access file belong to `contracts/` and factory-spec's `lint`. A
  commit and a merge belong to the forge port. The console only shows and asks.

### Order

T-51 first; it holds no code. Then T-52, T-53 and the first slice of T-54 side by side (console, testkit, the mock-ups).
Then T-55. T-56 and T-57 start with slices outside the console (the secrets port and adapter, the forge port, the
library), which run side by side with T-55. T-58 needs T-57. T-59 and T-60 come last. Only one agent changes the
console at a time (root `AGENTS.md`), so the console slices of T-52, T-55, T-56, T-57 and T-58 run one after the other.

### [ ] T-51 · the web concept: vision scenarios and decisions (P0)

- **Problem:** this wave changes three things that the repository states as rules. P3 and SCN-FACTORY-CODE-002 say
  that the UI only shows the factory. ADR 0072 says that the console needs no script in the browser and no build step.
  ADR 0089 says that the console has no sign-in of its own. Without one written concept, each item decides them again.
- **Build:** documents only, no code.
- **Done when:** the vision scenarios, the ADR and the architecture page are merged, and the items below name them.
- **Slices:**
  - [ ] New vision scenarios in `docs/vision/software-factory.feature`, `@status=planned`, `@evidence=derived`, then
    `make docs`. Write at least these, with the next free number of each area:
    - RUNTIME: only a person on the factory's access list signs in to the factory UI.
    - RUNTIME: a person stores the value of a secret in the factory UI; no page, log or agent shows it again; an agent
      that declares the secret uses it in its next run.
    - CODE: a factory engineer changes the factory in the UI; the change is a pull request that merges when its
      checks pass, names the person, and is the factory version of the next run.
    - CODE: a skill declares the secrets and hosts it needs; the factory refuses a definition whose agent lacks one.
    - ACCESS: the factory UI works on a phone.
    SCN-FACTORY-RUNTIME-009 (roles) and SCN-FACTORY-ROLE-002 (a factory engineer tunes skills) exist and are
    `planned`; this wave realizes them. SCN-FACTORY-CODE-002 stays: an agent's configuration page is still read-only
    and links to Git.
  - [ ] One ADR for the concept under "How the parts connect": the console as the backend of the browser, no gateway,
    no database, pages on the server. It supersedes the parts of ADR 0072 and ADR 0089 that this wave changes; an
    accepted ADR is never edited. Options to compare: an API gateway (Envoy, Traefik, agentgateway), module APIs open
    to the browser with CORS and a token of the person, the console as the backend.
  - [ ] A page `docs/architecture/web.md` with the diagram above, the request path of a page, of a form and of a
    change, and the three kinds of UI test (T-53). Update the row "Web UI" in `docs/architecture/stack.md`, the console's
    row in `docs/architecture/components.md` and in `docs/explanation/module-tiers.md`, the wording of P3 in
    `docs/principles.md` ("the UI shows them and proposes a change as a pull request"), and the glossary: island,
    page scenario, journey scenario, island scenario, access file, change.

### [ ] T-52 · Astro in the console (P0)

- **Problem:** the console's pages are Preact components written with htm, which Fastify routes render, styled by
  Pico CSS, without a build step (ADR 0072). The repository's tooling knows only `.ts` files: `tools/checks/quality.ts`
  skips other files, and ARCH and BOUNDARY read TypeScript with dependency-cruiser.
- **Build:** Astro in `modules/console`, with its Node adapter in middleware mode inside the Fastify server of
  `console serve`. Fastify keeps the CLI, `/v1/health`-style routes and every old page; Astro answers the routes of the
  new pages. The SolidJS integration for islands, and Tailwind CSS through its Vite plugin. The module's `build`
  script runs the Astro build, and the `bin` runs only built files (BOUNDARY-RUNTIME).
- **Adopt (check first, record in the ADR):** Astro, `@astrojs/node`, `@astrojs/solid-js`, Tailwind CSS. The owner
  chose Astro; the ADR still records what was compared: Preact with hand-made islands (today's stack), SvelteKit,
  React Router, Hono with JSX, htmx with Alpine.
- **Rules for the code:**
  - Logic lives in `.ts` files. A page's `.astro` file imports components and one function that returns the page's
    data as plain values; it shows them. No call of an API and no business rule in a template.
  - A form is an HTML form (an Astro action or a `POST` route) that answers 303 to a page, or a page that names the
    problem. It works with script turned off. The same-origin rule of ADR 0089 stays.
  - `modules/console/AGENTS.md` lists every island with the reason why a page load is not enough.
  - The console serves every font, style and script itself: no CDN, no request to another origin. It sends a
    Content-Security-Policy that allows only its own origin.
  - The layers of `architecture.json` get the pages and the islands; `domain` and `adapters` stay as they are.
- **Watch out:**
  - Astro, its adapter and Tailwind change between major versions. Read the docs inside the installed packages before
    you write configuration; do not trust what you remember.
  - `tsc` does not check `.astro` files: `astro check` joins the typecheck. Biome reads `.astro` files only in part;
    record what it covers.
  - Every check that reads source files needs a rule for `.astro` and `.tsx`: ARCH (dependency-cruiser does not read
    the imports of an `.astro` file), DUP, REACH and MUTATION. For each: teach the check the file type, or keep the
    file type free of logic and enforce that with a check. A rule that exists only as text is not done (root
    `AGENTS.md`, Hard rules).
  - REACH maps V8 coverage to source lines through source maps: the Astro build must write them for the server code.
  - Stryker mutates `.ts` and `.tsx`, builds once and switches mutants at run time (ADR 0061). Check that the switch
    survives the Vite bundle, and measure the build time.
  - The npm package must hold the built client files, since the profile's image installs the module from npm
    (`deploy/images/Dockerfile`); PROFILE pins the new version.
  - In middleware mode, Astro does not serve its own static files: Fastify does.
  - Each scenario starts one server. Measure the start of `console serve` before and after; the suite's budget is
    60 seconds for all scenarios (`modules/console/AGENTS.md`).
  - The existing scenarios of the console pass unchanged after every slice.
- **Done when:** one existing page is rendered by Astro with the new stack, its scenarios pass with their text
  unchanged, `make verify` passes, and the released image serves the page.
- **Slices:**
  - [ ] The ADR for the stack and for how each check treats `.astro` and `.tsx` files, with the measured build and
    start times.
  - [ ] The build: Astro behind Fastify in `console serve`, `astro check` in the typecheck, the layers, the checks'
    rules for the new file types (`SCN-REPO` scenarios for each changed check).
  - [ ] The first page on Astro: the smallest existing one (the health page is a candidate), with Tailwind and no
    design system yet. Its scenarios keep their text.
  - [ ] The package and the image hold the built files; the profile and the chart pin the release.

### [ ] T-53 · UI tests: pages over HTTP, journeys and islands in a browser (P0)

- **Problem:** no test of a module opens a browser; only proof uses Playwright, to capture evidence. The console's
  tests read the HTML of a page as text, table rows and links (`modules/console/system-tests/console.ts`), so a test
  breaks when the markup changes although the page still works. And no test can prove a sign-in redirect, an island or
  the layout on a phone.
- **Build:** three kinds of UI test in `@opensoftware/testkit`. Each is a system test: one scenario, one test, the
  built artifact from outside, and every check counts it (TRACE, STEPS, PASS, BUDGET, MUTATION).

  | Kind | Runs | Proves | Cost |
  | --- | --- | --- | --- |
  | Page scenario | The built console over HTTP; the test reads the HTML by role and name; no browser, no script | What a page shows and what a form does. The default. | As today |
  | Journey scenario | The built console with its fakes, in Chromium | One main flow of a person from start to end, across pages | Seconds |
  | Island scenario | One island of `@opensoftware/ui` on its page of the workbench (T-54), in Chromium | Everything the island does, as a whole | Under a second |

- **In the testkit:**
  - A page reader for HTTP: it fetches a page, parses the HTML and finds elements by role, accessible name, label and
    text; it follows a link and sends a form with its fields, and follows the redirect. Adopt a DOM parser and the
    queries of Testing Library's DOM package if they work without a browser; the test never names a CSS class.
  - `sut.browser`: Playwright with Chromium. One browser per test process and a new context per scenario, like the
    database per scenario of ADR 0129. The same queries as the page reader: role, name, label, text.
  - Determinism: the clock of the testkit, reduced motion, one fixed locale and time zone, named viewport sizes (phone,
    desktop). The context refuses every request that does not go to loopback and fails the scenario (NOREAL for the
    browser). An error in the browser's console or a failed request fails the scenario.
  - Accessibility: a helper that runs axe-core on the page a journey ends on; a violation fails the scenario.
  - REACH and MUTATION for code that runs in the browser: Chromium's V8 coverage through Playwright, mapped through
    source maps; Stryker's active mutant set in the page before its first script, and the mutants a scenario ran read
    back from the page. Verify in the installed Stryker how the instrumented code holds both.
  - Evidence instead of pixel tests: each journey writes its screenshots, and the pull request shows them through
    proof, so the reviewer sees the UI. This repository uses its own tool.
  - One Playwright version in the repository (proof pins `playwright-core`); `make install` installs its Chromium, and
    `.github/test-suites.yml` already has the field `browser`.
- **Rules (the owner's decision, write them into `docs/quality/testing-strategy.md`):**
  - A behavior is a page scenario unless it needs a browser.
  - A journey scenario only for a main flow. In this wave: sign in and land on the runs; store a secret; enable a
    skill and see the change go live; the shell on a phone. Keep the number of journeys small; a new one needs the
    reason in the module's `AGENTS.md`.
  - An island scenario for each island, at the level of the island. Only when the island needs nothing heavy: no
    server, no fake. An island that needs the console is proven inside a journey.
  - No test of a component inside an island, and none of a single `.astro` component. No component test that imports
    from `src/` (BOUNDARY).
  - A check, not prose: a UI test finds elements only by role, label or text (no CSS selector, no XPath, no test ID),
    never waits for time to pass, and uses only the named viewport sizes. Add it to `tools/checks/` with `SCN-REPO`
    scenarios.
- **What the new kinds replace:** no kind goes away. The smoke scenarios of `e2e/` prove the whole factory, not the
  UI. Unit tests stay excluded. When a page moves to Astro, its existing tests move from text comparison to the page
  reader; the scenario's text does not change and the test proves no less.
- **Watch out:**
  - A mutant reruns every scenario that reached its line. A journey costs seconds for each mutant, so server code must
    be reached by page scenarios first, and a journey stays short.
  - Scenario files share Vitest workers (ADR 0051): the browser belongs to the worker, the context to the scenario.
  - Never share a module process across scenarios (testing strategy, "Test speed").
  - Measure before the rules are final: the start of Chromium, a context, one journey, one island scenario. Write the
    numbers into the ADR and the testing strategy. The console's budget rises only with a measured reason.
- **Done when:** one page scenario, one journey scenario and one island scenario pass in `make verify` on CI with
  REACH and MUTATION counting them, the check on the queries exists, and the testing strategy names the three kinds.
- **Slices:**
  - [ ] The ADR: the three kinds, the adopted libraries, the measured times.
  - [ ] The page reader, and the console's shared readers on it (`SCN-TK` scenarios).
  - [ ] `sut.browser` with its guards, the accessibility helper and the screenshots as evidence (`SCN-TK`).
  - [ ] Coverage and mutants from the browser, counted by REACH and MUTATION (`SCN-TK`, `SCN-REPO`).
  - [ ] The check on the queries of UI tests, and the rules in `docs/quality/testing-strategy.md` and
    `docs/quality/checks.md`.

### [ ] T-54 · the design system: `@opensoftware/ui` (P0)

- **Tier / language / path / prefix:** optional · TS, Astro, SolidJS · `packages/ui/` · `SCN-UI` (a library without
  a `bin`, ADR 0039; add the prefix to `docs/reference/scenario-prefixes.md`)
- **Problem:** the console looks like Pico CSS's defaults. The product has a name and no icon, no colours and no type
  of its own, and no shared components, so each new page would invent its own.
- **Approved by the owner (14 November 2026):** the mock-ups of the direction "precise industrial": the brand sheet,
  the sign-in page, the shell with the runs list, Secrets, a skill's page, and the runs on a phone. They are a canvas
  outside the repository, so the first slice asks the owner for its export and commits it to `docs/design/` with the
  values below. From then on every agent works from a file in the repository. The approved values:

  | What | Value |
  | --- | --- |
  | Icon | A sawtooth factory roof with an open door, one shape in one colour, readable at 16 pixels. In a 32-pixel view box: `M4 27V15l8-6v6l8-6v6l8-6v18H4zM14 27v-5h4v5h-4z`, filled with the even-odd rule. |
  | Wordmark | "Open Software Factory" in the UI face, weight 600, beside the icon. |
  | Faces | IBM Plex Sans for text, IBM Plex Mono for what a person copies or compares: IDs, versions, names of secrets and skills, counts. Both are open-licensed (OFL). |
  | Dark theme (default) | Ground `#0C0D0F`, surface `#141619`, raised `#1B1E22`, line `#272B31`, strong line `#3A4048`, text `#E6E8EB`, muted text `#A0A7B1`, subtle text `#808894`. |
  | Light theme | Ground `#FAFAF9`, surface `#FFFFFF`, line `#E2E4E8`, text `#111316`, muted text `#555C66`, signal `#C4400A`. |
  | Signal colour | `#FF6B1A`. It means two things only: the main action of a page, and work that waits for a person. |
  | State colours | Running `#6CB0FF`, waits for a person: the signal colour, failed `#FF8F8A`. Complete and cancelled have no colour (muted and subtle text). Each state is a shape and a word, never colour alone. |
  | Shape | A 4-pixel grid, a radius of 4 pixels for controls and 6 for panels, lines instead of shadows, controls 44 pixels high. |
  | Type sizes | Page title 24, section title 16, text 14, secondary 13, labels 11 to 12 in mono with capitals and wide spacing. Sentence case everywhere. |
  | Layout | A navigation column of about 232 pixels on the left with the icon, the factory's name and version, the pages with a count of what needs attention, and the account at the bottom. On a phone: a top bar with a menu button, a list of cards in place of the table, the main action fixed at the bottom. |
  | Sign-in page | Two halves: the icon, the name, one sentence and the factory's stages as a line of stations on a fine grid; and the provider buttons with a plain refusal message. |

  These are the start of the tokens, not their final list: the contrast check below decides when a value must change.
- **Build:**
  - Tokens as CSS custom properties in Tailwind's theme, for dark and light: colour by meaning (surface, text, border,
    signal, and the states running, waiting, failed and done), the type scale, spacing on a 4-pixel grid, radius and
    motion. A page never names a raw colour.
  - Components as `.astro` files, built when a page of this wave needs them and not before: button, link, field with
    label, hint and error, input, select, switch, table, state badge, panel, page header, empty state, banner, dialog
    (the HTML `dialog` element), the shell with its navigation, an ID in monospace with a copy button, a time.
  - Islands in SolidJS, only the ones a page of this wave needs (candidates: the theme switch, the navigation on a
    phone, copy to clipboard, a live state).
  - The brand: wordmark and icon as SVG, readable at 16 pixels in one colour, with the favicon files.
  - The workbench: a static Astro site inside the package with one page per component and per state of an island. It
    is the reference of the design system and the place where island scenarios run (T-53). It is never part of the
    console.
- **Adopt (check first):** native HTML before a library (`dialog`, `details`, the popover API). For islands that need
  more: Kobalte, Ark UI or corvu (headless, SolidJS). Icons: Lucide. Fonts: open-licensed files that the package
  ships, such as Fontsource packages. Compare shadcn-style kits for SolidJS and say why a small own set is enough or
  not. Storybook was checked as the workbench: record why plain Astro pages are enough or not.
- **Checks to add (`tools/checks/`, `SCN-REPO`):**
  - Every pair of text and background tokens meets WCAG 2.2 AA contrast, in both themes.
  - No colour value and no font name outside the tokens file, in `packages/ui` and `modules/console`.
- **Watch out:**
  - Accessibility is part of each component: a visible focus, the keyboard, a state never shown by colour alone (icon
    and word too), reduced motion, touch targets on a phone.
  - The theme is set before the first paint, without a flash, and inside the Content-Security-Policy of T-52.
  - An Astro library ships its `.astro` sources; the console compiles them. Say in the ADR how BOUNDARY, REACH and
    MUTATION treat this library, and let Tailwind in the console scan the package's files.
  - It is a published package: `osf release-files` writes its release files (RELEASE), and its `AGENTS.md` sets the
    limits of DUP and MUTATION.
  - Do not build a zoo: a component without a page that uses it is removed.
- **Done when:** the pages of T-55 to T-58 use only its components and tokens, both checks pass, and each island has
  its island scenario.
- **Slices:**
  - [ ] The approved mock-up (the owner's export of the canvas) and its values in `docs/design/`, with a short
    `README.md` of the direction.
  - [ ] The ADR and the package: tokens, both themes, the brand files, the two checks.
  - [ ] The components and the workbench that the sign-in page and the shell need (with T-55).
  - [ ] The components that Secrets and Skills need (with T-56 and T-58).

### [ ] T-55 · sign-in, roles and the shell (P0)

- **Problem:** the product has no sign-in. The console trusts a header of a proxy that the team must run in front
  (`CONSOLE_USER_HEADER`, ADR 0089), every person behind it may do everything, and the first screen is a table in
  Pico CSS's defaults. SCN-FACTORY-RUNTIME-009 (roles) is still `planned`.
- **Build:**
  - **The access file.** `access.yaml` beside `factory.yaml` in the factory's repository: people by email, each with
    one role. Its schema is a new format in `contracts/` (TypeSpec, JSON Schema, fixtures), and `factory lint` checks
    it. The console reads it at sign-in and again for each request, with a short cache, so a removed person loses
    access after the next merge without a restart.

    | Role | May |
    | --- | --- |
    | `member` | See every page but Secrets; submit work; act on runs and gates, as a signed-in person does today |
    | `factory-engineer` | The same, and change the factory from the UI (T-57, T-58) |
    | `admin` | The same, and store and delete secrets (T-56) |

  - **The factory's files.** The console reads `factory.yaml`, `access.yaml` and the skills from a folder as today, or
    from `git+<url>#<ref>` as the foreman does (ADR 0124). Move the foreman's fetch into a library in `packages/`; a
    copy fails DUP.
  - **Sign-in.** OpenID Connect with the authorization code flow, PKCE, state and nonce; the provider's settings from
    its discovery document; the ID token checked for signature, issuer, audience and time. Only an email that the
    provider marks as verified counts, compared in lower case with the access file. GitHub has no OpenID Connect for
    sign-in: it is a second provider type that reads the person's verified primary email from GitHub's API.
  - **The session.** An encrypted, signed cookie with the email, the name and the end of the session: `HttpOnly`,
    `SameSite=Lax`, `Secure` when the console is served over HTTPS. No role in it; the role comes from the access file
    on each request. The key is `CONSOLE_SESSION_SECRET`. A page without a session redirects to `/signin` and comes
    back to the page the person asked for (local paths only); a form without a session answers 401, and without the
    role 403.
  - **The person in every action** stays `by: { kind: "person", id: <email> }` (ADR 0118), so the members of
    gatekeeper's groups file match the same emails.
  - **The sign-in page.** The first screen of the product: the icon, the name, one button per provider. A refused
    person reads why in plain words ("ada@acme.dev is not on this factory's access list") and where the list lives.
  - **The shell.** The layout of every new page: the navigation (Runs, Secrets, Skills; only what works and what the
    role may open), the factory's name and version, the account menu with the name, the role and "Sign out", the theme
    switch. On a phone the navigation folds away. A skip link, landmarks, and Astro's view transitions between pages.
    The pages that still have the old look stay reachable from the navigation.
  - **The runs list** `/` in the new look. Its scenarios keep their text.
  - **The profile.** `.env` gets the provider's issuer, client ID and client secret and the session key; a missing one
    is named. `deploy/README.md` shows the setup for Google and for GitHub with the callback on `http://localhost`.
    `console doctor` checks that the provider's discovery answers and that the access file has an admin.
  - **In the testkit:** `fakes.oidc()`, an identity provider that signs in the person a test names (discovery,
    authorize, token, keys), and the sign-in endpoints in `fakes.github`.
- **Adopt (check first):** `openid-client` with `jose` (a certified client, no database); Arctic; Better Auth and
  Auth.js (both want a database or an adapter); `oauth2-mock-server` for the fake. As services in front: oauth2-proxy,
  Pomerium, Authelia, Dex, Keycloak; they stay possible through `CONSOLE_USER_HEADER`. Prefer the smallest that needs
  no database.
- **Watch out:**
  - Google and most providers accept `http://localhost` as a callback, but no other host without HTTPS. A console on
    another host of a private network needs TLS, which is not in this wave: say so in the docs.
  - Some providers send no "verified" flag for the email. Do not guess: a provider without it needs an explicit
    setting that names the risk.
  - No first-person-becomes-admin rule. Without an access file, or without an admin in it, sign-in is refused and the
    page says which file is missing.
  - Never log a token, a code, a cookie or the client secret. The time of a token comes from `OSF_NOW` in tests.
  - `next` after sign-in takes only a path of the console (no open redirect). The state is used once.
  - `CONSOLE_USER_HEADER` keeps working for a team with a proxy, and the roles apply to it too. Decide in the ADR what
    happens when both are set.
  - The email is personal data: it is in the access file and in pull requests of the factory's repository. The docs
    say that this repository should be private.
- **Realizes:** SCN-FACTORY-RUNTIME-009, the new RUNTIME scenario of the access list and the new ACCESS scenario of
  the phone (T-51), SCN-FACTORY-VIS-001.
- **First scenarios:** a person on the access list signs in and lands on the runs; a person who is not on it is
  refused and reads why; an email that the provider did not verify is refused; a page without a session redirects to
  the sign-in and comes back; "Sign out" ends the session; a session past its end asks to sign in again; a person
  removed from the access file loses access without a restart; a member does not see Secrets and gets 403 for its
  form; the navigation shows only what works; on a phone the navigation folds away (journey); sign in and land on the
  runs (journey).
- **Done when:** the Compose profile on a laptop shows the sign-in page at its URL, a person of `access.yaml` signs
  in with Google or GitHub and sees the runs in the new shell, and nobody else gets past the sign-in.
- **Slices:**
  - [ ] The ADR: the library, the session, the roles, and the two ways to name the person.
  - [ ] The access file in `contracts/` and in `factory lint` (`SCN-CTR`, `SCN-FSPEC`).
  - [ ] The library that reads a factory from a Git remote, used by the foreman and the console.
  - [ ] `fakes.oidc()` and GitHub's sign-in in `fakes.github` (`SCN-TK`).
  - [ ] Sign-in, session and sign-out in the console, with the sign-in page (`SCN-CONSOLE`).
  - [ ] The roles on every page and form (`SCN-CONSOLE`).
  - [ ] The shell and the runs list in the new look, with the two journeys (`SCN-CONSOLE`).
  - [ ] The profile, the chart, `console doctor` and the docs (`SCN-DIST`, `SCN-CONSOLE`).

### [ ] T-56 · secrets from the UI (P1)

- **Problem:** an agent's secret gets its value from a variable or a file of the foreman's host
  (`ports/secrets/README.md`). To set or change one, a person edits `.env` and restarts the foreman. Nothing shows
  which declared secret has no value, so a run fails at its first turn. OpenBao is a provider, but only the chart
  knows it, and nothing writes to it.
- **What does not change:** an agent never holds a value. The sandbox holds a placeholder, and its egress proxy puts
  the value in on the way to the allowed hosts (ADR 0054). Which agent may use which secret stays in `factory.yaml`.
  The UI stores values; it does not grant them.
- **Build:**
  - **The secrets port gets a write side**, as commands of an adapter program, like the forge port: `put <name>` (the
    value on standard input only, never an argument or a variable), `list` (one line per secret with its name, the
    time and the person of the last change, and its version), `delete <name>`, `probe`. There is no command that
    prints a value. The `@conformance` scenarios go to `ports/secrets/features/` with the reserved prefix
    `SCN-SECRET`.
  - **The adapter** `adapters/secrets/openbao/` (`skills/new-module`, its own prefix): KV version 2, the value in the
    field `value` that the egress proxy already reads, the person in the secret's metadata.
  - **Two tokens with two policies.** The console's token may write and delete values and read names and metadata; it
    may not read a value. The egress proxy's token may only read. So a fault in the console cannot show a secret.
  - **In the testkit:** `fakes.openbao()`, the real OpenBao binary in development mode, pinned by `make install`, one
    server per test process and a mount per scenario (ADR 0049, ADR 0129).
  - **The profile.** An `openbao` service in `deploy/compose/compose.yaml` with its data on a volume, a job that
    creates the mount, the two policies and the two tokens, and the foreman's `OSF_OPENBAO_ADDR` and
    `OSF_OPENBAO_TOKEN`. The reference factory declares the provider `openbao` and its agents' secrets as
    `ref:openbao/<name>`; `ref:env/<NAME>` keeps working. The chart takes its own OpenBao or the team's. OpenBao's
    audit log is on.
  - **The page `/secrets`** (role `admin`). One list of the secrets that the factory's agents declare and of the names
    in the store, each with a state: "set" (who and when), "missing" (declared without a value; names the agents and
    skills that need it) or "not used" (stored, declared by no agent). A form sets or replaces a value in a field that
    never shows it again; "Delete" asks first. Secrets of the providers `env` and `file` are listed as set outside the
    UI.
  - **`console doctor`** fails with the name of each declared `openbao` secret without a value.
- **Adopt (check first):** OpenBao (chosen, already in `docs/architecture/stack.md`); a client library for it against
  plain HTTP calls; how the chart's OpenBao is installed today. For unsealing on one machine: OpenBao's own automatic
  unseal for a single node if the pinned version has one; otherwise say which key the operator keeps and where.
- **Watch out:**
  - A value appears nowhere: no page, no redirect URL, no log line, no error text, no trace, no run record, no test
    report. One scenario stores a value and searches every output of the console and the adapter for it.
  - The server does not log request bodies. The field has no autocomplete. The body has a size limit.
  - The egress proxy swaps a placeholder in an HTTP request. A secret that is not sent in an HTTP request (an SSH key,
    a database password) does not work this way; the page and the docs say so.
  - These are the agents' secrets. The modules' own tokens and the provider keys of the inference gateway stay in
    `.env` in this wave.
  - Check in `packages/sandbox-egress` when a changed value takes effect (at the start of a sandbox or per request)
    and say it on the page.
  - A name follows the pattern of `SecretReference` in `contracts/typespec/factory-definition.tsp`.
  - The console's OpenBao token and the unseal key are credentials: `.env` and the operator's safe only. The docs
    describe a backup of the volume and the key.
- **Realizes:** SCN-FACTORY-RUNTIME-006, the new RUNTIME scenario of the stored secret (T-51), P11.
- **First scenarios:** `put` then `list` names the secret without its value; `put` twice makes a second version;
  `delete` removes it; no command prints a value; the console's token cannot read a value; an admin stores a value and
  the list says "set" with the person; the value is in no output; a declared secret without a value says "missing"
  with its agents; a stored secret that no agent declares says "not used"; a member gets 403; a sandboxed agent's
  request carries the stored value at the allowed host; store a secret (journey).
- **Done when:** on the Compose profile, an admin stores the value of a secret that an agent of the reference factory
  declares, and the next run's request to the allowed host carries it, with no restart and no edit of `.env`.
- **Slices:**
  - [ ] The ADR; the port's write side and the adapter `secrets-openbao`, with `fakes.openbao()` (`SCN-SECRET`, the
    adapter's prefix, `SCN-TK`).
  - [ ] OpenBao in the Compose profile and the chart, the policies, the reference factory on `ref:openbao/`
    (`SCN-DIST`).
  - [ ] The page `/secrets` with its journey (`SCN-CONSOLE`).
  - [ ] The check of `console doctor`, and one smoke scenario in `e2e/` from a stored value to a sandbox's request
    (`SCN-CONSOLE`, `SCN-E2E`).

### [ ] T-57 · a change to the factory from the UI is a pull request (P1)

- **Problem:** `factory.yaml` changes only by hand in Git. The forge port cannot commit a file and cannot ask the
  forge to merge when the checks pass (`ports/forge/README.md`). In the Compose profile the factory is a local commit
  in a volume (the service `factory-repo`), so there is no pull request to open.
- **Build:**
  - **The forge port:** `commit <repo> <branch> --message <text> <path>=<file>...` writes one commit with these files
    to a branch that exists; `merge` gets an option that asks the forge to merge when the checks pass, and merges at
    once when they already did; a line of `prs` gets the state of the checks of its head and the time of the merge.
    `@conformance` scenarios, in both adapters and in `fakes.github`.
  - **A library in `packages/`** for edits of `factory.yaml` that keep comments, order and anchors: add and remove a
    skill, a secret reference and an egress host of an agent. The console may not import factory-spec (ISOLATION).
    factory-spec offers the same edits as a command, for people and for observer.
  - **The flow in the console** (roles `admin` and `factory-engineer`): a form posts the change; the console reads
    the newest commit of the main branch, makes the edit, creates the branch `console/<what>-<short hash>`, commits,
    opens the pull request with what changes and who asked for it, asks the forge to merge when green, and answers 303
    to `/changes`.
  - **The page `/changes`:** the pull requests whose branch starts with `console/`, newest first, like the inbox
    lists `observer/` (ADR 0073). The states: "checking", "live" with the factory version, "failed" with the name of
    the failed check and the link to the pull request, "conflict", "closed". A change that is not live yet also shows
    where it applies, for example beside the skill. While a change is checking, the page reloads itself.
  - **The factory's repository needs a check.** A workflow in the reference factory's folder runs `factory lint` and
    `factory plan` as the check `factory`, and the main branch requires it (the port's `protect`). `console doctor`
    fails when the main branch requires no check, and the console then refuses to open a change.
  - **The profile:** the foreman and the console read the factory from the forge's repository (`git+<url>#main`,
    ADR 0124). A factory from a local folder (`FACTORY_DIR`) keeps working: the pages then show the factory, offer no
    change and say why.
- **Adopt (check first):** the forge's own merge-when-green (GitHub's auto-merge, Forgejo's merge when checks
  succeed) before any loop of our own; the `yaml` package's document API for edits that keep comments (already a
  dependency); factory-spec's GitHub Action for the check, if it has one.
- **Watch out:**
  - The console keeps no state and runs no loop. The forge merges; the page asks the forge when it is opened.
  - GitHub's auto-merge waits only when the branch has a required check that is not green yet; it also needs the
    repository's setting that allows auto-merge. Without a required check the pull request would merge unchecked: this
    is why the console refuses.
  - The reference factory shares one list between agents through YAML anchors (`secrets: &secrets`). An edit for one
    agent must not change another: give the agent its own list first.
  - Two changes at the same time: the second may conflict. One change per pull request; "Try again" makes a new pull
    request from the newest commit.
  - The console's forge token now writes: contents and pull requests of the factory's repository, nothing else. Say
    which permissions a GitHub fine-grained token or app needs; the inbox's read-only token is another one.
  - The pull request's author is the token's user; the person is in the body and in a trailer of the commit. No text
    of a form goes into YAML, a branch name or Markdown without escaping.
  - A run keeps the factory version it started with (ADR 0110). The page says that a change is live for the next run.
  - observer's proposals keep their review by a person. Merge-when-green is only for a change that a signed-in person
    made in the console. P15's wording changes in T-51.
  - Not in this item: changing `access.yaml` from the UI.
- **Realizes:** the new CODE scenario of the change from the UI (T-51), SCN-FACTORY-RUNTIME-009.
- **First scenarios:** `commit` writes the files to the branch in one commit; merge-when-green merges after the check
  passes and does not merge while it fails; the edit of one agent keeps comments and leaves an agent that shared the
  list unchanged; a factory engineer's change opens a pull request that names the person; a member gets 403; a change
  whose check passes shows "live" with the new factory version; a change whose check fails shows "failed" with the
  check and the link; a repository without a required check refuses a change and says why; a factory from a local
  folder offers no change.
- **Done when:** on the Compose profile with a factory repository on GitHub or Forgejo, a factory engineer changes
  the factory in the UI, the pull request merges after its check without another click, the page shows "live", and
  the next run has that factory version.
- **Slices:**
  - [ ] The ADR; `commit`, merge-when-green and the new fields of `prs` in the forge port, both adapters and
    `fakes.github` (`SCN-FORGE`, `SCN-FGITHUB`, `SCN-FFORGEJO`, `SCN-TK`).
  - [ ] The library for edits of `factory.yaml`, and factory-spec's command on it (its own prefix, `SCN-FSPEC`).
  - [ ] The check `factory` and the required check in the reference factory; the profile reads the factory from the
    forge (`SCN-DIST`).
  - [ ] The flow and the page `/changes` in the console, and `console doctor` (`SCN-CONSOLE`).

### [ ] T-58 · skills: a format, sources and the catalog (P1)

- **Problem:** a skill is a path in `factory.yaml` (`skills: [./skills/x]`). `factory lint` does not read it.
  Nothing says which secret or host a skill needs, so a skill fails inside a run. Sharing a skill between factories
  means copying its folder. The UI shows no skill.
- **Where a skill is switched on:** for an agent of a factory, as `factory.yaml` already says. There is one foreman
  per factory, and it gives each stage's agent the skills that agent declares (ADR 0112). "For all agents" is one
  change with one edit per agent.
- **Build:**
  - **The format.** A skill is a folder with a `SKILL.md` in the Agent Skills format (agentskills.io): front matter
    with `name`, equal to the folder's name, and `description`, which says what the skill does and when to use it; a
    short body; details in files beside it that the agent reads when it needs them. What the factory adds goes into
    the format's own place for extensions (`metadata`): the secrets and the hosts the skill needs. A `SKILL.md` stays
    valid for every harness. Fix the key names in the ADR.
  - **`factory lint` reads skills:** the file exists, the front matter is valid, the name fits, the size stays inside
    the format's limits; an agent that uses a skill declares a secret for each secret the skill needs and allows each
    host in its sandbox's egress. A finding names the agent, the skill and what is missing.
  - **Skills of other repositories.** An agent's `skills` entry may name a folder of another Git repository at a ref
    (fix the form in the ADR, in line with `git+<url>#<ref>`). `factory plan` writes its commit and a hash of its
    files to `factory.lock` (an added field: a minor version of the contract). The foreman fetches it at that commit
    and refuses a reference without a pin, as it does for an MCP server of the registry (ADR 0112). `factory render`
    links it for a person's checkout.
  - **The page `/skills`:** every skill the factory can use, from the folders of its repository and the pins of its
    lock: name, description, source with its commit, the agents that use it, and what it needs, with the state of
    each secret from T-56. `/skills/<name>` shows the `SKILL.md` as rendered Markdown and its files, and one switch
    per agent. A switch is a change of T-57. When the agent lacks a secret reference or a host that the skill needs,
    the change adds them, and the page lists them before the person confirms.
  - **This repository's own skills** pass the new rules of `factory lint`.
- **Adopt (check first):** the Agent Skills specification and its reference validator (`skills-ref`); how Claude
  Code, Codex and OpenCode read skills today (ADR 0112); the `skills` command line of Vercel and the plugin
  marketplaces as prior art for sources and pins; a Markdown renderer with a sanitizer.
- **Watch out:**
  - A skill is instructions and scripts that an agent follows. A skill of another repository is a supply-chain risk:
    pin a commit, never follow a branch at run time, show what an update changes, and show the hosts and secrets it
    asks for before it is switched on.
  - A host added to an agent's egress widens what the sandbox can reach. The pull request's text lists each added
    host and secret in plain words.
  - The page renders Markdown from a repository: sanitize it, no raw HTML, no script, no remote image.
  - The foreman reads skill files as UTF-8 text (ADR 0112). A skill with a binary file fails `lint` until that
    changes.
  - Two skills with one name, one local and one from another repository: `lint` refuses.
  - Not in this item: an editor for `SKILL.md` in the UI, and adding a skill of another repository from the UI. Both
    are changes in Git first.
- **Realizes:** SCN-FACTORY-ROLE-002, SCN-FACTORY-CODE-001, the new CODE scenario of what a skill needs (T-51).
- **First scenarios:** `lint` refuses a skill without a description; `lint` names the secret an agent lacks for its
  skill; `plan` pins a skill of another repository; the foreman refuses a skill without a pin; a run's agent finds a
  pinned skill in its session; the catalog lists each skill with its agents and its needs; a skill's page shows a
  missing secret; a factory engineer switches a skill on for an agent and the change lists the added secret and host;
  the page's Markdown shows no script; enable a skill and see the change go live (journey).
- **Done when:** on the Compose profile, a factory engineer switches a skill on for one agent in the UI, an admin
  stores the secret it needs, and the agent's next run has the skill in its session and its request carries the
  secret.
- **Slices:**
  - [ ] The ADR; the format and its rules in `factory lint`; this repository's skills pass (`SCN-FSPEC`).
  - [ ] Skills of other repositories: the entry's form, `factory.lock`, `plan`, `render` and the foreman
    (`SCN-CTR`, `SCN-FSPEC`, `SCN-FORE`).
  - [ ] The pages `/skills` and `/skills/<name>`, read-only (`SCN-CONSOLE`).
  - [ ] The switch per agent as a change of T-57, with its journey (`SCN-CONSOLE`).

### [ ] T-59 · the remaining pages in the new look (P2)

- **Problem:** after T-55 the run page, the work form, the inbox, the factory pages, the improvement page and the
  health page still have the old look, and the console carries two stacks.
- **Build:** move one page per slice to Astro and the design system. A scenario keeps its text; its test moves to the
  page reader (T-53) and proves no less. When the last page moved, remove Preact, htm and Pico CSS and the route
  `/pico.css`; the route is part of the public surface, so its scenario becomes `deprecated` in the same change.
- **Watch out:** a page that shows nothing useful for a setting that is not there stays out of the navigation, as
  today's 404 of the inbox without its repository. The reload of the runs every `CONSOLE_REFRESH` seconds stays until
  the foreman has a stream of run changes; a live island is its own item then.
- **Done when:** no page uses Pico CSS, and `modules/console/package.json` has no dependency on Preact or htm.
- **Slices:**
  - [ ] The run page with its forms.
  - [ ] The work form and the inbox.
  - [ ] The factory pages and the improvement page.
  - [ ] The health page, if T-52 did not move it; then remove the old stack.

### [ ] T-60 · the person, proven to every module (P2)

- **Problem:** foreman, intake and gatekeeper trust the caller to name the person: anyone with a module's API token
  can act as any person (ADR 0118, "Revisit when"). With a sign-in of its own, the console can prove who acted.
- **Build:** the console signs a short-lived token for the signed-in person, and each module checks it for an action
  that names a person. The formats are in `contracts/`. Needed before a console is reachable from the internet.
- **Done when:** a call with a module's API token and a made-up person is refused by foreman, intake and gatekeeper.
- **Slices:**
  - [ ] The ADR and the contract.
  - [ ] The console signs; foreman, intake and gatekeeper check (one slice per module).

### Not in this wave

Each needs its own item, a vision scenario first: a console on a public URL (TLS, rate limits); passkeys; changing
`access.yaml` and adding a skill of another repository from the UI; the modules' own tokens and the inference
gateway's provider keys in OpenBao; live updates of the runs without a reload; a command palette; a second approver
for risky changes of the factory, as a policy of gatekeeper.

---

## Paid runs (last; started by a maintainer, manual)

Everything that needs a paid model call or a paid service, so the plan never waits for it. A maintainer starts each
run by hand, after the owner agreed on the model and the budget.

### [x] T-21 · dogfood with paid services

Slices that need a paid model call or a paid service. They come last, so the plan does not wait for them. Ask the
owner before each slice: which model or service, and its budget.

- **Slices:**
  - [x] scorekit (from T-07): `weekly-paid.yml` scores this repository's `runs/` weekly with every scorer of the pack on
    OpenRouter, `scorekit score --model` (`SCN-SCORE-046`), and the README links the report (ADR 0077).
  - [x] taskcapture (from T-09): the weekly job `models` of `taskcapture-suite.yml` runs opencode with a real model
    on OpenRouter on the small `prompt-injection` task, next to the oracle and reports it in the job summary (ADR 0077).
  - [x] taskcapture route (from T-09): the owner's one model is enough; the weekly models job routes with the
    report's pick (ADR 0077).
  - [x] effort (before the foreman slice): every agent of `factory.yaml` declares its `effort` (`low` to `max`, required;
    contracts 2.0.0); the foreman hands it to each stage as `OSF_EFFORT`, and claude-code, codex and opencode map it to
    their own setting; the console's factory page shows it (ADR 0078, `SCN-CTR-012`, `SCN-FSPEC-058`, `SCN-FORE-069`,
    `-070`, `SCN-TK-121`, `SCN-HCLAUDE-006`, `SCN-HCODEX-009`, `SCN-HOPENCODE-007`, `SCN-CONSOLE-036`).
  - [x] effort in the profile: once factory-spec, foreman and console are released on contracts 2.0.0, move the image
    pins of `deploy/compose/compose.yaml` and the Helm chart to them, and give the agents of the reference factory
    `deploy/compose/factory/factory.yaml` their levels: `high` for triage and ship (a small model), `medium` for spec,
    implement and review (a smart one). The released images before them reject `effort` as an unknown field.
  - [x] intake (from T-16): the Compose profile on a developer's machine takes the `issues` webhook of
    `sesigl/open-software-factory` through a smee.io relay; `INTAKE_WEBHOOK_SECRET` turns on the profile's
    `/forge/events` (`SCN-DIST-014`), and `deploy/README.md` describes the relay and the webhook (ADR 0065). Issue #150,
    labeled `factory`, became a work item. intake receives work only while the developer's machine runs the relay.
  - [x] harness (from T-12, T-20): `e2e/paid/` and the script `test:paid`: one SMOKE-PAID run for opencode, weekly on
    OpenRouter with `deepseek/deepseek-v4.1-flash-1017`, and one for claude-code on a developer's subscription with
    `claude-haiku-5-5` (ADR 0052, ADR 0053, ADR 0076, ADR 0077).
  - [x] codex (from T-12): a SMOKE-PAID run of harness-codex, weekly on OpenRouter's Responses API with
    `deepseek/deepseek-v4.1-flash-1017`; harness-codex adds a model Codex does not know to its model catalog, so Codex
    offers it apply_patch (`SCN-HCODEX-012`, ADR 0077). Done: run 43599387991 of `weekly-paid.yml` passed for codex.
  - [x] reference factory and foreman (from T-27, T-17): the reference factory on a sample repository, with a paid
    model. A maintainer starts `paid-reference-run.yml` (ADR 0128) with `gh workflow run paid-reference-run.yml -f
    ref=<branch>`; the foreman runs the implement stage on opencode with `deepseek/deepseek-v4.1-flash-1017` through
    LiteLLM (budget 0.50 USD) on an issue of a tiny sample repository in a Forgejo of the job. Done: run 43596073836
    opened the sample's pull request with `add(a, b)` and its test.

---

## After the plan: phase 3 and 4

When T-17 is done, follow `docs/explanation/bootstrapping.md`: the factory implements this repository's
`factory` issues with people at the gates, then observer improves our own `factory.yaml`. In phase 3 the factory
implements an issue labeled `factory` of this repository and opens its pull request, and a person reviews and merges
it; that run is not part of T-21. Add each new requirement as a vision scenario first, then as module scenarios and
a new item here.

Vision for later, not this plan (the owner's choice): once the factory's basic features are exposed in its UI, the
factory learns from its own work. The job `observe` of `weekly-paid.yml` already runs `observer analyze`, `observer
propose` and `observer check` on the weekly scores (ADR 0046, ADR 0077); phase 4 starts with the first merged observer
pull request whose effect `observer check` measures, on 20 scored runs before and after its merge.
