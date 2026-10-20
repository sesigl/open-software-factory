# AGENTS.md for module `runlog`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0023, ADR 0024, ADR 0025, ADR 0027.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `runlog <command>` (see `README.md#commands`)
- Input: a Claude Code or Codex session file or an `opencode export` file, named on the command line, or folders of
  them for `watch`, in the current folder (`$INPUT` in tests); the Git repository in the current folder for the
  commit, the author and the files Agent Trace attributes; `TRACEPARENT` from the launcher for `attach`
- Output: `$OUTPUT/collector.yaml` from `runlog collector`, which a test runs in `fakes.collector`;
  `$OUTPUT/runs.jsonl` (OTLP/JSON lines) or `$OUTPUT/<run id>.jsonl` with `--per-run`, or OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT`; the Agent Trace
  record at the path of `--agent-trace`
- State: `watch.json` in `OSF_DATA`, which tests never read
- Formats: the `run-record` contract (`contracts/run-record/`) and the OTLP trace format
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` maps a session file to a run and to an Agent Trace record and has no I/O; `adapters` read files
and folders, ask Git, keep the watch state and write or send OTLP with the OpenTelemetry SDK; `commands` join them
and check the run against the contract. The ARCH check enforces this. `collector/` holds the Collector config pack
(ADR 0025); the package ships it and `adapters` copies it.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 120 seconds in total on the CI runner. The Collector scenarios need Docker.

## Scenario prefix

`SCN-RUN-NNN`
