# AGENTS.md for adapter `sandbox/kubernetes`

Adds rules for this adapter. The root `AGENTS.md` applies in full. Decisions: ADR 0054, ADR 0055.

## Public surface

The only ways a system test or another program may use this adapter:

- CLI: `sandbox-kubernetes create | exec | copy | snapshot | destroy | list | egress-log` (see `README.md#commands`)
- Input: the `sandbox-spec` file named on the command line (contracts), and the secret files in `OSF_SECRETS_DIR`
- Output: the sandbox's ID, the command's output and exit code, copied files, and the egress log on standard output
- State: none of its own. The cluster holds each sandbox's claim, pods, Service, ConfigMaps and Secrets, found by the
  label `osf.sandbox.id`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` names the parts of a sandbox and writes their Kubernetes resources, without I/O; `adapters` run
kubectl; `commands` join them. The spec, the secrets, iron-proxy's configuration and the egress log come from
`@opensoftware/sandbox-egress`. The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 480 seconds in total on the CI runner. Each conformance scenario starts one or two sandboxes, each a
  pod from agent-sandbox and an egress pod, so a cluster with agent-sandbox must run. CI starts kind and loads the
  images `curlimages/curl`, `ironsh/iron-proxy` and `hello-world` into it before the tests.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-SKUBE-NNN` in `features/`, and the `@conformance` scenarios of the port: `SCN-SANDBOX-NNN` in
`ports/sandbox/features/`.
