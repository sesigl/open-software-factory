---
status: accepted
date: 2026-10-25
---

# 0063. intake: one inbox for agent work, over HTTP, Slack and MCP

## Context

TODO item T-16 asks for intake: one deduplicated inbox for agent work from all tools, with links back to the origin.
Its public surface is an HTTP API (submit, status), the Factory MCP server, webhook endpoints, and the event
`work.received@v1`. It realizes the vision scenarios LOOP-001 to LOOP-003, ACCESS-001 to ACCESS-003, AUTO-001 and
RUNTIME-002 (`docs/vision/software-factory.feature`).

Much of it exists already:

- The work item format (`contracts/work-item/`) has a `dedupeKey`: "requests with the same key become one work
  item". The event `work.received@v1` (`contracts/events/`) carries a work item as its `data`.
- The channel port (ADR 0059) turns a Slack message that mentions the bot into a work item, with a link to the
  message and the person as the requester, and replies in its thread.
- ADR 0003 says that server mode keeps its state in PostgreSQL and writes events to an outbox in the same
  transaction, relayed to NATS. gatekeeper does this (ADR 0048).
- The testkit starts a module as an HTTP server (`sut.http`), as an MCP server on stdio (`sut.mcp`), and gives
  PostgreSQL in process (`fakes.postgres`, ADR 0049), NATS, fake Slack and the built channel adapters.

The item is too large for one pull request. This decision covers the first slice: the inbox itself, its API, its
events, Slack mentions and the Factory MCP server. GitHub issues labeled `factory`, one work item across surfaces,
Sentry alerts and evidence come in later slices; they are listed in `TODO.md`.

## Decision

- **A new optional module `modules/intake/`** (prefix `SCN-INTAKE`), released to npm as `@opensoftware/intake`, with
  two commands: `intake serve` and `intake mcp`.
- **`intake serve`** starts a Fastify server on `PORT` (default 8080). It needs `INTAKE_API_TOKEN`; without it, it
  exits 2 and names it. Every call to `/v1/` needs `Authorization: Bearer <INTAKE_API_TOKEN>`, else 401.
  - `POST /v1/work-items` takes a submission: a work item without its `id`. `type` defaults to `task`. The answer
    is 201 with the new work item, or 200 with the work item that has the same dedupe key. A submission the server
    cannot read gets 400 with a problem (RFC 9457) that names the field.
  - Without a `dedupeKey`, the key is the origin's `url`, else `<source>:<externalId>`. A submission with neither
    gets 400 that names `dedupeKey`.
  - The work item's ID is `wi_` and the first 20 hex digits of the SHA-256 of its dedupe key. The same key always
    gives the same ID, on every server, with no clock and no randomness.
  - `GET /v1/work-items/{workItemId}` answers the work item, or 404. The view holds the work item, its `status`
    (`received`; the foreman's run events will move it on in T-17), the time it was received, and `requests`: each
    submission's requester, origin and time, oldest first. A request from an origin that is already listed is not
    listed again, so a retried delivery adds nothing.
  - The models `WorkSubmission`, `WorkItemView` and `WorkRequest` and the two operations are added to `contracts/`
    (`typespec/intake.tsp`, `typespec/intake-api.tsp`), as ADR 0048 did for gatekeeper. Adding paths and models is
    not breaking, so contracts get a minor version.
- **Storage.** With `INTAKE_DATABASE_URL`, the server keeps its work items in the schema `intake` of that
  PostgreSQL database. Without it, it keeps them in an embedded PostgreSQL, PGlite, in its data folder `OSF_DATA`
  (default `.intake`). Both run the same SQL, so the laptop and the server behave the same. The quick start needs no
  database.
- **Events.** With `INTAKE_NATS_URL`, a new work item writes `work.received@v1` to the table `intake.outbox` in the
  same transaction. A relay publishes the waiting events in order on `osf.work.received.v1` after each commit, when
  the server starts, and every minute, and marks them published. The event's `id` is the work item's ID, so a
  consumer can drop a copy; its `source` is `/osf/intake`. A second request for the same work item publishes nothing.
- **Slack through the channel port.** With `INTAKE_SLACK_TOKEN`, `POST /slack/events` hands each delivery to the
  channel adapter's `receive`, run as a program from `INTAKE_SLACK_ADAPTER` (default
  `npx -y @opensoftware/channel-slack`) with `CHANNEL_API_URL`, `CHANNEL_TOKEN` and `CHANNEL_SIGNING_SECRET` from
  `INTAKE_SLACK_URL`, `INTAKE_SLACK_TOKEN` and `INTAKE_SLACK_SIGNING_SECRET` (ADR 0060, ADR 0062). A work item it
  prints is submitted with the port's dedupe key, the thread. A new work item gets the reply
  `Received as work item <id>.` in its thread; a second mention in the thread is the same work item and gets no
  reply. A signature the adapter refuses gets 401. Slack's `url_verification` gets its challenge back.
