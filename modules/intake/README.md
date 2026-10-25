---
covers: [modules/intake/src/**]
---

# intake

One inbox for agent work. A program, a Slack mention or a local coding agent puts work in; intake turns requests with
the same dedupe key into one work item, keeps a link back to every origin, and publishes `work.received@v1` for the
foreman. Decision: [ADR 0063](../../docs/decisions/0063-intake.md).

## Quick start

This quick start is scenario `SCN-INTAKE-001` and is tested on every change. It needs no database: without
`INTAKE_DATABASE_URL`, intake keeps its work items in an embedded PostgreSQL in `.intake/`.

```sh
export INTAKE_API_TOKEN=dev-token
npx @opensoftware/intake serve
```

Save the work:

```json work.json
{
  "type": "idea",
  "title": "Export reports as CSV",
  "requester": { "kind": "person", "id": "slack:U0PERSON", "displayName": "Varun" },
  "origin": { "source": "api" },
  "dedupeKey": "idea:export-csv"
}
```

Submit it and read it back:

```sh
curl -H "Authorization: Bearer dev-token" -H "content-type: application/json" \
  --data @work.json http://localhost:8080/v1/work-items
curl -H "Authorization: Bearer dev-token" http://localhost:8080/v1/work-items/wi_…
```

The first call answers 201 with the work item `wi_…` in the state `received`. The same `dedupeKey` again answers 200
with the same work item.

## Commands

| Command | What it does |
| --- | --- |
| `intake serve` | Serve the work item API on `PORT`, Slack's events with `INTAKE_SLACK_TOKEN`, and publish `work.received@v1` with `INTAKE_NATS_URL`. |
| `intake mcp` | Serve the Factory MCP server on stdio for a local agent: the tools `submit_work` and `work_status` call the server at `INTAKE_URL`. |

## API

| Route | What it does |
| --- | --- |
| `POST /v1/work-items` | Submit work: a work item without its `id`. 201 with the new work item, 200 with the work item that has the same dedupe key, 400 with a problem that names the field. |
| `GET /v1/work-items/{workItemId}` | The work item, its `status` (`received`), `receivedAt`, and `requests`: the requester, origin and time of each submission, oldest first. 404 for a work item the server does not know. |
| `POST /slack/events` | Slack's Events API, with `INTAKE_SLACK_TOKEN`: a message that mentions the bot becomes a work item. |

The OpenAPI of the `/v1` routes is in [`contracts/openapi/openapi.json`](../../contracts/openapi/openapi.json); the
TypeScript type `paths` of `@opensoftware/contracts` types a client. The `/v1` routes need `Authorization: Bearer
<INTAKE_API_TOKEN>`, the Slack route Slack's signature; both answer 401 otherwise. Errors are
`application/problem+json` with `title`, `status` and `detail`.

A submission has the fields of a [work item](../../contracts/work-item/work-item.schema.json) without `id`. `type`
defaults to `task`. Without `dedupeKey`, the key is the origin's `url`, else `<source>:<externalId>`; a submission
with neither gets 400. The work item's ID is `wi_` and 20 hex digits of the SHA-256 of its dedupe key, so the same key
gives the same ID on every server. A request from an origin that the work item already lists is not listed again.

With `INTAKE_DATABASE_URL`, the work items live in the schema `intake` of that PostgreSQL database; the server creates
its tables when it starts.

## Slack

With `INTAKE_SLACK_TOKEN` and `INTAKE_SLACK_SIGNING_SECRET`, the server hands each request to `/slack/events` to the
channel port's adapter in `INTAKE_SLACK_ADAPTER` ([`ports/channel`](../../ports/channel/README.md)). A message that
mentions the bot becomes a work item whose dedupe key is the thread, whose requester is the person and whose origin
links the message. A new work item gets the reply `Received as work item <id>.` in the thread; another mention in the
thread is the same work item and gets no reply.

Set up a Slack app with the bot scope `chat:write`, the events `app_mention` or `message.channels`, and the request
URL `https://<server>/slack/events`.

## Factory MCP server

`intake mcp` lets a local coding agent submit work and follow it. Add it to the agent's MCP servers:

```json .mcp.json
{
  "mcpServers": {
    "factory": {
      "command": "npx",
      "args": ["-y", "@opensoftware/intake", "mcp"],
      "env": { "INTAKE_URL": "http://localhost:8080", "INTAKE_API_TOKEN": "dev-token", "INTAKE_REQUESTER": "github:varun" }
    }
  }
}
```

| Tool | Input | Answer |
| --- | --- | --- |
| `submit_work` | `title`, optional `description`, `type` (`idea`, `bug`, `task`, `automation`) and `dedupeKey` | The work item's view, as for `GET /v1/work-items/{id}`. The requester is the person in `INTAKE_REQUESTER`, the origin's source `mcp`, the default dedupe key `mcp:<requester>:<title>`. |
| `work_status` | `id` | The work item's view. |

An answer of the server other than 200 or 201 is a tool error that names the status and the problem's detail.

## Events

With `INTAKE_NATS_URL`, a new work item is written to the outbox table in the same transaction and then published as
[`work.received@v1`](../../contracts/events/work-received/work-received.schema.json) on `osf.work.received.v1`. The
event's `id` is the work item's ID and its `data` the work item. While NATS is unreachable the events wait in the
outbox and go out once it is back: after the next commit, when the server starts, or within a minute. A second
request for the same work item publishes nothing.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/intake/`. Merging it creates
the tag `intake-v<version>`. The workflow `.github/workflows/publish-intake.yml` then builds `dist/` and publishes the
package to npm as `@opensoftware/intake`. The first release is `0.1.0`; until `1.0.0`, a breaking change raises the
minor version.

The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)): the
GitHub environment `npm`, a token only for the first version, then a trusted publisher for the workflow
`publish-intake.yml`. No credential is stored in the repository.

## Scenarios

<!-- generated by make docs from features/: do not edit -->
