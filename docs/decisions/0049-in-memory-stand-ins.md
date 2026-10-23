---
status: accepted
date: 2026-10-23
---

# 0049. Fast in-memory stand-ins for slow outside systems, starting with PGlite for PostgreSQL

## Context

The goal of the testkit is system tests that are feasible from the outside: the test starts the built module,
drives it through its public surface and checks only what it produces. They must also be fast. The MUTATION check
reruns a module's whole suite once per mutant, BUDGET caps each suite, and agents run the suites many times a day.

ADR 0016 starts every outside service as a real container. That is faithful, but each scenario pays for a container
start and CI needs Docker. The gatekeeper server (ADR 0048) made this visible: its first mutation run had 489
mutants and did not finish in 150 minutes, and every server scenario starts its own PostgreSQL container. ADR 0016
rejected in-memory fakes because pg-mem and S3 mocks are not the real service and behave differently.

PGlite is the real PostgreSQL server compiled to WebAssembly. It runs inside the test's process, starts without
Docker, and gives the same SQL, the same planner and the same errors as PostgreSQL 18.

## Decision

- **The principle, for every outside system a module depends on:**
  1. The test stays outside. The module reaches the stand-in through the same configuration and the same client
     as in production: a URL, a port, a token. The test never gets a client for the module's data, and the module
     cannot tell a stand-in from the real system.
  2. Prefer the real system run in memory or in process, such as PGlite, over a mock that imitates it. It must
     behave like the real system in everything a scenario can observe: the protocol, the SQL, errors such as a
     refused password, transactions.
  3. If no such alternative exists and the real system is slow to start, build a small test-only stand-in in the
     testkit for the part modules use, as the fake Slack (ADR 0016) and the scripted model gateway do. Fill the
     gaps the stand-in cannot cover with a scenario against the real system.
  4. Switching is one change in the testkit: a fake keeps its name, its result type and what it gives the test,
     so no module's test changes. A difference in behavior that the stand-in cannot avoid is written in its
     source comment, in the testkit README and here.
  5. Measure before and after. A stand-in is worth it when it removes Docker or a container start from many
     scenarios. Keep the container when only the real service is faithful.
- **`fakes.postgres()` runs PGlite 0.5.11** (`@electric-sql/pglite`) in the test's process, behind a small
  wire-protocol server in the testkit (`fakes/postgres.ts`). The module connects to
  `postgres://test:test@127.0.0.1:<port>/test` with its own driver, as before.
  - PGlite has one session. The server lends it to one connection at a time, from the connection's first message
    until PostgreSQL reports idle (ReadyForQuery `I`). A transaction or an extended-protocol exchange (Parse, Bind,
    Execute, Sync) therefore never mixes with another connection's messages, and a pool with several connections
    works. A connection that closes inside a transaction is rolled back.
  - It asks for the password like a server with password authentication and refuses a wrong user or password with
    SQLSTATE `28P01`, so a scenario about a refused login keeps proving it.
  - The first start of a PGlite build saves an empty data directory in the temporary folder; later databases start
    from a copy in about 0.6 s instead of 2.4 s.
  - The `postgres` container image pin of ADR 0016 is removed.
- **Known differences from a PostgreSQL server**, accepted for tests:
  - Connections run one at a time. Code that waits inside a transaction for a second connection of its own waits
    forever here, where a server might go on. Read inside the transaction you hold instead (gatekeeper now reads a
    gate's button presses through the gate's transaction).
  - Settings made with `SET` and startup options such as `search_path` are shared by all connections or ignored.
  - The database and user names in the URL are not checked beyond the user `test`.
- NATS, Temporal, S3, Forgejo and the OpenTelemetry Collector stay containers for now. Each is a candidate under
  the principle above: `nats-server` is a single binary that starts in milliseconds, so it is the next one to
  measure.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| PostgreSQL container (ADR 0016) | The real server | Docker; one container start per scenario |
| PGlite behind `@electric-sql/pglite-socket` | Ready-made socket server | Its multiplexer interleaves single messages of different connections (an extended-protocol exchange of one connection can mix with another's), accepts any password, and leaks connections that end with an error |
| PGlite behind a small server in the testkit | The real PostgreSQL; no Docker; transactions and extended-protocol exchanges kept whole; password checked | About 200 lines to keep; one connection at a time |
| pg-mem | Pure JavaScript | Not PostgreSQL: a reimplementation of a subset; differs in SQL and errors |
| One shared PostgreSQL container per test run | One start | Shared state between scenarios; still Docker |

## Prior art

- PGlite (`@electric-sql/pglite`, Apache-2.0, ElectricSQL, 0.5 of October 2026, very
  active): adopted. PostgreSQL 18 in WebAssembly, single user.
- `@electric-sql/pglite-socket` (same project, 0.2): checked, not adopted; see the options. Its protocol handling
  showed how PGlite answers raw wire messages (`execProtocolRaw`).
- pg-gateway (MIT, Supabase community, a PostgreSQL wire-protocol server for Node.js): known, not adopted; the
  stand-in needs only the startup, a password check and pass-through to PGlite, which is less code than wiring a
  library. Revisit if the stand-in grows (SCRAM, TLS).
- pg-mem (MIT, active): rejected in ADR 0016 and here; it is not PostgreSQL.

## Consequences

- Scenarios that use only `fakes.postgres()` need no Docker. ledger's PostgreSQL scenarios and gatekeeper's server
  scenarios start their database in process.
- Measured on a 4-core machine with warm Docker images: gatekeeper's suite took 51 s with the container and 47 s with
  PGlite (the summed test time fell from 104 s to 83 s); ledger's took 47 s and 45 s (84 s to 74 s). The remaining
  time is spent starting the module's processes and loading test files, so the next gains come from there and from
  NATS. On a CI runner without the image cached the container also had to be pulled.
- A behavior that depends on several concurrent sessions cannot be shown with this stand-in. Such a scenario needs
  the real server, which the testkit no longer starts; add a container helper back for it when one is written.
- Revisit when PGlite gains several sessions, or when a module needs PostgreSQL extensions PGlite does not ship.
