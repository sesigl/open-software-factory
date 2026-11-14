import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-008", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client pipes "lin_test_51c2" and a line break into "put linear-token --by ada"', async () => {
    run = await box.run(token, ["put", "linear-token", "--by", "ada"], { stdin: `${VALUE}\n` });
  });

  await then('the test store holds the value "lin_test_51c2" for "linear-token"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(await box.bao.read("linear-token")).toEqual({ version: 1, data: { value: VALUE } });
  });
});
