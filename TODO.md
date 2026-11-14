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
| A change to the factory from the UI | Git stays the source of truth (P3). The UI opens a pull request on the factory's repository, and it merges when its checks are green, without another person. The UI shows the state of each change and links the pull request when it fails. The signed-in person is the approver and needs the role `admin` or `factory-engineer`; the pull request names the person. |
| UI stack | Astro, with pages rendered on the server. An island (SolidJS) only where the browser must react without loading a page. Backend code first; no single-page app; keep the frontend simple. Tailwind CSS is the owner's candidate for styles; T-53's ADR compares it with plain CSS on the tokens. |
| Sign-in | The console's own sign-in with OpenID Connect (Google, a company's provider) and GitHub. No password, no mail server. |
| Who may sign in | A file with people and roles in the factory's Git repository. |
| Where secret values live | OpenBao, in the Compose profile and for the chart. |
| First installation | A laptop or a private network. No public URL in this wave. |
| Look | "Precise industrial": dense, calm, almost one colour with one signal colour, a monospace face for IDs, states and versions. Dark by default, with a light theme. The mock-ups are approved (T-54). |
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
                         └─ a folder, or git fetch ─────▶ the factory's files: factory.yaml, access.yaml, skills
identity provider ◀──── redirects of the sign-in ────▶ console
sandbox's egress proxy ─ reads ─▶ OpenBao  as today: it swaps the placeholder for the value on the way out
```

- **No API gateway, and no module API that a browser calls.** The console is the backend of the browser: it holds the
  session and every service token, and calls the modules on the internal network. The modules keep their HTTP APIs
  and tokens as they are. A team's own UI or script uses those APIs with a token, as today
  (SCN-FACTORY-ACCESS-002). A gateway product is one more service to run and configure for one browser client;
  revisit it when a second browser client or a public API for many callers exists.
- **The console keeps no database.** The session is an encrypted cookie. Who may sign in is a file in Git. A secret's
  value is in OpenBao. The state of a change is its pull request on the forge. Each has one owner outside the
  console, so the console can run twice and loses nothing when it restarts. Its only folder is a cache of the
  factory's repository, which it can delete at any time.
- **A page renders on the server and works without script.** A form is an HTML form that answers with a redirect. An
  island adds comfort, like a live state or copy to clipboard; no feature depends on one, and the first release has
  none.
- **Each feature belongs to the part that owns its subject.** The secret store's operations belong to the secrets port
  and its adapter. Reading a factory's files and their rules (skills, the access file, an edit of `factory.yaml`)
  belongs to one library that factory-spec, the foreman and the console share. A commit and a merge belong to the
  forge port. The console only shows and asks.
- **One factory.** `CONSOLE_FOREMAN_URL` may name several foremen, and the runs of all of them stay listed. Sign-in,
  roles, Secrets, Skills and changes belong to the one factory of `CONSOLE_FACTORY`: its access file, its repository
  and its mount in OpenBao (`OSF_OPENBAO_MOUNT`). A console for several factories is a later item; the mount per
  factory keeps that possible.

### The console's three modes

Today's behavior stays the default, so the README's quick start, the 86 existing scenarios and a fresh profile keep
working without an identity provider.

| Mode | Set by | What a person gets |
| --- | --- | --- |
| Open, read-only | Nothing (today's default) | Today's pages, read-only, as ADR 0072 says. Every page and form of this wave that needs a role (Secrets, the forms of Changes, the switches of Skills) answers 404, like the inbox without its repository. |
| Behind a proxy | `CONSOLE_USER_HEADER` (ADR 0089) | The person comes from the proxy's header. Without an access file, as today: every person behind the proxy acts as a `member`, and what needs `factory-engineer` or `admin` answers 404. With an access file, its roles apply, and a person who is not in it gets 403. |
| Own sign-in | One explicit setting that names this mode (T-56) | The sign-in page, the session and the roles. Every page needs a session. |

The own sign-in is switched on by name, never inferred from which other settings are present: with it on, a provider
setting that is missing stops the console at its start. So a lost setting can never open a console that was closed.
The profile and the chart switch it on only when the operator asks for it in `.env` or the values. A check of
`console doctor` exists only for what is turned on, so a fresh profile still passes.

### Order

One agent changes a unit at a time (root `AGENTS.md`), so each unit has one order. Items in different units run side
by side.

| Unit | Order of the slices |
| --- | --- |
| docs, `docs/vision/` | T-51 first, before anything else |
| `packages/testkit` | T-52 → T-56 (`fakes.oidc`, sign-in of `fakes.github`) → T-57 (`fakes.openbao`) → T-58 (`fakes.github`: commit, merge) → T-55 |
| `modules/console` | T-52 (its tests on the page reader) → T-53 → T-56 → T-57 → T-58 → T-59 → T-60 → T-61 |
| `packages/ui` (new) | T-54, its slices with T-56, T-57 and T-59; then T-55 with the first island |
| `packages/factory-files` (new) | T-56 (read a factory, the access file) → T-58 (edits) → T-59 (skills) |
| `contracts` | T-56 (access file) → T-59 (lock) → T-61 |
| `modules/factory-spec` | T-56 (`lint` of the access file) → T-58 (the check `factory`) → T-59 |
| `modules/foreman` | T-56 (uses the library's fetch) → T-57 (a stage without its secret) → T-59 (pinned skills) → T-61 |
| secrets port, `adapters/secrets/openbao` (new), `packages/sandbox-egress`, the two sandbox adapters | T-57 |
| forge port and its two adapters | T-58 |
| `deploy/`, `tools/` setup commands | T-53 → T-56 → T-57 → T-58, each after the release of the packages it pins |
| `e2e/` | T-57 → T-58 → T-59 |
| `tools/checks` | T-52 → T-53 → T-54 → T-55 |

After T-51, these start together: the first two slices of T-52, the first slice of T-53 and the first slice of T-54.
T-55 waits until a page needs its first island; the first release needs none (T-54). A slice of `deploy/` tests
released packages (ADR 0095): it starts when the release it pins is published (`skills/release-packages`). Each new
package (`ui`, `factory-files`, `secrets-openbao`) needs its ADR, `skills/new-module` and a first publish.

### [x] T-51 · the web concept: vision scenarios and decisions (P0)

- **Problem:** this wave changes three things that the repository states as rules. P3 and SCN-FACTORY-CODE-002 say
  that the UI only shows the factory. ADR 0072 says that the console needs no script in the browser and no build step.
  ADR 0089 says that the console has no sign-in of its own. Without one written concept, each item decides them again.
- **Build:** documents only, no code.
- **Watch out:** a vision scenario's tags are `@scenario_id=SCN-FACTORY-<AREA>-<NNN>`, `@status`, `@evidence` and
  `@source`. Its status follows its realizing scenarios (VISION, ADR 0117): a new `planned` module scenario with
  `@realizes=` sets an `implemented` vision scenario back to `planned` until it is implemented. So an item of this
  wave realizes only the scenarios it names under "Realizes", and never one that is `implemented` today unless the
  item says so.
- **Done when:** the vision scenarios, the ADR and the architecture page are merged, and the items below name them.
  Done: SCN-FACTORY-RUNTIME-010, RUNTIME-011, CODE-007, CODE-008, ROLE-003 and ACCESS-004, ADR 0130 and
  `docs/architecture/web.md`.
- **Slices:**
  - [x] New vision scenarios in `docs/vision/software-factory.feature`, `@status=planned`, `@evidence=derived`, then
    `make docs`. Every `@source` of the file is a time of the talk, and its header says so: give the owner's request of
    November 2026 a form of its own, like `@source=owner-2026-11`, and add it to the header's legend. Write at least these, with the next free
    number of each area:
    - RUNTIME: only a person on the factory's access list signs in to the factory UI.
    - RUNTIME: a person stores the value of a secret in the factory UI; no page, log or agent shows it again; an agent
      that declares the secret uses it in its next run.
    - CODE: a factory engineer changes the factory in the UI; the change is a pull request that merges when its
      checks pass, names the person, and is the factory version of the next run.
    - CODE: a skill declares the secrets and hosts it needs; the factory refuses a definition whose agent lacks one.
    - ROLE: a factory engineer gives an agent a skill in the factory UI.
    - ACCESS: the factory UI works on a phone.
    SCN-FACTORY-RUNTIME-009 (only authorized roles change a factory) exists and is `planned`; T-58 realizes it.
    SCN-FACTORY-ROLE-002 is about the model mix and its measurement; this wave does not realize it.
    SCN-FACTORY-CODE-002 stays: an agent's configuration page is still read-only and links to Git.
  - [x] One ADR for the concept under "How the parts connect" and "The console's three modes": the console as the
    backend of the browser, no gateway, no database, pages on the server. It supersedes the parts of ADR 0072 and
    ADR 0089 that this wave changes; an accepted ADR is never edited. Options to compare: an API gateway (Envoy,
    Traefik, agentgateway), module APIs open to the browser with CORS and a token of the person, the console as the
    backend.
  - [x] A page `docs/architecture/web.md` with the diagram above, the request path of a page, of a form and of a
    change, the three modes and the three kinds of UI test (T-52). Update the row "Web UI" in
    `docs/architecture/stack.md`, the console's row in `docs/architecture/components.md` and in
    `docs/explanation/module-tiers.md`, the wording of P3 in `docs/principles.md` ("the UI shows them and proposes a
    change as a pull request"), and the glossary: island, page scenario, journey scenario, island scenario, access
    file, change.

### [ ] T-52 · UI test tools in the testkit (P0)

- **Problem:** no test of a module opens a browser; only proof uses Playwright, to capture evidence. The console's
  tests read the HTML of a page with patterns for literal tags (`rows` in `modules/console/system-tests/console.ts`
  matches `<tbody>`, `<tr>` and `<td>` without attributes), so a test breaks when the markup changes although the page
  still works. And no test can prove a sign-in redirect, an island or the layout on a phone.
- **Build:** three kinds of UI test in `@opensoftware/testkit`. Each is a system test: one scenario, one test, the
  built artifact from outside, counted by TRACE, STEPS, PASS and BUDGET. A page scenario and an island scenario also
  count for MUTATION; a journey counts for no mutant. A journey is marked as one, for example with a tag
  `@kind=journey` that SPEC knows, so the mutation runner and the checks can tell it from a page scenario.

  | Kind | Runs | Proves | Cost |
  | --- | --- | --- | --- |
  | Page scenario | The built console over HTTP; the test reads the HTML by role and name; no browser, no script | What a page shows and what a form does. The default. | As today |
  | Journey scenario | The built console with its fakes, in Chromium | One main flow of a person from start to end, across pages | Seconds |
  | Island scenario | One island of `@opensoftware/ui` on its page of the workbench (T-55), in Chromium | Everything the island does, as a whole | Under a second |

- **In the testkit (this item):**
  - A page reader for HTTP: it fetches a page, parses the HTML and finds elements by role, accessible name, label and
    text; it follows a link and sends a form with its fields, follows the redirect, and keeps the cookies between
    the requests of one scenario, as a browser does. It also answers what today's tests ask of a document:
    its title, whether and when it reloads itself, its stylesheets, whether it has a script, and its forms (a form
    without a name has no role). Adopt a DOM parser and the queries of Testing Library's DOM package if they work
    without a browser; a test never names a CSS class or a tag.
  - `sut.browser`: Playwright with Chromium. One browser per test process and a new context per scenario, like the
    database per scenario of ADR 0129. The same queries as the page reader: role, name, label, text.
  - Determinism: the clock of the testkit, reduced motion, one fixed locale and time zone, named viewport sizes (phone,
    desktop). The context refuses every request that does not go to loopback and fails the scenario (NOREAL for the
    browser). An error in the browser's console or a failed request fails the scenario.
  - Accessibility: a helper that runs axe-core on the page a journey ends on; a violation fails the scenario.
  - Evidence instead of pixel tests: each journey writes its screenshots, and the pull request shows them through
    proof, so the reviewer sees the UI. This repository uses its own tool.
  - The mutation runner leaves a journey out of every mutant's run. Without this, each mutant of server code that a
    journey reached would start the console and Chromium again (ADR 0061). Server code is noticed by page scenarios.
  - One Playwright version in the repository (proof pins `playwright-core`). CI installs Chromium only for a suite
    with `browser`, through the existing action `capture-browser`; a developer installs it with a target of its own,
    not with `make install`.
- **Rules (the owner's decision; write them into `docs/quality/testing-strategy.md`):**
  - A behavior is a page scenario unless it needs a browser.
  - A journey scenario only for a main flow. In this wave: sign in and land on the runs; the shell on a phone; store
    a secret; switch a skill on and see the change go live. A new journey needs its reason in the module's
    `AGENTS.md`.
  - An island scenario for each island, at the level of the island. An island needs nothing heavy: it gets its data
    as properties on its page of the workbench, and one that loads data takes the address as a property, which the
    workbench points at a static file. No island is proven only by a journey.
  - No test of a component inside an island, and none of a single `.astro` component. No component test that imports
    from `src/` (BOUNDARY).
  - A check, not prose: a UI test finds elements only by role, label or text (no CSS selector, no XPath, no test ID),
    or the page reader's facts of the document, never waits for time to pass, and uses only the named viewport sizes.
- **What the new kinds replace:** no kind goes away. The smoke scenarios of `e2e/` prove the whole factory, not the
  UI. Unit tests stay excluded. The console's own readers move from tag patterns to the page reader in this item,
  before any page changes its markup; a scenario's text does not change and its test proves no less.
- **Watch out:**
  - Scenario files share Vitest workers (ADR 0051): the browser belongs to the worker, the context to the scenario.
  - Never share a module process across scenarios (testing strategy, "Test speed").
  - Measure before the rules are final: the start of Chromium, a context, one journey on the demo module. Write the
    numbers into the ADR and the testing strategy.
  - The testkit's suite in `.github/test-suites.yml` needs `browser: chromium`. The job of a mutation shard installs
    a browser only when the unit's own `package.json` names `playwright-core`
    (`.github/actions/mutation-shard/action.yml`): a unit that gets the browser through the testkit must be found too,
    and a check keeps that true.
- **Done when:** the testkit's own scenarios prove the page reader and `sut.browser` with its guards on its demo
  module, the console's 86 tests read pages through the page reader with their scenarios unchanged, the check on the
  queries exists, and the testing strategy names the three kinds.
- **Slices:**
  - [x] The ADR: the three kinds, the adopted libraries, the measured times (ADR 0131).
  - [x] The page reader (`SCN-TK`), and the console's tests on it: the shared readers in `system-tests/console.ts`
    and the 14 test files that match literal tags themselves. This is the only slice of the item that touches the
    console; it comes before T-53's page slice.
  - [x] `sut.browser` with its guards, the accessibility helper and the screenshots as evidence (`SCN-TK`), and the
    browser in the testkit's suite. proof shows the screenshots on the pull request once the first journey exists
    (T-56): no unit has one yet.
  - [ ] The mark of a journey and the runner that leaves journeys out of a mutant's run; the browser in the
    mutation shards of a unit that gets it through the testkit, with its check (`SCN-REPO`).
  - [ ] The check on the queries of UI tests (`SCN-REPO`), and the rules in `docs/quality/testing-strategy.md` and
    `docs/quality/checks.md`.

### [ ] T-53 · Astro in the console (P0)

- **Problem:** the console's pages are Preact components written with htm, which Fastify routes render, styled by
  Pico CSS, without a build step (ADR 0072). The repository's tooling knows only `.ts` files:
  `tools/checks/quality.ts` counts added lines only for files that end in `.ts`, `tools/checks/reach.ts` matches no
  `.tsx`, and ARCH, ISOLATION and BOUNDARY read TypeScript with dependency-cruiser. A `.tsx` or `.astro` file would
  pass every check today without being looked at.
- **Build:** Astro in `modules/console`, with its Node adapter in middleware mode inside the Fastify server of
  `console serve`. Fastify keeps the CLI, every old page, and for a new page the route itself: the route checks the
  session and the role, loads the page's data with the code of `commands`, `adapters` and `domain` as today, and
  hands it to Astro, which only renders the template. The SolidJS integration comes with the first island (T-55),
  not before. The module's `build`
  script runs the Astro build, and the `bin` runs only built files (BOUNDARY-RUNTIME).
- **Adopt (check first, record in the ADR):** Astro, `@astrojs/node`, `@astrojs/solid-js`, and Tailwind CSS or plain
  CSS on the tokens. The owner chose Astro; the ADR still records what was compared: Preact with hand-made islands
  (today's stack), SvelteKit, React Router, Hono with JSX, htmx with Alpine.
- **Rules for the code:**
  - A template holds no logic. A route in `.ts` computes plain values and passes them to the template (verify that
    the adapter's handler takes the page's data, Astro's `locals`). So REACH and MUTATION keep counting the logic as
    they do today, and a template never calls an API. "No logic" means: the part above the markup holds only imports
    and the page's data; an expression reads a property, loops over a list or switches on a boolean that the route
    computed. The check of the templates enforces exactly this.
  - A page keeps its HTTP status: many pages answer 404, 400, 502 or 503 with a page that names the problem. Check how
    the route sets the status of a page that Astro renders.
  - Astro's source folder is not `src/pages`: that folder is today's layer `pages` of `.ts` files, and Astro would
    treat each as a route. Use a folder of its own, like `src/web/`.
  - A form is an HTML form that answers 303 to a page, or a page that names the problem. It works with script turned
    off. The same-origin rule of ADR 0089 stays.
  - Every island lives in `@opensoftware/ui` (T-54). `modules/console/AGENTS.md` lists each island a page uses with
    the reason why a page load is not enough.
  - The console serves every font, style and script itself: no CDN, no request to another origin. It sends a
    Content-Security-Policy that allows only its own origin and, in the first release, no script at all; a scenario
    proves the header. T-55 loosens it for the first island, after a check of how the installed Astro loads an
    island's script under such a policy.
  - No client-side router. A transition between pages uses the browser's own view transitions in CSS, or none.
  - The layers of `architecture.json` get the templates; `domain` and `adapters` stay as they are.
- **Watch out:**
  - Astro, its adapter and Tailwind change between major versions. Read the docs inside the installed packages before
    you write configuration; do not trust what you remember.
  - `tsc` does not check `.astro` files: `astro check` joins the typecheck. Biome reads `.astro` files only in part;
    record what it covers. Astro writes a folder `.astro/`: add it to `.gitignore` and keep it out of turbo's inputs.
  - Every check that reads source files gets a rule for `.astro` and `.tsx`: ARCH, ISOLATION, DUP, REACH and
    MUTATION. For a template: a check that it holds no logic (only its data, components and markup) and imports only
    components. For `.tsx`: T-55. A rule that exists only as text is not done (root `AGENTS.md`, Hard rules).
  - turbo caches the build and the tests by their inputs and outputs (`turbo.json`, AFFECTED): name the new files and
    the build's output folders.
  - REACH maps V8 coverage to source lines through source maps: if the server code goes through Vite, the build must
    write them. Prefer that `tsc` still builds the `.ts` files as today and Vite builds only templates and islands.
  - Stryker builds the mutated module once and switches mutants at run time (ADR 0061): measure the build time with
    Astro in it.
  - The npm package must hold the built client files, since the profile's image installs the module from npm
    (`deploy/images/Dockerfile`); PROFILE pins the new version.
  - In middleware mode, Astro does not serve its own static files: Fastify does.
  - Each scenario starts one server. `modules/console/AGENTS.md` says 68 scenarios in 60 seconds; there are 86 tests
    now. Measure the suite and the start of `console serve` before the first change and after it, and correct the
    number.
  - The existing scenarios of the console pass with their text unchanged after every slice.
- **Done when:** one existing page is rendered by Astro with the new stack, its scenarios pass with their text
  unchanged, `make verify` passes, and the released image serves the page.
- **Slices:**
  - [ ] The ADR for the stack and for how each check treats `.astro` and `.tsx` files, with the measured build,
    start and suite times.
  - [ ] The build: Astro behind Fastify in `console serve`, `astro check` in the typecheck, the layers, turbo's
    inputs, and the checks' rules for templates (`SCN-REPO` scenarios for each changed check).
  - [ ] The first page on Astro: the health page, the smallest one, after T-52's page reader. It keeps the look of
    Pico CSS; T-60 gives it the new look. Its scenarios keep their text.
  - [ ] The package and the image hold the built files; the profile and the chart pin the release (`SCN-DIST`).

### [ ] T-54 · the design system: `@opensoftware/ui` (P0)

- **Tier / language / path / prefix:** optional · TS, Astro, SolidJS · `packages/ui/` · `SCN-UI` (a library without
  a `bin`, ADR 0039; add the prefix to `docs/reference/scenario-prefixes.md`)
- **Problem:** the console looks like Pico CSS's defaults. The product has a name and no icon, no colours and no type
  of its own, and no shared components, so each new page would invent its own.
- **Approved by the owner (14 November 2026):** the mock-ups of the direction "precise industrial". They are in the
  repository: `docs/design/` holds one static HTML page per screen (the brand sheet, the sign-in page with a refused
  person, the shell with the runs list, Secrets, a skill's page with a change that is checking, the runs on a phone)
  and `docs/design/README.md` holds the approved values (the icon's path, the faces, the colours of both themes, the
  shape, the type sizes, the layout), the rules behind the look, and where this plan differs from the pictures. Read
  that folder before you build a token, a component or a page, and build a page so that it looks like its mock-up.
  The values are the start of the tokens, not their final list: the contrast check below decides when a value must
  change, and the README changes with it. The mock-ups do not show every state. The page that needs one adds it in
  the same language, and `docs/design/` records it: an empty list, an error of a server that does not answer, a form
  with a wrong value, the light theme.
- **Build:**
  - Tokens as CSS custom properties, for dark and light: colour by meaning (surface, text, border, signal, and the
    states running, waiting, failed and done), the type scale, spacing on a 4-pixel grid, radius and motion. A page
    never names a raw colour.
  - Components as `.astro` files, built when a page of this wave needs them and not before: button, link, field with
    label, hint and error, input, select, switch, table, state badge, panel, page header, empty state, banner, the
    shell with its navigation, an ID in monospace, a time. No dialog in the first release: opening one needs script,
    so "are you sure" is a page of its own.
  - No island in the first release. The shell works without script: the theme is dark unless a cookie says light
    (the owner's decision; the system's preference is not followed), a link sets the cookie and comes back to the
    page, so the server renders the right theme and nothing flashes; the navigation on a phone is a `details`
    element. An island (SolidJS) comes only when a page needs one that a form cannot replace, like copy to clipboard
    or a live state; every island of the product lives here, and its first one starts T-55.
  - The brand: wordmark and icon as SVG, with the favicon files.
  - No workbench in the first release. A static site with one page per island is where island scenarios run; it
    comes with the first island (T-55). Until then the reference of the design system is `docs/design/` and the pages
    of the console.
  - Its scenarios until the first island are about its built files, read through the package's exports: the tokens
    define every name in both themes, and the brand files exist. The package holds no `.ts` logic until T-55, so
    MUTATION has nothing to mutate; its `AGENTS.md` says so.
- **Adopt (check first):** native HTML before a library (`dialog`, `details`, the popover API). For islands that need
  more: Kobalte, Ark UI or corvu (headless, SolidJS). Icons: Lucide. Fonts: the open-licensed files, shipped by the
  package, such as Fontsource packages. Compare shadcn-style kits for SolidJS and say why a small own set is enough or
  not.
- **Checks to add (`tools/checks/`, `SCN-REPO`):**
  - Every pair of text and background tokens meets WCAG 2.2 AA contrast, in both themes.
  - No colour value and no font name outside the tokens file, in `packages/ui` and `modules/console`.
- **Watch out:**
  - Accessibility is part of each component: a visible focus, the keyboard, a state never shown by colour alone (icon
    and word too), reduced motion, touch targets on a phone.
  - The existing scenario SCN-CONSOLE-014 says that the runs page has no script element. It stays true, and it is a
    good rule for every page of the first release.
  - An Astro library ships its `.astro` sources; the console compiles them. Say in the ADR how BOUNDARY, REACH and
    MUTATION treat this library.
  - It is a published package: `osf release-files` writes its release files (RELEASE), its first publish follows
    `skills/release-packages`, and its `AGENTS.md` sets the limits of DUP and MUTATION and its budget.
  - Do not build a zoo: a component without a page that uses it is removed.
- **Done when:** the pages of T-56 to T-59 use only its components and tokens, and both checks pass.
- **Slices:**
  - [x] The approved mock-ups and their values in `docs/design/`, with a `README.md` of the direction.
  - [ ] The ADR and the package: tokens, both themes, the brand files, the two checks.
  - [ ] The components that the sign-in page and the shell need (with T-56).
  - [ ] The components that Secrets and Skills need (with T-57 and T-59).

### [ ] T-55 · the first island: code in the browser counts (P2)

- **Starts when:** a page needs its first island (T-54). The first release needs none, so this item waits and blocks
  nothing.
- **Problem:** MUTATION sees only code that runs in Node. An island's code runs in the browser, and
  `tools/checks/quality.ts` counts added lines only for files that end in `.ts`. So no check would know whether a test
  notices a change to an island.
- **Build:**
  - `packages/ui` is a library: Stryker reruns all its tests for each mutant, without coverage (ADR 0039,
    `tools/scaffold/mutation.ts`). So MUTATION for an island needs one thing: the active mutant set in the page before
    its first script. Verify in the installed Stryker how the instrumented code reads it. REACH does not apply to a
    library; MUTATION covers its lines.
  - `.tsx` files count as source in the checks that read added lines.
  - The workbench in `packages/ui`: a static site built by Astro with one page per island and state, served by a
    static file server of the testkit. Compare Storybook and record why plain Astro pages are enough or not.
  - Every island has island scenarios there, which notice its mutants. A journey counts for no mutant (T-52).
  - The Content-Security-Policy allows the console's own scripts from now on (T-53).
  - The first island with its island scenarios, as the proof.
- **Watch out:**
  - Keep an island small, and keep what it decides in its properties, which the server computes.
  - `packages/ui` needs a suite in `.github/test-suites.yml` with `browser: chromium`, and the console's suite too
    once it has a journey (T-56); the console is in the suite `rest` today.
  - Measure one island scenario and one mutation shard with a browser, and write the numbers into the ADR.
- **Done when:** an island scenario passes in `make verify` on CI, and a missed mutant in an island fails MUTATION.
- **Slices:**
  - [ ] The ADR; `.tsx` in the checks; the static file server and the active mutant in the page (`SCN-TK`,
    `SCN-REPO`).
  - [ ] The workbench and the first island with its island scenarios and its suite (`SCN-UI`).

### [ ] T-56 · sign-in, roles and the shell (P0)

- **Problem:** the product has no sign-in. The console trusts a header of a proxy that the team must run in front
  (`CONSOLE_USER_HEADER`, ADR 0089), every person behind it may do everything, and the first screen is a table in
  Pico CSS's defaults.
- **Build:**
  - **The library `@opensoftware/factory-files`** (`packages/`, its own prefix): it reads a factory's files from a
    folder or from `git+<url>#<ref>`, as the foreman does today (ADR 0124). The foreman's fetch moves here; a copy
    fails DUP. For a private repository it takes a token from a documented variable and hands it to Git without
    writing it to a file or a command line. T-58 and T-59 add to this library.
  - **The access file.** `access.yaml` beside `factory.yaml`: people by email, each with one role. Its schema is a new
    format in `contracts/` (TypeSpec, JSON Schema, fixtures); the library reads and checks it, and `factory lint`
    reports its findings. The console reads it at sign-in and again for each request, with a short cache, so a
    removed person loses access after the next merge without a restart. When the file cannot be read, the console
    keeps the last one it read for a set time and then refuses everyone, and says why. The reference factory ships an
    `access.yaml` with an example person that `console doctor` refuses, like the example member of ADR 0114.

    | Role | May |
    | --- | --- |
    | `member` | See every page but Secrets; submit work; act on runs and gates, as a signed-in person does today |
    | `factory-engineer` | The same, and change the factory from the UI (T-58, T-59) |
    | `admin` | The same, and store and delete secrets (T-57) |

  - **The mode.** One setting switches the own sign-in on by name ("The console's three modes"). With it on, the
    console does not start without the provider's settings, the session key and its address. A missing access file
    does not stop it: a merge can remove the file while the console runs, so the sign-in page names the missing file
    and lets nobody in.
  - **One hook for the person.** A Fastify hook in front of every page, old and new, finds the person (the session or
    the proxy's header), reads the role, and answers. Not Astro's middleware: the old pages do not pass through it.
    Without a session: `/signin`, the provider's callback, the static files and a new probe route. The probe route
    says that the console runs and can read its factory, without a session; the profile's and the chart's health
    checks use it in place of `/factory`, which would redirect.
  - **Sign-in.** OpenID Connect with the authorization code flow, PKCE, state and nonce; the provider's settings from
    its discovery document; the ID token checked for signature, issuer, audience and time. Only an email that the
    provider marks as verified counts, compared in lower case with the access file. GitHub has no OpenID Connect for
    sign-in: it is a second provider type that reads the person's verified primary email from GitHub's API. The
    state, the nonce and the verifier of one sign-in live in a short-lived cookie that the callback deletes.
  - **The session.** An encrypted, signed cookie with the email, the name and the end of the session: `HttpOnly`,
    `SameSite=Lax`, `Secure` over HTTPS. It lasts 12 hours (a setting). No role in it; the role comes from the access
    file on each request, so removing a person ends their access even while a copied cookie is still valid. The key
    is `CONSOLE_SESSION_SECRET`; the console accepts two keys, so a key can change without signing everyone out. A
    page without a session redirects to `/signin` and comes back to the page the person asked for (local paths only);
    a form without a session answers 401, and without the role 403.
  - **The console's own address.** One setting, like `CONSOLE_URL` with the default `http://localhost:8080`, is the
    source of the provider's callback address, of the same-origin rule and of the rule below. The same-origin rule
    in the open and the proxy mode stays as today (ADR 0089); with the own sign-in a form's `Origin` must be this
    address, and a form without `Origin` is refused. Inside a container the
    console cannot see where a request came from, so it never decides this from the connection. A request for another
    host is sent to this address before the sign-in starts; otherwise the cookie of the sign-in would be set on one
    host and missed on the other.
  - **Only over loopback or HTTPS.** When the address is neither, the console with sign-in on does not start and says
    why: the cookie and, later, a secret's value would cross the network in clear text. A team on a private network
    puts its own TLS proxy in front and sets the address to its `https://` URL.
  - **The person in every action** stays `by: { kind: "person", id: <email> }` (ADR 0118), so the members of
    gatekeeper's groups file match the same emails.
  - **The sign-in page.** The first screen of the product, as in `docs/design/sign-in.html`: the icon, the name, one
    button per
    provider. A refused person reads why in plain words ("ada@acme.dev is not on this factory's access list") and
    where the list lives.
  - **The shell.** The layout of every new page, as in `docs/design/runs.html` and, on a phone,
    `docs/design/runs-phone.html`: the navigation (only what works, what the mode offers and what the
    role may open), the factory's name and version, the account with the name, the role and "Sign out", the theme
    link. It has no script (T-54). A count in the navigation comes only from data the page loads anyway or from a
    short cache, and a store or forge that does not answer leaves the count out and never fails the page; in this
    item only Runs has a count. On a phone the navigation folds away. A skip link and landmarks. The pages that
    still have the old look stay reachable from the navigation.
  - **The runs list** `/` in the new look. SCN-CONSOLE-001 names the stylesheet `/pico.css` of this page: write its
    successor with `@replaces`, mark the old one `deprecated` and delete its test, in the same change. The other
    scenarios of the runs list keep their text, SCN-CONSOLE-014 ("the page has no script element") among them.
  - **Setup.** `osf init` generates `CONSOLE_SESSION_SECRET` (today it generates only names that end in `_PASSWORD`,
    `_API_TOKEN` or `_MASTER_KEY`) and asks for nothing else; `osf up` names each provider setting that is missing
    when sign-in is on. `deploy/README.md` and `docs/tutorials/first-run.md` tell a person to open the console at
    `http://localhost:8080` (today they say `127.0.0.1`), and get a part "turn on sign-in" for Google and for GitHub
    with the callback on that address. `console doctor` checks, with sign-in on, that the provider's discovery
    answers and that the access file has an admin who is not the example.
  - **In the testkit:** `fakes.oidc()`, an identity provider that signs in the person a test names (discovery,
    authorize, token, keys), reachable from a container for the scenarios of `deploy/`, and the sign-in endpoints in
    `fakes.github`.
- **Adopt (check first):** `openid-client` with `jose` (a certified client, no database); Arctic; Better Auth and
  Auth.js (both want a database or an adapter); `oauth2-mock-server` for the fake. As services in front: oauth2-proxy,
  Pomerium, Authelia, Dex, Keycloak; they stay possible through `CONSOLE_USER_HEADER`. Prefer the smallest that needs
  no database, and check that it takes the time from a clock the tests set (`OSF_NOW`).
- **Watch out:**
  - The existing scenarios of the open mode and of the proxy mode stay as they are (for example SCN-CONSOLE-026,
    -046 and -047): the own sign-in is a third mode, not a change of the two.
  - A browser sends a cookie of a host to every port of that host. Today the docs open the console on `127.0.0.1`,
    the same host as the links to Jaeger, LiteLLM and the Temporal UI (`OSF_HOST`), so these tools would get the
    session cookie. Make it so that the console is on `localhost` and the tools stay on `127.0.0.1`, and say why in
    the docs.
  - GitHub takes a token for Git over HTTPS only as Basic credentials (ADR 0096): the library's fetch of a private
    repository sends it that way.
  - Google and most providers accept `http://localhost` as a callback, but no other host without HTTPS.
  - Some providers send no "verified" flag for the email. Do not guess: a provider without it needs an explicit
    setting that names the risk.
  - No first-person-becomes-admin rule. Without an access file, or without an admin in it, sign-in is refused and the
    page says which file is missing.
  - Never log a token, a code, a cookie or the client secret.
  - `next` after sign-in takes only a path of the console (no open redirect).
  - Whoever may write to the factory's repository can make themselves `admin`: `access.yaml` lives there. The docs
    say that write access to that repository is admin access to the factory, and that the repository should be
    private, since it holds emails.
  - When `CONSOLE_USER_HEADER` is set and the own sign-in is on, the console does not start and names both.
- **Realizes:** SCN-FACTORY-RUNTIME-011 (the access list) and SCN-FACTORY-ACCESS-004 (the phone), from T-51.
- **First scenarios:** a person on the access list signs in and lands on the runs; a person who is not on it is
  refused and reads why; an email that the provider did not verify is refused; a page without a session redirects to
  the sign-in and comes back; `next` with another host is ignored; "Sign out" ends the session; a session past its
  end asks to sign in again; a cookie of the second key is accepted; a person removed from the access file loses
  access without a restart; an access file that cannot be read refuses everyone after the set time; a member does not
  see Secrets and gets 403 for its form; a console whose address is neither loopback nor HTTPS does not start with
  sign-in on; a person who opens the console on `127.0.0.1` is sent to its address and signs in; with sign-in on and
  a provider setting missing, the console does not start; the open mode shows no page that needs a role; behind a
  proxy without an access file a person acts as a member and Secrets answers 404; behind a proxy with an access file a
  person who is not in it gets 403; the navigation shows only what works; the probe route answers without a session;
  on a phone the navigation folds away (journey); sign in and land on the runs (journey).
- **Done when:** the Compose profile on a laptop, with a provider in `.env`, shows the sign-in page, a person of
  `access.yaml` signs in with Google or GitHub and sees the runs in the new shell, nobody else gets past the sign-in,
  and a profile without a provider works as today.
- **Slices:**
  - [ ] The ADR: the library, the session, the roles, the modes and the hook.
  - [ ] `@opensoftware/factory-files` with the fetch, used by the foreman (its own prefix; the foreman's `SCN-FORE`
    scenarios of ADR 0124 pass unchanged); its first publish.
  - [ ] The access file in `contracts/`, the library and `factory lint` (`SCN-CTR`, the library's prefix,
    `SCN-FSPEC`).
  - [ ] `fakes.oidc()` and GitHub's sign-in in `fakes.github` (`SCN-TK`).
  - [ ] The hook, sign-in, session and sign-out in the console, with the sign-in page and the probe route
    (`SCN-CONSOLE`).
  - [ ] The roles on every page and form (`SCN-CONSOLE`).
  - [ ] The shell and the runs list in the new look, with the two journeys and the console's own suite with
    `browser: chromium` (`SCN-CONSOLE`).
  - [ ] `osf init`, `osf up`, the profile, the chart, `console doctor`, the tutorial; one scenario of the profile
    with sign-in on (`SCN-REPO`, `SCN-DIST`, `SCN-CONSOLE`). After the console's release.

### [ ] T-57 · secrets from the UI (P1)

- **Problem:** an agent's secret gets its value from a variable or a file of the foreman's host
  (`ports/secrets/README.md`). To set or change one, a person edits `.env` and restarts the foreman. Nothing shows
  which declared secret has no value, so a run fails at its first turn. Both sandbox adapters resolve
  `ref:openbao/<name>`, but only against a fake: no profile runs OpenBao, the chart has no setting for it (ADR 0075
  leaves OpenBao to its own chart), and nothing writes to it.
- **What does not change:** an agent never holds a value. The sandbox holds a placeholder, and its egress proxy puts
  the value in on the way to the allowed hosts (ADR 0054). Which agent may use which secret stays in `factory.yaml`.
  The UI stores values; it does not grant them. The reference factory keeps `ref:env/GH_TOKEN` and
  `ref:env/CLAUDE_CODE_OAUTH_TOKEN` from `.env` in this wave: a first run needs them before anyone signs in.
- **Build:**
  - **The secrets port gets a write side**, as commands of an adapter program, like the forge port: `put <name>` (the
    value on standard input only, never an argument or a variable), `list` (one line per secret with its name, the
    time and the person of the last change, and its version; a name may hold `/`, so it walks the folders), `delete
    <name>`, `probe` (the store answers, and how long the token still lives). There is no command that prints a
    value. The `@conformance` scenarios go to `ports/secrets/features/` with the reserved prefix `SCN-SECRET`.
  - **The adapter** `adapters/secrets/openbao/` (`skills/new-module`, its own prefix): KV version 2, the value in the
    field `value` that the egress proxy already reads, the person in the secret's metadata.
  - **Git's form of a secret from OpenBao.** Today the egress proxy gives a secret from OpenBao no Basic form
    (`packages/sandbox-egress/src/domain/proxy-config.ts`, ADR 0096), so `git clone` and `git push` over HTTPS fail
    with a token stored in the UI. Close that gap in `packages/sandbox-egress` and the sandbox port's conformance
    scenarios, and say in the ADR when a changed value takes effect (at the start of the sandbox, or per request).
  - **A run that cannot work says so first.** A stage whose agent declares an OpenBao secret without a value fails
    before its first turn and names the secret. The check asks only whether the secret exists: the read token may read
    a secret's metadata for this.
  - **Two tokens with two policies.** The console's token may write and delete values and read names and metadata; it
    may not read a value. The egress proxy's token may only read. So a fault in the console cannot show a secret. One
    mount per factory; the read token of a factory's sandboxes reads that whole mount.
  - **In the testkit:** `fakes.openbao()`, the real OpenBao binary in development mode, pinned by `make install`, one
    server per test process and a mount per scenario (ADR 0049, ADR 0129). It is the first real OpenBao in the tests
    of the sandbox adapters too.
  - **The Compose profile.** An `openbao` service, always on, with its data on a volume and its audit log on. The
    scenarios of `deploy/` and `e2e/` start the profile once per scenario: measure what the service adds to both
    suites before it is added. Decide in the ADR,
    and prove with a scenario that restarts the profile: who initializes it and where the unseal key and the root
    token go; how it unseals after a restart without a person (OpenBao's own automatic unseal for one node if the
    pinned version has one); and how the two tokens reach the services. `osf init` generates the two token IDs into
    `.env`, and a job creates the tokens with these IDs and their policies on every start. A token must not end
    silently: OpenBao gives a token a maximum lifetime (verify the default of the pinned version), so choose a
    lifetime or a renewal that needs no loop in the console, and let `console doctor` and the health page warn before
    a token ends.
  - **The chart.** It installs no OpenBao (ADR 0075). Its values take the address, the mount and a Secret with the two
    tokens of the team's own OpenBao, and the docs give the two policies.
  - **The page `/secrets`** (role `admin`), as in `docs/design/secrets.html`. One list of the secrets that the factory's agents
    declare and of the names in the store, each with a state: "set" (who and when), "missing" (declared without a
    value; names the agents that need it, and from T-59 on the skills) or "not used" (stored, declared by no agent). A form sets or
    replaces a value in a field that never shows it again; "Delete" asks first, on a page of its own. Secrets of the providers `env` and
    `file` are listed as set outside the UI. The page says when a new value takes effect and that it is sent only to
    the hosts the agent may reach.
  - **`console doctor`**, when the factory declares an OpenBao secret: fails with the name of each one without a
    value, and when the store does not answer.
- **Adopt (check first):** OpenBao (chosen, already in `docs/architecture/stack.md`); a client library for it against
  plain HTTP calls; iron-proxy's source for OpenBao as the egress proxy uses it today.
- **Watch out:**
  - A value appears nowhere: no page, no redirect URL, no log line, no error text, no trace, no run record, no test
    report. One scenario stores a value and searches every output of the console and the adapter for it.
  - The server does not log request bodies. The field has no autocomplete. The body has a size limit. The form exists
    only over loopback or HTTPS (T-56).
  - The egress proxy swaps a placeholder in an HTTP request. A secret that is not sent in an HTTP request (an SSH key,
    a database password) does not work this way; the page and the docs say so.
  - These are the agents' secrets. The modules' own tokens and the provider keys of the inference gateway stay in
    `.env` in this wave.
  - `lint` refuses a secret whose provider the factory does not declare (`modules/factory-spec/src/domain/lint.ts`):
    a factory that uses `ref:openbao/` declares `providers.secrets.openbao`.
  - A name follows the pattern of `SecretReference` in `contracts/typespec/factory-definition.tsp`.
  - The tokens and the unseal key are credentials: `.env` and the operator's safe only. The docs describe a backup of
    the volume and the key.
- **Realizes:** SCN-FACTORY-RUNTIME-010 (the stored secret), from T-51.
- **First scenarios:** `put` then `list` names the secret without its value; `put` twice makes a second version; a
  name with a folder is listed; `delete` removes it; no command prints a value; the console's token cannot read a
  value; a sandbox's `git clone` works with a token from OpenBao; a stage whose secret has no value fails before its
  first turn and names it; the profile restarts and a stored secret still reaches a sandbox; an admin stores a value
  and the list says "set" with the person; the value is in no output; a declared secret without a value says
  "missing" with its agents; a stored secret that no agent declares says "not used"; a member gets 403; store a
  secret (journey).
- **Done when:** on the Compose profile, an admin stores the value of a secret that an agent declares as
  `ref:openbao/<name>`, and the next run's request to the allowed host carries it, with no restart and no edit of
  `.env`.
- **Slices:**
  - [ ] The ADR; the port's write side and the adapter `secrets-openbao`, with `fakes.openbao()` (`SCN-SECRET`, the
    adapter's prefix, `SCN-TK`); the adapter's first publish.
  - [ ] Git's form of a secret from OpenBao, and the stage that fails first without a value (`SCN-SEGRESS`,
    `SCN-SANDBOX`, `SCN-FORE`).
  - [ ] OpenBao in the Compose profile with `osf init`, the job and the restart scenario; the chart's values
    (`SCN-DIST`, `SCN-REPO`). After the releases above.
  - [ ] The page `/secrets` with its journey, and the checks of `console doctor` (`SCN-CONSOLE`).
  - [ ] One smoke scenario in `e2e/` from a stored value to a sandbox's request (`SCN-E2E`).

