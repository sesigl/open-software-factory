---
status: accepted; no sign-in of the console's own superseded by 0130
date: 2026-11-08
---

# 0089. Console actions with the person's identity

## Context

The console is read-only (ADR 0072): a person sees the runs and the work, but must use Slack, the forge or `curl` to
submit work, steer or cancel a run, or decide a gate. The review of the whole stack asks for a UI that shows the key
features and lets a person act on them (`TODO.md` T-28). Every action must stay attributed to a person (principle
P11), and the console has no sign-in of its own: it runs behind the team's sign-in proxy, such as oauth2-proxy.

## Decision

- **Actions are off by default.** Without `CONSOLE_USER_HEADER` the console stays read-only, as ADR 0072 says, and
  every method but `GET` and `HEAD` answers 405.
- **The person comes from the sign-in proxy.** `CONSOLE_USER_HEADER` names the header in which the proxy sends the
  signed-in person, like `X-Forwarded-Email`. A form sent without that header answers 401 and does nothing. Only run
  the console with actions behind a proxy that sets the header and removes it from the browser's requests.
- **Same origin only.** A form whose `Origin` header names another host answers 403, so another site cannot send it
  in the person's name.
- **Each action is one call of an existing API**, with the console's token for that API and the person as the actor.
  The first action is "submit work": the page `/work` has a form with a title, a type and a description, which the
  console posts to intake's `POST /v1/work-items` with the requester `{ kind: "person", id: <header value> }` and the
  origin `console`. Steering, cancelling, taking over and handing back a run, and deciding a gate, follow as later
  slices of T-28; each needs its API to record the actor first.
- **Forms, not scripts.** The pages stay server-rendered HTML without script; a form answers with a redirect to the
  page it came from (303), or with a page that names the problem.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Actions behind the sign-in proxy's identity header (chosen) | No sign-in code in the console; the proxy the team already runs decides who may act | Wrong when the proxy does not strip the header from outside requests |
| A sign-in of the console itself (OIDC) | No trust in a header | A second sign-in to build and run; ADR 0072 chose the proxy |
| Keep the console read-only, act in Slack and the forge | Nothing to build | The UI does not show the key features; a person needs three tools |

## Prior art

- **oauth2-proxy** (MIT, maintained): sets `X-Forwarded-Email` and `X-Forwarded-User` for the upstream; the same
  pattern as Grafana's auth proxy (`auth.proxy` with `header_name`).
- **Temporal UI, Argo Workflows UI**: actions on runs from the UI, attributed to the signed-in user.

## Consequences

- A team that sets `CONSOLE_USER_HEADER` can submit work from the console; the work item names the person.
- ADR 0072's read-only rule holds for a console without the variable.
- Revisit when a team needs roles inside the console: today every signed-in person may submit work, as in Slack.
