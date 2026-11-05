import { scenario } from "@opensoftware/testkit";
import { workDatabase } from "./db.ts";

scenario("SCN-PG-005", async ({ fakes, given, when, then }) => {
  let database: Awaited<ReturnType<typeof workDatabase>>;
  await given('a pool on a PostgreSQL database with the table "work"', async () => {
    database = await workDatabase(fakes);
  });

  // The clients go back when the scenario ends, before the pool ends; the fifth gets a client from the first four.
  await when("five requests ask the pool for a client at once", async () => {
    const asked = Array.from({ length: 5 }, () => database.pool.connect());
    onTestFinished(async () => {
      for (const client of asked) (await client).release();
    });
  });

  // A pool with no limit of four never makes a request wait.
  await then("1 request waits", async () => {
    await expect.poll(() => database.pool.waitingCount).toBe(1);
  });

  await then("the pool has 4 clients", async () => {
    expect(database.pool.totalCount).toBe(4);
  });
});
