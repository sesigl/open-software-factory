---
status: accepted
date: 2026-10-22
---

# 0048. gatekeeper serve: an HTTP API, Slack events and buttons, and a Postgres outbox

## Context

ADR 0047 built gatekeeper as a CLI. `status` reads the channel again each time it runs, so a job that waits for a
decision polls. TODO item T-11 lists the next slice: the HTTP API with its OpenAPI in `contracts/` (`gatekeeper
serve`), Slack's Events API and buttons instead of polling, and the Postgres outbox for the events.

ADR 0003 says that server mode keeps operational state in PostgreSQL and writes CloudEvents to an outbox in the same
transaction, relayed to NATS. The stack (`docs/architecture/stack.md`) picks Fastify for HTTP servers.
`docs/architecture/internals.md` says that every module's server mode is REST with OpenAPI, and that the generated
TypeScript types are the only client (ADR 0012). No module has an HTTP API yet, so `contracts/openapi/openapi.json`
has no `paths`.

## Decision

- **`gatekeeper serve --policy <file.rego> --groups <file.json> --channel slack:<channel ID>`** starts a Fastify
  server on `PORT` (default 8080). It needs `GATEKEEPER_DATABASE_URL`, `GATEKEEPER_API_TOKEN`,
  `GATEKEEPER_SLACK_TOKEN` and `GATEKEEPER_SLACK_SIGNING_SECRET`; without one it exits 2 and names it. The policy,
  the groups and the channel are the server's: a caller sends only the request.
