# AGENTS.md for module `intake`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0063, ADR 0065, ADR 0071.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `intake <command>` (see `README.md#commands`)
- HTTP API of `intake serve` on `PORT`: `/v1/work-items` (OpenAPI in `contracts/openapi/openapi.json`), and the
  webhooks `/slack/events`, `/forge/events` and `/sentry/events` (see `README.md#api`)
- MCP server of `intake mcp` on stdio: the tools `submit_work`, `work_status` and `run_evidence` (see `README.md#factory-mcp-server`)
- Input: Slack's deliveries through the channel port's adapter in `INTAKE_SLACK_ADAPTER`, the forge's through the
  forge port's adapter in `INTAKE_FORGE_ADAPTER`, and Sentry's alerts
- Output: replies in the Slack thread of a mention
- Outside systems it calls: the foreman's HTTP API at `INTAKE_FOREMAN_URL`, from `intake mcp` for `run_evidence`
- Server state: the schema `intake` in the PostgreSQL database at `INTAKE_DATABASE_URL`, or the embedded PostgreSQL
  in `OSF_DATA`; private to the module
- Events: `work.received@v1` out, `run.started@v1` and `run.completed@v1` in (`contracts/events/`), on NATS at
  `INTAKE_NATS_URL`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` reads a submission, derives its dedupe key and ID, builds the view of a work item and the event, and reads
what an issue's label, a Sentry alert or a mention's link asks for, and what a run event says of its work item, without I/O; `adapters` keep the work items and
the outbox in PostgreSQL or the embedded PGlite, publish to and listen on NATS, run the channel and forge adapters as programs, and
call intake's and the foreman's APIs for the MCP server; `commands` join them: `serve` runs the Fastify server with its webhooks and `mcp` the
MCP server. The ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 240 seconds in total on the CI runner (36 scenarios; most start a server with a fresh embedded
  PostgreSQL, whose first start takes about 2 seconds). SCN-INTAKE-010 to -012 and -030 to -034 start NATS on the host (ADR 0067); SCN-INTAKE-008
  runs PostgreSQL in process (PGlite, ADR 0049); the other server scenarios use the embedded PGlite. The Slack
  scenarios run the built `channel-slack` adapter and the forge scenarios the built `forge-github` adapter against
  `fakes.github` (`sut.adapter`); `turbo.json` builds both before the tests.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-INTAKE-NNN`