### [ ] T-58 · a change to the factory from the UI is a pull request (P1)

- **Problem:** `factory.yaml` changes only by hand in Git. The forge port cannot commit a file, cannot ask the forge
  to merge when the checks pass, cannot close a pull request and cannot read a branch's merge rules
  (`ports/forge/README.md`). In the Compose profile the factory is a local commit in a volume (the service
  `factory-repo`), and gatekeeper, the console's groups and the `factory` tools read that volume.
- **Build:**
  - **The forge port:**
    - `commit <repo> <branch> --message <text> <path>=<file>...` writes one commit with these files to a branch that
      exists.
    - `branch --from` takes a commit, not only a branch name.
    - `merge` gets an option that asks the forge to merge when the checks pass; it merges at once when they already
      did, and exits with a named error when the forge cannot do this for the repository.
    - `rules <repo> <branch>` prints the checks and approvals the branch requires. `protect` only writes, replaces
      all rules and needs admin rights, so the console never runs it.
    - `close <repo> <number> [--delete-branch]`.
    - `prs` gets `--limit <n>` and the merge commit of a merged pull request.
    `@conformance` scenarios, in both adapters and in `fakes.github`.
  - **Edits in `@opensoftware/factory-files`** (T-56): add and remove a skill, a secret reference and an egress host
    of an agent, and declare a secrets provider, in a `factory.yaml` whose comments, order and anchors stay.
  - **The flow in the console** (roles `admin` and `factory-engineer`): a form posts the change. The console reads
    the newest commit of the main branch, makes the edit, creates the branch `console/<what>-<that commit>-<hash of
    the edit>` from that commit, commits, opens the pull request with what changes and who asked for it, asks the
    forge to merge when green, and answers 303 to `/changes`. The branch starts at the commit that was read, so a
    change that arrived in between shows as a conflict and overwrites nothing.
  - **The page `/changes`:** the newest pull requests whose branch starts with `console/` and whose author is the
    user of the console's token, like the inbox lists `observer/` (ADR 0073). A branch that somebody else pushed under
    that name is not a change of the console and gets no button. Every signed-in person sees the page; its buttons
    need the role. The states: "checking", "live" with the factory version, "failed" with the name of the
    failed check and the link to the pull request, "conflict", "discarded". The page asks `pr` only for the changes
    that are still open. A failed or conflicting change has two buttons: "Try again" closes the pull request, deletes
    its branch and makes the change again on the newest commit; "Discard" closes it and deletes its branch. The
    console keeps no state, so it reads the edit of "Try again" from a line that it wrote into the pull request for a
    program to read; it checks that line like a form (anyone who may write to the repository can change it) and checks
    the person's role again. So no
    failed change stays armed to merge later without the person. A change that is not live yet also shows where it
    applies, for example beside the skill. While a change is checking, the page reloads itself.
  - **The check comes first.** The console asks for a merge only for a change whose check `factory` it can rely on:
    - The main branch requires the check (`rules`): the forge merges when it is green.
    - The forge cannot merge when green for this repository: the change waits as "checking". Every open change of
      the console whose check `factory` is green shows "ready" with one button "Merge"; the console refuses the
      button while the check is not green.
    - The repository has no check `factory`: the console opens no change and says what is missing. It knows this
      without state: the branch's rules do not require the check, and the newest commit of the main branch carries
      no check of that name.
    A workflow in the reference factory's folder runs `factory lint` and `factory plan --check` (fails when the lock
    is not current) and posts the check `factory`, on pull requests and on pushes to the main branch. A check that is
    still pending counts as present: right after a merge the newest commit has no result yet.
  - **The profile.** A factory from a local folder (`FACTORY_DIR`) stays the default: the pages then show the
    factory, offer no change and say why. With a repository on a forge (`FACTORY_REPOSITORY`, opt-in), the service
    `factory-repo` clones it into the same volume at each start, so gatekeeper's policy and groups, the console's
    groups and the `factory` tools read it as today, and a change to them takes effect at a restart, as today. The
    foreman and the console read `factory.yaml`, the access file and the skills from the repository at each run and
    request (`git+<url>#main`, ADR 0124). The clone of `factory-repo` and both fetches use the token of T-56's library
    for a private repository. The chart gets the same choice.
