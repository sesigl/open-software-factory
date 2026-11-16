---
covers: [modules/gatekeeper/src/**, modules/gatekeeper/action.yml, modules/gatekeeper/action.sh]
---

# gatekeeper

Ask people for approval before an automation or a CI job goes on. A Rego policy picks the groups that must approve
a change, for example by its risk. gatekeeper asks them in Slack or on the pull request, reads their answer, refuses
anyone outside the groups, asks a second group after a timeout, and writes a signed record of who decided what and
when. As a server it takes requests over HTTP and decides on Slack's events and buttons without polling. Decisions:
[ADR 0047](../../docs/decisions/0047-gatekeeper.md), [ADR 0048](../../docs/decisions/0048-gatekeeper-server.md),
[ADR 0062](../../docs/decisions/0062-gatekeeper-ports.md), [ADR 0151](../../docs/decisions/0151-the-person-proven-to-every-module.md).

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
| `gatekeeper serve --policy <file.rego> --groups <file.json> [--channel slack:<channel ID>]` | Serve the gate API on `PORT` until it gets SIGTERM; see [Server](#server). |
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
`slack:U024BE7LH`, `github:octocat` or `forgejo:octocat`, or as email addresses like `ada@acme.dev`, as the console
names a person who decides through the [server's API](#the-person-who-decides). A group the policy names must be in
it.

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
100 changed files). The request is a comment; a decision is a later comment `/approve` or `/reject <reason>`,
however many comments are in between. A comment that the forge dates before the request comment never decides, by the
forge's own clock; without its request comment, deleted or not listed, no comment decides the gate: it stays pending.
Each run sets the commit status `gatekeeper` of the head commit: `pending`, `success` or `failure`. A new commit is a new gate,
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
  checks: read # the forge adapter's pr lists the check runs of the head commit
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

The action sets up OPA 1.21.0 (through the GitHub API, checked against its pinned SHA-256, when github.com fails to
send the release file), runs `request` and `status` for the pull request of the event and uploads the record as the
artifact `gatekeeper-record`. Its outputs are `decision` (`approved`, `rejected`, `expired` or `pending`) and
`record` (the record's path, once decided). It fails when the gate is rejected or expired; while it waits it
succeeds and the commit status stays `pending`. Inputs: `policy`, `groups`, `token` (default the job's token),
`record` and `command` (default `npx --yes @opensoftware/gatekeeper@<version of the action>`). To sign the record, set
`GATEKEEPER_SIGNING_KEY` from a secret in the step's `env`.

## Server

`gatekeeper serve` keeps the gates in PostgreSQL, so a program asks with one HTTP call and people decide with a
button or a reply in Slack, or with a comment on a pull request. For Slack nothing polls: Slack sends each reply and
each press to the server.

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
| `POST /v1/gates/{gateId}/decisions` | A person decides a pending gate: `{ "decision": "approved" or "rejected", "by": { "kind": "person", "id": "…" }, "reason": "…" }` decides like a reply `approve` or `reject <reason>` from `by.id` in the gate's channel, with the same record, event and reply ([ADR 0118](../../docs/decisions/0118-actions-record-the-person.md)). 200 with the gate, 400 without `by` or with another decision, 403 when `by.id` is in no group of `waitingFor`, 404 for an unknown gate, 409 when the gate is no longer pending. With `GATEKEEPER_PERSON_KEYS`, 401, 403 or 503 for the proof of the person ([The person who decides](#the-person-who-decides)). |
| `GET /v1/health` | Whether the server reaches its database, can start OPA and, with `GATEKEEPER_NATS_URL`, reaches NATS: 200 with `status: ok`, else 503 with the failing check and what to fix ([ADR 0086](../../docs/decisions/0086-health-routes.md)). Needs no token. |
| `POST /slack/events` | Slack's Events API: a message in the channel makes the server read the threads of its pending gates, so a reply decides like `status`. |
| `POST /slack/actions` | Slack's interactivity: a press of Approve or Reject decides like a reply `approve` or `reject`. |

The OpenAPI of the `/v1` routes is in [`contracts/openapi/openapi.json`](../../contracts/openapi/openapi.json); the
TypeScript type `paths` of `@opensoftware/contracts` types a client. The `/v1` routes except `/v1/health` need `Authorization: Bearer
<GATEKEEPER_API_TOKEN>`, the Slack routes Slack's signature; both answer 401 otherwise. Errors are
`application/problem+json` with `title`, `status` and `detail`.

The request message has the buttons Approve and Reject. The rules of [Decisions](#decisions) hold for presses and
replies alike, and a press after the decision changes nothing. A press counts at the server's time when it arrives. The policy's answer is stored with the gate when it
is requested; the groups file is read when the server starts. A group whose only member is `slack:U0EXAMPLE`, the member that the
reference `groups.json` of `deploy/` ships in place of a person, makes the server write a line to stderr that names
the group, as nobody decides its gates; the server starts all the same
([ADR 0114](../../docs/decisions/0114-the-example-member-of-the-reference-groups.md)). The server checks every pending gate when it starts
and then every minute, so an escalation or an expiry needs no event.

### The person who decides

Without `GATEKEEPER_PERSON_KEYS`, a caller with the API token names any person in `by`, and the server says so once
when it starts. With it, the server checks a person proof for each `POST /v1/gates/{gateId}/decisions`
([ADR 0151](../../docs/decisions/0151-the-person-proven-to-every-module.md)), with the library
[`@opensoftware/person-proof`](../../packages/person-proof/README.md). The setting names the issuers as `name=url`
pairs of their key sets, separated by commas:

```sh
export GATEKEEPER_PERSON_KEYS=console=http://console:8080/.well-known/jwks.json
```

The caller sends the API token and, in the header `OSF-Person`, a proof that an issuer of the setting signed for
`gatekeeper`, this request's method, path and body bytes, and the person in `by.id`. A gate is decided by a person, so
every decision needs a proof, whatever kind of actor `by` names. The server checks the body first (400), then the proof:

| Status | When |
| --- | --- |
| 401 | No `OSF-Person`, a proof that does not verify (another `alg` or `typ`, an issuer the setting does not name, an unknown key, a bad signature), one for another module, claims that are no valid `person-proof`, or a proof that ended more than 10 seconds ago. |
| 403 | A valid proof for another method, path, body or person; the problem names the claim. |
| 503 | The issuer's key set cannot be fetched, answers another status than 200, or is no valid `person-keys`; the problem names the issuer. The person did nothing wrong. |

Each refusal is a problem with the reason as `detail`, changes nothing, and writes one line to stderr, like
`gatekeeper: refused POST /v1/gates/g…/decisions for "ada@acme.dev": the person proof ended at 2026-11-15T10:00:30Z`,
which names the person the proof claims and never holds the proof. A decision with a valid proof is recorded with the
proven person: `decidedBy` of the record and of `gate.decided@v1` has the proof's `sub` as `id` and its `name` as
`displayName`. So list the person as the console names them, like `ada@acme.dev`, in the groups file. A team's own tool
decides a gate only with a key set of its own, named in the setting, like `acme-portal=https://portal.acme.dev/jwks.json`.
Replies and presses in Slack and comments on a pull request need no proof: Slack and the forge name the person
themselves. A setting that is no list of `name=url` pairs stops `serve` with code 2, like
`GATEKEEPER_PERSON_KEYS: a key set is <name>=<url>, like console=http://console:8080/.well-known/jwks.json: "console" is not`.
In tests the clock of the check is `OSF_NOW`.

### Pull requests in server mode

With `GATEKEEPER_FORGE_TOKEN`, a request whose `links` contain a pull request URL (`https://github.com/<owner>/<repo>/pull/<n>`,
or `/pulls/<n>` on Forgejo) is asked on that pull request, as [Pull requests](#pull-requests) describes: the server
comments the request with its marker and sets the commit status `gatekeeper` of the head commit to `pending`. The
gate's `channel` is the pull request's URL. The server reads the comments of the pull requests with a pending gate
every `GATEKEEPER_POLL_MS` (default 30 seconds) and decides with the same rules as `status`: an `/approve` or
`/reject <reason>` of an approver decides, and the commit status becomes `success` or `failure`. The record and the
event `gate.decided@v1` are the same as for a gate in Slack. The commit status goes to the head commit that the server
read when it asked; after a restart, the server reads the head commit again.

The server's forge is configuration, never request data: `GATEKEEPER_FORGE_URL`, or GitHub's API without it. A link
counts as the gate's pull request only on that forge's origin: `https://github.com` for `https://api.github.com`, the
URL's own origin otherwise (like `https://forge.example` for Forgejo, or `https://ghe.example` for
`https://ghe.example/api/v3`). The server never calls a link to another host and never sends it the token: such a
request is asked in the Slack channel, or gets the status 400 on a server without one. The CLI's `--pull-request` is
the caller's own configuration, so there the pull request's origin still picks the URL when `GATEKEEPER_FORGE_URL` is
not set.

A server can run without a Slack app:

```sh
export GATEKEEPER_DATABASE_URL=postgres://gatekeeper@db/gatekeeper
export GATEKEEPER_API_TOKEN=... GATEKEEPER_FORGE_TOKEN=...
npx @opensoftware/gatekeeper serve --policy policy.rego --groups groups.json
```

It needs `--channel`, `GATEKEEPER_FORGE_TOKEN` or both, and exits with code 2 without either. With both, a request with a
pull request link is asked on the pull request and every other request in Slack. Without `--channel`, a request
without a pull request link gets 400, and the Slack routes answer 404. The approvers on a pull request are
`github:<login>` (or the prefix of the forge adapter) in the groups file.

Set up a Slack app with the bot scopes `chat:write` and `channels:history`, the event `message.channels` with the
request URL `https://<server>/slack/events`, and interactivity with the request URL `https://<server>/slack/actions`.

With `GATEKEEPER_NATS_URL`, each event is written to the outbox table in the same transaction as the gate's change
and published right after. While NATS is unreachable the events wait in the outbox and go out once it is back, at
least once, with the same event IDs. The events go to the JetStream stream `OSF` on `osf.>`, which gatekeeper adds
when it is missing; an event leaves the outbox only after the stream stored it, so a foreman that is down gets the
decision when it starts ([ADR 0085](../../docs/decisions/0085-durable-events.md)).

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

`GATEKEEPER_SIGNING_KEY` may also be the seed of the key in 64 hex digits, like the output of `openssl rand -hex 32`.
Its public key in PEM, for `verify`:

```sh
node -e 'const c = require("node:crypto");
const der = Buffer.from("302e020100300506032b657004220420" + process.env.GATEKEEPER_SIGNING_KEY, "hex");
const key = c.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
process.stdout.write(c.createPublicKey(key).export({ type: "spki", format: "pem" }));' > gatekeeper.pub
```

Without the key, `gatekeeper status` says that the record is not signed, and `gatekeeper serve` says once at its
start that its records are not signed.

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
| `GATEKEEPER_SLACK_ADAPTER` | string | `"npx -y @opensoftware/channel-slack"` | The command line of the channel port's slack adapter, which reaches Slack for a slack: channel (ADR 0062). |
| `GATEKEEPER_SLACK_URL` | string |  | Base URL of the Slack Web API, ending in a slash: the adapter's CHANNEL_API_URL. Default: the adapter's, https://slack.com/api/. |
| `GATEKEEPER_SLACK_TOKEN` | string |  | Slack bot token with chat:write and channels:history: the adapter's CHANNEL_TOKEN. Required for a slack: channel. |
| `GATEKEEPER_SLACK_SIGNING_SECRET` | string |  | serve: the signing secret of the Slack app, the adapter's CHANNEL_SIGNING_SECRET, which checks every request from Slack. Required for serve with a Slack channel. |
| `GATEKEEPER_FORGE_ADAPTER` | string |  | The command line of the forge port's adapter for --pull-request (ADR 0062). Default: npx -y @opensoftware/forge-github for github.com, npx -y @opensoftware/forge-forgejo for any other host. |
| `GATEKEEPER_FORGE_URL` | string |  | The forge adapter's FORGE_URL. serve: the server's only forge; a request's link counts as a pull request only on its origin (github.com for https://api.github.com), and no other host is called. Default: https://api.github.com; for --pull-request, https://api.github.com for github.com and the pull request's origin for Forgejo. |
| `GATEKEEPER_FORGE_TOKEN` | string |  | The forge adapter's FORGE_TOKEN: a token that may read the pull request and its checks (on GitHub: Checks: read, since the adapter's pr lists the check runs), comment on it and set its commit status. serve: with it, a request that links a pull request of GATEKEEPER_FORGE_URL's forge is asked on the pull request. Never written to a file. |
| `GATEKEEPER_POLL_MS` | string | `"30000"` | serve: the milliseconds between two reads of the comments of the pull requests with a pending gate (ADR 0080). Only with GATEKEEPER_FORGE_TOKEN. |
| `GATEKEEPER_SIGNING_KEY` | string |  | The Ed25519 private key that signs each record: in PEM, as gatekeeper keys writes it, or its seed in 64 hex digits, like the output of openssl rand -hex 32. Without it the record is unsigned, and serve says so once at its start. |
| `GATEKEEPER_NATS_URL` | string |  | NATS server, like nats://localhost:4222, for the events gate.requested@v1 and gate.decided@v1. Unset: no events. serve keeps them in its outbox while NATS is unreachable. |
| `GATEKEEPER_DATABASE_URL` | string |  | serve: the PostgreSQL database, like postgres://gatekeeper@db/gatekeeper, for the gates and the outbox. Required for serve. |
| `GATEKEEPER_API_TOKEN` | string |  | serve: the token that callers of the API send as Authorization: Bearer <token>. Required for serve. Never written to a file. |
| `GATEKEEPER_PERSON_KEYS` | string |  | serve: the issuers of person proofs as name=url pairs of their key sets, separated by commas, like console=http://console:8080/.well-known/jwks.json (ADR 0151). With it, each decision through the API needs the header OSF-Person, a proof of the person that one of them signed. Unset: a caller with the API token names any person. |

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
| SCN-GATE-062 | implemented | A channel adapter that prints no JSON exits 1 and names the adapter |
| SCN-GATE-063 | deprecated | A request that links a pull request is asked in a comment on the pull request |
| SCN-GATE-064 | implemented | An "/approve" comment of a maintainer approves the gate and is published as "gate.decided@v1" |
| SCN-GATE-065 | implemented | A "/reject" comment of a maintainer rejects the gate with the reason |
| SCN-GATE-066 | implemented | A request without a pull request link on a server without Slack gets the status 400 |
| SCN-GATE-067 | implemented | The server without a Slack channel and without the forge token exits with code 2 |
| SCN-GATE-068 | implemented | A failed read of the pull request's comments keeps the gate pending, and a later read decides it |
| SCN-GATE-069 | implemented | The server goes on serving when its database fails during a check of the pull request gates |
| SCN-GATE-070 | implemented | The server goes on serving when its database stops in the middle of a pull request gate's check |
| SCN-GATE-071 | implemented | A work item that is no text of 1 to 128 characters exits 2 and names the field |
| SCN-GATE-072 | implemented | A stage that is no lowercase name exits 2 and names the field |
| SCN-GATE-073 | implemented | A summary of only spaces exits 2 and names the field |
| SCN-GATE-074 | implemented | Links that are no list of URLs exit 2 and name the field |
| SCN-GATE-075 | implemented | A change that is no JSON object exits 2 and names the field |
| SCN-GATE-076 | implemented | A request file that holds no JSON object exits 2 and names the file |
| SCN-GATE-077 | implemented | Approvers or escalation groups that are no group names exit 2 and name the rule |
| SCN-GATE-078 | implemented | A policy without rules in the package "gatekeeper" exits 2 and names the policy |
| SCN-GATE-079 | implemented | A policy without approvers exits 2 and names the policy |
| SCN-GATE-080 | implemented | A risk that is no text exits 2 |
| SCN-GATE-081 | implemented | A policy with "escalate_after" and without "escalate_to" exits 2 |
| SCN-GATE-082 | implemented | A duration that is not like "4h" exits 2 and names the rule |
| SCN-GATE-083 | implemented | A groups file that does not map each group to a list of identities exits 2 and names the file |
| SCN-GATE-084 | implemented | A time in "OSF_NOW" that is no ISO time exits 2 and names the time |
| SCN-GATE-085 | implemented | A channel that is not like "slack:C0GATES", or a Slack channel without a token, exits 2 |
| SCN-GATE-086 | implemented | "gatekeeper request" with wrong arguments exits 2 and says what to change |
| SCN-GATE-087 | implemented | "gatekeeper verify" without a public key or with two records exits 2 |
| SCN-GATE-088 | implemented | The output of a request names the gate, the groups, the channel and the risk |
| SCN-GATE-089 | implemented | The server with a wrong setting exits with code 2 and names the setting |
| SCN-GATE-090 | implemented | A call without an Authorization header gets the status 401 and a problem that says how to send the token |
| SCN-GATE-091 | implemented | A server that reaches its database, OPA and NATS is healthy |
| SCN-GATE-092 | implemented | A server without OPA is failing and says what to fix |
| SCN-GATE-093 | implemented | The server names a group whose only member is the example's when it starts |
| SCN-GATE-094 | implemented | A request reaches a stream "OSF" that another module added with a max age, and the stream keeps its age |
| SCN-GATE-095 | implemented | A member of the approver group rejects a gate through the API, and the record names the person |
| SCN-GATE-096 | implemented | A decision through the API by a person outside the approver groups is refused |
| SCN-GATE-097 | implemented | A decision through the API without a person, of an unknown gate or of a decided gate is refused |
| SCN-GATE-098 | implemented | A decision with the console's proof of the person is recorded with that person and the proof's name |
| SCN-GATE-099 | implemented | A decision with the API token but without a proof is refused, for a made-up person and for a trigger, after the body is checked |
| SCN-GATE-100 | implemented | A proof past its end is refused, and the log names the person and the reason but not the proof |
| SCN-GATE-101 | implemented | A proof for another module, another path, another body or another person is refused and names the claim |
| SCN-GATE-102 | implemented | A team's own tool named in the setting decides with its own proof, and an issuer that the setting does not name is refused |
| SCN-GATE-103 | implemented | A server whose GATEKEEPER_PERSON_KEYS is no list of name=url pairs exits with code 2 and names the pair |
| SCN-GATE-104 | implemented | Without GATEKEEPER_PERSON_KEYS a decision for a made-up person is accepted as before, and the server says so once |
| SCN-GATE-105 | implemented | An issuer whose key set answers 500 gives the status 503 that names the issuer, and the gate stays pending |
| SCN-GATE-106 | implemented | A groups file names a member by an email address, as the console names a person, but not by a bare "ada@" |
| SCN-GATE-107 | implemented | A request that links a pull request of the server's forge is asked in a comment on the pull request |
| SCN-GATE-108 | implemented | A pull request link to another forge is never called, and without Slack the request gets the status 400 |
| SCN-GATE-109 | implemented | A pull request link to another forge does not decide a gate: the server asks in Slack |
| SCN-GATE-110 | implemented | Without "GATEKEEPER_FORGE_URL" the server's forge is GitHub, and a pull request link to another forge is never called |
| SCN-GATE-111 | implemented | When the forge no longer lists the request's comment, no "/approve" decides the gate, also none from before the request |
| SCN-GATE-112 | implemented | An "/approve" after more than 100 comments passes the gate |
| SCN-GATE-113 | implemented | Without "GATEKEEPER_SIGNING_KEY" the server writes unsigned records and says so once at its start |
| SCN-GATE-114 | implemented | A signing key of 64 hex digits, the seed of an Ed25519 key, signs a record that verifies with its public key |
| SCN-GATE-115 | implemented | The merge gate of this repository asks "maintainers" for the factory's branches "osf/", "observer/" and "factory/" |
| SCN-GATE-116 | implemented | An "/approve" that the forge lists after the request but dates before it does not pass the gate |
| SCN-GATE-117 | implemented | In the second of the request the forge's order decides: a "/reject" listed before the request does not count, an "/approve" listed after it does |
