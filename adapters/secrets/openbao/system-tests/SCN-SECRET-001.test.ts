import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-001", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client pipes "lin_test_51c2" into "put linear-token --by ada"', async () => {
    run = await box.run(token, ["put", "linear-token", "--by", "ada"], { stdin: VALUE });
  });

  await then('put prints the name "linear-token" and the version 1', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe('{"name":"linear-token","version":1}\n');
  });

  await then('the test store holds the value "lin_test_51c2" for "linear-token"', async () => {
    expect(await box.bao.read("linear-token")).toEqual({ version: 1, data: { value: VALUE } });
  });
});
