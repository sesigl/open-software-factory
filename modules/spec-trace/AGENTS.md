# AGENTS.md for module `spec-trace`

Adds rules for this module. The root `AGENTS.md` applies in full. Decision: ADR 0030.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `spec-trace <command>` (see `README.md#commands`)
- Input: the repository in the current folder (`$INPUT` in tests): feature files, test files, JUnit XML reports,
  `spec-trace.json` or the file named by `--config`, a Markdown prefix table, and proof bundles named by `--evidence`
- Output: the lines of `check` and `next-id`; the report file (`$OUTPUT/spec-trace.json` or `--out`)
- Formats: the `evidence-bundle` contract (`contracts/evidence-bundle/`), read only
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` holds the settings, the four rules, the report and the next ID, without I/O; `adapters` list and
read the files of the repository, parse feature files, read test ASTs with ts-morph, read JUnit XML and proof
bundles; `commands` join them. The ARCH check enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 120 seconds in total on the CI runner.

## Scenario prefix

`SCN-TRACE-NNN`
