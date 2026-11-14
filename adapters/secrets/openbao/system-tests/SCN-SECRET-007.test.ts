import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-007", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  await given('another client stored "linear-token" in the test store', async () => {
    await box.bao.write("linear-token", { value: VALUE });
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client runs "list"', async () => {
    run = await box.run(token, ["list"]);
  });

  await then('list prints the name "linear-token", the version 1 and the person null', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    const secret = JSON.parse(run.stdout) as Record<string, unknown>;
    expect(secret).toMatchObject({ name: "linear-token", version: 1, by: null });
  });
});
