# AGENTS.md for module `runlog`

Adds rules for this module. The root `AGENTS.md` applies in full. Decision: ADR 0023.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `runlog <command>` (see `README.md#commands`)
- Input: a Claude Code or Codex session file, named on the command line, in the current folder (`$INPUT` in tests);
  the Git repository in the current folder for the commit and the author
- Output: `$OUTPUT/runs.jsonl` (OTLP/JSON lines), or OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT`
- Formats: the `run-record` contract (`contracts/run-record/`) and the OTLP trace format
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` maps a session file to a run and has no I/O; `adapters` read the file, ask Git and write or send
OTLP with the OpenTelemetry SDK; `commands` join them and check the run against the contract. The ARCH check
enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner.

## Scenario prefix

`SCN-RUN-NNN`
