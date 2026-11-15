import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-004", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let token = "";
  await given("the test store and the write token", async () => {
    box = await store(sut, fakes);
    token = await box.token("write");
  });

  await given(
    'the client piped values into "put team/linear/token --by ada" and "put linear-token --by ada"',
    async () => {
      await box.lines(token, ["put", "team/linear/token", "--by", "ada"], VALUE);
      await box.lines(token, ["put", "linear-token", "--by", "ada"], "lin_test_77e4");
    },
  );

  let run: Awaited<ReturnType<Store["run"]>>;
  await when('the client runs "list"', async () => {
    run = await box.run(token, ["list"]);
  });

  await then('list prints the names "linear-token" and "team/linear/token", in this order', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    const names = run.stdout
      .trimEnd()
      .split("\n")
      .map((line) => (JSON.parse(line) as { name: string }).name);
    expect(names).toEqual(["linear-token", "team/linear/token"]);
  });
});
