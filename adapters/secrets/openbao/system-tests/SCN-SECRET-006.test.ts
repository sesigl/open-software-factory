import { scenario } from "@opensoftware/testkit";
import { type Store, store } from "./store.ts";

scenario("SCN-SECRET-006", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client runs "delete linear-token"', async () => {
    run = await box.run(token, ["delete", "linear-token"]);
  });

  await then('delete prints the name "linear-token" and "deleted" false', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe('{"name":"linear-token","deleted":false}\n');
  });
});
