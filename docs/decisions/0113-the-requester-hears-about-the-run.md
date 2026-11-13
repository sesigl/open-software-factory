---
status: accepted
date: 2026-11-13
---

# 0113. The requester hears about the run

## Context

T-45: intake answered a Slack mention with the work item's ID and, when the run succeeded, with its pull requests
(ADR 0071). A person heard nothing when the run waited at a gate or failed, and an issue got no comment at all. The
gatekeeper already publishes `gate.requested@v1` with the work item's ID, but without the run's. `run.completed@v1`
names the stage a run ended at, but no reason beyond its outcome. The forge port's `comment` posts on a pull request;
GitHub and Forgejo comment on an issue through the same `/issues/<number>/comments` endpoint. JetStream delivers an
event at least once.

## Decision

- intake's durable consumer also listens on `osf.gate.requested.v1`. A consumer of an earlier version gets the new
  subjects with an update when creating it is refused.
- Each origin of a request for the work item hears of the run: the thread of a Slack request through the channel
  adapter's `reply`, the issue of a forge request (external ID `<owner>/<name>#<number>`) through the forge adapter's
  `comment`, with `INTAKE_FORGE_TOKEN`. Sentry and API requests hear nothing.
- The messages: a gate's stage and summary; a failed or cancelled run's outcome and stage; a succeeded run's pull
  requests, as before. Each message that is about a run links its page in the console, `INTAKE_CONSOLE_URL/runs/<run
  ID>`, or names the run's ID without a console. The run of a gate is the run the work item follows.
- intake keeps the source and ID of every event it told of in `intake.told`, written after the replies; the same event
  again tells nothing. A reply that fails is a warning and is not retried, so one bad origin does not repeat the
  message on the others.
- The forge port's `comment` takes the number of a pull request or of an issue (conformance scenario SCN-FORGE-034).
  No contract changes.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Reply from the consumed event, dedupe by event ID (chosen) | No contract change; one place per origin | A failed reply is lost, not retried |
| A new `run.blocked@v1` from the foreman | Covers checks too | A contract and foreman change for what `gate.requested@v1` already says |
| A new port command `issue-comment` | Explicit | Same endpoint on both forges; a second command for one call |
| Retry a failed reply with the event | No lost message | Repeats the message on every origin that already heard it |

## Prior art

No new module, dependency or service. Slack and GitHub bots such as Renovate and the GitHub Actions bot reply once per
state change in the thread or issue that asked, with a link to the run's page; this follows them.

## Consequences

- A run blocked at its checks, not at a gate, tells nothing yet: no event says so. Revisit when the foreman publishes
  a stage's waiting state.
- The reason of a failure is the stage the run ended at; a richer reason needs a field in `run.completed@v1`.
- `intake.told` grows by one row per run event; prune it with the work items when they get a retention.
