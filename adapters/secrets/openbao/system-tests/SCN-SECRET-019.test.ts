import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-019", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the read token", async () => {
    box = await store(sut, fakes);
    token = await box.token("read");
  });

  await given('another client stored "linear-token" with the value "lin_test_51c2" in the test store', async () => {
    await box.bao.write("linear-token", { value: VALUE });
  });

  let runs: Awaited<ReturnType<Store["run"]>>[] = [];
  await when('the client runs "exists linear-token" and "exists team/other-token" with the read token', async () => {
    runs = [await box.run(token, ["exists", "linear-token"]), await box.run(token, ["exists", "team/other-token"])];
  });

  await then(
    'exists prints the name "linear-token" with "exists" true, and the name "team/other-token" with "exists" false',
    async () => {
      expect(runs.map((run) => [run.exitCode, run.stdout, run.stderr])).toEqual([
        [0, '{"name":"linear-token","exists":true}\n', ""],
        [0, '{"name":"team/other-token","exists":false}\n', ""],
      ]);
    },
  );

  await then('neither output contains "lin_test_51c2"', async () => {
    expect(runs.map((run) => run.stdout + run.stderr).join("\n")).not.toContain(VALUE);
  });
});
