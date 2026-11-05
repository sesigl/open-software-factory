---
name: use-postgres
description: Rules for code that uses PostgreSQL through node-postgres (pg). Use when you write or change a pg.Pool, a transaction or a checked-out client, or when a server process ends after its database stops.
---

# Use PostgreSQL with node-postgres

Modules connect to PostgreSQL with `pg` (node-postgres). The database can stop or close a connection at any time.
The process must go on and answer with an error. It must not end.

## Rules

1. Give each `pg.Pool` an `error` listener: `pool.on("error", ...)`. It covers only the idle clients in the pool.
2. A client from `pool.connect()` is not covered by the pool's listener. When the database closes its connection
   while no query runs on it, for example between two queries of a transaction, the client emits `error`. Without
   a listener, Node ends the process with `Unhandled 'error' event` and `read ECONNRESET`.
   - Add an `error` listener to the client when you check it out.
   - Remove the listener before you release the client. The pool gives the same client out again.
   - Release a broken client with `client.release(error)`. The pool then destroys it and does not give it out again.
3. Use `pool.query(...)` for a single statement. It checks out, handles errors and releases for you.
4. Keep the checkout in one helper per module (for example `inTransaction`), so that the rules above are in one
   place.

```ts
async function inTransaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  const onError = (error: Error) => {
    broken = error;
  };
  client.on("error", onError);
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.off("error", onError);
    client.release(broken);
  }
}
```

## Prove it

Write a scenario in which the database stops while the server runs, and the server still answers with an error
status (for example SCN-GATE-069). In the system test, stop the database of `fakes.postgres()` with `db.stop()`.

This failure depends on timing. It can pass alone and fail when the whole suite runs. When such a test fails with
`ECONNREFUSED` on the server's port, the server process ended: read its stderr before you run the test again.
