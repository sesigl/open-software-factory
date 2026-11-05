import { transaction } from "@opensoftware/postgres";
import { scenario } from "@opensoftware/testkit";
import { workDatabase } from "./db.ts";

scenario("SCN-PG-003", async ({ fakes, given, when, then }) => {
  let database: Awaited<ReturnType<typeof workDatabase>>;
  await given('a pool on a PostgreSQL database with the table "work"', async () => {
    database = await workDatabase(fakes);
  });

  // The work holds its client with no query running: the database's close then reaches the client as an event.
  let goOn = () => {};
  let done: Promise<unknown>;
  await given('a transaction that inserted the row "w-1" into "work" and waits before its next query', async () => {
    let inserted = () => {};
    const waiting = new Promise<void>((resolve) => {
      inserted = resolve;
    });
    done = transaction(database.pool, async (client) => {
      await client.query("INSERT INTO work (id) VALUES ($1)", ["w-1"]);
      inserted();
      await new Promise<void>((resolve) => {
        goOn = resolve;
      });
      await client.query("INSERT INTO work (id) VALUES ($1)", ["w-2"]);
    });
    done.catch(() => {});
    await waiting;
  });

  await when("the database stops", async () => {
    await database.db.stop();
  });

  await when("the transaction goes on with its next query", async () => {
    goOn();
  });

  await then("the transaction rejects", async () => {
    await expect(done).rejects.toThrow();
  });

  await then("no error ended the process", async () => {
    expect(database.errors).toEqual([]);
  });
});
