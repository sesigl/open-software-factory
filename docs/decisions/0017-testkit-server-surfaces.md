---
status: accepted
date: 2026-10-19
---

# 0017. The testkit drives a module's HTTP API, MCP server and events with the official clients

## Context

T-02 asks the `sut` for `http` (a generated client), `mcp` and `events` besides `cli` and `files`. A module that
runs as a server must be started from its built artifact, reached from the outside and stopped when the scenario
ends. Events are CloudEvents on NATS JetStream (ADR 0003); HTTP APIs are described in OpenAPI 3.1 generated from
TypeSpec (ADR 0006, 0012); MCP servers speak JSON-RPC over stdio.

## Decision

- `sut.http.start()` starts the artifact with `PORT` set to a free port and waits until it listens on
  `127.0.0.1:PORT`. `sut.http.client<paths>()` is an `openapi-fetch` 0.17.0 client typed by the module's generated
  OpenAPI `paths`; `get`, `post` and `request` are plain `fetch` calls for tests that need no types.
- `sut.mcp.connect()` starts the artifact on stdio with `@modelcontextprotocol/sdk` 1.32.1 and returns its
  `Client`.
- `sut.events.watch(nats)` subscribes with `@nats-io/transport-node` 3.4.0 to the NATS server of `fakes.nats()`
  and records CloudEvents in structured JSON mode. A core subscription also sees messages that JetStream stores.
- Every surface gets the same environment as `sut.cli` and the same BOUNDARY-ENV check. The sut stops what it
  started before the fakes close.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Official clients (MCP SDK, nats.js, openapi-fetch) | The same protocol code users run; typed | Three dependencies |
| Hand-written JSON-RPC and NATS protocol code | No dependencies | Rebuilds maintained libraries; drifts from the protocols |
| A generated client per module (openapi-typescript-codegen, orval) | Full SDK per API | Generated code in every module; openapi-fetch needs only the types |
| Start servers with a fixed port per module | Simple | Parallel tests collide |

## Prior art

- `@modelcontextprotocol/sdk` (MIT, official, active, 1.x): adopted for the MCP client.
- `@nats-io/transport-node` (Apache-2.0, official nats.js v3, active): adopted. The older `nats` package is the
  v2 line.
- `openapi-fetch` (MIT, active, part of openapi-ts with `openapi-typescript`): adopted; it needs only the
  generated `paths` types.
- `orval` and `openapi-typescript-codegen` (MIT, active): not adopted, see above.
- `supertest` (MIT, active): needs an in-process server object, which a black-box test does not have.

## Consequences

- A module's server, MCP server and events are tested the same way as its CLI, from its built artifact.
- A server must read `PORT` and listen on `127.0.0.1`; module templates and READMEs say so when the first server
  module starts.
- Revisit when the MCP SDK reaches 2.x or when a module needs an MCP transport other than stdio.
