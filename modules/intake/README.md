---
covers: [modules/intake/src/**]
---

# intake

One inbox for agent work. A program, a Slack mention, an issue labeled `factory`, a Sentry alert or a local coding
agent puts work in; intake turns requests with the same dedupe key into one work item, keeps a link back to every
origin, and publishes `work.received@v1` for the foreman. Decisions: [ADR 0063](../../docs/decisions/0063-intake.md),
[ADR 0065](../../docs/decisions/0065-intake-issues-and-alerts.md).

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
| `intake serve` | Serve the work item API on `PORT`, Slack's events with `INTAKE_SLACK_TOKEN`, the forge's with `INTAKE_WEBHOOK_SECRET`, Sentry's with `INTAKE_SENTRY_SECRET`, and, with `INTAKE_NATS_URL`, publish `work.received@v1` and follow the foreman's run events. |
| `intake mcp` | Serve the Factory MCP server on stdio for a local agent: the tools `submit_work` and `work_status` call the server at `INTAKE_URL`, and `run_evidence` also the foreman at `INTAKE_FOREMAN_URL`. |

## API

| Route | What it does |
| --- | --- |
| `POST /v1/work-items` | Submit work: a work item without its `id`. 201 with the new work item, 200 with the work item that has the same dedupe key, 400 with a problem that names the field. |
| `GET /v1/work-items?dedupeKey=<key>` | The work item with this dedupe key, such as an issue's link or `sentry:<issue ID>`. 404 when there is none, 400 without the key. |
| `GET /v1/work-items/{workItemId}` | The work item, its `status` ([Events](#events)), its `runId` once the foreman started its run, `receivedAt`, and `requests`: the requester, origin and time of each submission, oldest first. 404 for a work item the server does not know. |
| `POST /slack/events` | Slack's Events API, with `INTAKE_SLACK_TOKEN`: a message that mentions the bot becomes a work item. |
| `POST /forge/events` | The forge's webhook, with `INTAKE_WEBHOOK_SECRET`: an issue that gets the label `factory` becomes a work item. |
| `POST /sentry/events` | Sentry's webhook, with `INTAKE_SENTRY_SECRET`: an alert about a fatal error becomes a `bug`. |

The OpenAPI of the `/v1` routes is in [`contracts/openapi/openapi.json`](../../contracts/openapi/openapi.json); the
TypeScript type `paths` of `@opensoftware/contracts` types a client. The `/v1` routes need `Authorization: Bearer
<INTAKE_API_TOKEN>`, the webhook routes their sender's signature; all answer 401 otherwise. Errors are
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
thread is the same work item and gets no reply. When the work item's run completes with pull requests, each thread
of a Slack request for it gets the reply `Pull request: <link>`, one line per pull request (needs `INTAKE_NATS_URL`,
see [Events](#events)).

Set up a Slack app with the bot scope `chat:write`, the events `app_mention` or `message.channels`, and the request
URL `https://<server>/slack/events`.

## Issues on the forge

With `INTAKE_WEBHOOK_SECRET`, the server hands each request to `/forge/events` to the forge port's adapter in
`INTAKE_FORGE_ADAPTER` ([`ports/forge`](../../ports/forge/README.md)), which checks the signature and prints the
delivery's event. An `issue.labeled@v1` whose issue has the label in `INTAKE_FORGE_LABEL` (default `factory`) becomes
a `task` with the issue's title and body. Its requester is the issue's author, like `github:varun`; its origin is the
forge with the issue's link and `<owner>/<name>#<number>`; its dedupe key is the issue's link, so labeling the issue
again adds nothing. Any other delivery gets 200 and makes nothing. One server reads one forge: for Forgejo, set
`INTAKE_FORGE_ADAPTER` to `npx -y @opensoftware/forge-forgejo`.

Register the webhook with the adapter, or let factory-spec register it for a `github.issue.labeled` automation:

```sh
FORGE_TOKEN=… FORGE_WEBHOOK_SECRET=$INTAKE_WEBHOOK_SECRET \
  npx -y @opensoftware/forge-github webhook acme/web https://<server>/forge/events --event issue.labeled
```

## One work item across surfaces

A Slack mention whose text links an issue, like `https://github.com/acme/web/issues/42`, takes the issue's link as its
dedupe key instead of the thread. So the mention and the label on that issue are one work item, whichever comes
first, and the work item lists both requests. A mention that joins a work item from another surface gets the reply
`Added to work item <id>.`; only the first link of the form `<base>/<owner>/<name>/issues/<number>` counts.

## Sentry

With `INTAKE_SENTRY_SECRET`, the client secret of a Sentry internal integration, the server reads Sentry's alerts at
`/sentry/events`. A delivery whose `Sentry-Hook-Signature` is not the HMAC-SHA256 of its body with the secret gets 401.
An `event_alert` about an event of level `fatal` becomes a `bug` with the event's title. Its requester is the trigger
`sentry:<the alert rule>`, its origin `sentry` with the event's link and the Sentry issue's ID, its dedupe key
`sentry:<issue ID>`, so later alerts about the same issue add nothing. It links the error and, with
`INTAKE_SENTRY_CHANGE_URL`, the change: the template with `{release}` replaced by the event's release. Any other
delivery gets 200 and makes nothing.

In Sentry, create an internal integration with the webhook URL `https://<server>/sentry/events` and "Alert Rule
Action" on, then an alert rule "The event's level is equal to fatal" that sends a notification to it. A delivery
looks like this:

```json sentry-alert.json
{
  "action": "triggered",
  "data": {
    "triggered_rule": "Fatal errors",
    "event": {
      "title": "TypeError: total is undefined",
      "level": "fatal",
      "issue_id": "1117540176",
      "release": "4c5d6e7",
      "web_url": "https://acme.sentry.io/issues/1117540176/events/9fac2ceed9344f2bbfdd1fdacb0ed9b1/"
    }
  }
}
```

## Factory MCP server

`intake mcp` lets a local coding agent submit work and follow it. Add it to the agent's MCP servers:

```json .mcp.json
{
  "mcpServers": {
    "factory": {
      "command": "npx",
      "args": ["-y", "@opensoftware/intake", "mcp"],
      "env": {
        "INTAKE_URL": "http://localhost:8080",
        "INTAKE_API_TOKEN": "dev-token",
        "INTAKE_REQUESTER": "github:varun",
        "INTAKE_FOREMAN_URL": "http://localhost:8081",
        "INTAKE_FOREMAN_TOKEN": "dev-token"
      }
    }
  }
}
```

| Tool | Input | Answer |
| --- | --- | --- |
| `submit_work` | `title`, optional `description`, `type` (`idea`, `bug`, `task`, `automation`) and `dedupeKey` | The work item's view, as for `GET /v1/work-items/{id}`. The requester is the person in `INTAKE_REQUESTER`, the origin's source `mcp`, the default dedupe key `mcp:<requester>:<title>`. |
| `work_status` | `id` | The work item's view. |
| `run_evidence` | `id` | What the foreman recorded of the work item's run, its view from [`GET /v1/runs/{runId}`](../foreman/README.md#api): the run's state, factory version, pull request, and each stage with its agent, state, harness session, gate, checks and reason. |

An answer of the server other than 200 or 201 is a tool error that names the status and the problem's detail.
`run_evidence` reads the work item's `runId` from the server, then the run from the foreman at `INTAKE_FOREMAN_URL` with
`INTAKE_FOREMAN_TOKEN`. A work item without a run, a foreman's answer other than 200, and a missing `INTAKE_FOREMAN_URL`
are tool errors; the other tools work without it.

## Events

With `INTAKE_NATS_URL`, a new work item is written to the outbox table in the same transaction and then published as
[`work.received@v1`](../../contracts/events/work-received/work-received.schema.json) on `osf.work.received.v1`. The
event's `id` is the work item's ID and its `data` the work item. While NATS is unreachable the events wait in the
outbox and go out once it is back: after the next commit, when the server starts, or within a minute. A second
request for the same work item publishes nothing.

With `INTAKE_NATS_URL` the server also listens for the foreman's
[`run.started@v1`](../../contracts/events/run-started/run-started.schema.json) on `osf.run.started.v1` and
[`run.completed@v1`](../../contracts/events/run-completed/run-completed.schema.json) on `osf.run.completed.v1`, and the
work item of a run follows it (ADR 0071):

| Event | The work item's `status` |
| --- | --- |
| none yet | `received` |
| `run.started@v1` | `running`, with the run's `runId` |
| `run.completed@v1` with the outcome `succeeded`, `failed` or `cancelled` | `complete`, `failed` or `cancelled` |

A `run.completed@v1` that lists `pullRequests` also links them in the Slack threads of the work item, as described in
[Slack](#slack). A `run.started@v1` that arrives after its run completed changes nothing. The subjects are core NATS: run events
published while the server is down do not reach it. While NATS is unreachable the server tries again every 2 seconds.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `PORT` | string | `"8080"` | serve: the port the HTTP server listens on. |
| `OSF_DATA` | string | `".intake"` | serve: the folder of the embedded PostgreSQL (PGlite) when INTAKE_DATABASE_URL is not set. |
| `OSF_NOW` | string |  | The current time, like 2026-01-01T00:00:00Z, for the time a work item and a request were received. Default: the clock. |
| `INTAKE_API_TOKEN` | string |  | serve: the token that callers of /v1 send as Authorization: Bearer <token>. Required. mcp: the token it sends to the server. Required. |
| `INTAKE_DATABASE_URL` | string |  | serve: the PostgreSQL database of the work items, schema intake. Default: an embedded PostgreSQL in OSF_DATA. |
| `INTAKE_NATS_URL` | string |  | serve: the NATS server for work.received@v1 on osf.work.received.v1, and for the foreman's run.started@v1 and run.completed@v1, which move a work item's status (ADR 0071). Unset: no events. |
| `INTAKE_SLACK_ADAPTER` | string | `"npx -y @opensoftware/channel-slack"` | serve: the command line of the channel port's slack adapter, which reads Slack's deliveries and replies (ADR 0063). |
| `INTAKE_SLACK_URL` | string |  | serve: base URL of the Slack Web API, ending in a slash: the adapter's CHANNEL_API_URL. Default: the adapter's, https://slack.com/api/. |
| `INTAKE_SLACK_TOKEN` | string |  | serve: Slack bot token with chat:write, the adapter's CHANNEL_TOKEN. Set, the server takes Slack's events at /slack/events. |
| `INTAKE_SLACK_SIGNING_SECRET` | string |  | serve: the signing secret of the Slack app, the adapter's CHANNEL_SIGNING_SECRET. Required with INTAKE_SLACK_TOKEN. |
| `INTAKE_WEBHOOK_SECRET` | string |  | serve: the secret the forge signs its webhook deliveries with, the forge adapter's FORGE_WEBHOOK_SECRET. Set, the server takes the forge's deliveries at /forge/events. |
| `INTAKE_FORGE_ADAPTER` | string | `"npx -y @opensoftware/forge-github"` | serve: the command line of the forge port's adapter, whose event command checks and reads the forge's deliveries (ADR 0065). |
| `INTAKE_FORGE_LABEL` | string | `"factory"` | serve: the label that makes an issue a work item. |
| `INTAKE_SENTRY_SECRET` | string |  | serve: the client secret of the Sentry integration, which signs its deliveries. Set, the server takes Sentry's alerts at /sentry/events. |
| `INTAKE_SENTRY_CHANGE_URL` | string |  | serve: the link to the change of a Sentry alert, with {release} for the event's release, like https://github.com/acme/web/commit/{release}. Unset: no link to the change. |
| `INTAKE_URL` | string |  | mcp: the base URL of intake serve, like http://localhost:8080. Required. |
| `INTAKE_REQUESTER` | string |  | mcp: the person the agent works for, <source>:<id> like github:varun, the requester of its work. Required. |
| `INTAKE_FOREMAN_URL` | string |  | mcp: the base URL of foreman serve, like http://localhost:8081, for the tool run_evidence (ADR 0071). Unset: run_evidence is an error that names it. |
| `INTAKE_FOREMAN_TOKEN` | string |  | mcp: the token of foreman serve's API, its FOREMAN_API_TOKEN, sent with INTAKE_FOREMAN_URL. |

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

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-INTAKE-001 | implemented | A program submits work over HTTP and reads it back |
| SCN-INTAKE-002 | implemented | A second submission with the same dedupe key is the same work item |
| SCN-INTAKE-003 | implemented | A submission without a dedupe key takes the link of its origin as the key |
| SCN-INTAKE-004 | implemented | A submission without a dedupe key and without a link or ID of its origin gets the status 400 |
| SCN-INTAKE-005 | implemented | A submission without a title gets the status 400 and names the field |
| SCN-INTAKE-006 | implemented | A call without the API token gets the status 401 |
| SCN-INTAKE-007 | implemented | A work item the server does not know gets the status 404 |
| SCN-INTAKE-008 | implemented | A work item kept in PostgreSQL is there after the server starts again |
| SCN-INTAKE-009 | implemented | The server without an API token exits with code 2 and names the variable |
| SCN-INTAKE-010 | implemented | A new work item is published as the event "work.received@v1" |
| SCN-INTAKE-011 | implemented | A second request for the same work item publishes no second event |
| SCN-INTAKE-012 | implemented | An event of a time when NATS was unreachable is published once the server reaches NATS |
| SCN-INTAKE-013 | implemented | A Slack mention becomes a work item with a link to the message |
| SCN-INTAKE-014 | implemented | A second mention in the same thread is the same work item and gets no second reply |
| SCN-INTAKE-015 | implemented | A Slack delivery with a wrong signature gets the status 401 and makes no work item |
| SCN-INTAKE-016 | implemented | Slack's URL verification gets its challenge back |
| SCN-INTAKE-017 | implemented | A local agent submits work through the Factory MCP server |
| SCN-INTAKE-018 | implemented | A local agent reads the state of a work item through the Factory MCP server |
| SCN-INTAKE-019 | implemented | A tool call that the server refuses is a tool error with the server's reason |
| SCN-INTAKE-020 | implemented | The MCP server without the server's URL exits with code 2 and names the variable |
| SCN-INTAKE-021 | implemented | A GitHub issue labeled "factory" becomes a work item with a link to the issue |
| SCN-INTAKE-022 | implemented | An issue labeled with another label makes no work item |
| SCN-INTAKE-023 | implemented | A forge delivery with a wrong signature gets the status 401 and makes no work item |
| SCN-INTAKE-024 | implemented | A Slack mention that links a labeled issue joins the issue's work item |
| SCN-INTAKE-025 | implemented | The label on an issue that a Slack mention linked joins the mention's work item |
| SCN-INTAKE-026 | implemented | A Sentry alert about a fatal error becomes a bug work item that links the error and the change |
| SCN-INTAKE-027 | implemented | A Sentry alert about an error that is not fatal makes no work item |
| SCN-INTAKE-028 | implemented | A Sentry delivery with a wrong signature gets the status 401 |
| SCN-INTAKE-029 | implemented | A work item is found by its dedupe key |
| SCN-INTAKE-030 | implemented | A work item whose run started is running |
| SCN-INTAKE-031 | implemented | A work item whose run succeeded is complete |
| SCN-INTAKE-032 | implemented | A work item whose run failed is failed |
| SCN-INTAKE-033 | implemented | A late "run.started@v1" leaves a completed work item complete |
| SCN-INTAKE-034 | implemented | A local agent fetches the evidence of a work item's run through the Factory MCP server |
| SCN-INTAKE-035 | implemented | The evidence of a work item without a run is a tool error |
| SCN-INTAKE-036 | implemented | The evidence tool without the foreman's URL is a tool error that names the variable |
| SCN-INTAKE-037 | implemented | The Factory MCP server lists the tool "run_evidence" |
| SCN-INTAKE-038 | implemented | A "run.completed@v1" that breaks its contract changes nothing |
| SCN-INTAKE-039 | implemented | The Slack thread of a work item links the pull request of its finished run |
| SCN-INTAKE-040 | implemented | A finished run without a pull request adds no reply to the Slack thread |
