import { scenario } from "@opensoftware/testkit";
import { addLines, demoModule, shardsOf } from "./mutation.ts";
import { prefixes } from "./repo.ts";

scenario("SCN-REPO-093", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with module "demo" whose package.json sets "mutationLinesPerShard" to 2 and "src/run.ts" of 3 lines',
    async () => {
      await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", prefixes(["DEMO", "modules/demo/features/"]));
      await demoModule(sut, "demo", 3, { mutationLinesPerShard: 2 });
    },
  );

  await given('module "small" in the base commit that the change does not touch', async () => {
    await demoModule(sut, "small", 1);
    base = await sut.git.commit("base");
  });

  await given('a change that adds lines 4 to 6 to "src/run.ts"', async () => {
    await addLines(sut, 6, [4, 5, 6]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf mutation-plan" against the base commit', async () => {
    run = await sut.cli(["mutation-plan"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output lists the shards "1/2" and "2/2" of "modules/demo" and no shard of "modules/small"',
    async () => {
      expect(shardsOf(run.stdout)).toEqual(["modules/demo 1/2", "modules/demo 2/2"]);
    },
  );
});
