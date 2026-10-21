---
status: accepted
date: 2026-10-21
---

# 0034. ledger computes cost per pull request and flow metrics with DuckDB views

## Context

TODO item T-08 asks for ledger: cost per pull request and flow metrics for any team that uses agents. The vision
asks for human interactions per pull request (SCN-FACTORY-METRIC-001), median cycle time by segment (METRIC-002),
throughput and runs by agent type (METRIC-003), cost per pull request split into compute, platform and inference
(METRIC-004), spend by source, user, agent and model (METRIC-005), the 20 most expensive pull requests
(METRIC-006), the gap to a cost target (METRIC-007) and the revert rate next to throughput and cost (METRIC-008).
Leadership reads these outcomes, not token volume (OUTCOME-001, OUTCOME-002), and factory engineers measure their
changes with them (ROLE-002).

The data exists in three places. The LLM gateway (LiteLLM) logs the spend of each call. runlog (ADR 0023) writes
each run as OTLP/JSON with the `run-record` attributes: requester, source, harness, agent, model, cost and the
pull requests the run touched. The forge knows when a pull request was opened, reviewed, merged or closed. The
contracts have `work.received@v1` and `pr.opened@v1`, but no event for a review or for the end of a pull request.

This change is the first slice of T-08: the contract events, the CLI `ingest` and `report`, the DuckDB views and
the npm release.

## Decision

- **New optional module `modules/ledger`** (TypeScript and SQL, prefix `SCN-LEDGER`), published as
  `@opensoftware/ledger`. Layers: `entry` (`src/cli.ts`) → `commands` → `adapters` → `domain`. `domain` reads the
  input records into rows and turns query results into the report, without I/O; `adapters` read files and talk
  to DuckDB; `commands` join them. The SQL of the views lives in `sql/duckdb/`, shipped with the package.
- **Two new contract events**, a minor change of `contracts`: `pr.reviewed@v1` (a person, an agent or a bot
  reviewed or commented on a pull request: `url`, `reviewer`, `automated`, `state` approved, changes_requested or
  commented) and `pr.closed@v1` (`url`, `merged`, `mergeCommit`). Forge adapters (T-15) publish them next to
  `pr.opened@v1`.
- **Ingest.** `ledger ingest <files or folders>...` reads `.json` and `.jsonl` files. A file is one JSON value
  (an object or an array of objects) or JSON Lines. Each object is one of three kinds: an OTLP/JSON trace export
  request (`resourceSpans`), a CloudEvent (`specversion`), checked against its contract, or a LiteLLM spend log
  row (`request_id` and `spend`), as LiteLLM's `GET /spend/logs` returns it. Any other object exits 2 with the file
  and line. CloudEvents of other types are counted and skipped. Rows go into a DuckDB database file, `--db`
  (default `ledger.duckdb` in the current folder). Each record has a key (spend: `request_id`; run: `osf.run.id`;
  pull request: its URL; review: event source and ID; work item: its ID), and a record that is already there is
  replaced, so ingesting the same files twice changes nothing.
- **Attribution.** A spend row belongs to a run when its `metadata.spend_logs_metadata` holds `osf.run.id`, which
  a launcher sets on each gateway call through LiteLLM's `spend_logs_metadata`. A run's inference cost is the sum
  of its spend rows, or its `osf.cost.usd` when no spend row names it. A spend row without a run is unattributed
  and shown as its own line. A run belongs to a pull request when the run lists it in `osf.pull_request.urls`, when
  `pr.opened@v1` names the run, or when both share the work item. A run that belongs to several pull requests splits
  its cost evenly.
- **Run shape.** A run's agent is `gen_ai.agent.name`, else the harness. A run is top-level unless its
  `invoke_agent` span lies below another run's `invoke_agent` span in the same trace.
- **Flow.** Kickoff is the time of the work item's `work.received@v1`, else the start of the pull request's first
  run. First human review is the first `pr.reviewed@v1` that is not `automated`. A human interaction is a review or
  comment by a person. A revert is a merged pull request whose title starts with `Revert "`, as the forge's revert
  button writes it.
