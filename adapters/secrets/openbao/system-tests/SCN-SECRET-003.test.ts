import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-003", async ({ sut, fakes, given, when, then }) => {
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
  await when('the client pipes "lin_test_77e4" into "put linear-token --by grace"', async () => {
    run = await box.run(token, ["put", "linear-token", "--by", "grace"], { stdin: "lin_test_77e4" });
  });

  await then('put prints the name "linear-token" and the version 2', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe('{"name":"linear-token","version":2}\n');
  });

  await then('list prints the version 2 and the person "grace" for "linear-token"', async () => {
    const [secret] = await box.lines(token, ["list"]);
    expect(secret).toMatchObject({ name: "linear-token", version: 2, by: "grace" });
  });

  await then('the test store holds the value "lin_test_77e4" for "linear-token"', async () => {
    expect(await box.bao.read("linear-token")).toEqual({ version: 2, data: { value: "lin_test_77e4" } });
  });
});
