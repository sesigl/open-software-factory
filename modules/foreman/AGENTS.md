# AGENTS.md for module `foreman`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0004, ADR 0067, ADR 0068, ADR 0069, ADR 0070, ADR 0071, ADR 0107, ADR 0109, ADR 0111, ADR 0115, ADR 0126, ADR 0139, ADR 0142, ADR 0146, ADR 0151, ADR 0158.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `foreman <command>` (see `README.md#commands`)
- HTTP API of `foreman serve` on `PORT`: `/v1/runs` (OpenAPI in `contracts/openapi/openapi.json`, see `README.md#api`)
- Input: the factory in `FOREMAN_FACTORY` and its prompts, at a commit of its Git repository
- Outside systems it drives: the sandbox adapter in `FOREMAN_SANDBOXES`, the forge adapter in `FOREMAN_FORGES`, the
  inference adapter in `FOREMAN_INFERENCES` and the secrets adapters in `FOREMAN_SECRETS` as command lines, the harness adapters in
  `FOREMAN_HARNESSES` over ACP, gatekeeper at
  `FOREMAN_GATEKEEPER_URL`, Temporal at `FOREMAN_TEMPORAL_ADDRESS`, the key sets of the issuers of person proofs in
  `FOREMAN_PERSON_KEYS` (ADR 0151)
- Server state: the workflows in Temporal and the runs' folders in `OSF_DATA`; private to the module, except the folder
  of a run that a person took over, which the run shows as `folder` (ADR 0070)
- Events: `work.received@v1`, `work.retry-requested@v1` and `gate.decided@v1` in, `run.started@v1` and `run.completed@v1` out
  (`contracts/events/`), on NATS at `FOREMAN_NATS_URL`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `workflows` →
`adapters` → `domain`. `domain` checks a definition, derives IDs, takes the next step of a run and applies each fact to
its view, finds the run's pull request and reads its checks, and builds the events, without I/O. `adapters` read the
factory and its commit, run a sandbox adapter's commands and a forge adapter's `pr` and `prs`, run a harness adapter over ACP,
run an inference adapter's `start`, `key` and `stop` and a secrets adapter's `exists`, call gatekeeper and NATS. `workflows` holds the Temporal workflow `run.ts`
and the activities; `commands` join them: `serve` runs Fastify, the Temporal worker and the NATS subscriptions. The ARCH check enforces the layers.
`serve` checks a person proof of `@opensoftware/person-proof` in Fastify, before a signal or a retry reaches
Temporal, on the body's bytes that its JSON parser keeps (ADR 0151): a workflow never sees a proof.

`src/workflows/run.ts` runs in Temporal's sandbox inside a worker thread and must stay deterministic: it imports only
types and `@temporalio/workflow`, and asks the local activities `next` and `apply` for every decision, so the logic
runs in `domain` in the worker's own thread. `pnpm build` bundles it into `dist/workflows.bundle.js`.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 360 seconds of wall time on the CI runner.
- Most of it: the starts of `foreman serve` and of each stage's harness adapter, in a namespace of the
  Temporal dev server per scenario (ADR 0129).

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-FORE-NNN`
