import { transaction } from "@opensoftware/postgres";
import { scenario } from "@opensoftware/testkit";
import { rows, workDatabase } from "./db.ts";

scenario("SCN-PG-001", async ({ fakes, given, when, then }) => {
  let database: Awaited<ReturnType<typeof workDatabase>>;
  await given('a pool on a PostgreSQL database with the table "work"', async () => {
    database = await workDatabase(fakes);
  });

  let returned: number;
  await when('a transaction inserts the rows "w-1" and "w-2" into "work"', async () => {
    returned = await transaction(database.pool, async (client) => {
      await client.query("INSERT INTO work (id) VALUES ($1)", ["w-1"]);
      await client.query("INSERT INTO work (id) VALUES ($1)", ["w-2"]);
      return 2;
    });
  });

  await then("the transaction returns 2", async () => {
    expect(returned).toBe(2);
  });

  await then('"work" holds the rows "w-1" and "w-2"', async () => {
    expect(await rows(database.pool)).toEqual(["w-1", "w-2"]);
  });
});
