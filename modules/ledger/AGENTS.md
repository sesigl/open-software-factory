# AGENTS.md for module `ledger`

Adds rules for this module. The root `AGENTS.md` applies in full. Decision: ADR 0034.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `ledger <command>` (see `README.md#commands`)
- Input: the spend, run and event files and folders named on the command line, in the current folder (`$INPUT` in
  tests)
- Output: `report.json` in `$OUTPUT` (or `--out`), the Markdown report named by `--markdown`, the lines on standard
  output and error, and the views of the DuckDB file (`sql/duckdb/views.sql`)
- Formats: LiteLLM spend log rows, OTLP/JSON runs with the `run-record` attributes, and the CloudEvents
  `work.received@v1`, `pr.opened@v1`, `pr.reviewed@v1` and `pr.closed@v1` (`contracts/`), read only
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

System tests read the report, never the DuckDB file: its tables are private.

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` turns input records into rows and query results into the report, without I/O; `adapters` read
and write files and talk to DuckDB; `commands` join them. The SQL of the tables and views lives in `sql/duckdb/`.
The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner.

## Scenario prefix

`SCN-LEDGER-NNN`
