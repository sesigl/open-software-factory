import { scenario } from "@opensoftware/testkit";
import { type Store, store, VALUE } from "./store.ts";

scenario("SCN-SECRET-009", async ({ sut, fakes, given, when, then }) => {
  let box: Store;
  let write = "";
  let read = "";
  await given("the test store, the write token and the read token", async () => {
    box = await store(sut, fakes);
    write = await box.token("write");
    read = await box.token("read");
  });

  let runs: Awaited<ReturnType<Store["run"]>>[] = [];
  await when(
    'the client pipes "lin_test_51c2" into "put linear-token --by ada", and runs "list", "probe" and "delete linear-token"',
    async () => {
      runs = [await box.run(write, ["put", "linear-token", "--by", "ada"], { stdin: VALUE })];
      for (const args of [["list"], ["probe"], ["delete", "linear-token"]])
        runs = [...runs, await box.run(write, args)];
    },
  );

  await when(
    'the client pipes "lin_test_51c2" into "put linear-token --by ada" with the read token, which may not write',
    async () => {
      runs = [...runs, await box.run(read, ["put", "linear-token", "--by", "ada"], { stdin: VALUE })];
    },
  );

  await then('no output and no error of these commands contains "lin_test_51c2"', async () => {
    // Four commands succeeded and printed a line, and the last one failed with an error: each had something to say.
    expect(runs.map((run) => run.exitCode)).toEqual([0, 0, 0, 0, 1]);
    expect(runs.map((run) => (run.stdout + run.stderr).length > 0)).toEqual([true, true, true, true, true]);
    for (const run of runs) expect(run.stdout + run.stderr).not.toContain(VALUE);
  });
});
