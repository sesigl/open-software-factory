---
status: accepted
date: 2026-11-10
---

# 0101. foreman stops at once on SIGTERM, and a running stage runs again

## Context

A stage of a run is a Temporal activity that runs one harness turn (ADR 0067). When foreman got SIGTERM while a stage
ran, the process did not exit:

- Temporal's worker does not cancel running activities with the default `shutdownGraceTime` of 0. So it waited for
  the turn, which can run for hours.
- Each running stage asks its workflow for steering and take-over with a query (ADR 0070). After SIGTERM no worker
  answers a query, so the open queries kept the process alive, also after the worker stopped.

So foreman stopped only on SIGKILL: after 10 s in Compose, after 30 s in Kubernetes, and after 5 s in the testkit.
Temporal then ran the stage again only after its heartbeat timeout of 1 minute. A cancelled turn ends its stage as
`cancelled`, so a cancel at a shutdown must not look like a person's cancel.

## Decision

- foreman's worker has `shutdownGraceTime` of 1 second: a short activity, like publishing an event, can end; then
  the worker cancels the running activities with the reason `WORKER_SHUTDOWN`.
- A stage that gets that cancel cancels its turn and throws the cancel. Temporal marks the attempt as failed, not the
  stage, and runs the stage again soon on the next worker, up to the stage's 3 attempts.
- The run API's queries to a workflow get an abort signal, which foreman aborts once its worker stopped. Then foreman
  closes its connections and exits.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Grace time, a failed attempt, aborted queries | foreman exits about 1 s after SIGTERM; the stage runs again at once | A turn that ran for a long time starts again from the start |
| `shutdownForceTime` only | One option | The process still waits for the turn and the queries until that time; Temporal waits for the heartbeat timeout |
| Keep it | Nothing to change | foreman stops only on SIGKILL, and each stage waits 1 minute to run again |

## Prior art

No new dependency. The Temporal TypeScript SDK (MIT) documents this way: an activity that throws the
`WORKER_SHUTDOWN` cancel fails its attempt, so that the server runs it again sooner than after a timeout.

## Consequences

foreman stops in about 1 s with a running stage, and in about 0.2 s without one. A stage that ran when foreman
stopped starts its turn again when a foreman runs, without the wait for the heartbeat timeout (`SCN-FORE-087`). Each
such restart uses one of the stage's 3 attempts, as before. Queries of the run API that arrive while foreman stops
fail.
