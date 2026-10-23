import { scenario } from "@opensoftware/testkit";
import { addLines, demoBase } from "./mutation.ts";

scenario("SCN-REPO-063", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with module "demo", the limit "at least 70% of the mutants in changed lines" and "src/run.ts" of 5 lines',
    async () => {
      base = await demoBase(sut, 5);
    },
  );

  await given('a change that adds lines 4 to 6 and line 9 to "src/run.ts"', async () => {
    await addLines(sut, 9, [4, 5, 6, 9]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf mutation modules/demo --list --shard 2/2" against the base commit', async () => {
    run = await sut.cli(["mutation", "modules/demo", "--list", "--shard", "2/2"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "src/run.ts:6-6" and "src/run.ts:9-9", one per line', async () => {
    expect(run.stdout).toBe("src/run.ts:6-6\nsrc/run.ts:9-9\n");
  });
});
