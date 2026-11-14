---
covers: [modules/console/**]
---

# The factory UI

The console is the factory's web UI and the backend of the browser (ADR 0130). A person reads the runs, signs in,
stores secrets, gives agents skills and changes the factory there. Git stays the source of truth: the UI shows the
factory and proposes a change as a pull request (P3). This page describes the target of wave 6 of `TODO.md`; each
item of the wave says which part it builds.

## How the parts connect

```text
browser ─────────────▶ console            the only server a browser reaches: pages, forms, the session cookie
                         ├─ HTTP with a service token and the person ─▶ foreman, intake, gatekeeper (as today)
                         ├─ secrets adapter, a program ─▶ OpenBao       writes values, lists names, cannot read a value
                         ├─ forge adapter, a program ───▶ the forge     commit, pull request, merge when green
                         └─ a folder, or git fetch ─────▶ the factory's files: factory.yaml, access.yaml, skills
identity provider ◀──── redirects of the sign-in ────▶ console
sandbox's egress proxy ─ reads ─▶ OpenBao  as today: it swaps the placeholder for the value on the way out
```

- No API gateway, and no module API that a browser calls. The modules keep their HTTP APIs and tokens; a team's own
  UI or script uses them with a token (SCN-FACTORY-ACCESS-002).
- The console keeps no database. The session is an encrypted cookie, who may sign in is the access file in Git, a
  secret's value is in OpenBao, and the state of a change is its pull request. Its only folder is a cache of the
  factory's repository.
- A page renders on the server and works without script. An island adds comfort; no feature depends on one.

## The path of a request

| Request | Path |
| --- | --- |
| A page | The browser asks the console for `GET /runs`. The console checks the session (or the proxy's header), asks the foremen with their service tokens, renders the HTML on the server and answers it. |
| A form | The browser posts the form to the console. The console checks the session, the role and that the `Origin` is its own, makes one call of a module API, a secrets adapter or a forge adapter with the person as the actor, and answers with a redirect (303) to a page that shows the result. |
| A change | A factory engineer edits a setting of the factory. The console reads the factory's files from its cache, writes the edit on a new branch through the forge adapter, opens a pull request that names the person and asks the forge to merge it when its checks are green. The page of the change shows the pull request's state and links it when it fails. The merged commit is the factory version of the next run. |

## The three modes

| Mode | Set by | What a person gets |
| --- | --- | --- |
| Open, read-only | Nothing (the default) | The pages, read-only (ADR 0072). A page or form that needs a role answers 404. |
| Behind a proxy | `CONSOLE_USER_HEADER` (ADR 0089) | The person comes from the proxy's header. Without an access file every person acts as a `member`; with one its roles apply, and a person who is not in it gets 403. |
| Own sign-in | One explicit setting that names this mode (T-56) | The sign-in page with OpenID Connect or GitHub, the session and the roles. Every page needs a session. |

The own sign-in is switched on by name, never inferred. With it on, a missing provider setting stops the console at
its start.

## Three kinds of UI test

Each is a system test: one scenario, one test, the built console from outside (T-52).

| Kind | Runs | Proves |
| --- | --- | --- |
| Page scenario | The built console over HTTP; the test reads the HTML by role and name; no browser | What a page shows and what a form does. The default. |
| Journey scenario | The built console with its fakes, in Chromium | One main flow of a person from start to end, across pages |
| Island scenario | One island on its page of the workbench, in Chromium | Everything the island does, as a whole |

A test finds elements by role, label or text, never by a CSS class, a tag or a test ID. No test compares pixels; a
journey's screenshots are evidence on the pull request.
