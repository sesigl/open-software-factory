# AGENTS.md for module `taskcapture`

Adds rules for this module. The root `AGENTS.md` applies in full. Decision: ADR 0042.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `taskcapture <command>` (see `README.md#commands`)
- Input: a merged pull request on GitHub or Forgejo, read from the forge API at `TASKCAPTURE_FORGE_URL` and from Git
  (the clone URL of the pull request's repository, or the Git repository named with `--git`, `.` in tests); Harbor
  trial results (`result.json`) below the folders named on the command line; a `report.json` and a LiteLLM config
  for `route`
- Output: the suite folder (`$OUTPUT/suite` or `--suite`) with one Harbor task folder per pull request and the task
  `prompt-injection`; `$OUTPUT/report.json` (or `--out`) and the files of `--markdown` and `--chart`;
  `$OUTPUT/litellm-config.yaml` (or `--out`)
- Formats: Harbor's task folder (`schema_version = "1.4"`) and trial `result.json`; LiteLLM's proxy config
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` parses the pull request URL, splits the changed files into tests and solution, writes the text of
each task file, computes the cells, the picks and the Pareto front, and edits the LiteLLM config, without I/O;
`adapters` call the forge API, run Git and tar, and read and write files; `commands` join them. The ARCH check
enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner. SCN-TASK-004 needs Docker (Forgejo); the other capture
  scenarios read a Git repository in $INPUT and a scripted GitHub API.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-TASK-NNN`
