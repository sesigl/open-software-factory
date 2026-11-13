# AGENTS.md for module `foreman`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0004, ADR 0067, ADR 0068, ADR 0069, ADR 0070, ADR 0071.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `foreman <command>` (see `README.md#commands`)
- HTTP API of `foreman serve` on `PORT`: `/v1/runs` (OpenAPI in `contracts/openapi/openapi.json`, see `README.md#api`)
- Input: the factory in `FOREMAN_FACTORY` and its prompts, at a commit of its Git repository
- Outside systems it drives: the sandbox adapter in `FOREMAN_SANDBOXES`, the forge adapter in `FOREMAN_FORGES` and the
  inference adapter in `FOREMAN_INFERENCES` as command lines, the harness adapters in
  `FOREMAN_HARNESSES` over ACP, gatekeeper at
  `FOREMAN_GATEKEEPER_URL`, Temporal at `FOREMAN_TEMPORAL_ADDRESS`
- Server state: the workflows in Temporal and the runs' folders in `OSF_DATA`; private to the module, except the folder
  of a run that a person took over, which the run shows as `folder` (ADR 0070)
- Events: `work.received@v1`, `work.retry-requested@v1` and `gate.decided@v1` in, `run.started@v1` and `run.completed@v1` out
  (`contracts/events/`), on NATS at `FOREMAN_NATS_URL`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `workflows` →
`adapters` → `domain`. `domain` checks a definition, derives IDs, takes the next step of a run and applies each fact to
its view, finds the run's pull request and reads its checks, and builds the events, without I/O. `adapters` read the
factory and its commit, run a sandbox adapter's commands and a forge adapter's `pr`, run a harness adapter over ACP,
run an inference adapter's `start`, `key` and `stop`, call gatekeeper and NATS. `workflows` holds the Temporal workflow `run.ts`
and the activities; `commands` join them: `serve` runs Fastify, the Temporal worker and the NATS subscriptions. The ARCH check enforces the layers.

`src/workflows/run.ts` runs in Temporal's sandbox inside a worker thread and must stay deterministic: it imports only
types and `@temporalio/workflow`, and asks the local activities `next` and `apply` for every decision, so the logic
runs in `domain` in the worker's own thread. `pnpm build` bundles it into `dist/workflows.bundle.js`.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 430 seconds in total on the CI runner (107 scenarios; each starts the Temporal dev server and NATS as
  pinned binaries on the host, ADR 0067, and the built `harness-acp` adapter with the testkit's scripted agent, which
  `turbo.json` builds before the tests; sandboxed stages use the testkit's fake sandbox adapter, ADR 0068; checks use
  `fakes.github` and the built `forge-github` adapter, ADR 0069; the gateway uses the testkit's fake inference adapter,
  ADR 0070).
- Measured for 320 s: on main, 72 scenarios took 234 s on the CI runner (3.3 s each, of which about 0.7 s is the
  Temporal dev server and most of the rest the start of `foreman serve`). Wave 5 adds 11 scenarios of about 4 s each
  (durable events, health, traces, evidence), two of which start the foreman twice. The same 72 scenarios took 261 s
  in another run on the same runner type, so the budget keeps about 10% for the runner.
- Measured for 430 s: T-38's retry (ADR 0105) adds 21 scenarios. On a development machine, the 86 scenarios before
  it took 286 s in one run and 312 s in another, so the machine varies by about 10%. In the second run the 21 new
  ones took 82 s (3.9 s each; the two refusals that need no run 1.7 s, which is the start of Temporal and `foreman
  serve`), 393 s in total, and 405 s in a third run; its runner benchmark took 1.25 times the reference. Each new
  run is a second workflow with its own stages, so most new scenarios run two runs. The budget keeps about 6% above
  the slowest run.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-FORE-NNN`
