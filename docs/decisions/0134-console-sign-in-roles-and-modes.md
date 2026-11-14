---
status: accepted
date: 2026-11-14
---

# 0134. The console's own sign-in: OpenID Connect and GitHub, a session cookie, roles from an access file

## Context

ADR 0130 makes the console the backend of the browser with three modes: open and read-only (ADR 0072), behind a
sign-in proxy (ADR 0089), and its own sign-in. The owner decided that the own sign-in uses OpenID Connect (Google, a
company's provider) and GitHub, without passwords or a mail server, that who may sign in is a file in the factory's
Git repository, and that the first installation is a laptop or a private network (`TODO.md`, wave 6). T-56 builds it.

## Decision

### The modes

| Mode | Set by | Who is the person |
| --- | --- | --- |
| Open, read-only | Nothing | Nobody: a page or form that needs a role answers 404 |
| Behind a proxy | `CONSOLE_USER_HEADER` | The proxy's header. Without an access file every person is a `member`; with one its role applies, and a person not in it gets 403 |
| Own sign-in | `CONSOLE_SIGN_IN` names the provider type, `oidc` or `github` | The session's email, with its role from the access file |

The own sign-in is switched on by name, never inferred. With it on, the console does not start without the provider's
settings, `CONSOLE_SESSION_SECRET` and `CONSOLE_URL`; it does not start when `CONSOLE_USER_HEADER` is set too, or when
`CONSOLE_URL` is neither loopback nor `https://`, and it names the setting.

### One hook for the person

A Fastify `onRequest` hook in front of every page, old and new, finds the person (the session or the proxy's header),
reads the role from the access file and answers: a page without a session redirects to `/signin?next=<path>`, a form
without a session answers 401, a page or form without the role 403. It lets through `/signin`, the provider's
callback, the static files and the probe route `/v1/ready`, which says without a session that the console runs and
reads its factory; the profile's and the chart's health checks use it. Not Astro's middleware: the old pages do not
pass through Astro.

### Sign-in

- **OpenID Connect** with the authorization code flow, PKCE (S256), `state` and `nonce`, through `openid-client`: the
  provider's settings from its discovery document, the ID token checked for its signature, issuer, audience, nonce and
  time against the console's clock (`OSF_NOW` in tests). Only an email the provider marks as verified counts.
- **GitHub** has no OpenID Connect for people: a second provider type uses its OAuth app flow and reads the person's
  verified primary email from `GET /user/emails`.
- The state, the nonce and the verifier of one sign-in live in a short-lived encrypted cookie that the callback
  deletes. `next` takes only a path of the console.
- The email, in lower case, must be in the access file. A refused person reads why ("ada@acme.dev is not on this
  factory's access list") and where the list lives. Without an access file, or without an `admin` in it, nobody signs
  in, and the page names the file. There is no "first person becomes admin" rule.

### The session

An encrypted and signed cookie (`jose`, JWE with a key derived from `CONSOLE_SESSION_SECRET`): the email, the name and
the end of the session, 12 hours by default (`CONSOLE_SESSION_HOURS`). `HttpOnly`, `SameSite=Lax`, `Secure` over
HTTPS. `CONSOLE_SESSION_SECRET` may name two keys, separated by a comma: the first signs, both are accepted, so a key
changes without signing everyone out. No role in the cookie: the role comes from the access file on each request, so a
person removed by a merge loses access at the next request.

### The access file and its roles

`access.yaml` beside `factory.yaml`, a new format in `contracts/`: people by email, each with one role.

| Role | May |
| --- | --- |
| `member` | Every page but Secrets; submit work; act on runs and gates |
| `factory-engineer` | The same, and change the factory from the UI (T-58, T-59) |
| `admin` | The same, and store and delete secrets (T-57) |

The library `@opensoftware/factory-files` reads a factory's files from a folder or from `git+<url>#<ref>` (the
foreman's fetch of ADR 0124 moves there) and reads and checks the access file; `factory lint` reports its findings.
The console reads it at each request through a cache of 30 seconds; when it cannot read it, it keeps the last one it
read for 10 minutes and then refuses everyone, and the sign-in page says why. Whoever may write to the factory's
repository can make themselves `admin`: the docs say so, and that the repository should be private, since it holds
emails.

### The address

`CONSOLE_URL` (default `http://localhost:8080`) is the source of the callback address and of the same-origin rule:
with the own sign-in, a form's `Origin` must be this address and a form without `Origin` is refused. A request for
another host is redirected to this address before the sign-in starts. The console runs on `localhost` and the tools of
the profile (Jaeger, LiteLLM, the Temporal UI) on `127.0.0.1`, so a browser never sends them the session cookie.

### Tests

`fakes.oidc()` in the testkit is an identity provider in the test process: discovery, authorize, token and keys, with
the testkit's clock, signing in the person a test names; and `fakes.github` gets GitHub's sign-in endpoints. Page
scenarios prove the sign-in over HTTP with `sut.pages`; two journeys prove it in Chromium (ADR 0131).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| `openid-client` and `jose` in the console (chosen) | A certified client, no database, its clock can be set; the console keeps no state (ADR 0130) | The console holds the sign-in code |
| Arctic | Small, many providers | No ID token validation of its own; less of OpenID Connect |
| Better Auth, Auth.js | Complete | Want a database or an adapter; the console has no database |
| A service in front (oauth2-proxy, Pomerium, Authelia, Dex, Keycloak) | Proven | One more service to run; stays possible through `CONSOLE_USER_HEADER` |
| `oauth2-mock-server` as the fake | Exists | Signs with the real clock and has no person to name per test; a fake of the testkit's own follows its clock and its rules for fakes |

## Prior art

- **openid-client** 6 (MIT, certified by the OpenID Foundation, very active) and **jose** 6 (MIT, very active):
  adopted.
- **Arctic** (MIT), **Better Auth** (MIT), **Auth.js** (ISC): checked, not adopted.
- **oauth2-proxy** (MIT), **Pomerium** (Apache-2.0), **Authelia** (Apache-2.0), **Dex** (Apache-2.0), **Keycloak**
  (Apache-2.0): checked; they stay usable as the proxy of the second mode.
- **oauth2-mock-server** 9 (MIT): checked for the fake, not adopted.
- **Grafana** and **Argo CD**: an own OIDC sign-in with roles from a file or a config map, the pattern here.

## Consequences

- A person signs in to the console itself; nobody gets past the sign-in without being on the access list.
- The console needs `CONSOLE_SESSION_SECRET` and `CONSOLE_URL` with the sign-in; `osf init` generates the secret.
- Two more npm packages for the console and the foreman: `@opensoftware/factory-files` must be published once before a
  published package depends on it.
- Revisit when a team needs groups from the provider (an `admin` group in Google Workspace, a GitHub team) in place of
  emails in the access file.
