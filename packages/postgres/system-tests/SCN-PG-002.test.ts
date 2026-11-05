import { transaction } from "@opensoftware/postgres";
import { scenario } from "@opensoftware/testkit";
import { rows, workDatabase } from "./db.ts";

scenario("SCN-PG-002", async ({ fakes, given, when, then }) => {
  let database: Awaited<ReturnType<typeof workDatabase>>;
  await given('a pool on a PostgreSQL database with the table "work"', async () => {
    database = await workDatabase(fakes);
  });

  let done: Promise<unknown>;
  await when('a transaction inserts the row "w-1" into "work" and then fails with "no room"', async () => {
    done = transaction(database.pool, async (client) => {
      await client.query("INSERT INTO work (id) VALUES ($1)", ["w-1"]);
      throw new Error("no room");
    });
    await done.catch(() => {});
  });

  await then('the transaction rejects with "no room"', async () => {
    await expect(done).rejects.toThrow("no room");
  });

  await then('"work" holds no row', async () => {
    expect(await rows(database.pool)).toEqual([]);
  });
});
