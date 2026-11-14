# AGENTS.md for adapter `secrets/openbao`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decision: ADR 0137.

## Public surface

The only ways a system test or another program may use this adapter:

- CLI: `secrets-openbao put | list | delete | probe | policy` (see `README.md#commands`)
- Input: the arguments, and for `put` the value on standard input
- Output: JSON lines on standard output; for `policy`, the text of an OpenBao policy
- State: none of its own. OpenBao holds every secret, version and person
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` checks a name and holds the two policies, without I/O; `adapters` calls OpenBao's HTTP API and
names a store that does not answer, a refused token and a token without the right; `commands` join them. The ARCH
check enforces the layers.

## Rules

- A value goes from standard input to OpenBao and nowhere else: never into an argument, a variable, a line of output
  or an error. SCN-SECRET-009 searches every output for it.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner, counted as the sum of the scenarios' times. Each Vitest worker
  starts one OpenBao in development mode, under a second, and its scenarios share it, each with a mount of its own
  (ADR 0137). A scenario runs the adapter's CLI one to five times, about 0.15 seconds each; SCN-SOPENBAO-004 pipes
  33 MiB. Measured on a 4-core machine: 26 scenarios, 7 seconds of wall time and 19 seconds summed.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

The `@conformance` scenarios of the port: `SCN-SECRET-NNN` in `ports/secrets/features/`. The adapter's own scenarios:
`SCN-SOPENBAO-NNN` in `features/`.
