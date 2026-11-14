---
status: accepted
date: 2026-11-14
---

# 0129. fakes.postgres and fakes.temporal start one server per test process

## Context

System tests are the only tests, and MUTATION reruns them for each mutant, so a scenario's time is paid many times. A
profile of every suite on 14 November 2026 showed where two fakes lose time:

- `fakes.postgres()` was PGlite, PostgreSQL compiled to WebAssembly, in the test's process (ADR 0049, ADR 0093). Each
  scenario started a new one: 0.9 to 1.2 seconds, a quarter of gatekeeper's suite. PGlite also ran in the thread of
  the test, so each request of gatekeeper that reads the database took about 280 ms.
- intake keeps its work items in an embedded PGlite when `INTAKE_DATABASE_URL` is not set. All but three of its
  scenarios started the server that way, and the start of the embedded database was most of the 1.7 seconds until
  the server listened. The profile sets `INTAKE_DATABASE_URL`, so these scenarios did not run the database of a
  deployment.
- `fakes.temporal()` started a dev server for each scenario: 0.1 seconds to start, and 19% of the CPU time of
  foreman's suite, because each server runs for the whole scenario.

`fakes.forge()` already starts one Forgejo per test process and cleans it for each scenario (ADR 0064).

## Decision

The three fakes that start a server follow one rule: the first scenario of a test process that asks for the server
starts it, and every scenario gets a part of it that no other scenario sees.

- **`fakes.postgres()`** starts the image `postgres:17-alpine`, the major version of the profile, with its data in
  memory. Each scenario gets a new database, made with `createdb` in the container, and reaches it through a relay
  on a port of its own in the test process. `stop()` closes the relay: open connections end and new ones are refused,
  as before, while the server keeps running for the next scenario. Ryuk removes the container when the process ends,
  as for the forge. The server asks for the password as text (`POSTGRES_HOST_AUTH_METHOD=password`), so that a test
  of the testkit can speak the protocol without a client.
- **`fakes.temporal()`** starts the dev server once and makes a new namespace for each scenario through the server's
  HTTP API. The test passes `namespace` on to the module, as foreman's tests do with `FOREMAN_TEMPORAL_NAMESPACE`.
  The server stops when the test process ends.
- **intake**: the helpers of its tests that also start NATS, Slack or a forge give the server a database of
  `fakes.postgres()`, as the profile does. The scenarios that start the server alone keep the embedded database,
  the default of the README's quick start.
- PGlite leaves the testkit. intake still ships it as its embedded database (ADR 0063, ADR 0093).
- Scenarios SCN-TK-152 and SCN-TK-153 check the behavior: two scenarios in one test file get the same server, and
  each its own database or namespace.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| One PostgreSQL container per test process, a database per scenario (chosen) | The real server; 0.1 s per scenario after 1.5 s once; 127 lines less in the testkit | The suites of gatekeeper, intake and `packages/postgres` now need Docker; a run with one PostgreSQL scenario is 0.5 s slower |
| PGlite per scenario (before) | No Docker | About 1 s per scenario; a WebAssembly build of PostgreSQL in the test's thread; our own wire-protocol server |
| PostgreSQL as a pinned binary on the host, like NATS | No Docker | No official binary for every platform; PostgreSQL refuses to run as root, which agent sandboxes are |
| One PostgreSQL for the whole run (Vitest `globalSetup`) | One start | A setting in each unit's Vitest config, and a second way to start for a unit without it |
| A PostgreSQL client in the testkit instead of `createdb` in the container | About 50 ms less per scenario | A new dependency of the testkit |
| `stop()` forbids connections to the database | No relay | New connections fail with a server error, not with a refused connection; SCN-TK-125 expects the refusal |
| One Temporal server per test process, a namespace per scenario (chosen) | 17% less CPU time for foreman's suite; the same rule as the forge and PostgreSQL | A test must pass the namespace on |
| More Vitest workers for foreman | 201 s with two workers, 152 s with three, 134 s with four | BUDGET adds up the scenarios' times, and they grow with the workers: 398, 450 and 529 s |

## Prior art

- The official PostgreSQL image (`postgres:17-alpine`, PostgreSQL License, maintained by the Docker community and the
  PostgreSQL project): adopted. It creates the user from `POSTGRES_USER` and ships `createdb`.
- Testcontainers for Node (`testcontainers` 12.2.0, MIT, very active, ADR 0064): already in use. It documents a
  container shared by a suite, and Ryuk removes it.
- `@testcontainers/postgresql` (MIT, same project): checked, not adopted. It adds a class around the same image and
  a snapshot feature; three lines of `GenericContainer` do what the fake needs.
- Temporal's dev server (`temporal` 1.4.1, MIT, ADR 0067): already in use. Its HTTP API registers a namespace that a
  worker can use at once.
- PGlite (`@electric-sql/pglite`, Apache-2.0, active): no longer used by the testkit.

## Consequences

- Measured on a 4-core machine, two runs each on the same commit, wall-clock time and the sum of the scenarios' times:

  | Suite | Before | After |
  | --- | --- | --- |
  | gatekeeper (96 scenarios) | 33 s, 95 s summed | 26 s, 75 s summed |
  | intake (66 scenarios) | 68 s, 199 s summed | 46 s, 133 s summed |
  | ledger (66 scenarios) | 19 s, 52 s summed | 17 s, 46 s summed |
  | `packages/postgres` (5 scenarios) | 3.1 s | 3.6 s |
  | foreman (157 scenarios, two workers) | 202 s, 399 s summed | 201 s, 398 s summed |

  foreman's suite gets no shorter with two workers. It uses less CPU time, which counts where the CPUs are busy: in
  a mutation run.
- A database is not removed at the end of its scenario; it goes with the container. A scenario sees only its own
  database. What a scenario creates outside a database, such as a role, stays for the next scenario of its process.
  No scenario does that today.
- The suites that use `fakes.postgres()` need Docker: gatekeeper, intake, ledger, `packages/postgres` and the testkit.
  ledger and the testkit needed it before, for the forge.
- In a mutation run, each run of a mutant is a test process of its own and starts its own servers. A mutant that only
  one PostgreSQL scenario reaches costs about 0.5 s more than before; one that several reach costs less.
- 40 of intake's 66 scenarios now start the server on PostgreSQL and 24 on the embedded database; two start no server.
- Revisit the number of Vitest workers of foreman when BUDGET measures something else than the sum of the scenarios'
  times.
