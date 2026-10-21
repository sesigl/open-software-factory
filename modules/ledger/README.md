---
covers: [modules/ledger/src/**, modules/ledger/sql/**]
---

# ledger

Know what each pull request costs and how work flows through your factory. ledger joins three things a team that
uses agents already has: the spend log of its LLM gateway (LiteLLM), the run records of its agent sessions
([runlog](../runlog/README.md)) and its forge's pull request events. It writes them into one DuckDB file and reports
the cost per pull request, split into inference, compute and platform, the spend by source, user, agent and model,
the most expensive pull requests, throughput, cycle time, human interactions, runs by agent type and the revert rate.
For a team, it writes to PostgreSQL instead and ships a Grafana dashboard over the same views.
Decisions: [ADR 0034](../../docs/decisions/0034-ledger.md), [ADR 0035](../../docs/decisions/0035-ledger-postgres-grafana.md).

## Quick start

This quick start is scenario `SCN-LEDGER-001` and is tested on every change. Save two runs, two gateway spend rows
and three pull request events:

```jsonl ledger.jsonl
{"resourceSpans":[{"resource":{"attributes":[{"key":"osf.run.id","value":{"stringValue":"run-01"}},{"key":"osf.source","value":{"stringValue":"slack"}},{"key":"osf.requester.id","value":{"stringValue":"slack:U024BE7LH"}},{"key":"osf.harness.name","value":{"stringValue":"claude-code"}}]},"scopeSpans":[{"spans":[{"traceId":"0af7651916cd43dd8448eb211c80319c","spanId":"0af7651916cd43dd","name":"invoke_agent","startTimeUnixNano":"1767258000000000000","endTimeUnixNano":"1767261600000000000","attributes":[{"key":"gen_ai.operation.name","value":{"stringValue":"invoke_agent"}},{"key":"gen_ai.request.model","value":{"stringValue":"claude-sonnet-5-5"}},{"key":"osf.pull_request.urls","value":{"arrayValue":{"values":[{"stringValue":"https://github.com/acme/web/pull/1"}]}}}]}]}]}]}
{"resourceSpans":[{"resource":{"attributes":[{"key":"osf.run.id","value":{"stringValue":"run-02"}},{"key":"osf.source","value":{"stringValue":"slack"}},{"key":"osf.requester.id","value":{"stringValue":"slack:U024BE7LH"}},{"key":"osf.harness.name","value":{"stringValue":"claude-code"}}]},"scopeSpans":[{"spans":[{"traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"4bf92f3577b34da6","name":"invoke_agent","startTimeUnixNano":"1767265200000000000","endTimeUnixNano":"1767267000000000000","attributes":[{"key":"gen_ai.operation.name","value":{"stringValue":"invoke_agent"}},{"key":"gen_ai.request.model","value":{"stringValue":"claude-sonnet-5-5"}},{"key":"osf.cost.usd","value":{"doubleValue":1}},{"key":"osf.pull_request.urls","value":{"arrayValue":{"values":[{"stringValue":"https://github.com/acme/web/pull/2"}]}}}]}]}]}]}
{"request_id":"req-01","spend":2,"startTime":"2026-01-01T09:10:00Z","model":"claude-sonnet-5-5","metadata":{"spend_logs_metadata":{"osf.run.id":"run-01"}}}
{"request_id":"req-02","spend":0.5,"startTime":"2026-01-01T09:40:00Z","model":"claude-sonnet-5-5","metadata":{"spend_logs_metadata":{"osf.run.id":"run-01"}}}
{"specversion":"1.0","id":"evt-01","source":"/osf/forge","type":"pr.opened@v1","time":"2026-01-01T10:00:00Z","data":{"url":"https://github.com/acme/web/pull/1","repository":"https://github.com/acme/web","number":1,"title":"Fix the login redirect","headBranch":"fix-1","baseBranch":"main","headCommit":"9b1c2d3","author":{"kind":"person","id":"github:mona"}}}
{"specversion":"1.0","id":"evt-02","source":"/osf/forge","type":"pr.opened@v1","time":"2026-01-01T11:30:00Z","data":{"url":"https://github.com/acme/web/pull/2","repository":"https://github.com/acme/web","number":2,"title":"Add a sum function","headBranch":"fix-2","baseBranch":"main","headCommit":"9b1c2d3","author":{"kind":"person","id":"github:mona"}}}
{"specversion":"1.0","id":"evt-03","source":"/osf/forge","type":"pr.closed@v1","time":"2026-01-01T12:00:00Z","data":{"url":"https://github.com/acme/web/pull/1","merged":true}}
```

Report on them:

```sh
npx @opensoftware/ledger report ledger.jsonl
```

It writes `ledger.duckdb` and `$OUTPUT/report.json`, and prints
`2 pull requests, cost per pull request 1.75 USD, revert rate 0.0%`: run-01 cost 2.50 USD in spend rows, run-02
1.00 USD by its own `osf.cost.usd`, and each run belongs to one pull request.

## Commands

| Command | What it does |
| --- | --- |
| `ledger ingest [--db <file or URL>] <file or folder>...` | Read spend rows, runs and events into the database `--db`. Prints `ingested 2 runs, 3 spend rows and 4 events into ledger.duckdb`. |
| `ledger report [options] [<file or folder>...]` | Ingest the files named, then write the report of the database to `--out` (`$OUTPUT/report.json`). |
| `ledger query [--db <file or URL>] <SQL>` | Run one SQL statement, like `SELECT * FROM pr_cost`, and print its rows as JSON Lines. |
| `ledger dashboard [--out <file>]` | Write the Grafana dashboard to `--out` (`$OUTPUT/ledger-dashboard.json`). See [PostgreSQL and Grafana](#postgresql-and-grafana). |

Options of `report`:

| Option | Meaning |
| --- | --- |
| `--since <date>`, `--until <date>` | The period, both days included, like `2026-01-31`. Pull requests count by the time they were opened, spend and runs by the time they started, merges and reverts by the time of the merge. Default: everything. |
| `--target <usd>` | The cost per pull request to reach. The report adds it and the gap. |
| `--compute-usd-per-hour <usd>` | What one hour of a run costs in compute, for example a sandbox. Default 0. |
| `--platform-usd <usd>` | What the platform cost in the period: servers, licenses. It is spread over the pull requests. Default 0. |
| `--markdown <file>` | Also write the report as Markdown tables. |
| `--db <file or URL>` | The database: a DuckDB file, or a PostgreSQL URL that starts with `postgres://` or `postgresql://`. Default `$LEDGER_DB`, else `ledger.duckdb`. |

A wrong option or input record exits 2 before anything is written, with the file and line.

## Inputs

`ingest` and `report` read `.json` and `.jsonl` files, and every such file below a folder. A file is one JSON value
(an object or an array of objects) or JSON Lines. Each object is one of:

| Record | Recognized by | Used for |
| --- | --- | --- |
| LiteLLM spend log row, as `GET /spend/logs` returns it | `request_id` and `spend` | Inference cost. `startTime` is the time, `model` the model; `metadata.spend_logs_metadata."osf.run.id"` names the run. |
| OTLP/JSON trace export request, as runlog writes it | `resourceSpans` | Runs: every span `invoke_agent` with the `run-record` attributes. |
| CloudEvent of the [contracts](../../contracts/README.md) | `specversion` | `work.received@v1` (kickoff), `pr.opened@v1`, `pr.reviewed@v1`, `pr.closed@v1`. Each is checked against its schema; other types are counted and skipped. |

A record with the same key replaces the one in the database (spend: `request_id`; run: `osf.run.id`; pull
request: its URL; review: the event's source and ID), so ingesting a file again changes nothing.

To attribute a gateway call to a run, the launcher sends LiteLLM's metadata with each call:
`{"metadata": {"spend_logs_metadata": {"osf.run.id": "<run id>"}}}`.

## How the numbers are made

- **Inference cost of a run:** the sum of its spend rows, or its `osf.cost.usd` when no spend row names it. A spend
  row without a known run is unattributed and shown as its own line.
- **Runs of a pull request:** the run lists it in `osf.pull_request.urls`, `pr.opened@v1` names the run, or both
  share the work item. A run of several pull requests splits its cost evenly.
- **Cost per pull request:** the period's inference, compute (run hours times `--compute-usd-per-hour`) and
  platform cost, divided by the pull requests opened in the period.
- **Agent type:** `gen_ai.agent.name`, else the harness. A run is **top-level** unless its `invoke_agent` span lies
  below another run's `invoke_agent` span in the same trace.
- **Kickoff:** the time of the work item's `work.received@v1`, else the start of the pull request's first run.
- **First human review:** the first `pr.reviewed@v1` that is not `automated`. A **human interaction** is a review
  or a comment by a person.
- **Revert:** a merged pull request whose title starts with `Revert "`, as the revert button of GitHub, GitLab and
  Forgejo writes it. The revert rate is reverts divided by merged pull requests.

Amounts are rounded to cents, shares to four digits; durations are medians in hours.

## Views

The database is yours to query, for example with the DuckDB CLI: `duckdb ledger.duckdb "FROM pr_cost"`, with
`psql`, or with `ledger query "FROM pr_cost"` on either engine. The views are the public SQL surface ([`sql/duckdb/views.sql`](sql/duckdb/views.sql),
[`sql/postgres/views.sql`](sql/postgres/views.sql)), the same on both engines; the tables below them are private.

| View | One row per | Columns |
| --- | --- | --- |
| `run_cost` | run | `run_id`, `work_item_id`, `source`, `requester_id`, `agent`, `model`, `started_at`, `ended_at`, `top_level`, `hours`, `inference_usd` |
| `spend_attributed` | spent amount | `spent_at`, `usd`, `run_id`, `source`, `user_id`, `agent`, `model` |
| `pr_runs` | run of a pull request | `pr_url`, `run_id`, `share` |
| `pr_flow` | pull request | `url`, `title`, `author_id`, `opened_at`, `kickoff_at`, `first_human_review_at`, `merged_at`, `closed_at`, `is_revert`, `human_interactions` |
| `pr_cost` | pull request | `url`, `title`, `opened_at`, `inference_usd`, `hours` |

## PostgreSQL and Grafana

A team keeps its numbers in PostgreSQL and looks at them in Grafana. Point `--db` or `LEDGER_DB` at a PostgreSQL
database; set the variable to keep the password off the command line:

```sh
export LEDGER_DB=postgres://ledger:<password>@db.internal:5432/ledger
npx @opensoftware/ledger ingest spend/ runs/ events/
npx @opensoftware/ledger report --markdown report.md
```

ledger creates the same tables and views in the first schema of the connection's `search_path` (normally `public`),
and `report` gives the same report as from a DuckDB file. Output shows the URL as `postgres://ledger:***@...`. Run
`ingest` from a cron job or CI to keep the database current; records already there are replaced, never doubled.

`ledger dashboard` writes `ledger-dashboard.json`. Import it in Grafana (Dashboards, New, Import) and pick a
PostgreSQL data source for the database. Its panels read only the views: cost per pull request and its split, revert
rate, human interactions, unattributed spend, pull requests opened and merged per day, spend per day, median cycle
time by segment, human interactions per day, spend by source, user, agent and model, the 20 most expensive pull
requests and runs by agent type. The time picker sets the period. The variables `compute_usd_per_hour` and
`platform_usd` do what `--compute-usd-per-hour` and `--platform-usd` do for `report`; `platform_usd` is the
platform cost of the period the time picker shows.

## Report

`report.json` holds `period`, `pullRequests` (opened, merged, per day), `cost` (the period's total, inference,
compute, platform), `costPerPullRequest` (the same per pull request, with `target` and `gap`; `null` without pull
requests), `spend` (total, unattributed, and `bySource`, `byUser`, `byAgent`, `byModel` with each group's share),
`topPullRequests` (the 20 most expensive), `cycleTime` (median hours of `kickoffToPullRequest`, `kickoffToMerge`,
`pullRequestToFirstHumanReview`, `firstHumanReviewToMerge`), `humanInteractions` (per pull request, per day),
`runs` (total, top-level, by agent) and `revertRate` (rate, reverts, merged). Read cost next to throughput and the
revert rate: a cheaper pull request is no gain when more of them are reverted.

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/ledger/`. Merging it
creates the tag `ledger-v<version>`, and `.github/workflows/publish-ledger.yml` builds `dist/` and publishes
`@opensoftware/ledger` to npm with `sql/` and `grafana/`. The first release is `0.1.0`; until `1.0.0`, a breaking change raises the minor
version. The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)),
with a trusted publisher for `publish-ledger.yml`. No credential is stored in the repository.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OUTPUT` | string | `"."` | Folder of report.json and ledger-dashboard.json when --out is not given. |
| `LEDGER_DB` | string | `"ledger.duckdb"` | Default of --db: a DuckDB file, or a PostgreSQL URL like postgres://user:password@host:5432/ledger. Keeps the password off the command line. |

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-LEDGER-001 | implemented | A new user computes the cost per pull request of the sample file from the README |
| SCN-LEDGER-002 | implemented | The help lists every command |
| SCN-LEDGER-003 | implemented | Ingest counts the runs, spend rows and events it read |
| SCN-LEDGER-004 | implemented | Ingesting the same file twice counts each record once |
| SCN-LEDGER-005 | implemented | A folder is read with every JSON and JSON Lines file below it |
| SCN-LEDGER-006 | implemented | The answer of LiteLLM's spend logs endpoint is read as spend rows |
| SCN-LEDGER-007 | implemented | A line that is no run, spend row or event is refused with its file and line |
| SCN-LEDGER-008 | implemented | An event that breaks its contract is refused with its file, line and path |
| SCN-LEDGER-009 | implemented | An event of another type is skipped and counted |
| SCN-LEDGER-010 | implemented | The cost per pull request is the total spend divided by the pull requests |
| SCN-LEDGER-011 | implemented | The cost per pull request is split into compute, platform and inference |
| SCN-LEDGER-012 | implemented | Spend is sliced by source, user, agent and model |
| SCN-LEDGER-013 | implemented | Spend without a run is reported as unattributed |
| SCN-LEDGER-014 | implemented | A run without spend rows counts its own cost |
| SCN-LEDGER-015 | implemented | Spend rows of a run replace the run's own cost |
| SCN-LEDGER-016 | implemented | The 20 most expensive pull requests are listed |
| SCN-LEDGER-017 | implemented | A run that belongs to two pull requests splits its cost evenly |
| SCN-LEDGER-018 | implemented | A run belongs to the pull request of its work item |
| SCN-LEDGER-019 | implemented | The report shows the gap to a cost target |
| SCN-LEDGER-020 | implemented | The report shows human interactions per pull request and their trend per day |
| SCN-LEDGER-021 | implemented | The report shows the median cycle time by segment |
| SCN-LEDGER-022 | implemented | Without a work item event the kickoff is the start of the pull request's first run |
| SCN-LEDGER-023 | implemented | A review by an agent or a bot is not a human review |
| SCN-LEDGER-024 | implemented | The report shows pull requests opened and merged per day |
| SCN-LEDGER-025 | implemented | The report shows total and top-level runs by agent type |
| SCN-LEDGER-026 | implemented | The revert rate is shown next to throughput and cost |
| SCN-LEDGER-027 | implemented | The options "--since" and "--until" limit the period |
| SCN-LEDGER-028 | implemented | The report is written as Markdown with throughput, cycle time, cost and revert rate |
| SCN-LEDGER-029 | implemented | Without pull requests the cost per pull request is empty |
| SCN-LEDGER-030 | implemented | Ingest writes into the PostgreSQL database that "LEDGER_DB" names and hides its password |
| SCN-LEDGER-031 | implemented | The report from PostgreSQL equals the report from a DuckDB file |
| SCN-LEDGER-032 | implemented | Ingesting the same file twice into PostgreSQL counts each record once |
| SCN-LEDGER-033 | implemented | "ledger query" prints the rows of the view "pr_cost" in PostgreSQL |
| SCN-LEDGER-034 | implemented | The dashboard asks for a PostgreSQL data source on import |
| SCN-LEDGER-035 | implemented | Every panel of the dashboard reads the views of the database |
| SCN-LEDGER-036 | implemented | The panel "Cost per pull request" shows the cost of the README sample |
| SCN-LEDGER-037 | implemented | The dashboard variables add compute and platform cost |
| SCN-LEDGER-038 | implemented | A database that refuses the password exits 1 without printing the password |
