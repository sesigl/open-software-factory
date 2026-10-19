---
status: accepted
date: 2026-10-19
---

# 0021. The testkit has a scripted HTTP fake

## Context

factory-spec reads the MCP Registry at plan time (ADR 0020). Later modules read other HTTP APIs: Sentry, Linear,
Jira, package registries. A system test may not start its own server, because BOUNDARY-STATIC forbids Node
built-in imports in system tests, and NOREAL refuses every real host. The testkit has fakes for a model gateway,
Slack and a forge, but nothing for a plain JSON API.

## Decision

- `fakes.http(routes)` starts an HTTP server on `127.0.0.1`. A route names a `method` (default `GET`), an exact
  `path` with its query, and the `status` (default 200) and JSON `body` of the answer.
- A request no route names gets HTTP 404 and fails the scenario with the method and path shown, like an
  unscripted model call (`SCN-TK-007`). `requests()` lists what the fake received.
- The fake stops when the scenario ends.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A scripted HTTP fake in the testkit | One small fake for every JSON API; same failure rule as the model gateway | Routes are exact; no templating |
| A fake per outside API | Realistic answers | One fake per API before any module needs it |
| WireMock or Mockoon in a container | Mature, rich matching | Docker for every scenario that reads one URL; Java or Electron tooling |

## Prior art

- WireMock (Apache-2.0, active) and Mockoon (MIT, active): full mock servers. Not adopted: a container per
  scenario for a few fixed answers, and their matching rules are more than a scenario needs.
- msw (MIT, active) and nock (MIT, active): intercept requests inside the test process. Not usable: the module
  runs in its own process (BOUNDARY-RUNTIME).
- The testkit's model gateway (`SCN-TK-006`): the same shape, extended to any JSON route.

## Consequences

- A module test can fake any JSON API it calls through a documented base URL.
- A scenario that needs dynamic answers or request matching on a body needs a dedicated fake.