- **Views** (the public SQL surface): `run_cost`, `spend_attributed`, `pr_runs`, `pr_flow`, `pr_cost`. They hold
  amounts and hours; no rate is stored in the database.
- **Report.** `ledger report` writes `$OUTPUT/report.json` (or `--out`) and, with `--markdown <file>`, the same as
  Markdown. `--since` and `--until` (dates, inclusive) limit the period: pull requests by the time they were opened,
  spend and runs by the time they started. Cost per pull request is the period's cost divided by the pull requests
  opened in it. Inference is the spend; compute is run hours times `--compute-usd-per-hour` (default 0); platform is
  `--platform-usd` (default 0) for the period. `--target <usd>` adds the target and the gap. Amounts are rounded
  to cents, shares to four digits, durations are in hours.
- **Release.** release-please with the tag `ledger-v<version>`, first version `0.1.0`, and
  `.github/workflows/publish-ledger.yml`, like scorekit (ADR 0032).
- **Later slices of T-08:** the same views for PostgreSQL, a Grafana dashboard JSON over them, an import of a
  forge's pull requests as events for teams without forge adapters, and the dogfood: this repository's cost per
  pull request on a dashboard.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| DuckDB file with SQL views | One file, no server; the views are the public surface that Grafana and people query; fast on millions of rows | A native dependency per platform |
| Compute in TypeScript only | No native dependency | No SQL surface for dashboards; every new question needs a release |
| PostgreSQL first | Shared, always on | Needs a server for the five-minute quick start |
| New events `pr.reviewed@v1` and `pr.closed@v1` | One format for every forge; forge adapters publish them anyway | Nothing publishes them until T-15 |
| GitHub webhook payloads as input | Exist today | Tied to one forge; the event name sits in an HTTP header, not in the payload |
| Revert from the title `Revert "` | Works for the revert button of GitHub, GitLab and Forgejo | Misses a revert written by hand |
| Compute and platform as rates | No billing integration needed; honest about what is known | The rate is a guess until a cost source (OpenCost, FOCUS) is read |

## Prior art

- Apache DevLake (Apache-2.0, Apache incubator, active): DORA metrics and Grafana dashboards from GitHub, GitLab and
  Jira. Not adopted: Go and MySQL services, and it knows nothing about runs, agents or LLM spend. Its metric
  definitions shaped the cycle-time segments.
- Four Keys by Google (Apache-2.0, archived): DORA metrics on BigQuery. Not adopted: archived and tied to GCP.
- LiteLLM spend tracking (MIT core, active): spend per key, user, team and tag in its `SpendLogs`. Adopted as the
  inference cost source. It has no notion of a pull request, so ledger joins its rows to runs.
- Langfuse cost tracking (MIT core, active): cost per trace. Not the source here: it needs a running Langfuse, and
  ledger must work from files.
- OpenCost (Apache-2.0, CNCF, active) and the FinOps FOCUS specification (open, active): compute cost per workload
  and a billing export format. Not adopted yet; a later slice may read them for compute cost instead of a rate.
- DuckDB (MIT, DuckDB Foundation, monthly releases) through `@duckdb/node-api` (MIT, the official "Neo" Node client,
  active; `1.5.6-r.1`). Adopted as the engine and file format.
- LinearB, Swarmia, Jellyfish and Sleuth: flow metrics as a service. Not adopted: closed source, and the data
  leaves the company (P7).

## Consequences

- A team gets cost per pull request and its flow from files it already has, with one command and no server.
- Every number in the report has a view behind it that a person can query with the DuckDB CLI.
- Compute and platform cost are only as good as the rates given. Revisit when a compute cost source is read.
- The revert rule misses hand-written reverts. Revisit when forge adapters can name the reverted pull request.
- `pr.reviewed@v1` and `pr.closed@v1` are new contract events; until forge adapters exist, a team writes them from
  its forge's API.
