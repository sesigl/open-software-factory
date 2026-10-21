# AGENTS.md for module `spec-trace`

Adds rules for this module. The root `AGENTS.md` applies in full. Decision: ADR 0030.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `spec-trace <command>` (see `README.md#commands`)
- GitHub Action: `action.yml` with its script `action.sh`, run in tests with `sut.action` (see `README.md#github-action`)
- Input: the repository in the current folder (`$INPUT` in tests): feature files, test files, JUnit XML reports,
  `spec-trace.json` or the file named by `--config`, a Markdown prefix table, proof bundles named by `--evidence`,
  and the Git history for `--base`
- Output: the lines of `check` and `next-id`; the report file (`$OUTPUT/spec-trace.json` or `--out`); the Markdown
  summary named by `--summary`; the action's output `report` and job summary
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

## Quality limits

Checked by DUP and MUTATION (ADR 0035):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-TRACE-NNN`
