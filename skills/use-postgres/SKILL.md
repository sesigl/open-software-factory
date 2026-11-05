---
name: use-postgres
description: Rules for code that uses PostgreSQL through node-postgres (pg), and for its system tests with fakes.postgres. Use when you write or change a pool, a transaction or a checked-out client, or when a server process ends after its database stops.
---

# Use PostgreSQL with node-postgres

Modules connect to PostgreSQL with `pg` (node-postgres). The database can stop or close a connection at any time.
The process must go on and answer with an error. It must not end.

## Rules

1. Use the library `@opensoftware/postgres` (`packages/postgres`, ADR 0082). Do not create a `pg.Pool` or a
   transaction helper in a module.

   ```ts
   import { openPool, transaction } from "@opensoftware/postgres";

   const pool = openPool(url, { max: 4 });
   await transaction(pool, async (client) => {
     await client.query("UPDATE ...", [id]);
     await client.query("INSERT INTO outbox ...", [event]);
   });
   ```

2. Use `pool.query(...)` for a single statement. It checks out, handles errors and releases for you.
3. A module that needs more around `pg` (for example `LISTEN`) adds it to the library, with a scenario there.

## Why the library exists

- `pool.on("error")` covers only the idle clients in a pool.
- A client from `pool.connect()`, for example the client of a transaction, is not idle. When the database closes its
  connection while no query runs on it, for example between two queries of a transaction, the client emits `error`.
  Without a listener, Node ends the process with `Unhandled 'error' event` and `read ECONNRESET`.
- `openPool` gives every client its own listener (`pool.on("connect", ...)`). pg-pool destroys a client that is no
  longer queryable when it is released, so nobody tracks broken clients.
- The library's tests run in the test's process. SCN-PG-003 holds a transaction between two queries, stops the
  database and checks that no error ends the process, in every run. A module's test from outside cannot stop the
  database at that moment, so the proof belongs in the library.

## Prove a module's behavior with a system test

A module still needs a scenario for what it does when its database stops, for example that it answers with an error
status. Make the timing deterministic; a test that stops the database at a random moment notices a bug in only some
runs, and MUTATION fails.

- Find a call to a fake (`fakes.http`) that the module makes inside a transaction.
- Hold its answer with the route option `until` (a promise). The fake reads `until` when a request arrives, so the
  test can set it on a route it already gave the fake.
- Wait until the fake has the request, stop the database with `db.stop()` of `fakes.postgres()`, then release the
  answer and check the module's answer. Example: SCN-GATE-070.

When a test fails with `ECONNREFUSED` on the server's port, the server process ended. Read its stderr before you run
the test again.
