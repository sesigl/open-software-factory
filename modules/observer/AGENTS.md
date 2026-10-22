# AGENTS.md for module `observer`

Adds rules for this module. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `observer <command>` (see `README.md#commands`)
- HTTP API: `contracts/observer/openapi.yaml` (server mode only)
- Events: `contracts/observer/asyncapi.yaml`
- Input folder: `$INPUT`, output folder: `$OUTPUT`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `adapters` → `domain`. A file
imports only its own layer and the layers below it. The ARCH check enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-OBS-NNN`
