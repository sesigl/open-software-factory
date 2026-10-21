---
status: accepted
date: 2026-10-21
---

# 0035. ledger writes to PostgreSQL too and ships a Grafana dashboard over its views

## Context

ADR 0034 made ledger a CLI over one DuckDB file. That serves one person on a laptop. A team wants the numbers
always on, shared, and on a dashboard: TODO item T-08 asks for "SQL views for DuckDB and PostgreSQL" and a "Grafana
dashboard JSON", and is done when "our own cost per PR is visible on a dashboard" (SCN-FACTORY-METRIC-001 to 008).

Grafana has a built-in PostgreSQL data source. It has no built-in DuckDB data source, and it cannot open a file
that a CLI writes on another machine.

This change is the second slice of T-08: the PostgreSQL tables and views, `ingest` and `report` on PostgreSQL, and a
Grafana dashboard over the views.

## Decision

- **One option for both engines.** `--db` takes a file path (DuckDB, as before) or a URL that starts with
  `postgres://` or `postgresql://` (PostgreSQL). The new variable `LEDGER_DB` is the default of `--db`, so a
  password does not have to be on the command line. ledger never prints a password: output shows the URL with
  `***` in place of it.
- **The same views.** `sql/postgres/tables.sql` and `sql/postgres/views.sql` hold the same tables and views as
  `sql/duckdb/`, with the same names, columns and meaning. ledger creates them in the first schema of the
  connection's `search_path` (normally `public`), inside a transaction that holds an advisory lock, so two
  ingests that start at once do not race. A record with a key that is already there is replaced (`INSERT ... ON
  CONFLICT DO UPDATE`), as in DuckDB.
- **One report.** `ledger report` sends the same queries to both engines. Where the dialects differ (hours between
  two times, a date as text) the adapter of the engine supplies the SQL fragment. The report of the same input is
  the same on both engines.
- **Driver:** node-postgres (`pg`) and its types `@types/pg`, pinned. It is the PostgreSQL client most Node projects
  use. ledger reads `bigint` and `numeric` as numbers and times without a zone as UTC, as DuckDB does.
- **Query.** `ledger query <SQL>` runs one statement on either engine and prints its rows as JSON Lines. A person
  reads the views without installing `psql` or the DuckDB CLI, and the system tests read the database only this way
  (ADR 0016 gives tests no database client).
- **Dashboard.** `ledger dashboard` writes `ledger-dashboard.json` to `$OUTPUT` (or `--out`): a Grafana dashboard
  for import, with one data source input of type `grafana-postgresql-datasource`. The file ships in the package
  (`grafana/ledger-dashboard.json`). Its panels read only the public views and use only the Grafana macros
  `$__timeFrom()` and `$__timeTo()` and the dashboard variables `compute_usd_per_hour` and `platform_usd`. The
  panels follow the report: cost per pull request and its split,
  pull requests opened and merged per day, revert rate, median cycle time by segment, human interactions per pull
  request, spend by source, user, agent and model with the unattributed rest, the 20 most expensive pull requests
  and runs by agent type.
- **Tests.** The PostgreSQL scenarios run against `fakes.postgres` (ADR 0016). The dashboard scenarios run each
  panel's SQL through `ledger query` with the macros and variables filled in as Grafana fills them. They do not
  start Grafana and do not render the panels. Each scenario starts its own PostgreSQL, so the module's budget grows
  from 60 to 120 seconds, like the other modules that need Docker.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `--db` takes a path or a PostgreSQL URL | One option to learn; every command works on both engines | The adapter is picked by the text of a value |
| A separate command `ledger sync` from DuckDB to PostgreSQL | DuckDB stays the only writer | Two steps and two copies of the data for a team |
| DuckDB's `postgres` extension to write to PostgreSQL | One SQL dialect | Downloads a native extension at run time; ledger loads no extension (ADR 0034) |
| node-postgres (`pg`) | Most used, stable API, pure JavaScript | Callback-era API, returns `bigint` and `numeric` as text |
| Postgres.js (`postgres`) | Fast, tagged templates | Smaller user base; templates do not fit SQL text shared with DuckDB |
| Grafana dashboard over PostgreSQL | Built into Grafana; no plugin to install | The team needs PostgreSQL for the dashboard |
| Grafana dashboard over DuckDB with the MotherDuck plugin | No server | Unsigned community plugin; the file must sit next to Grafana |
| Run the panel SQL in tests with the macros filled in | Fast, no Grafana container; catches every wrong column or view | Does not prove the layout renders |
| Start Grafana in tests and query through `/api/ds/query` | Proves the import and the data source | A second container, a shared container network and about 15 seconds per scenario |

## Prior art

- node-postgres `pg` (MIT, maintained by Brian Carlson, active, `8.23.1`): adopted as the driver, with its types
  `@types/pg` (MIT, DefinitelyTyped, active, `8.23.1`).
- Postgres.js `postgres` (Unlicense, active, `3.4.9`): not adopted, see the table.
- Grafana (AGPL-3.0, Grafana Labs, active) and its built-in PostgreSQL data source: adopted as the dashboard
  runtime. ledger ships only a dashboard JSON file and does not link Grafana code.
- MotherDuck DuckDB data source for Grafana (MIT, community plugin, unsigned): not adopted, see the table.
- Apache DevLake (Apache-2.0, active) ships Grafana dashboards over its MySQL or PostgreSQL tables for DORA metrics.
  Its approach (dashboards over SQL views, one data source variable) shaped this one; its panels do not cover runs
  or LLM spend.

## Consequences

- A team runs `ledger ingest` from CI or a cron job into its PostgreSQL and imports one dashboard file into Grafana.
- Every view exists twice, in two dialects. A change to a view changes both files, and the scenario that compares
  the reports of both engines catches a drift in the numbers.
- The dashboard is tested at the level of its SQL. A broken layout shows only when someone imports it. Revisit when
  the testkit gains a Grafana fake.
- Later slices of T-08: an import of a forge's pull requests as `pr.*` events, and the dogfood dashboard of this
  repository.
