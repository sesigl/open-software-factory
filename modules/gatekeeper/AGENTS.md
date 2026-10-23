# AGENTS.md for module `gatekeeper`

Adds rules for this module. The root `AGENTS.md` applies in full. Decisions: ADR 0047, ADR 0048.

## Public surface

The only ways a system test or another program may use this module:

- CLI: `gatekeeper <command>` (see `README.md#commands`)
- GitHub Action: `action.yml` with `action.sh` (see `README.md#github-action`)
- HTTP API of `gatekeeper serve` on `PORT`: `/v1/gates` (OpenAPI in `contracts/openapi/openapi.json`), and
  `/slack/events` and `/slack/actions` for Slack (see `README.md#server`)
- Input: the request file, the Rego policy and the groups file named on the command line; a Slack channel through the
  Web API at `GATEKEEPER_SLACK_URL`; a pull request on GitHub or Forgejo through the forge API; `opa` as a separate
  process
- Output: `$OUTPUT/gate.json` (or `--out`) and `$OUTPUT/record.json` (or `--record`); messages in the Slack channel;
  comments and the commit status `gatekeeper` on the pull request
- Server state: the schema `gatekeeper` in the PostgreSQL database at `GATEKEEPER_DATABASE_URL`, private to the module
- Events: `gate.requested@v1` and `gate.decided@v1` (`contracts/events/`) on NATS at `GATEKEEPER_NATS_URL`
- Environment variables: the list in `README.md#configuration` (generated from `src/config.schema.json`)

## Architecture

Layers, top to bottom, in `architecture.json` (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` →
`domain`. `domain` checks the request and the policy's answer, derives the gate ID, decides the gate from the
messages of its thread, writes the message texts and the buttons, checks Slack's signatures, builds the events and
the API's view of a gate, and builds, signs and verifies records, without I/O; `adapters` run OPA, call Slack and the
forge API, publish to NATS, keep the server's gates and outbox in PostgreSQL, and read and write files; `commands`
join them, and `serve` runs the Fastify server. The CLI keeps no state between commands: the channel holds the
request and the decisions. The server keeps its gates in PostgreSQL and decides with the same domain function. The
ARCH check enforces the layers.

## Allowed exceptions

- Unit tests: none.

## Budget

- System tests: 180 seconds in total on the CI runner. SCN-GATE-012, -025 and -055 to -057 need Docker for NATS;
  the server scenarios SCN-GATE-041 to -058 run PostgreSQL in process (PGlite, ADR 0049); all use fake Slack, a
  scripted forge API and the pinned `opa` of `make install`.

## Quality limits

Checked by DUP and MUTATION (ADR 0037):

- Duplication: at most 3% of the lines in src/.
- Mutation score: at least 70% of the mutants in changed lines, 80% in total.

## Scenario prefix

`SCN-GATE-NNN`
