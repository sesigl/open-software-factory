import { scenario } from "@opensoftware/testkit";
import { addLines, demoBase, shardsOf } from "./mutation.ts";

scenario("SCN-REPO-173", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with module "demo", the limit "at least 70% of the mutants in changed lines" and "src/clock.tsx" of 3 lines',
    async () => {
      base = await demoBase(sut, 3, "src/clock.tsx");
    },
  );

  await given('a change that adds lines 4 to 6 to "src/clock.tsx"', async () => {
    await addLines(sut, 6, [4, 5, 6], "src/clock.tsx");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf mutation-plan" against the base commit', async () => {
    run = await sut.cli(["mutation-plan"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output lists the shard "1/1" of "modules/demo"', async () => {
    expect(shardsOf(run.stdout)).toEqual(["modules/demo 1/1"]);
  });
});
