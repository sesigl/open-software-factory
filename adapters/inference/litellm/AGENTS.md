# AGENTS.md for adapter `inference/litellm`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decision: ADR 0056.

## Public surface

The only ways a system test or another program may use this adapter:

- CLI: `inference-litellm start | key | revoke | spend-log | stop | list` (see `README.md#commands`)
- HTTP: the gateway's OpenAI-compatible API at the URL `start` printed, called with a key from `key`
- Input: the LiteLLM config named on the command line, and the variables `OSF_SECRET_*` it names, including the
  master key of a running proxy that `osf.proxy` names
- Output: the gateway's ID and URL, keys, and the spend log on standard output
- State: the Docker host holds each started gateway's LiteLLM and PostgreSQL containers and its network, found by name
  and label, and the volume `osf-inference-python` with LiteLLM's compiled Python files, which all gateways share. An
  attached gateway's record and the hashed tokens of its run keys are in `OSF_DATA/gateways/`, private to the adapter
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` names a gateway's parts and images, turns the user's LiteLLM config into the gateway's and reads
`osf.proxy`, without I/O; `adapters` run the Docker CLI, call LiteLLM's admin API and keep the records of attached
gateways; `commands` join them. The ARCH check enforces the
layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 280 seconds of wall time on the CI runner.
- Most of it: twelve port scenarios each start a gateway, a LiteLLM and a PostgreSQL container; Docker must run.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

The `@conformance` scenarios of the port: `SCN-INFER-NNN` in `ports/inference/features/`. The adapter's own
scenarios: `SCN-INFLITE-NNN` in `features/`.