- **The gate API** (all calls need `Authorization: Bearer <GATEKEEPER_API_TOKEN>`, else 401):
  - `POST /v1/gates` with a request (the same JSON as the CLI's request file) asks the approver groups. It answers
    201 with the new gate, or 200 with the gate that the same request made before. A request the server cannot
    read gets 400 with a problem that names the field. A policy without approver groups approves at once.
  - `GET /v1/gates/{gateId}` answers the gate, or 404. A gate has its ID, the request's work item, stage and
    summary, the risk, the approver groups, the escalation groups, the channel, the state (`pending`, `approved`,
    `rejected` or `expired`), the groups it waits for, the request time and, once decided, the record.
  - Errors are `application/problem+json` (RFC 9457) with `title`, `status` and `detail`.
- **The OpenAPI lives in `contracts/`.** `typespec/gatekeeper-api.tsp` declares the operations with `@typespec/http`.
  `pnpm build` compiles them with `@typespec/openapi3` and copies only their `paths` into `openapi/openapi.json`,
  next to the named models of the JSON Schema bundle; a `$ref` in a path that names no model fails the build. The
  models `GateRequest`, `Gate`, `GateRecord` and `Problem` are new formats of the contracts. `GateRecord` is the
  record that the CLI already writes. openapi-typescript generates the `paths` type, which the system tests use with
  the typed client of the testkit. Adding paths and models is not breaking, so contracts get a minor version.
- **Slack.** The request message has two buttons, Approve and Reject, next to the text that says how to reply.
  - `POST /slack/events` takes the Events API: it answers `url_verification` with its challenge, and a `message`
    event in the thread of a gate makes the server decide that gate.
  - `POST /slack/actions` takes the interactivity payload: a press of Approve or Reject by a person is stored in
    PostgreSQL with Slack's action time, then the server decides the gate.
  - Both check Slack's signature (`v0`, HMAC-SHA256 with `GATEKEEPER_SLACK_SIGNING_SECRET`) and refuse a request
    older than 5 minutes with 401. Slack retries a request that gets no answer within 3 seconds; a decision is
    idempotent, so a retry posts nothing new.
- **One decision logic.** The server decides with the same domain function as `gatekeeper status`: the thread's
  replies and the pressed buttons, ordered by time, go through the same rules (first decision by a member counts,
  one refusal reply for anyone else, escalation, expiry, markers only from gatekeeper's own user). The policy's
  answer is stored with the gate when it is requested, so a later change of the policy does not change an open
  gate; the groups file is read when the server starts.
- **Escalation and expiry without polling.** The server checks every pending gate when it starts and then every
  minute, and posts an escalation or expires the gate when its time has come. Time is `OSF_NOW` or the clock.
- **PostgreSQL** holds the gates (request, policy answer, thread, state, record), the pressed buttons and the
  outbox, in the schema `gatekeeper`. The server creates its tables when it starts. The channel still shows every
  request and decision.
- **The outbox.** With `GATEKEEPER_NATS_URL`, `gate.requested@v1` and `gate.decided@v1` are written to the table
  `gatekeeper.outbox` in the same transaction as the gate's change. A relay publishes unpublished events in order
  after each commit and at each check, and marks them published. When NATS is unreachable the events wait and go
  out later: at least once, with the same event IDs as the CLI (`<gate>.requested`, `<gate>.decided`), so a
  consumer can drop a duplicate.
- **Testkit.** `fakes.slack` signs what it sends with its `signingSecret`, keeps the buttons of a message, and
  `press` sends a button press to the module's interactivity URL; `sign` gives the headers Slack would send with a
  body. `sut.http.stop` stops the server, so a test can
  start it again with another time or another NATS server.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Fastify | The stack's pick; schema validation, plugins, small and fast; MIT, very active | One more runtime dependency |
| `node:http` alone | No dependency | Routing, body parsing, errors by hand in every module |
| Slack Bolt (`@slack/bolt`) | Signature checks, retries, acknowledgements built in | Brings its own Express receiver next to Fastify; the fake would need more of the Web API; the check is 15 lines |
| The thread as the only store (as in the CLI) | No database | A server must find a gate from a Slack event and keep button presses, which Slack does not keep in the thread |
| PostgreSQL for gates and outbox | ADR 0003; one transaction for the gate and its event; survives restarts | Needs a database in server mode |
| `pg-transactional-outbox` | A ready outbox and inbox for PostgreSQL | Brings logical replication setup and its own tables for a few rows a day; one table and one query do the job |
| Re-evaluate the policy on each decision | A fixed policy applies at once | An open gate could change its approvers while people decide |
| Store the policy's answer with the gate | The record says which rules applied; stable while people decide | A policy fix needs a new request |
| OpenAPI by `@typespec/openapi3`, paths merged into `openapi.json` | One source for models and operations; one document for clients and oasdiff | A second emitter run in the build |
| A hand-written OpenAPI per module | No build change | Two sources of the same models; ADR 0012 asks for TypeSpec |

## Prior art

- Fastify (`fastify`, MIT, OpenJS Foundation, 5.12 of October 2026, very active): adopted as the HTTP server.
- Slack Bolt for JavaScript (`@slack/bolt`, MIT, 5.1 of September 2026, active): checked, not adopted; see the
  options. Its signature check follows Slack's documented `v0` scheme, which gatekeeper implements with
  `node:crypto`.
- `pg-transactional-outbox` (MIT, 0.6 of October 2026, maintained by one person): checked, not adopted; see the
  options.
- TypeSpec HTTP and OpenAPI 3 emitters (`@typespec/http`, `@typespec/openapi3`, MIT, Microsoft, 1.17, active):
  adopted as build dependencies of the contracts, at the version of the compiler, with `@typespec/openapi`, which
  the OpenAPI 3 emitter needs.
- `pg` (node-postgres, MIT, active): already used by ledger (ADR 0035); adopted here too.
- HumanLayer and trstringer/manual-approval were checked in ADR 0047; neither has a self-hosted server with a
  policy and a record.

## Consequences

- A program asks for approval with one HTTP call and learns the decision from `gate.decided@v1` or one `GET`, with
  no polling of Slack. A person decides with a button or a reply.
- Server mode needs PostgreSQL and a Slack app with the Events API and interactivity pointed at the server. The CLI
  keeps working without both.
- The server keeps one channel. A second channel needs a second server or the channel port (T-15), which brings
  Vercel Chat SDK in place of the direct Slack calls.
- Pull requests stay with the CLI and the GitHub Action: forge webhooks come with the channel and forge ports.
- Revisit the one-minute check when many gates wait, and the stored policy answer when people ask to re-evaluate.
