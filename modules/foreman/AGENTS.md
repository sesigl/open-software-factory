# AGENTS.md for module `foreman`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0004, ADR 0067.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `foreman <command>` (see `README.md#commands`)
- HTTP API of `foreman serve` on `PORT`: `/v1/runs` (OpenAPI in `contracts/openapi/openapi.json`, see `README.md#api`)
- Input: the factory in `FOREMAN_FACTORY` and its prompts, at a commit of its Git repository
- Outside systems it drives: the harness adapters in `FOREMAN_HARNESSES` over ACP, gatekeeper at
  `FOREMAN_GATEKEEPER_URL`, Temporal at `FOREMAN_TEMPORAL_ADDRESS`
- Server state: the workflows in Temporal and the runs' folders in `OSF_DATA`; private to the module
- Events: `work.received@v1` and `gate.decided@v1` in, `run.started@v1` and `run.completed@v1` out
  (`contracts/events/`), on NATS at `FOREMAN_NATS_URL`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `workflows` →
`adapters` → `domain`. `domain` checks a definition, derives IDs, takes the next step of a run and applies each fact to
its view, and builds the events, without I/O. `adapters` read the factory and its commit, run a harness adapter over
ACP, call gatekeeper and NATS. `workflows` holds the Temporal workflow `run.ts` and the activities; `commands` join them:
`serve` runs Fastify, the Temporal worker and the NATS subscriptions. The ARCH check enforces the layers.

`src/workflows/run.ts` runs in Temporal's sandbox inside a worker thread and must stay deterministic: it imports only
types and `@temporalio/workflow`, and asks the local activities `next` and `apply` for every decision, so the logic
runs in `domain` in the worker's own thread. `pnpm build` bundles it into `dist/workflows.bundle.js`.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 180 seconds in total on the CI runner (23 scenarios; each starts the Temporal dev server and NATS as
  pinned binaries on the host, ADR 0067, and the built `harness-acp` adapter with the testkit's scripted agent, which
  `turbo.json` builds before the tests).

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-FORE-NNN`
