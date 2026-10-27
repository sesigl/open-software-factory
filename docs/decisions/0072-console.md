---
status: accepted
date: 2026-10-26
---

# 0072. console: a read-only web view of the factory, rendered on the server

## Context

TODO item T-18 asks for the console: a read-only web view of a factory with live runs, their origin and evidence,
the self-improvement inbox and links to dashboards. It reads only the public APIs of intake, foreman, runlog's trace
store, gatekeeper and observer. It realizes the vision scenarios VIS-001 (a person sees all runs across factories),
VIS-002 (a person opens a teammate's run: transcript, artifacts, origin), CODE-002 (configuration is read-only and
links to the file in Git), IMPROVE-004 (the self-improvement inbox) and the view side of ORCH-008 (filter runs by
state).

What exists:

- The foreman's `GET /v1/runs` (ADR 0071) lists every run, running runs first, with `?state=` as filter, and
  `GET /v1/runs/{runId}` shows one run: its work item with requester and origin, factory, factory version, state, pull
  request and stages with agent, harness session, gate and checks. Both need `Authorization: Bearer
  <FOREMAN_API_TOKEN>`.
- intake's `GET /v1/work-items/{id}` shows every request of a work item: each requester and origin (ADR 0063).
- gatekeeper's `GET /v1/gates/{gateId}` shows a gate's state, approvers and who it waits for (ADR 0048).
- Traces live in a trace store such as Langfuse or Phoenix; each has its own UI and URL scheme. Temporal has its own
  UI for a workflow's history. The foreman's workflow ID is the run ID (ADR 0067).
- observer opens its proposals as pull requests on the branch `observer/<problem>-<hash>` (ADR 0046). The forge port
  has no operation that lists pull requests (ADR 0057).
- Every system test talks to a module through its public surface; a web UI's surface is HTTP.

## Decision

### The module

- **`modules/console`, tier optional, prefix `SCN-CONSOLE`.** The command `console serve` serves HTML pages on
  `PORT`. It keeps no state of its own: every page asks the other modules' APIs when it is opened.
- **Rendered on the server, no client script.** Each page is HTML that Preact renders on the server from components
  written with htm, Preact's tagged-template syntax, so the source stays plain TypeScript (`.ts`, no JSX build step).
  The pages need no JavaScript in the browser. The runs pages reload themselves every `CONSOLE_REFRESH` seconds
  (default 10) with a `<meta http-equiv="refresh">`. Pico CSS styles the plain HTML; the server serves its file at
  `/pico.css`.
- **Read-only.** The server answers only `GET` and `HEAD`. Any other method answers 405. No page has a form.
- **Linked, not rebuilt.** The trace, a stage's transcript, the Temporal history and the dashboards are links into
  their own UIs, built from URL templates in the configuration: `CONSOLE_TRACE_URL` with `{runId}`,
  `CONSOLE_SESSION_URL` with `{sessionId}`, `CONSOLE_TEMPORAL_URL` and `CONSOLE_LINKS`.
- **Several factories.** `CONSOLE_FOREMAN_URL` lists one foreman or several, comma-separated, with one token in
  `CONSOLE_FOREMAN_TOKEN` or one per foreman in the same order. The runs page merges their lists: runs that have not
  ended first, the one that started last first, then the runs that ended, the one that ended last first. A foreman
  that does not answer is named on the page; the runs of the others are still listed.

### The pages

| Page | What it shows | From |
| --- | --- | --- |
| `/` | The runs: title, factory, state, source, requester, pull request and age; links to filter by each of the five states (`?state=`) | foreman `GET /v1/runs` |
| `/runs/{runId}` | One run: its origin and every request of its work item, its stages with agent, state, transcript, gate and checks as its evidence, its pull request, trace and history | foreman `GET /v1/runs/{runId}`, intake, gatekeeper |
| `/factory` | The factory definition from `CONSOLE_FACTORY`: name, version, providers and agents | the file, read-only |
| `/factory/agents/{name}` | One agent's configuration, with the link to the file and the branch in Git where it changes | the file, read-only |

The age of a run counts from its start to `OSF_NOW` or the clock: seconds, minutes, hours or days.

### Layers

`entry` (`src/cli.ts`) → `commands` (`serve` joins the routes) → `pages` (the Preact components) → `adapters` (the
HTTP clients of foreman, intake and gatekeeper, and the factory file) → `domain` (the run order, ages, states and
URL templates, without I/O). The ARCH check enforces them.

### Not in this slice

The self-improvement inbox (IMPROVE-004) needs the observer's pull requests with their state and review, which no
public API answers yet. It comes in the next slice of T-18, with a forge port operation that lists pull requests by
branch prefix and an ADR for that port change.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Server-rendered HTML with Preact and htm | Plain `.ts` files that the checks, Stryker and the layers already handle; escaping built in; tests read the HTML over HTTP; the same components can hydrate later | No interactivity without a reload |
| Next.js or Remix | Full framework with routing and data loading | Large build, a second server runtime, JSX/TSX that the repository tooling does not handle yet; much more than a read-only view needs |
| A single-page app (React, Vue or Svelte) that calls the APIs from the browser | Live updates | The browser would need the foreman's and gatekeeper's tokens; tests need a browser; a build step |
| Grafana or Backstage as the UI | Exists, plugins | Grafana shows metrics, not runs with origin and evidence; Backstage is a large platform with its own database |
| Temporal's UI only | No new code | Shows workflows, not work items, origins, gates or pull requests; the T-18 "Done when" is to not open it |
| Template strings without a framework | No dependency | Escaping by hand is easy to get wrong; T-18 says to adopt a UI framework |
| Server-sent events for live runs | Live without reload | Needs client script and a push source; the foreman has no run stream yet. A reload every 10 seconds is enough for a view of runs that take minutes |

## Prior art

- `preact` 11 (MIT, very active; 11.0 released in September 2026) with `preact-render-to-string` 6.8 (MIT,
  active): adopted for rendering components to HTML on the server.
- `htm` 3.1 (Apache-2.0, stable, last release 2022, maintained by the Preact team): adopted for JSX-like templates in
  plain TypeScript.
- Pico CSS, `@picocss/pico` 2.1 (MIT, active): adopted to style semantic HTML without classes.
- Fastify 5 (MIT, very active): already the server of intake, foreman and gatekeeper; adopted at the same version.
- `yaml` 2.9 (ISC, active): already used by foreman and factory-spec; reads `factory.yaml`.
- Temporal UI (MIT), Langfuse (MIT core) and Arize Phoenix (Elastic License 2.0): their UIs stay the place for
  histories and traces; the console links to them.
- Backstage (Apache-2.0, very active), Grafana (AGPL-3.0, very active), Argo Workflows UI (Apache-2.0) and the GitHub
  Actions run list: checked for the shape of a run list and filter. Too large or a different subject to adopt.

## Consequences

- A person sees every run of every factory with its state, origin, requester, pull request and age in one page, and
  opens a run's stages, gates, transcript and trace without opening Temporal.
- The console has no store and no token of its own to protect: it is read-only, but it shows what the foreman and
  intake show. Run it behind the company's sign-in proxy, such as oauth2-proxy, like any internal UI.
- Each page asks the APIs again. With many runs, the run list is as slow as the foreman's (ADR 0071).
- The inbox waits for the forge port's list of pull requests (next slice).
