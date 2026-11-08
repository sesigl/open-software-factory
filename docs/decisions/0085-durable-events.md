---
status: accepted
date: 2026-11-08
---

# 0085. Durable events on a JetStream stream

## Context

intake, foreman and gatekeeper send their events as plain NATS messages on the subjects `osf.*` (ADR 0047, 0067,
0071). A consumer that is not connected when an event goes out never gets it:

- A `work.received@v1` that intake publishes while the foreman restarts starts no run. The work item stays
  `received`.
- A `gate.decided@v1` that gatekeeper publishes while the foreman restarts never reaches the run. The run stays
  `blocked` at its gate.
- A `run.completed@v1` that the foreman publishes while intake restarts never changes the work item.

ADR 0067 said to revisit this "with JetStream when a foreman runs as a service". The Compose profile and the Helm
chart run NATS with JetStream, but no stream exists. The review of the whole stack marked this as a P0 gap for v1
(`TODO.md` T-22).

## Decision

- **One stream.** The stream `OSF` keeps every subject `osf.>` for 7 days, on file storage. Each module that publishes
  or consumes events creates the stream when it is missing. Creating it again with the same configuration changes
  nothing, so the order in which the modules start does not matter.
- **Publishers wait for the stream.** intake's outbox, gatekeeper and the foreman publish with JetStream's publish,
  which answers only after the stream stored the message. intake removes an event from its outbox only after that
  answer, so an event that NATS did not store goes out again.
- **Consumers are durable.** The foreman reads `osf.work.received.v1` and `osf.gate.decided.v1` through the durable
  consumer `foreman`, and intake reads `osf.run.started.v1` and `osf.run.completed.v1` through the durable consumer
  `intake`. A consumer acknowledges a message after it handled it. When the handling fails, the message comes again
  after 5 seconds, at most 5 times. Then the server writes a warning.
- **Replicas share a consumer.** Two foreman servers with the same consumer name get each message once between them.
- **Handling stays idempotent.** A message can come more than once: the foreman starts one run per work item
  (Temporal's workflow ID, ADR 0067), and intake's status changes ignore an event that does not move the work item
  forward (ADR 0071).
- **The contracts do not change.** The subjects and the CloudEvents stay as they are; a program that reads the subjects
  as plain NATS messages still gets them.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| JetStream stream and durable consumers (chosen) | Already in the profile and the chart; no new service; the subjects stay the same | Each module needs the JetStream client and creates the stream |
| The foreman polls intake's outbox over HTTP | No NATS feature needed | Couples the foreman to intake's API; gate decisions need a second poll; replaces the events of the contracts |
| A separate stream setup job in the profile | Modules only consume | A module that starts first loses events; the system tests need the same job |
| A shared library for the bus in `packages/` | One copy of the code | One more package to release; the code is a few lines per module |

## Prior art

- **NATS JetStream** (Apache-2.0, maintained by Synadia and the CNCF NATS project): streams, durable pull consumers
  with explicit acknowledgement, redelivery and a delivery limit. We adopt it through its official client
  `@nats-io/jetstream` 3.4.0, the same release as the `@nats-io/transport-node` the modules use.
- **Transactional outbox** (already in intake, ADR 0063): JetStream's publish acknowledgement completes it, because the
  outbox now knows that the stream stored the event.
- Checked and not adopted: a NATS stream setup through the `nats` CLI in the profile (see the options), and
  Temporal signals from intake straight to the foreman (couples intake to Temporal).

## Consequences

- A foreman or intake that restarts gets the events it missed. The vision scenario RUNTIME-001 (durable runs) now
  holds also for the events between the modules.
- The first start of a module on a new NATS creates the stream. A team that runs its own NATS must enable JetStream.
- A message that fails 5 times is not handled. Its warning names the subject and the reason.
- Revisit when more than one team shares one NATS: then the stream name and the subjects need a prefix per factory.