- **Adopt (check first):** the forge's own merge-when-green (GitHub's auto-merge, Forgejo's merge when checks
  succeed) before any loop of our own; a merge step in the factory repository's own workflow as the alternative for a
  forge without it; the `yaml` package's document API for edits that keep comments (already a dependency);
  factory-spec's GitHub Action for the check, if it has one.
- **Watch out:**
  - The console keeps no state and runs no loop. The forge merges; the page asks the forge when it is opened.
  - Verify for GitHub: auto-merge is set through its GraphQL API, waits only when a required check is not green yet,
    needs the repository's setting that allows it, and is not offered for private repositories of every plan; the
    same holds for required checks. The owner's first installation may be such a repository: the button "Merge" is
    its path, and the docs say so.
  - `fakes.github` is an in-process fake of the REST API without Git (ADR 0058). The console's scenarios of a change
    fetch the repository with Git, so they use `fakes.forge` (Forgejo, started once per test process; the console's
    suite in `.github/test-suites.yml` then needs `images: forge`). Measure what they add to the console's budget. `fakes.github` still gets `commit`, the merge option and `rules` for the
    conformance scenarios of the GitHub adapter.
  - On Forgejo something must post the check: a runner of Forgejo Actions, or the `factory` tools in a job of the
    profile. Decide in the ADR; the scenarios post it with the port's `check`.
  - The main branch of the factory's repository requires the check `factory` and no approval: a required approval
    would stop every change of the console, since the token's user cannot approve its own pull request. observer's
    proposals keep their review by a person as a rule of the process: observer never asks for merge-when-green, and
    the console merges only branches that start with `console/`.
  - The reference factory shares one list between agents through YAML anchors (`secrets: &secrets`). An edit for one
    agent must not change another: give the agent its own list first.
  - The console's forge token writes: contents and pull requests of the factory's repository, nothing else, and it
    reads the branch's rules. Say which permissions a GitHub fine-grained token or app needs; the inbox's read-only
    token is another one.
  - The pull request's author is the token's user; the person is in the body and in a trailer of the commit. No text
    of a form goes into YAML, a branch name or Markdown without escaping.
  - A run keeps the factory version it started with (ADR 0110). The page says that a change is live for the next run.
  - Not in this item: changing `access.yaml` from the UI.
