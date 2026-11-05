---
status: accepted
date: 2026-11-05
---

# 0082. The library postgres opens the pools and runs the transactions of modules on PostgreSQL

## Context

gatekeeper and intake keep their state in PostgreSQL through `pg` (node-postgres). Each creates its own `pg.Pool` and
its own transaction helper. Both had the same bug: a client that a transaction holds emits `error` when the database
closes its connection between two queries. The pool's listener covers only idle clients, so the process ended with
`Unhandled 'error' event`.

gatekeeper's fix is proven by SCN-GATE-070, because gatekeeper calls the forge inside a transaction and a test can hold
that call. intake's transactions hold only queries. A test from outside cannot stop the database between two of them,
so a fix in intake alone has no system test that notices it, and MUTATION rejects it.

## Decision

- A library `packages/postgres`, published as `@opensoftware/postgres` (ADR 0037, ADR 0039), holds what modules need
  around `pg`:
  - `openPool(url, options)`: a `pg.Pool` with a listener for the errors of idle clients and one for each client it
    creates, so a checked-out client that loses its connection does not end the process;
  - `transaction(pool, work)`: `BEGIN`, the work, `COMMIT`; `ROLLBACK` when the work fails; the client goes back to
    the pool in every case, and pg-pool destroys a client that lost its connection.
- Its system tests call it in the test's process with `fakes.postgres()`. A test can hold a transaction between two
  of its queries and stop the database, so the error handling is proven in every run.
- gatekeeper and intake use the library. Their own pool code goes away. A new module on PostgreSQL uses it too
  (`skills/use-postgres`).

## Options considered

| Option | For | Against |
| --- | --- | --- |
| A library around `pg` (chosen) | One place for the error handling, proven by tests that can hold a client; less duplicated code | A new package to release before the modules that use it |
| The same one-line listener in intake | Small | No test notices it; MUTATION rejects it |
| Switch both modules to `pg-promise` or `postgres` (porsager) | Both handle lost connections themselves | A new driver in two modules, their SQL and tests rewritten, for one listener |

## Prior art

- `pg` and `pg-pool` (MIT, maintained, in use): the pool covers idle clients only; a checked-out client needs its own
  `error` listener, and `release(error)` or a not queryable client is destroyed. Kept; the library adds the listener.
- `pg-promise` (MIT, maintained): tasks and transactions with connection error events. Not adopted: a new API for the
  modules' queries.
- `postgres` by porsager (Unlicense, maintained): a different driver with its own reconnect. Not adopted for the same
  reason.

## Consequences

- A module that uses PostgreSQL gets the error handling by using the library, not by repeating it.
- The first release of `@opensoftware/postgres` is published by hand, then through its trusted publisher
  (`contracts/README.md#releases`); gatekeeper and intake releases that use it wait for that.
- Revisit when a module needs `LISTEN`/`NOTIFY` or a long-lived client: the library then needs a scenario for it.
