# AGENTS.md for module `factory-spec`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0020, ADR 0022, ADR 0060.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `factory <command>` (see `README.md#commands`)
- Library: `resolveFactory` from `@opensoftware/factory-spec` (`src/index.ts`)
- Input: `factory.yaml` (the `factory-definition` contract), its prompts and skills, and `factory.lock`, in the
  current folder (`$INPUT` in tests)
- Output folder: `$OUTPUT`; state folder: `OSF_DATA`
- Outside systems: the MCP Registry at `FACTORY_MCP_REGISTRY`, only in `factory plan`; the forge port's adapters
  (`FACTORY_FORGEJO_ADAPTER`, `FACTORY_GITHUB_ADAPTER`) as separate processes, in `factory plan` and `factory apply`
  when the factory has forgejo or github automations. The system tests pass the built adapters of this repository
  with `sut.adapter`, so `turbo.json` builds them first.
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`, `src/index.ts`) → `commands` →
`adapters` → `domain`. `domain` holds the pure rules (lint, resolve, render, diff); `adapters` read and write
files, the registry, the forge adapters, Git and the state; `commands` join them. The ARCH check enforces this.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 300 seconds in total on the CI runner.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-FSPEC-NNN`