- **The Factory MCP server.** `intake mcp` serves MCP on stdio for a local coding agent, with the MCP TypeScript SDK.
  It is a client of the API: it calls the server at `INTAKE_URL` with `INTAKE_API_TOKEN` and keeps no state.
  - `submit_work` takes `title`, and optionally `description`, `type` and `dedupeKey`. The requester is the person
    in `INTAKE_REQUESTER`, like `github:varun`; the origin's source is `mcp`. The default dedupe key is
    `mcp:<requester>:<title>`.
  - `work_status` takes a work item's `id` and answers its view.
  - Both answer the view as JSON text. An answer of the server other than 200 or 201 is a tool error with the
    problem's detail. Without `INTAKE_URL`, `INTAKE_API_TOKEN` or `INTAKE_REQUESTER`, `intake mcp` exits 2 and names
    the variable.
- **Layers** (ADR 0014): `entry` (`src/cli.ts`) → `commands` → `adapters` → `domain`. `domain` reads a submission,
  derives the dedupe key and the ID, builds the view and the event, without I/O. `adapters` keep the store in
  PostgreSQL or PGlite, publish to NATS, run the channel adapter, and call the API from the MCP server. `commands`
  join them; `serve` runs Fastify and `mcp` the MCP server.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| PostgreSQL only | One store, as gatekeeper | The quick start needs a database; "useful alone" asks for none |
| SQLite (`node:sqlite`) without a database URL | Built into Node 24 | A second SQL dialect beside PostgreSQL; twice the store code to test and mutate |
| PGlite without a database URL | The same SQL as PostgreSQL, in process, persisted in a folder; already in the testkit (ADR 0049) | One more runtime dependency of about 10 MB |
| A random ULID as the work item ID | The contract recommends ULIDs | Needs randomness and a clock; a retried delivery to another server gets another ID |
| The ID from the dedupe key's hash | Deterministic; one key, one ID everywhere | The ID shows that two requests share a key, which the API shows anyway |
| The MCP server inside `intake serve` (streamable HTTP) | One process | A local agent then needs the server's URL and token in its MCP config anyway; stdio is what every harness supports |
| `intake mcp` on stdio as a client of the API | No state of its own; any harness starts it with `npx` | Needs a running server |
| Slack through the channel port | One adapter for gatekeeper and intake; Vercel Chat SDK checks the signature | A process per delivery |
| Slack's Events API parsed by intake | No process per delivery | A second Slack client beside channel-slack (ADR 0062 removed gatekeeper's) |

## Prior art

- n8n (Sustainable Use License, not open source by the OSI definition, very active): workflows from webhooks,
  Slack and trackers. Checked, not adopted: it is a general workflow tool without a work item format or dedupe key,
  and its license does not fit an Apache-2.0 tool family (ADR 0008).
- Huginn (MIT, maintained, few releases): agents that watch sources and emit events. Checked, not adopted: Ruby,
  no MCP, no work item format.
- Plane's intake (AGPL-3.0, active): an inbox for issues from email and forms inside Plane. Checked, not adopted: it
  is part of a tracker and its license is AGPL.
- OpenHands' GitHub resolver (MIT, active): a label on an issue starts an agent. Checked: it starts one agent per
  label, without an inbox or other surfaces; T-16's GitHub slice covers the label.
- Vercel Chat SDK (`chat`, MIT, active): adopted through the channel port's `slack` adapter (ADR 0059).
- MCP TypeScript SDK (`@modelcontextprotocol/sdk`, MIT, Anthropic and the MCP project, 1.32, very active): adopted for
  `intake mcp`, at the version of the testkit.
- PGlite (`@electric-sql/pglite`, Apache-2.0 or PostgreSQL License, ElectricSQL, 0.5, active): adopted as the
  embedded store, at the version of the testkit (ADR 0049).
- Fastify (MIT, ADR 0048), `pg` (MIT, ADR 0035) and `@nats-io/transport-node` (Apache-2.0, ADR 0047): already used;
  adopted here at the same versions.

## Consequences

- A person, a program or a local agent can put work into one inbox today, and read it back with its origins.
  The foreman (T-17) will read `work.received@v1`; it needs no Slack or MCP code of its own.
- The same work from two surfaces is one work item only when both send the same dedupe key. A Slack thread's key is
  the thread, a GitHub issue's key will be its URL; making those meet is the slice "one work item across surfaces".
- Each Slack delivery starts the adapter as a process. Slack retries a delivery that gets no answer within 3
  seconds; the dedupe key makes a retry harmless. Revisit when deliveries are many.
- `status` is always `received` until the foreman reports runs. Revisit the view when it does.
