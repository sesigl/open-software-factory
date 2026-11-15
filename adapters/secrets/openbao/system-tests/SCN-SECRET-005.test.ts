import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-005", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  await given('the client piped two values into "put linear-token --by ada"', async () => {
    await box.lines(token, ["put", "linear-token", "--by", "ada"], VALUE);
    await box.lines(token, ["put", "linear-token", "--by", "ada"], "lin_test_77e4");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client runs "delete linear-token"', async () => {
    run = await box.run(token, ["delete", "linear-token"]);
  });

  await then('delete prints the name "linear-token" and "deleted" true', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe('{"name":"linear-token","deleted":true}\n');
  });

  await then("list prints nothing", async () => {
    expect(await box.lines(token, ["list"])).toEqual([]);
  });

  await then('the test store holds no secret "linear-token"', async () => {
    expect(await box.bao.read("linear-token")).toBeUndefined();
  });
});
