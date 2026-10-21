# AGENTS.md for module `ledger`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0034, ADR 0035, ADR 0036.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `ledger <command>` (see `README.md#commands`)
- Input: the spend, run and event files and folders named on the command line, in the current folder (`$INPUT` in
  tests)
- Output: `report.json`, `ledger-dashboard.json` and `pr-events.jsonl` in `$OUTPUT` (or `--out`), the Markdown report named by
  `--markdown`, the lines on standard output and error, and the views of the DuckDB file or the PostgreSQL database
  (`sql/duckdb/views.sql`, `sql/postgres/views.sql`)
- Formats: LiteLLM spend log rows, OTLP/JSON runs with the `run-record` attributes, and the CloudEvents
  `work.received@v1`, `pr.opened@v1`, `pr.reviewed@v1` and `pr.closed@v1` (`contracts/`); `ledger import` writes the three `pr.*`
  events
- The forge API that `ledger import` reads: GitHub's REST API or Forgejo's API v1 (`fakes.http`, `fakes.forge` in tests)
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

System tests read the report and the output of `ledger query`, never the database directly: its tables are
private. The dashboard scenarios run each panel's SQL through `ledger query`.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` turns input records into rows and query results into the report, without I/O; `adapters` read
and write files and talk to DuckDB, PostgreSQL or the forge API; `commands` join them. The SQL of the tables and views lives in `sql/duckdb/` and
`sql/postgres/`: change both in the same commit. `grafana/ledger-dashboard.json` reads only the views.
The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 120 seconds in total on the CI runner. The PostgreSQL and dashboard scenarios need Docker.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-LEDGER-NNN`
