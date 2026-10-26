---
status: accepted
date: 2026-10-26
---

# 0065. intake: issues labeled "factory", one work item across surfaces, Sentry alerts

## Context

ADR 0063 built intake's inbox: the API, the events, Slack mentions and the Factory MCP server. TODO item T-16 lists
three more slices, which this decision covers:

- GitHub issues labeled `factory` become work items, with the issue's link as the dedupe key (the item's "Done
  when").
- One work item across surfaces: a Slack mention that links an issue and the label on that issue meet.
- A Sentry alert about a fatal error becomes a `bug` work item linked to the error and the change (vision scenario
  LOOP-003).

What exists:

- The forge port (ADR 0057, ADR 0060) registers webhooks for the port's event names, among them `issue.labeled`, and
  its `event` command turns a delivery into a CloudEvent. It knows only pull request events so far.
- factory-spec registers the webhooks of automations at intake's URL, signed with `FACTORY_WEBHOOK_SECRET`, "which
  intake checks with the port's `event`" (ADR 0060).
- The testkit's `fakes.github` and `fakes.forge` keep pull requests and deliver their webhooks, but have no issues.

## Decision

- **A new event `issue.labeled@v1`** in `contracts/events/issue-labeled/`, from the forge adapters. Its data is the
  issue's `url`, `repository`, `number`, `title`, optional `body`, `author` (the person who opened it), `labels` (every
  label name after the change) and optional `label` (the one just added, when the forge names it). Adding an event is
  not breaking, so contracts get a minor version.
- **The forge port's `event`** prints `issue.labeled@v1` for a delivery about a label added to an issue. A new
  `@conformance` scenario, `SCN-FORGE-030`, holds for both adapters. GitHub sends `issues` with the action `labeled`
  and names the label; Forgejo sends `issue_label` with the action `label_updated` and only the labels after the
  change, so `label` is absent there.
- **`POST /forge/events` in `intake serve`**, with `INTAKE_WEBHOOK_SECRET`. intake writes each delivery to a file and
  runs the adapter in `INTAKE_FORGE_ADAPTER` (default `npx -y @opensoftware/forge-github`) with
  `event <file>` and `FORGE_WEBHOOK_SECRET`. An adapter that refuses the signature gives 401. An `issue.labeled@v1`
  whose `labels` hold `INTAKE_FORGE_LABEL` (default `factory`) is submitted as a `task`: the issue's title and body,
  the author as the requester, the origin `<forge>` with the issue's link and `<owner>/<name>#<number>`, and the
  issue's link as the dedupe key. Any other delivery gets 200 and makes nothing. One intake serves one forge; the
  `<forge>` is the prefix of the author, like `github`.
- **A Slack mention that links an issue** takes the first link of the form `<base>/<owner>/<name>/issues/<number>` in
  its text as its dedupe key, instead of its thread. So the mention and the label meet in one work item, whichever
  comes first. A mention that makes a new work item gets the reply `Received as work item <id>.`; a mention that joins
  a work item from another surface gets `Added to work item <id>.`; a later mention in the same thread gets no reply.
- **`POST /sentry/events` in `intake serve`**, with `INTAKE_SENTRY_SECRET`, the client secret of a Sentry internal
  integration. A delivery whose `Sentry-Hook-Signature` is not the HMAC-SHA256 of its body with the secret gets 401.
  An `event_alert` (resource header `Sentry-Hook-Resource`) whose event has the level `fatal` becomes a `bug` work
  item: the event's title, the rule that fired as the requester `sentry:<rule>` of kind `trigger`, the origin
  `sentry` with the event's link and the Sentry issue's ID, and the dedupe key `sentry:<issue ID>`. Its links are the
  error in Sentry and, with `INTAKE_SENTRY_CHANGE_URL`, the change: that template with `{release}` replaced by the
  event's release. Any other delivery gets 200 and makes nothing.
- **`GET /v1/work-items?dedupeKey=<key>`** answers the work item with that key, or 404, so a client that knows an
  issue's link or a Sentry issue finds its work item without knowing how the ID is made. The operation is added to
  `contracts/typespec/intake-api.tsp`; a new path is not breaking.
- **The testkit** gets `fakes.sentry()`, which sends a webhook the `event_alert` of a rule, signed with its client
  secret, with issue IDs from a counter. It also gets issues: `openIssue(repository, {title, body})` and `label(repository, number, name)` on both
  fakes. `fakes.github` answers `GET /repos/{owner}/{repo}/issues/{number}` and delivers `issues` with the action
  `labeled`; `fakes.forge` calls Forgejo, which delivers `issue_label` itself.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| intake parses GitHub's and Forgejo's issue payloads itself | No contract change | A second forge client beside the adapters; ADR 0060 says intake checks deliveries with the port's `event` |
| The adapter prints a work item for an issue | No new event | The port would know intake's format; other clients (foreman, automations) want the label event |
| A new event `issue.labeled@v1` from the adapters | The port stays about forges; any client reads it | One more format in contracts |
| One adapter per forge, chosen by a delivery's headers | One intake for GitHub and Forgejo | Two adapter variables and a guess by header; no user needs both yet |
| One adapter in `INTAKE_FORGE_ADAPTER` | Simple; the same as gatekeeper's `GATEKEEPER_FORGE_ADAPTER` | A second forge needs a second intake |
| Join surfaces by a link in the text | Works with today's Slack adapter; deterministic | Only links of the form `/issues/<n>` meet; a later mention in the thread without the link is its own work item |
| Join surfaces by a model that reads the text | Finds work that is described, not linked | A model call in intake; no real model in tests |
| A Sentry SDK to read alerts | Sentry's own code | No official library verifies webhooks; the check is one HMAC |

## Prior art

- Sentry integration platform webhooks (docs, sentry.io): an internal integration sends `event_alert` deliveries
  signed with HMAC-SHA256 of the body in `Sentry-Hook-Signature`. Followed as documented. Sentry's SDKs
  (MIT, very active) send errors; none verifies webhooks.
- Sentry's own GitHub and Jira integrations (FSL, active): create an issue from an alert. Checked, not adopted: they
  write into a tracker, not into a deduplicated inbox with other surfaces.
- Keep (`keephq/keep`, MIT, active): an alert hub that deduplicates alerts from many tools. Checked, not adopted: a
  Python service with its own database for alerts, not work items; its deduplication works on alert fields, not
  links across chat and issues.
- OpenHands' GitHub resolver (MIT, active, see ADR 0063): a label starts an agent. Checked again: it is the same
  trigger, but without an inbox; the label rule here follows it.
- Probot (ISC, maintained, few releases): GitHub App framework that verifies and parses webhooks. Checked, not
  adopted: GitHub only; the forge port already verifies deliveries for GitHub and Forgejo.

## Consequences

- An issue labeled `factory` on a repository whose webhook points at intake becomes a work item. For this
  repository that needs a running intake with a public URL; that was the T-16 "Done when". The owner deferred hosting
  until the foreman acts on work items, so it is a slice of T-21 now.
- Work that a person mentions in Slack and labels on GitHub shows both requests on one work item.
- A fatal error in production starts the same loop as an idea or a bug report. Errors of lower levels make
  nothing; a Sentry alert rule picks what reaches intake.
- Each delivery starts the forge adapter as a process, as Slack's do (ADR 0063).
- Revisit the link rule when other trackers (Linear, Jira) send work: their links do not end in `/issues/<n>`.
