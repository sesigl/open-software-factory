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

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `adapters` → `domain`. `domain`
decides tool calls by the allowlist, holds the shape of the session record and builds the run record, without I/O;
`adapters` run the ACP proxy between the client and the agent process and keep the session records in `OSF_DATA`;
`entry` parses the command line. The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 60 seconds in total on the CI runner. The agent behind the adapter is the testkit's scripted harness;
  SCN-HARNESS-006 waits the 3 seconds of the cancel deadline.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

The `@conformance` scenarios of the port: `SCN-HARNESS-NNN` in `ports/harness/features/`.
