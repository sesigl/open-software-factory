# AGENTS.md for module `factory-spec`

Adds rules for this module. The root `AGENTS.md` applies in full.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `factory-spec <command>` (see `README.md#commands`)
- HTTP API: `contracts/factory-spec/openapi.yaml` (server mode only)
- Events: `contracts/factory-spec/asyncapi.yaml`
- Input folder: `$INPUT`, output folder: `$OUTPUT`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `adapters` → `domain`. A file
imports only its own layer and the layers below it. The ARCH check enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner.

## Scenario prefix

`SCN-FSPEC-NNN`
