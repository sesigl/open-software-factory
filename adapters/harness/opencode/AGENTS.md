# AGENTS.md for adapter `harness/opencode`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decision: ADR 0053.

## Public surface

The only ways a system test or another program may use this adapter:

- ACP on stdio: `harness-opencode run [--allow <kinds>]` (see `README.md#how-it-behaves`)
- CLI: `harness-opencode transcript <session ID>` (see `README.md#commands`)
- Output: `$OUTPUT/run-record.json` and `$OUTPUT/transcript.jsonl`
- State: the session records and opencode's settings, logins and sessions in `OSF_DATA`, private to the adapter
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

One layer in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) parses the command line, names opencode's
binary, its configuration with the permissions of each session, and its environment, and hands the rest to `@opensoftware/harness-proxy`.
Code that another harness adapter needs goes into that library, not here. The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 80 seconds of wall time on the CI runner.
- Most of it: each test starts the real opencode against `fakes.modelGateway`, about 2 s to a first turn.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-HOPENCODE-NNN` in `features/`, and the `@conformance` scenarios of the port: `SCN-HARNESS-NNN` in
`ports/harness/features/`.
