---
status: accepted
date: 2026-10-19
---

# 0016. The testkit starts real services with Testcontainers, and fakes Slack in process

## Context

System tests must not reach real networks or services (AGENTS.md), but modules store state in PostgreSQL, publish
events to NATS JetStream, run workflows on Temporal, keep objects behind the S3 API (ADR 0003, 0004) and talk to a
forge and to Slack. T-02 asks the testkit for Testcontainers helpers for these services, a Forgejo helper and a
fake Slack. The tests stay deterministic and black-box: a test gets only a URL to hand to the module through its
documented configuration, never a database client.

## Decision

- The testkit depends on `testcontainers` 12.2.0. `fakes.postgres()`, `fakes.nats()`, `fakes.temporal()`,
  `fakes.s3()` and `fakes.forge()` each start one container for the scenario and stop it when the scenario ends.
  Since ADR 0064, `fakes.forge()` starts one container per test process instead.
- Pinned images:

  | Helper | Image | Started as |
  | --- | --- | --- |
  | `postgres` | `postgres:17.6-alpine` | user, password and database `test` |
  | `nats` | `nats:2.11.9-alpine` | `-js` (JetStream) |
  | `temporal` | `temporalio/temporal:1.4.1` | `server start-dev --headless`, namespace `default` |
  | `s3` | `chrislusf/seaweedfs:3.97` | `server -s3` with hashicorp Raft bootstrap, so it is ready in about 2 s |
  | `forge` | `code.forgejo.org/forgejo/forgejo:11` | SQLite, an admin user `tester` and an API token |

- `fakes.forge()` gives the module a URL and a token, and gives the test a small API: create a repository, open
  a pull request, read its comments and its commit statuses.
- `fakes.slack()` is an in-process HTTP server with the Slack Web API calls modules use (`chat.postMessage`,
  `conversations.replies`, `conversations.history`, `reactions.add`). The test reads what the module posted and
  can post a message as a person. Slack has no container, and the official Slack SDK needs no real server.
- The testkit's own system tests start every container. The testkit's budget rises to 240 seconds.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| Testcontainers with generic containers | One library for every service; pinned images; cleanup by Ryuk even when a test crashes | Docker is required for these tests |
| Testcontainers service modules (`@testcontainers/postgresql` and others) | Ready-made wait strategies | One more dependency per service; no module for SeaweedFS, Temporal or Forgejo |
| Docker Compose profile started once per run | Fast reuse | Shared state between scenarios; harder to run one test |
| In-memory fakes (pg-mem, an S3 mock) | No Docker | Not the real service; behavior differs |
| MinIO for S3 | Common in tests | Community edition archived in April 2026 (ADR 0003) |

## Prior art

- Testcontainers for Node.js (`testcontainers`, MIT, active, 12.x): adopted.
- `@testcontainers/postgresql` and the other service modules (MIT, active): not adopted, see above.
- pg-mem (MIT, active) and s3rver (MIT, rarely maintained): not adopted; they are not the real services.
- Slack: the Slack Web API and Events API docs define the calls; no maintained open-source Slack server emulator was
  found, so the testkit builds the small subset modules use.
- Forgejo (GPL-3.0 server, run as a container only, not linked): adopted as the real forge (TODO.md T-02).

## Consequences

- A system test that needs a service is a real integration test and still runs in seconds.
- CI needs Docker, which GitHub-hosted runners have. Pulls from Docker Hub can hit its rate limit.
- New services need a new helper and an image pin here.
- Revisit when Docker Hub limits slow CI; the images can move to a mirror such as `public.ecr.aws/docker/library`.
