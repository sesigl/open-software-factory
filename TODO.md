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
  - ISOLATION allows a module to depend only on `@opensoftware/contracts`, `@opensoftware/testkit` (tests only) and external
    packages.
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

### [ ] T-05 · proof

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
  - [ ] The dogfood from the released tool: once `@opensoftware/proof` is on npm, drop the input `command` of the step
    `proof` in `.github/workflows/verify.yml`, so the action runs its release.

---

## Wave 2 · Measure

### [ ] T-06 · spec-trace

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
  - [ ] The GitHub Action, the base and head diff in the report, and the dogfood: a root `spec-trace.json` and CI
    runs spec-trace instead of `tools/checks/` for SPEC, TRACE, STEPS and PASS.

### [ ] T-07 · scorekit

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
- **Done when:** our own sessions are scored nightly and the report is linked from the README.

### [ ] T-08 · ledger

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

---

## Wave 3 · Improve

### [ ] T-09 · taskcapture

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

### [ ] T-10 · observer

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
- **Done when:** one observer PR to this repository was merged with a measured effect.

### [ ] T-11 · gatekeeper

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

### [ ] T-12 · harness port and adapters

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
- **Done when:** all five adapters pass conformance; claude-code, codex and opencode also in SMOKE-PAID.
- **From T-03:** `factory plan` pins harnesses by ACP Registry ID in `factory.lock` (ADR 0022).

### [ ] T-13 · sandbox port, egress and MCP gateway wiring

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

### [ ] T-14 · inference port

- **Tier / language / path / prefix:** core · TypeScript + LiteLLM config · `ports/inference/`, `adapters/inference/litellm/`
  · `SCN-INFER`
- **Alone:** one OpenAI-compatible endpoint for every harness with budgets, routing and spend logs.
- **Adopt:** LiteLLM (configuration, not a fork).
- **Realizes:** OPEN-001, OPEN-003, OPEN-004, BENCH-006 (routing), principle "cost is bounded".
- **First scenarios:** a request with a routing alias reaches the configured model; a run over its budget is
  stopped with a clear error; every call writes a spend log line with `osf.run.id`; a bring-your-own gateway URL is
  used instead of the bundled one.
- **Done when:** taskcapture's `route` output is applied by this adapter in E2E-004.

---

## Wave 4 · Automate

### [ ] T-15 · channel and forge ports

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

### [ ] T-16 · intake

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

### [ ] T-17 · foreman

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
- **Done when:** E2E-001 passes and this repository's `factory` issues are implemented by the foreman (phase 3).

### [ ] T-18 · console

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

### [ ] T-19 · distribution

- **Tier / language / path / prefix:** optional · YAML · `deploy/compose/`, `deploy/helm/` · `SCN-DIST`
- **Alone:** install a complete factory with one command.
- **Build:** Compose profile (Postgres with Temporal and pgvector, SeaweedFS, NATS, Phoenix, LiteLLM, the
  modules); Helm chart (managed Postgres, object storage, NATS, Temporal, Langfuse, OpenBao, agent-sandbox);
  a reference `factory.yaml` with the loop triage → spec (gate) → implement → review → verify (evidence) → ship.
  Signed images, SBOMs, SLSA provenance.
- **Realizes:** OPEN-006, DATA-006, RUNTIME-001, LOOP-013.
- **First scenarios:** `docker compose up` reaches a healthy state within the budget; the reference factory
  plans and applies cleanly; `helm install` on kind passes the same smoke subset.
- **Done when:** `make smoke` runs against the Compose profile.

### [ ] T-20 · end-to-end smoke suite

- **Path / prefix:** `e2e/` · `SCN-E2E`
- **Build:** implement the five scenarios in `e2e/features/smoke.feature` against the Compose profile with the
  testkit fakes; add `SMOKE-PAID` (one small real task per first-party harness with a real model, nightly).
- **From T-00:** `make smoke`, `make smoke-paid` and `make mutation` run Turborepo tasks that no package defines
  yet, so they run nothing. Give `e2e/` a package with `test:system` and `test:paid` scripts; the nightly workflow
  already calls them. Add a Stryker `mutation` script with the first module that has code.
- **Done when:** all five pass on every merge to `main`; SMOKE-PAID runs nightly.

---

## After the plan: phase 3 and 4

When T-17 is done, follow `docs/explanation/bootstrapping.md`: the factory implements this repository's
`factory` issues with people at the gates, then observer improves our own `factory.yaml`. Add each new
requirement as a vision scenario first, then as module scenarios and a new item here.
