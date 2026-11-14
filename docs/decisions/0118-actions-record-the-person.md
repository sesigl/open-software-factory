---
status: accepted
date: 2026-11-14
---

# 0118. Signals and gate decisions record the person who acted

## Context

ADR 0089 lets the console act in the name of the person that the sign-in proxy names, and leaves steering,
cancelling, taking over and handing back a run, and deciding a gate, to later slices: each needs its API to record the
actor first (`TODO.md` T-28). The foreman's `POST /v1/runs/{runId}/signals` took only the signal, so nobody could tell
who cancelled a run. gatekeeper had no API to decide a gate at all: people decided in Slack or on the pull request.
Every action must stay attributed to a person (principle P11).

## Decision

- **A signal names its person.** `RunSignal` gets the optional field `by` (an `Actor`). The foreman sends the run a
  signal "acted" with `{ type, by, at, message? }` before the signal itself, and the run shows these in its view's new
  field `actions`, oldest first. A signal without `by` works as before and is not listed. The run keeps the list beside
  its view, so the facts of its stages never overwrite it; the memo of the run list holds it from the next fact on.
- **gatekeeper takes a decision over HTTP.** `POST /v1/gates/{gateId}/decisions` with a `GateDecisionRequest`
  (`decision` `approved` or `rejected`, `by`, `reason`) decides like a reply `approve` or `reject <reason>` in the
  gate's channel: it is kept like a button press and decided with the same rules, so the record, the event
  `gate.decided@v1`, the reply in the thread and the commit status are the same. A person who is in no group the gate
  waits for gets 403 and the gate stays pending; a gate that is no longer pending gets 409.
- **`by.id` is matched as it is** against the members of the groups file. The console sends the value of the sign-in
  proxy's header, like `ada@acme.dev`, so a team that decides gates from the console lists that identity in its
  groups.
- **The console posts the forms** of the run page to these APIs: "Steer" (with a message), "Take over" (while a stage
  runs), "Hand back" (while a person holds a stage), "Cancel", and "Approve" and "Reject" (with a reason) for a pending
  gate of a stage when the console knows gatekeeper. Each answers 303 to the run page, or the API's status and detail.
- **The caller is trusted to name the person**, as for `POST /v1/runs/{runId}/retry` (ADR 0105): only callers with the
  API's token reach these routes, and the console takes the person from the sign-in proxy (ADR 0089).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `by` in the body, the run's `actions` list, a decisions route in gatekeeper (chosen) | Additive; one call per action; gatekeeper's rules decide as in Slack | Anyone with the API token can name any person |
| A signed token of the person, checked by each API | No trust in the caller | Every API needs the sign-in proxy's keys; the console has no sign-in of its own (ADR 0072) |
| Record the actor only in the console's log | Nothing changes in the APIs | The console keeps nothing (ADR 0072); a cancel from `curl` stays anonymous |

## Prior art

- **Temporal**: a signal and a cancel request carry an `identity` of the client, which the history shows; the foreman
  sends one client identity for all people, so it keeps the person in the run instead.
- **Argo Workflows, GitHub Actions environments**: an approval from the UI names the signed-in user and is refused for
  someone outside the required reviewers.

## Consequences

- The console steers, cancels, takes over, hands back and decides gates in the person's name; `GET /v1/runs/{id}`
  shows who sent which signal, and the gate's record who decided it.
- A run that started before this change takes the signal "acted" as well: the signal is new in its history, so its
  replay stays the same.
- Revisit when gatekeeper should check the person itself, for example with a token of the sign-in proxy.
