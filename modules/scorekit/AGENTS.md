# AGENTS.md for module `scorekit`

Adds rules for this module. The root `AGENTS.md` applies in full. Decision: ADR 0032, ADR 0033 (export to Langfuse).

## Public surface

The only ways a system test or another program may use this module:

- CLI: `scorekit <command>` (see `README.md#commands`)
- Input: the runs files and folders, scorer files, labels files and score files named on the command line, in the
  current folder (`$INPUT` in tests); the scorer pack in `scorers/`
- Output: `scores.jsonl`, `calibration.json`, `report.json` and `evaluators.json` in `$OUTPUT` (or `--out`), the Markdown report named by
  `--markdown`, and the lines on standard output and error
- Outside systems: the judge's OpenAI-compatible gateway at `SCOREKIT_INFERENCE_URL` (`fakes.modelGateway` or
  `fakes.http` in tests) and Langfuse's score, evaluator and evaluation-rule APIs at `LANGFUSE_HOST` (`fakes.http`)
- Formats: the `score` contract (`contracts/score/`), written and read; OTLP/JSON runs with the `run-record`
  attributes, read only
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` holds the scorer format, the runs, the transcript, the sampling, the judge messages and verdict,
the score, the calibration and the report, without I/O; `adapters` read and write files and call the gateway and
Langfuse over HTTP; `commands` join them. The ARCH check enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner.

## Scenario prefix

`SCN-SCORE-NNN`
