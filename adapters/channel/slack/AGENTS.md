# AGENTS.md for adapter `channel/slack`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decision: ADR 0059.

## Public surface

The only ways a system test or another program may use this adapter:

- CLI: `channel-slack receive | reply | ask` (see `README.md#commands`)
- Input: the arguments, and for `receive` a delivery file `{"headers", "body"}`
- Output: JSON lines on standard output
- State: none of its own. Slack holds every message, thread and card
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `adapters` → `domain`. The entry
hands the adapter's channel to `runChannel` of `@opensoftware/channel-kit`, which reads the command line and the
delivery file. `domain` checks Slack's signature and builds the work item and the decision, without I/O; `adapters` builds the Chat SDK's `Chat` with its Slack adapter, registers its handlers, posts and names a refused token. The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner, counted as the sum of the scenarios' times. Each scenario
  starts the testkit's in-process fake Slack, so no Docker is needed; the sum is about 15 seconds.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

The `@conformance` scenarios of the port: `SCN-CHANNEL-NNN` in `ports/channel/features/`. Its own scenarios:
`SCN-CSLACK-NNN` in `features/`.
