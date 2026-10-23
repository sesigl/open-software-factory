# AGENTS.md for adapter `sandbox/docker`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decision: ADR 0054.

## Public surface

The only ways a system test or another program may use this adapter:

- CLI: `sandbox-docker create | exec | copy | snapshot | destroy | list | egress-log` (see `README.md#commands`)
- Input: the `sandbox-spec` file named on the command line (contracts), and the secret files in `OSF_SECRETS_DIR`
- Output: the sandbox's ID, the command's output and exit code, copied files, and the egress log on standard output
- State: none of its own. The Docker host holds each sandbox's container, network and egress proxy, found by name
  and label
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` names the parts of a sandbox, turns the spec into the sandbox's environment and limits and into
iron-proxy's configuration, and reads iron-proxy's audit lines, without I/O; `adapters` run the Docker CLI and touch
files on the client's side; `commands` join them. The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 180 seconds in total on the CI runner. Each conformance scenario starts one or two sandboxes, each a
  container and an iron-proxy container, so Docker must run. The images `curlimages/curl` and `ironsh/iron-proxy`
  are pulled before the tests in CI.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-SDOCKER-NNN` in `features/`, and the `@conformance` scenarios of the port: `SCN-SANDBOX-NNN` in
`ports/sandbox/features/`.
