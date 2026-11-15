import { scenario } from "@opensoftware/testkit";
import { VALUE } from "./store.ts";

scenario("SCN-SECRET-015", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a test store that does not answer at "http://127.0.0.1:9"', async () => {
    env = { OSF_OPENBAO_ADDR: "http://127.0.0.1:9", OSF_OPENBAO_TOKEN: "osf-test-unknown-token" };
  });

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when(
    'the client runs "put linear-token --by ada" with a value, "list", "delete linear-token" and "probe"',
    async () => {
      runs = [await sut.cli(["put", "linear-token", "--by", "ada"], { env, stdin: VALUE })];
      for (const args of [["list"], ["delete", "linear-token"], ["probe"]])
        runs = [...runs, await sut.cli(args, { env })];
    },
  );

  await then('each exits with code 1 and the error "the store at http://127.0.0.1:9 does not answer"', async () => {
    const error = "secrets-openbao: the store at http://127.0.0.1:9 does not answer\n";
    expect(runs.map((run) => [run.exitCode, run.stderr, run.stdout])).toEqual(Array(4).fill([1, error, ""]));
  });
});
