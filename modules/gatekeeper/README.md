---
covers: [modules/gatekeeper/src/**, modules/gatekeeper/action.yml, modules/gatekeeper/action.sh]
---

# gatekeeper

Ask people for approval before an automation or a CI job goes on. A Rego policy picks the groups that must approve
a change, for example by its risk. gatekeeper asks them in Slack or on the pull request, reads their answer, refuses
anyone outside the groups, asks a second group after a timeout, and writes a signed record of who decided what and
when. As a server it takes requests over HTTP and decides on Slack's events and buttons without polling. Decisions:
[ADR 0047](../../docs/decisions/0047-gatekeeper.md), [ADR 0048](../../docs/decisions/0048-gatekeeper-server.md),
[ADR 0061](../../docs/decisions/0061-gatekeeper-ports.md).

## Quick start

This quick start is scenario `SCN-GATE-001` and is tested on every change. You need
[OPA 1.x](https://www.openpolicyagent.org/docs#running-opa) on the PATH and a Slack bot token. Save the policy:

```rego policy.rego
package gatekeeper

default risk := "low"

risk := "high" if {
	some path in input.change.paths
	startswith(path, "contracts/")
}

approvers contains "maintainers" if risk == "high"

approvers contains "reviewers" if risk == "low"

escalate_after := "4h"

escalate_to contains "leads"

expire_after := "2d"
```

the groups:

```json groups.json
{
  "maintainers": ["slack:U0ADA"],
  "reviewers": ["slack:U0ADA", "slack:U0BEN"],
  "leads": ["slack:U0LEO"]
}
```

and the request:

```json request.json
{
  "workItem": "https://github.com/acme/web/pull/6",
  "stage": "merge",
  "summary": "Merge the new checkout flow",
  "links": [{ "url": "https://github.com/acme/web/pull/6", "title": "Pull request" }],
  "change": { "paths": ["contracts/checkout.tsp", "src/checkout.ts"] }
}
```

Ask for approval:

```sh
export GATEKEEPER_SLACK_TOKEN=xoxb-...
npx @opensoftware/gatekeeper request --policy policy.rego --groups groups.json --channel slack:C0GATES request.json
```

It writes `$OUTPUT/gate.json` and posts to the channel `C0GATES`: "Approval needed from maintainers (risk high): Merge
the new checkout flow". A maintainer replies `approve` in the thread. Then the same arguments give the decision:

```sh
npx @opensoftware/gatekeeper status --policy policy.rego --groups groups.json --channel slack:C0GATES request.json
```

It prints `gate g… approved by slack:U0ADA`, exits 0 and writes the record `$OUTPUT/record.json`.

## Commands

| Command | What it does |
| --- | --- |
| `gatekeeper request <gate> [--out <file>] [--record <file>]` | Ask the policy's approver groups in the channel, once per gate. Writes `$OUTPUT/gate.json` (or `--out`). |
| `gatekeeper status <gate> [--record <file>]` | Decide the gate from the channel and write the record `$OUTPUT/record.json` (or `--record`) once it is decided. Exits 0 when approved, 1 when rejected or expired, 3 while it waits. |
| `gatekeeper serve --policy <file.rego> --groups <file.json> --channel slack:<channel ID>` | Serve the gate API on `PORT` until it gets SIGTERM; see [Server](#server). |
| `gatekeeper verify --public-key <file.pem> <record.json>` | Check the record's signature. |
| `gatekeeper keys [--out <folder>]` | Write a new Ed25519 key pair: `gatekeeper.pem` (only its owner may read it) for `GATEKEEPER_SIGNING_KEY` and `gatekeeper.pub` for `verify`. |

`<gate>` is `--policy <file.rego> --groups <file.json>` and either `--channel slack:<channel ID> <request.json>` or
`--pull-request <URL>` (with an optional `--channel`). `request` and `status` take the same arguments: gatekeeper
keeps no state of its own. The channel holds the request and the decisions.

## Request

| Field | What it holds |
| --- | --- |
| `workItem` | What waits: a work item ID or a URL, up to 128 characters. |
| `stage` | The stage that waits, a lowercase name like `merge` or `spec`. |
| `summary` | What the approvers decide, shown in the channel. |
| `links` | Optional `{ "url", "title" }` list, shown in the channel. |
| `change` | Optional facts for the policy, such as changed paths, labels or the author. |

The gate's ID is `g` and 16 hex digits of the SHA-256 of `workItem`, `stage` and `change`: the same request is the
same gate, and a different change is a new gate.

## Policy

gatekeeper runs `opa eval` with the request as `input` and reads the rules of the package `gatekeeper`:

| Rule | What it says |
| --- | --- |
| `approvers` | The set of groups whose members may decide. An empty set approves at once, by the policy. |
| `risk` | Optional text shown in the channel and kept in the record, like `high`. |
| `escalate_after`, `escalate_to` | Optional: after this time without a decision, also ask these groups. |
| `expire_after` | Optional: after this time without a decision, the gate expires. |

Times are like `30m`, `4h` or `2d`. The groups file maps each group to its members, as identities like
`slack:U024BE7LH`, `github:octocat` or `forgejo:octocat`. A group the policy names must be in it.

## Decisions

- The first decision in the thread by a member of an approver group decides: `approve`, or `reject <reason>`.
- A decision by anyone else gets one reply that says so and does not count.
- After `escalate_after`, `status` posts one message that asks the `escalate_to` groups. Their members may decide
  after that message.
- After `expire_after` without a decision, the gate expires. A decision after that time does not count.
- Each message of gatekeeper ends with a marker like `[gatekeeper g… requested]`. Only markers by gatekeeper's own
  user count, so a person cannot fake a request or an escalation.

## Channels and forges

gatekeeper talks to Slack and to forges through the [channel port](../../ports/channel/README.md) and the
[forge port](../../ports/forge/README.md): it runs an adapter as a program for each call and reads the JSON lines it
prints. A `slack:` channel runs `GATEKEEPER_SLACK_ADAPTER`, by default `npx -y @opensoftware/channel-slack`. A pull
request runs `GATEKEEPER_FORGE_ADAPTER`, by default `npx -y @opensoftware/forge-github` on github.com and
`npx -y @opensoftware/forge-forgejo` on any other host. gatekeeper passes the adapter its token and URL, and prints
the adapter's error when a call fails, like `the channel refused the token` or `no pull request acme/web#12`.

## Pull requests

```sh
export GATEKEEPER_FORGE_TOKEN=...
npx @opensoftware/gatekeeper status --policy merge.rego --groups groups.json --pull-request https://github.com/acme/web/pull/12
```

The request is built from the pull request: the work item is its URL, the stage is `merge`, and `change` holds
`repository`, `number`, `author`, `head` (branch), `sha` (head commit), `base`, `labels`, `draft` and `paths` (up to
100 changed files). The request is a comment; a decision is a later comment `/approve` or `/reject <reason>`. Each run
sets the commit status `gatekeeper` of the head commit: `pending`, `success` or `failure`. A new commit is a new gate,
so an approval of an older commit does not count. Require the status `gatekeeper` in a branch protection rule to
block the merge until the gate is approved. On Forgejo, `GATEKEEPER_FORGE_URL` is the forge's origin, like
`https://forge.example`, not its `/api/v1`.

## GitHub Action

```yaml
on:
  pull_request_target:
    types: [opened, synchronize, reopened, labeled]
  issue_comment:
    types: [created]
permissions:
  contents: read
  issues: write
  pull-requests: write
  statuses: write
jobs:
  gate:
    if: github.event_name != 'issue_comment' || github.event.issue.pull_request
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v5 # the default branch: a pull request cannot change its own gate
      - uses: sesigl/open-software-factory/modules/gatekeeper@gatekeeper-v0.1.0
        with:
          policy: .github/gatekeeper/merge.rego
          groups: .github/gatekeeper/groups.json
```

The action sets up OPA, runs `request` and `status` for the pull request of the event and uploads the record as the
artifact `gatekeeper-record`. Its outputs are `decision` (`approved`, `rejected`, `expired` or `pending`) and
`record` (the record's path, once decided). It fails when the gate is rejected or expired; while it waits it
succeeds and the commit status stays `pending`. Inputs: `policy`, `groups`, `token` (default the job's token),
`record` and `command` (default `npx --yes @opensoftware/gatekeeper@<version of the action>`). To sign the record, set
`GATEKEEPER_SIGNING_KEY` from a secret in the step's `env`.

## Server

`gatekeeper serve` keeps the gates in PostgreSQL, so a program asks with one HTTP call and people decide with a
button or a reply in Slack. Nothing polls: Slack sends each reply and each press to the server.

```sh
export GATEKEEPER_DATABASE_URL=postgres://gatekeeper@db/gatekeeper
export GATEKEEPER_API_TOKEN=... GATEKEEPER_SLACK_TOKEN=xoxb-... GATEKEEPER_SLACK_SIGNING_SECRET=...
npx @opensoftware/gatekeeper serve --policy policy.rego --groups groups.json --channel slack:C0GATES
curl -H "Authorization: Bearer $GATEKEEPER_API_TOKEN" -H "content-type: application/json" \
  --data @request.json http://localhost:8080/v1/gates
```

| Route | What it does |
| --- | --- |
| `POST /v1/gates` | Ask for a decision on a request (the JSON of [Request](#request)). 201 with the new gate, 200 with the gate the same request made before, 400 with a problem that names the field. |
| `GET /v1/gates/{gateId}` | The gate: `state` (`pending`, `approved`, `rejected` or `expired`), `waitingFor`, `requestedAt`, `expiresAt` and, once decided, the `record`. 404 for a gate the server does not know. |
| `POST /slack/events` | Slack's Events API: a message in the channel makes the server read the threads of its pending gates, so a reply decides like `status`. |
| `POST /slack/actions` | Slack's interactivity: a press of Approve or Reject decides like a reply `approve` or `reject`. |

The OpenAPI of the `/v1` routes is in [`contracts/openapi/openapi.json`](../../contracts/openapi/openapi.json); the
TypeScript type `paths` of `@opensoftware/contracts` types a client. The `/v1` routes need `Authorization: Bearer
<GATEKEEPER_API_TOKEN>`, the Slack routes Slack's signature; both answer 401 otherwise. Errors are
`application/problem+json` with `title`, `status` and `detail`.

The request message has the buttons Approve and Reject. The rules of [Decisions](#decisions) hold for presses and
replies alike, and a press after the decision changes nothing. A press counts at the server's time when it arrives. The policy's answer is stored with the gate when it
is requested; the groups file is read when the server starts. The server checks every pending gate when it starts
and then every minute, so an escalation or an expiry needs no event.

Set up a Slack app with the bot scopes `chat:write` and `channels:history`, the event `message.channels` with the
request URL `https://<server>/slack/events`, and interactivity with the request URL `https://<server>/slack/actions`.

With `GATEKEEPER_NATS_URL`, each event is written to the outbox table in the same transaction as the gate's change
and published right after. While NATS is unreachable the events wait in the outbox and go out once it is back, at
least once, with the same event IDs.

## Records

`record.json` has `gate`, `workItem`, `stage`, `summary`, `request` (SHA-256 of the request), `policy`,
`policyDigest` (SHA-256 of the policy's text), `risk`, `approvers`, `channel`, `requestedAt`, `decision`,
`decidedBy` (`kind` `person` or `trigger` and `id`; absent when the gate expired), `decidedAt` and `reason`: the
format [`gate-record`](../../contracts/gate-record/gate-record.schema.json) of the contracts. With
`GATEKEEPER_SIGNING_KEY` it has a `signature`: Ed25519 over the canonical JSON of the rest, and `key`, the SHA-256 of
the public key. `gatekeeper keys` makes a key pair; keep `gatekeeper.pem` in a secret store, such as a GitHub Actions
secret, and publish `gatekeeper.pub`:

```sh
npx @opensoftware/gatekeeper keys --out keys
export GATEKEEPER_SIGNING_KEY="$(cat keys/gatekeeper.pem)"
npx @opensoftware/gatekeeper verify --public-key keys/gatekeeper.pub record.json
```

## Events

With `GATEKEEPER_NATS_URL`, `request` (and `POST /v1/gates`) publishes [`gate.requested@v1`](../../contracts/events/gate-requested/gate-requested.schema.json)
on `osf.gate.requested.v1` when it posts a request, and `status` (and the server) publishes
[`gate.decided@v1`](../../contracts/events/gate-decided/gate-decided.schema.json) on `osf.gate.decided.v1` when it posts
the decision. The event ID is the gate's ID with `.requested` or `.decided`.

## Configuration

<!-- generated by make docs from src/config.schema.json: do not edit -->

| Variable | Type | Default | Meaning |
| --- | --- | --- | --- |
| `OUTPUT` | string | `"."` | Folder of gate.json and record.json when --out and --record are not given. |
| `OSF_NOW` | string |  | The current time, like 2026-01-01T05:00:00Z, for escalation and expiry. Default: the clock. |
| `PORT` | string | `"8080"` | serve: the port the HTTP server listens on. |
| `GATEKEEPER_OPA` | string | `"opa"` | The OPA 1.x program that evaluates the policy. |
| `GATEKEEPER_SLACK_ADAPTER` | string | `"npx -y @opensoftware/channel-slack"` | The command line of the channel port's slack adapter, which reaches Slack for a slack: channel (ADR 0061). |
| `GATEKEEPER_SLACK_URL` | string |  | Base URL of the Slack Web API, ending in a slash: the adapter's CHANNEL_API_URL. Default: the adapter's, https://slack.com/api/. |
| `GATEKEEPER_SLACK_TOKEN` | string |  | Slack bot token with chat:write and channels:history: the adapter's CHANNEL_TOKEN. Required for a slack: channel. |
| `GATEKEEPER_SLACK_SIGNING_SECRET` | string |  | serve: the signing secret of the Slack app, the adapter's CHANNEL_SIGNING_SECRET, which checks every request from Slack. Required for serve. |
| `GATEKEEPER_FORGE_ADAPTER` | string |  | The command line of the forge port's adapter for --pull-request (ADR 0061). Default: npx -y @opensoftware/forge-github for github.com, npx -y @opensoftware/forge-forgejo for any other host. |
| `GATEKEEPER_FORGE_URL` | string |  | The forge adapter's FORGE_URL. Default: https://api.github.com for github.com, the pull request's origin for Forgejo. |
| `GATEKEEPER_FORGE_TOKEN` | string |  | The forge adapter's FORGE_TOKEN: a token that may read the pull request, comment on it and set its commit status. Never written to a file. |
| `GATEKEEPER_SIGNING_KEY` | string |  | Ed25519 private key in PEM that signs each record. Without it the record is unsigned. |
| `GATEKEEPER_NATS_URL` | string |  | NATS server, like nats://localhost:4222, for the events gate.requested@v1 and gate.decided@v1. Unset: no events. serve keeps them in its outbox while NATS is unreachable. |
| `GATEKEEPER_DATABASE_URL` | string |  | serve: the PostgreSQL database, like postgres://gatekeeper@db/gatekeeper, for the gates and the outbox. Required for serve. |
| `GATEKEEPER_API_TOKEN` | string |  | serve: the token that callers of the API send as Authorization: Bearer <token>. Required for serve. Never written to a file. |

## Releases

release-please opens a release pull request from the Conventional Commits under `modules/gatekeeper/`. Merging it
creates the tag `gatekeeper-v<version>`. The workflow `.github/workflows/publish-gatekeeper.yml` then builds the
package and publishes it to npm as `@opensoftware/gatekeeper`. When the newest tag is missing on npm, the next run of
the workflow on `main` publishes it. To publish a tag again, run the workflow by hand with the tag. The first release
is `0.1.0`; until `1.0.0`, a breaking change raises the minor version.

The one-time setup is the same as for contracts ([`contracts/README.md`](../../contracts/README.md#releases)): the
GitHub environment `npm`, a token only for the first version, then a trusted publisher for the workflow
`publish-gatekeeper.yml`. No credential is stored in the repository.

## Scenarios

<!-- generated by make docs from features/: do not edit -->

| ID | Status | Scenario |
| --- | --- | --- |
| SCN-GATE-001 | implemented | A new user asks for approval in Slack with the files from the README |
| SCN-GATE-002 | implemented | The help lists every command |
| SCN-GATE-003 | implemented | An unknown command shows the usage |
| SCN-GATE-004 | implemented | The policy asks "maintainers" for a change of high risk |
| SCN-GATE-005 | implemented | The policy asks "reviewers" for a change of low risk |
| SCN-GATE-006 | implemented | The same request twice asks only once |
| SCN-GATE-007 | implemented | A policy that names no approver group approves without a person |
| SCN-GATE-008 | implemented | A group that the groups file does not define exits 2 |
| SCN-GATE-009 | implemented | A request without a work item exits 2 and names the field |
| SCN-GATE-010 | implemented | Without OPA the command says how to install it |
| SCN-GATE-011 | implemented | A policy that OPA cannot read exits 2 with OPA's message |
| SCN-GATE-012 | implemented | A request is published as the event "gate.requested@v1" |
| SCN-GATE-013 | implemented | A member of the approver group approves in the thread |
| SCN-GATE-014 | implemented | The record names the approver and the time |
| SCN-GATE-015 | implemented | A member rejects with a reason |
| SCN-GATE-016 | implemented | A decision by a person outside the approver group is refused |
| SCN-GATE-017 | implemented | A refused decision gets one reply, however often status runs |
| SCN-GATE-018 | implemented | A gate without a decision waits |
| SCN-GATE-019 | implemented | A gate without a decision after its timeout asks the escalation group |
| SCN-GATE-020 | implemented | A member of the escalation group approves after the escalation |
| SCN-GATE-021 | implemented | A member of the escalation group cannot decide before the escalation |
| SCN-GATE-022 | implemented | A gate without a decision expires after "expire_after" |
| SCN-GATE-023 | implemented | Status before any request exits 1 |
| SCN-GATE-024 | implemented | A text that looks like gatekeeper's marker but comes from a person is no request |
| SCN-GATE-025 | implemented | A decision is published as the event "gate.decided@v1" |
| SCN-GATE-026 | implemented | A signed record verifies with the public key |
| SCN-GATE-027 | implemented | A record whose approver was changed fails verification |
| SCN-GATE-028 | implemented | A record without a signature fails verification |
| SCN-GATE-029 | implemented | A factory-made pull request asks "maintainers" in a comment |
| SCN-GATE-030 | implemented | A pull request that the policy does not gate passes without a person |
| SCN-GATE-031 | implemented | An "/approve" comment of a maintainer passes the gate |
| SCN-GATE-032 | implemented | An approval of an older commit does not count for a new commit |
| SCN-GATE-033 | implemented | A "/reject" comment of a maintainer fails the gate |
| SCN-GATE-034 | implemented | The action asks for approval of a factory-made pull request and waits |
| SCN-GATE-035 | implemented | The action fails when a maintainer rejects the pull request |
| SCN-GATE-036 | implemented | The action names the record of an approved pull request |
| SCN-GATE-037 | implemented | The command "keys" writes a key pair for signing records |
| SCN-GATE-038 | implemented | A signing key that is no PEM key exits 2 and writes no record |
| SCN-GATE-039 | implemented | A groups file that is not JSON exits 2 and names the file |
| SCN-GATE-040 | deprecated | A pull request that the forge does not know exits 1 |
| SCN-GATE-041 | implemented | A program asks for approval over HTTP and the server asks in Slack with buttons |
| SCN-GATE-042 | implemented | The same request twice answers the same gate and asks only once |
| SCN-GATE-043 | implemented | A request without a summary gets the status 400 and names the field |
| SCN-GATE-044 | implemented | A call without the API token gets the status 401 |
| SCN-GATE-045 | implemented | A gate the server does not know gets the status 404 |
| SCN-GATE-046 | implemented | A policy that names no approver group approves a request over HTTP at once |
| SCN-GATE-047 | implemented | A member of the approver group presses "Approve" |
| SCN-GATE-048 | implemented | A member rejects with a reason in the thread |
| SCN-GATE-049 | implemented | A press of "Approve" by a person outside the approver group is refused |
| SCN-GATE-050 | implemented | A second press after the decision changes nothing |
| SCN-GATE-051 | implemented | A Slack request with a wrong signature gets the status 401 and decides nothing |
| SCN-GATE-052 | implemented | Slack's URL verification gets its challenge back |
| SCN-GATE-053 | implemented | The server asks the escalation group when it starts after the escalation time |
| SCN-GATE-054 | implemented | The server expires a gate when it starts after "expire_after" |
| SCN-GATE-055 | implemented | A request over HTTP is published as the event "gate.requested@v1" |
| SCN-GATE-056 | implemented | A decision in Slack is published as the event "gate.decided@v1" |
| SCN-GATE-057 | implemented | An event of a time when NATS was unreachable is published once the server reaches NATS |
| SCN-GATE-058 | implemented | The server without a database exits with code 2 and names the variable |
| SCN-GATE-059 | implemented | A Slack token that the channel refuses exits 1 with the channel's error |
| SCN-GATE-060 | implemented | A forge token that the forge refuses exits 1 with the forge's error |
| SCN-GATE-061 | implemented | A pull request that the forge does not have exits 1 and names it |
