# AGENTS.md for module `foreman`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0004, ADR 0067, ADR 0068, ADR 0069, ADR 0070, ADR 0071, ADR 0107, ADR 0109, ADR 0111, ADR 0115.

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
factory and its commit, run a sandbox adapter's commands and a forge adapter's `pr` and `prs`, run a harness adapter over ACP,
run an inference adapter's `start`, `key` and `stop`, call gatekeeper and NATS. `workflows` holds the Temporal workflow `run.ts`
and the activities; `commands` join them: `serve` runs Fastify, the Temporal worker and the NATS subscriptions. The ARCH check enforces the layers.

`src/workflows/run.ts` runs in Temporal's sandbox inside a worker thread and must stay deterministic: it imports only
types and `@temporalio/workflow`, and asks the local activities `next` and `apply` for every decision, so the logic
runs in `domain` in the worker's own thread. `pnpm build` bundles it into `dist/workflows.bundle.js`.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 480 seconds in total on the CI runner (140 scenarios; each starts the Temporal dev server and NATS as
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
  the slowest run. The events of a second run (SCN-FORE-102, -104, -105) add 15 s: the 110 scenarios took 358 s in
  one run on a development machine, so the budget stays.
- T-39's limits of the waits (ADR 0106) add 5 scenarios, which set the limits to 1 second. On a development machine
  the 115 scenarios took 450 s, of which the 110 before took 427 s: that machine is about 1.19 times slower than the
  one of the 358 s. The 5 new ones took 23 s (4.5 s each), about 19 s on the faster machine, so the 115 come to about
  377 s there and the budget stays.
- T-41's run keys (ADR 0108) add 5 scenarios, of 4.5 to 8 s each (SCN-FORE-121 restarts the foreman). On a
  development machine whose benchmark took 1.61 times the reference, the 124 scenarios took 565 s, of which the 5 new
  ones 32 s; BUDGET divides by the slowdown, 351 s, so the budget stays.
- T-42's pull requests of the forge took the 129 scenarios to 458 s on the reference runner, over the budget. The
  time went to process starts: `foreman serve` took 1.4 s to listen (0.7 to 0.9 s of it imports), each stage 0.45 s to
  start its two Node processes (the harness adapter, then the scripted agent), and each read of the README 0.2 s, as
  `fakes.fromRepository` read every report of the module. Now the foreman and the testkit's processes use Node's
  compile cache, the worker loads the workflow bundle while the client connects, the harness proxy starts its agent
  before it loads the ACP SDK, and `fromRepository` reads a file when the test takes it. `foreman serve` listens
  after 1.0 s and a stage starts in 0.3 s: on a development machine the 129 scenarios took 469 s and 499 s before,
  394 s to 411 s in four runs after, 17% less. That is about 380 s on the reference runner, so the budget stays.
- T-43's factory version and ADR 0111's stage result took the 140 scenarios to 437 s on the reference runner (the
  138 before them 405 s, the 129 of main 396 s to 406 s, BUDGET's measure). A start of `foreman serve` takes 1.0 s:
  0.55 s imports (`@temporalio/worker` alone 0.53 s, webpack and memfs of its bundler 0.12 s of it), 0.15 s to read
  the factory (the contract's validator compiles in 0.06 to 0.1 s, Git 0.02 s) and 0.35 s for `Worker.create` after
  the connection; a stop takes 0.2 s, 1.2 s when a stage runs (the shutdown grace, ADR 0101). The check that the
  factory is committed now runs `git rev-parse` and one `git status` at once instead of three processes in a row. Not
  faster: opening the connections while the factory is read, the client on the worker's connection (a retry race
  of SCN-FORE-098 failed once), and a module hook that stubs webpack (Node's hooks cost more than they save). On a
  development machine the same code took 398 s and 434 s, so one run cannot show a change under 5%.
  The 11 new scenarios cost 27 s and main already took up to 406 s, so the budget is 480 s, about 10% above the
  437 s. Getting well below 400 s needs fewer starts of `foreman serve` per scenario, not a faster start.
- T-48's pages (ADR 0115) add 3 scenarios: one completes two runs and reads them in pages of one (3 s), two are
  refusals that start no run (1.3 s each). A cursor the foreman did not write is refused before Temporal: Temporal's
  client retried an unreadable page token for 21 s. The full suite of 145 took 584 s summed in one run on a
  development machine while a second copy of the suite and intake's ran at the same time, and 400 s alone, so the
  budget stays.
- The run list in pages, measured once on a development machine (ADR 0115): 1000 runs in the Temporal dev server,
  started through `POST /v1/runs` with a harness that fails, so each ended as "failed". `GET /v1/runs` answered the
  first page of 50 with a `next` in 13 to 15 ms, and the console's `/` with one foreman in 17 to 23 ms (51 ms for the
  first request after its start). It was a temporary test with the testkit's `fakes.temporal` and the built console,
  not a scenario: 1000 runs take about a minute to start and end, which the budget has no room for.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-FORE-NNN`
