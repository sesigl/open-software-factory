# AGENTS.md for module `factory-spec`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0020, ADR 0022.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `factory <command>` (see `README.md#commands`)
- Library: `resolveFactory` from `@opensoftware/factory-spec` (`src/index.ts`)
- Input: `factory.yaml` (the `factory-definition` contract), its prompts and skills, and `factory.lock`, in the
  current folder (`$INPUT` in tests)
- Output folder: `$OUTPUT`; state folder: `OSF_DATA`
- Outside systems: the MCP Registry at `FACTORY_MCP_REGISTRY`, only in `factory plan`; the webhooks of the Forgejo at
  `FACTORY_FORGE_URL`, in `factory apply` and `factory plan` (ADR 0022)
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`, `src/index.ts`) → `commands` →
`adapters` → `domain`. `domain` holds the pure rules (lint, resolve, render, diff); `adapters` read and write
files, the registry, Git and the state; `commands` join them. The ARCH check enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 120 seconds in total on the CI runner.

## Scenario prefix

`SCN-FSPEC-NNN`
