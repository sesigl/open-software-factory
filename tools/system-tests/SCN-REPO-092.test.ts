import { scenario } from "@opensoftware/testkit";
import { demoModule, shardsOf } from "./mutation.ts";

scenario("SCN-REPO-092", async ({ sut, given, when, then }) => {
  await given(
    'module "demo" whose package.json sets "mutationAllLinesPerShard" to 2 and whose "src/run.ts" has 5 lines',
    async () => {
      await demoModule(sut, "demo", 5, { mutationAllLinesPerShard: 2 });
    },
  );

  await given('module "small" whose "src/run.ts" has 1 line', async () => {
    await demoModule(sut, "small", 1);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf mutation-plan --all"', async () => {
    run = await sut.cli(["mutation-plan", "--all"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output lists the shards "1/3", "2/3" and "3/3" of "modules/demo" and the shard "1/1" of "modules/small"',
    async () => {
      expect(shardsOf(run.stdout)).toEqual([
        "modules/demo 1/3",
        "modules/demo 2/3",
        "modules/demo 3/3",
        "modules/small 1/1",
      ]);
    },
  );
});