- **Realizes:** SCN-FACTORY-CODE-008 (the change from the UI), from T-51, and SCN-FACTORY-RUNTIME-009.
- **First scenarios:** `commit` writes the files to the branch in one commit; `branch --from <commit>` starts there;
  merge-when-green merges after the check passes and does not merge while it fails; `rules` names a required check;
  `close --delete-branch` closes and deletes; the edit of one agent keeps comments and leaves an agent that shared
  the list unchanged; a factory engineer's change opens a pull request that names the person; a member gets 403; a
  change whose check passes shows "live" with the new factory version; a change whose check fails shows "failed" with
  the check and the link; a change made on an older commit shows "conflict" and changes nothing; "Try again" closes
  the old pull request and opens a new one; "Discard" closes it and deletes its branch; on a forge that cannot merge
  when green, a green change shows "Merge" and a red one refuses it; a repository without the check refuses a change
  and says why; a factory from a local folder offers no change.
- **Done when:** on the Compose profile with a factory repository on GitHub or Forgejo, a factory engineer changes
  the factory in the UI, the pull request merges after its check without another person, the page shows "live", and
  the next run has that factory version.
- **Slices:**
  - [ ] The ADR; the forge port's new operations in both adapters and `fakes.github` (`SCN-FORGE`, `SCN-FGITHUB`,
    `SCN-FFORGEJO`, `SCN-TK`).
  - [ ] The edits in `@opensoftware/factory-files`, and `factory plan --check` (the library's prefix, `SCN-FSPEC`).
  - [ ] The flow and the page `/changes` in the console (`SCN-CONSOLE`).
  - [ ] The workflow with the check `factory` in the reference factory; the profile and the chart with a factory
    repository on a forge; `console doctor` (`SCN-DIST`, `SCN-CONSOLE`). After the releases above.
  - [ ] One smoke scenario in `e2e/`: a change from the console becomes the factory version of the next run
    (`SCN-E2E`).

### [ ] T-59 · skills: a format, sources and the catalog (P1)

- **Problem:** a skill is a path in `factory.yaml` (`skills: [./skills/x]`). `factory lint` checks only that the path
  exists. Nothing says which secret or host a skill needs, so a skill fails inside a run. Sharing a skill between
  factories means copying its folder. The UI shows no skill.
- **Where a skill is switched on:** for an agent of a factory, as `factory.yaml` already says. There is one foreman
  per factory, and it gives each stage's agent the skills that agent declares (ADR 0112). "For all agents" is one
  change with one edit per agent.
- **Build:**
  - **The format.** A skill is a folder with a `SKILL.md` in the Agent Skills format (agentskills.io): front matter
    with `name`, equal to the folder's name, and `description`, which says what the skill does and when to use it; a
    short body; details in files beside it that the agent reads when it needs them. What the factory adds goes into
    the format's own place for extensions (`metadata`): the secrets and the hosts the skill needs. Verify with the
    format's validator which values `metadata` takes; if only text, a list is one text with a fixed separator. A
    `SKILL.md` stays valid for every harness. Fix the key names in the ADR.
  - **The rules in `@opensoftware/factory-files`**, reported by `factory lint` and shown by the console: the file
    exists, the front matter is valid, the name fits, the size stays inside the format's limits; an agent that uses a
    skill declares a secret for each secret the skill needs and allows each host in its sandbox's egress. A finding
    names the agent, the skill and what is missing.
  - **Skills of other repositories.** An agent's `skills` entry may name a folder of another Git repository at a ref
    (fix the form in the ADR, in line with `git+<url>#<ref>`). `factory plan` writes its commit and a hash of its
    files to `factory.lock` (an added optional field; check with CONTRACT that it is no breaking change). The foreman
    fetches it at that commit and refuses a reference without a pin, as it does for an MCP server of the registry
    (ADR 0112). `factory render` links it for a person's checkout. The fetch of a pinned skill is the library's, with
    its token and its cache, for the foreman, `render` and the console's catalog alike.
  - **The page `/skills`:** every skill the factory can use, from the folders of its repository and the pins of its
    lock: name, description, source with its commit, the agents that use it, and what it needs, with the state of
    each secret from T-57. `/skills/<name>`, as in `docs/design/skill.html`, shows the `SKILL.md` as rendered Markdown and its
    files, and one switch per agent. Both pages exist in every mode; the switches need a role and a factory on a
    forge. A switch is a change of T-58. When the agent lacks a secret reference, its provider or a host that the
    skill needs, the change adds them, and the page lists them before the person confirms.
  - **This repository's own skills** pass the new rules.
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
  - The foreman reads skill files as UTF-8 text (ADR 0112). A skill with a binary file fails the rules until that
    changes.
  - Two skills with one name, one local and one from another repository: the rules refuse.
  - Not in this item: an editor for `SKILL.md` in the UI, and adding a skill of another repository from the UI. Both
    are changes in Git first.
- **Realizes:** SCN-FACTORY-ROLE-003 (the skill from the UI) and SCN-FACTORY-CODE-007 (what a skill needs), from
  T-51.
- **First scenarios:** `lint` refuses a skill without a description; `lint` names the secret an agent lacks for its
  skill; `plan` pins a skill of another repository; the foreman refuses a skill without a pin; a run's agent finds a
  pinned skill in its session; the catalog lists each skill with its agents and its needs; a skill's page shows a
  missing secret; a factory engineer switches a skill on for an agent and the change lists the added secret and host;
  the page's Markdown shows no script; switch a skill on and see the change go live (journey).
- **Done when:** on the Compose profile, a factory engineer switches a skill on for one agent in the UI, an admin
  stores the secret it needs, and the agent's next run has the skill in its session and its request carries the
  secret.
- **Slices:**
  - [ ] The ADR; the format and its rules in the library and `factory lint`; this repository's skills pass (the
    library's prefix, `SCN-FSPEC`).
  - [ ] Skills of other repositories: the entry's form, `factory.lock`, `plan`, `render` and the foreman
    (`SCN-CTR`, `SCN-FSPEC`, `SCN-FORE`).
  - [ ] The pages `/skills` and `/skills/<name>`, read-only (`SCN-CONSOLE`).
  - [ ] The switch per agent as a change of T-58, with its journey (`SCN-CONSOLE`).
  - [ ] One smoke scenario in `e2e/`: a skill switched on in the console and its stored secret reach a run
    (`SCN-E2E`). After the releases above.

### [ ] T-60 · the remaining pages in the new look (P2)

- **Problem:** after T-56 the run page, the work form, the inbox, the factory pages, the improvement page and the
  health page still have the old look, and the console carries two stacks.
- **Build:** move one page per slice to Astro and the design system. A scenario keeps its text and its test proves
  no less; a scenario whose text names what the move takes away is replaced with `@replaces`. When the last page
  moved, remove Preact, htm and Pico CSS and the route `/pico.css`; the route is part of the public surface, so a
  scenario that still names it becomes `deprecated` in the same change.
- **Watch out:** a page that shows nothing useful for a setting that is not there stays out of the navigation, as
  today's 404 of the inbox without its repository. The reload of the runs every `CONSOLE_REFRESH` seconds stays until
  the foreman has a stream of run changes; a live island is its own item then.
- **Done when:** no page uses Pico CSS, and `modules/console/package.json` has no dependency on Preact or htm.
- **Slices:**
  - [ ] The run page with its forms.
  - [ ] The work form and the inbox.
  - [ ] The factory pages, the improvement page and the health page (on Astro since T-53, in Pico's look).
  - [ ] Remove the old stack and the route `/pico.css`.

### [ ] T-61 · the person, proven to every module (P2)

- **Problem:** foreman, intake and gatekeeper trust the caller to name the person: anyone with a module's API token
  can act as any person (ADR 0118, "Revisit when"). With a sign-in of its own, the console can prove who acted.
- **Build:** the console signs a short-lived token for the signed-in person, and each module checks it for an action
  that names a person. The formats are in `contracts/`. A team's own tool keeps the abilities
  SCN-FACTORY-ACCESS-002 gives it: decide in the ADR how it names itself or proves a person, for example with a key
  of its own that the modules know. Needed before a console is reachable from the internet.
- **Adopt (check first):** signed JSON Web Tokens with `jose`, the keys published by the console; what the sign-in
  proxies of T-56's list hand to an upstream.
- **First scenarios:** an action with the console's token of the person is recorded with that person; a call with a
  module's API token and a made-up person is refused; a token past its end is refused; a team's own tool acts as
  itself.
- **Done when:** a call with a module's API token and a made-up person is refused by foreman, intake and gatekeeper.
- **Slices:**
  - [ ] The ADR and the contract (`SCN-CTR`).
  - [ ] The console signs; foreman, intake and gatekeeper check (one slice per module).

### Not in this wave

Each needs its own item, a vision scenario first: a console on a public URL (TLS in the profile, rate limits);
passkeys; changing `access.yaml` and adding a skill of another repository from the UI; the reference factory's own
tokens, the modules' tokens and the inference gateway's provider keys in OpenBao; a console for several factories;
live updates of the runs without a reload; a command palette; a second approver for risky changes of the factory, as a
policy of gatekeeper.

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
