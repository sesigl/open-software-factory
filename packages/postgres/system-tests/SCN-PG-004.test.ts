import { scenario } from "@opensoftware/testkit";
import { workDatabase } from "./db.ts";

scenario("SCN-PG-004", async ({ fakes, given, when, then }) => {
  let database: Awaited<ReturnType<typeof workDatabase>>;
  await given('a pool on a PostgreSQL database with the table "work"', async () => {
    database = await workDatabase(fakes);
  });

  await given("the pool holds an idle client after a query", async () => {
    await database.pool.query("SELECT 1");
    expect(database.pool.idleCount).toBe(1);
  });

  await when("the database stops", async () => {
    await database.db.stop();
  });

  // The pool drops an idle client when its connection fails, after its own listener got the error.
  await then("the pool drops its idle client", async () => {
    await expect.poll(() => database.pool.idleCount).toBe(0);
  });

  await then("no error ended the process", async () => {
    expect(database.errors).toEqual([]);
  });
});
