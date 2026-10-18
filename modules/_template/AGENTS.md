# AGENTS.md for module `<name>`

Adds rules for this module. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `<name> <command>` (see `README.md#commands`)
- HTTP API: `contracts/<name>/openapi.yaml` (server mode only)
- Events: `contracts/<name>/asyncapi.yaml`
- Input folder: `$INPUT`, output folder: `$OUTPUT`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner.

## Scenario prefix

`SCN-<PREFIX>-NNN`
