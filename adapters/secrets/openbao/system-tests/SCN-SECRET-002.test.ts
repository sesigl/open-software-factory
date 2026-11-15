import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-002", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  await given('the client piped "lin_test_51c2" into "put linear-token --by ada"', async () => {
    await box.lines(token, ["put", "linear-token", "--by", "ada"], VALUE);
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client runs "list"', async () => {
    run = await box.run(token, ["list"]);
  });

  await then(
    'list prints one line with the name "linear-token", the version 1, the time of the change and the person "ada"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const lines = run.stdout.trimEnd().split("\n");
      expect(lines).toHaveLength(1);
      const secret = JSON.parse(lines[0] as string) as Record<string, unknown>;
      expect(Object.keys(secret)).toEqual(["name", "version", "changed", "by"]);
      expect(secret).toMatchObject({ name: "linear-token", version: 1, by: "ada" });
      // OpenBao's clock: the time of the version, in ISO 8601 with nanoseconds.
      expect(secret.changed).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/);
    },
  );

  await then('the output does not contain "lin_test_51c2"', async () => {
    expect(run.stdout + run.stderr).not.toContain(VALUE);
  });
});
