---
name: use-postgres
description: Rules for code that uses PostgreSQL through node-postgres (pg), and for its system tests with fakes.postgres. Use when you write or change a pg.Pool, a transaction or a checked-out client, or when a server process ends after its database stops.
---

# Use PostgreSQL with node-postgres

Modules connect to PostgreSQL with `pg` (node-postgres). The database can stop or close a connection at any time.
The process must go on and answer with an error. It must not end.

## Rules

1. Give each `pg.Pool` two listeners, directly after you create it:

   ```ts
   const pool = new pg.Pool({ connectionString: url, max: 4 });
   pool.on("error", () => {});
   pool.on("connect", (client) => client.on("error", () => {}));
   ```

   - `pool.on("error")` covers only the idle clients in the pool.
   - A client from `pool.connect()`, for example the client of a transaction, is not idle. When the database closes
     its connection while no query runs on it, for example between two queries of a transaction, the client emits
     `error`. Without a listener, Node ends the process with `Unhandled 'error' event` and `read ECONNRESET`. The
     `connect` listener gives each client its own listener once.
   - Do not track broken clients yourself. On `release()`, pg-pool destroys a client that is no longer queryable.
2. Use `pool.query(...)` for a single statement. It checks out, handles errors and releases for you.
3. Keep `pool.connect()` in one helper per module (for example `inTransaction`), with `release()` in `finally`.

## Prove it with a system test

Write a scenario in which the database stops while the module holds a transaction open, and the module still
answers with an error status. Make the timing deterministic; a test that stops the database at a random moment
notices the bug in only some runs, and MUTATION fails.

- Find a call to a fake (`fakes.http`) that the module makes inside the transaction.
- Hold its answer with the route option `until` (a promise). The fake reads `until` when a request arrives, so the
  test can set it on a route it already gave the fake.
- Wait until the fake has the request, stop the database with `db.stop()` of `fakes.postgres()`, then release the
  answer and check the module's answer.

Examples: SCN-GATE-070 (gatekeeper holds the read of the pull request comments), SCN-TK-127 (`fakes.postgres` stops
while a client holds a transaction open).

When a test fails with `ECONNREFUSED` on the server's port, the server process ended. Read its stderr before you run
the test again.
