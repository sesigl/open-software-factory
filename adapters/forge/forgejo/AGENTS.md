# AGENTS.md for adapter `forge/forgejo`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decision: ADR 0057.

## Public surface

The only ways a system test or another program may use this adapter:

- CLI: `forge-forgejo branch | commit | open-pr | pr | prs | check | comment | comments | protect | rules | close |
  merge | webhook | hooks | unhook | event` (see `README.md#commands`)
- Input: the arguments, and for `event` a delivery file `{"headers", "body"}`
- Output: JSON lines on standard output
- State: none of its own. The forge holds every branch, pull request, status, rule and webhook
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` checks a delivery's signature and turns it into a CloudEvent, without I/O; `adapters` calls
Forgejo's REST API v1 and names a refused token and a missing repository; `commands` join them. The ARCH check
enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 120 seconds of wall time on the CI runner.
- Most of it: each Vitest worker starts one Forgejo, about 6 s (ADR 0064); the webhook scenarios wait for
  its deliveries. Docker must run.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

The `@conformance` scenarios of the port: `SCN-FORGE-NNN` in `ports/forge/features/`. The adapter's own scenarios:
`SCN-FFORGEJO-NNN` in `features/`.
