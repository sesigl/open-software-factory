---
status: accepted
date: 2026-11-14
---

# 0116. Events that are not lost without a trace

## Context

T-49. ADR 0085 made the stream `OSF` durable, with NATS's default limits: it keeps every event until the disk is full.
A consumer's message that failed 5 times was dropped with only a warning in the log, so nobody could find it or send it
again, and nothing told an operator that it happened. intake's outbox kept every published row forever.

## Decision

- **The stream has a max age.** `OSF_STREAM_MAX_AGE`, a duration like `7d`, `12h`, `30m` or `90s`, is the stream's
  `max_age` for intake and the foreman. The module that adds the stream adds it with that age; when the stream
  exists with another configuration, a module with the setting updates its `max_age`, one without it keeps the
  stream as it is (gatekeeper never sets it, it only publishes). Unset, a new stream has no limit of age, as before.
  The Compose profile sets `7d` (`${OSF_STREAM_MAX_AGE:-7d}`), the Helm chart `natsStreamMaxAge: 7d`. A larger
  value than the stream's disk allows still fills the disk; NATS's own `max_bytes` stays for the operator
  (`nats stream edit OSF`).
- **Dead letters are events on the stream.** When a consumer's handling fails on the 5th (`max_deliver`) delivery, the
  module publishes the message's body unchanged to `osf.dead.<consumer>.<subject without osf.>`, for example
  `osf.dead.foreman.work.received.v1`, and acknowledges the original. The warning of that delivery names the dead
  letter's subject. A dead letter lives as long as the stream's max age; `nats stream view OSF --subject
  'osf.dead.>'` shows them.
- **`resend` sends them again to the consumer only.** `intake resend` and `foreman resend` publish each dead letter of
  their consumer to `osf.resend.<consumer>.<subject without osf.>` and delete it from the stream. The durable consumer
  also reads `osf.resend.<consumer>.>` and handles such a message as one of its first subject. Other consumers of the
  subject do not get it a second time. A durable consumer of an earlier version gets the new filter on start.
- **Health fails while dead letters wait.** The check `nats` of `/v1/health` on intake and the foreman also counts the
  consumer's dead letters on the stream; while one waits it fails with their number and says to fix the cause the
  warnings name and run `resend`. The checks' names stay as they were (ADR 0086), so a probe or a dashboard that reads
  them needs no change.
- **intake's outbox forgets published events.** A row gets the time it was published; each relay (at start, after an
  event and every minute) removes the rows published longer than `INTAKE_OUTBOX_KEEP` (default `7d`) ago and prints
  how many. Rows published before this version count as old.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Dead letters as subjects on the same stream, `resend` per consumer (chosen) | No new stream or service; the max age covers them; one count per consumer for health | Each module has the code for its consumer |
| NATS advisories (`$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES`) and a second stream | NATS's own signal | The advisory holds only the sequence; the message must still be read before the max age removes it; a second stream to configure |
| `resend` republishes on the first subject | No extra filter | Every other consumer of the subject gets the event again |
| A dead-letter table in each module's database | Survives the stream's max age | The foreman has no database of its own; NATS already keeps the events |
| A health check of its own, `dead letters` | Clear name | Changes the checks a probe or the scenarios of ADR 0086 expect |

## Prior art

- **NATS JetStream** (Apache-2.0, ADR 0085): `max_age` and `max_deliver` are stream and consumer limits; the NATS docs
  describe dead letters as republishing on the last delivery, or reading the `MAX_DELIVERIES` advisory. We use the
  first, with the client `@nats-io/jetstream` the modules already use. No new dependency.
- **Transactional outbox** cleanup by age is the usual pattern (Debezium's outbox router, for example, leaves removal to
  the application); we delete in the relay.

## Consequences

- An operator sees a failing health check while a dead letter waits, finds it on `osf.dead.>` and sends it again with
  one command after fixing its cause.
- A dead letter that nobody sends again is gone after the max age, like every event; the health check passes again then.
- intake, the foreman and gatekeeper must be released together: an older gatekeeper fails to publish on a stream that
  another module added with a max age.
- Revisit when a dead letter needs to be inspected from the console, or when the stream needs a size limit too.
