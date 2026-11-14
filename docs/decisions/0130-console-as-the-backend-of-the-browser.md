---
status: accepted
date: 2026-11-14
supersedes: 0072 (no build step, no script in the browser, read-only only), 0089 (no sign-in of the console's own)
---

# 0130. The console is the backend of the browser: no gateway, no database, pages on the server

## Context

Wave 6 of `TODO.md` makes the console the face of the factory: a person signs in, stores the secrets the agents need,
gives agents their skills and changes the factory, in one UI. The owner decided the open questions in November 2026
(`TODO.md`, "Decided by the owner"): Astro with pages on the server, islands only where the browser must react, the
console's own sign-in with OpenID Connect and GitHub, an access file in Git, secret values in OpenBao, a change from
the UI as a pull request that merges when its checks are green, and a laptop or a private network as the first
installation.

Three rules of the repository stand in the way, and each item of the wave would otherwise decide them again:

- Principle P3 and SCN-FACTORY-CODE-002 say that the UI only shows the factory.
- ADR 0072 says that the console needs no script in the browser and no build step, and that it is read-only.
- ADR 0089 says that the console has no sign-in of its own: the person comes from the sign-in proxy's header.

Today the modules intake, foreman and gatekeeper each have an HTTP API with a service token. The console calls them
with those tokens and keeps no state (ADR 0072). A team's own tool uses the same APIs (SCN-FACTORY-ACCESS-002).

## Decision

### The console is the only server a browser reaches

```text
browser ─────────────▶ console            the only server a browser reaches: pages, forms, the session cookie
                         ├─ HTTP with a service token and the person ─▶ foreman, intake, gatekeeper (as today)
                         ├─ secrets adapter, a program ─▶ OpenBao       writes values, lists names, cannot read a value
                         ├─ forge adapter, a program ───▶ the forge     commit, pull request, merge when green
                         └─ a folder, or git fetch ─────▶ the factory's files: factory.yaml, access.yaml, skills
identity provider ◀──── redirects of the sign-in ────▶ console
sandbox's egress proxy ─ reads ─▶ OpenBao  as today: it swaps the placeholder for the value on the way out
```

- **No API gateway, and no module API that a browser calls.** The console holds the session and every service token
  and calls the modules on the internal network. The modules keep their APIs and tokens as they are; a team's own UI
  or script still uses them with a token.
- **No database in the console.** The session is an encrypted cookie. Who may sign in is the access file in the
  factory's Git repository. A secret's value is in OpenBao. The state of a change is its pull request on the forge.
  Each has one owner outside the console, so the console can run twice and loses nothing when it restarts. Its only
  folder is a cache of the factory's repository, which it may delete at any time.
- **Pages render on the server and work without script.** A form is an HTML form that answers with a redirect (303).
  An island (SolidJS) adds comfort, like a live state or copy to clipboard; no feature depends on one. The pages move
  to Astro with its Node adapter inside the console's Fastify server (T-53); that is the build step ADR 0072 avoided.
- **Each feature belongs to the part that owns its subject.** The secret store's operations belong to the secrets
  port and its adapter. Reading a factory's files and their rules (skills, the access file, an edit of
  `factory.yaml`) belongs to one library that factory-spec, the foreman and the console share. A commit and a merge
  belong to the forge port. The console only shows and asks.
- **A change is a pull request.** The UI never writes the factory's files in place. It opens a pull request on the
  factory's repository that names the signed-in person, which merges when its checks are green, and shows its state.
  Git stays the source of truth (P3). An agent's configuration page stays read-only and links to Git
  (SCN-FACTORY-CODE-002).
- **One factory.** `CONSOLE_FOREMAN_URL` may still name several foremen, and the runs of all of them stay listed.
  Sign-in, roles, secrets, skills and changes belong to the one factory of `CONSOLE_FACTORY`: its access file, its
  repository and its mount in OpenBao (`OSF_OPENBAO_MOUNT`).

### Three modes

| Mode | Set by | What a person gets |
| --- | --- | --- |
| Open, read-only | Nothing (today's default) | Today's pages, read-only, as ADR 0072 says. A page or form that needs a role answers 404. |
| Behind a proxy | `CONSOLE_USER_HEADER` (ADR 0089) | The person comes from the proxy's header. Without an access file every person acts as a `member`; with one its roles apply, and a person who is not in it gets 403. |
| Own sign-in | One explicit setting that names this mode (T-56) | The sign-in page, the session and the roles. Every page needs a session. |

The own sign-in is switched on by name, never inferred from the settings present. With it on, a missing provider
setting stops the console at its start, so a lost setting can never open a console that was closed. A fresh profile
stays in the first mode and passes `console doctor`.

### What this supersedes

- From ADR 0072: "no client script", "no build step" and "read-only, no page has a form". Its pages, URLs, links into
  other UIs and the list of several foremen stay.
- From ADR 0089: "the console has no sign-in of its own". The proxy mode stays as the second mode; the actions keep the
  same-origin rule and the person as the actor.

### UI tests

Three kinds, all system tests from outside (T-52, its own ADR): a page scenario reads the HTML over HTTP by role and
name and is the default; a journey scenario runs one main flow in Chromium; an island scenario runs one island on its
page of the workbench. No pixel comparison.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| The console as the backend of the browser (chosen) | One server for one browser client; tokens never reach the browser; the modules stay as they are; no extra service to run | The console grows: sign-in, session and the calls of several modules live in it |
| An API gateway in front of the modules (Envoy, Traefik, agentgateway) | Sign-in, rate limits and routing in one place, for many clients | One more service to run and configure for a single browser client; the pages still need a server; the gateway would hold the session the console needs anyway |
| Module APIs open to the browser, with CORS and the person's token | No server between browser and modules | Every module must check a person's token, roles and CSRF; a single-page app with a build and a browser in every test; tokens in the browser |
| Keep the console read-only and act only in Git, Slack and the forge | Nothing to build | The owner asks for a UI in which a person signs in, stores secrets and gives skills |

## Prior art

- **Backend for frontend** (the pattern described by Sam Newman and the IETF draft "OAuth 2.0 for Browser-Based
  Applications"): the server that holds the tokens and the session is the only one the browser talks to; adopted.
- **Envoy** (Apache-2.0, very active), **Traefik** (MIT, very active) and **agentgateway** (Apache-2.0, Linux
  Foundation, active): checked as gateways; not adopted for one browser client. Revisit when a second browser client
  or a public API for many callers exists.
- **Grafana** (AGPL-3.0) and **Argo CD** (Apache-2.0): a server-side UI with its own OIDC sign-in and roles from a
  file or config map; the shape of the sign-in and roles here.
- **Backstage** (Apache-2.0): a single-page app with a backend and a database; checked and not adopted for a UI that
  keeps no state.
- **oauth2-proxy** (MIT): stays the proxy of the second mode (ADR 0089).

## Consequences

- Each item of wave 6 builds on one written concept: the console holds the session, the modules are unchanged, a
  change is a pull request.
- The console needs a build step (Astro) and the repository's checks must read `.astro` and `.tsx` files (T-53).
- The console holds every service token and the session key. It must run on a laptop or a private network in this
  wave; a public URL needs its own review.
- Revisit when a second browser client or a public API for many callers exists (a gateway), or when one console must
  serve several factories (a mount and an access file per factory).
