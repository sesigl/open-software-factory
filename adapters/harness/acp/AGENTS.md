# AGENTS.md for adapter `harness/acp`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decision: ADR 0050.

## Public surface

The only ways a system test or another program may use this adapter:

- ACP on stdio: `harness-acp run [--allow <kinds>] -- <agent command>...` (see `README.md#how-it-behaves`)
- CLI: `harness-acp transcript <session ID>` (see `README.md#commands`)
- Output: `$OUTPUT/run-record.json` and `$OUTPUT/transcript.jsonl`
- State: the session records in `OSF_DATA/sessions/`, private to the adapter
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

One layer in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) parses the command line and hands the rest to
`@opensoftware/harness-proxy`, which holds the proxy, the allowlist, the session records and the run record
(ADR 0052). The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner. The agent behind the adapter is the testkit's scripted harness;
  SCN-HARNESS-013 waits 4 seconds after a cancel.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-HACP-NNN` in `features/`, and the `@conformance` scenarios of the port: `SCN-HARNESS-NNN` in
`ports/harness/features/`.
