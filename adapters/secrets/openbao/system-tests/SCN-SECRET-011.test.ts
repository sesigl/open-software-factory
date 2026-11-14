import { scenario } from "@opensoftware/testkit";
import { type Store, store } from "./store.ts";

scenario("SCN-SECRET-011", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and a write token that lives one hour", async () => {
    box = await store(sut, fakes);
    token = await box.token("write", "1h");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client runs "probe"', async () => {
    run = await box.run(token, ["probe"]);
  });

  await then(
    'probe prints a "ttl" of at most 3600 seconds and more than 3500, and the time the token expires',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const { ttl, expires, ...rest } = JSON.parse(run.stdout) as { ttl: number; expires: string };
      expect(rest).toEqual({});
      expect(ttl).toBeLessThanOrEqual(3600);
      expect(ttl).toBeGreaterThan(3500);
      // OpenBao's clock decides both; the token ends about ttl seconds after the store's now.
      expect(expires).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/);
    },
  );
});
