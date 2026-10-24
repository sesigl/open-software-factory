# AGENTS.md for adapter `inference/litellm`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decision: ADR 0056.

## Public surface

The only ways a system test or another program may use this adapter:

- CLI: `inference-litellm start | key | spend-log | stop | list` (see `README.md#commands`)
- HTTP: the gateway's OpenAI-compatible API at the URL `start` printed, called with a key from `key`
- Input: the LiteLLM config named on the command line, and the variables `OSF_SECRET_*` it names
- Output: the gateway's ID and URL, keys, and the spend log on standard output
- State: none of its own. The Docker host holds each gateway's LiteLLM and PostgreSQL containers and its network,
  found by name and label
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` names a gateway's parts and images and turns the user's LiteLLM config into the gateway's, without
I/O; `adapters` run the Docker CLI and call LiteLLM's admin API; `commands` join them. The ARCH check enforces the
layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 300 seconds in total on the CI runner. Each conformance scenario starts its own gateway, a LiteLLM
  and a PostgreSQL container, which takes about 25 seconds, so Docker must run. The images are pulled before the
  tests in CI.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

The `@conformance` scenarios of the port: `SCN-INFER-NNN` in `ports/inference/features/`. The adapter has no
scenarios of its own yet.
