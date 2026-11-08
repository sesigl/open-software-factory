import { scenario } from "@opensoftware/testkit";
import { addLines, demoModule, keyOf, turboRoot } from "./mutation.ts";
import { prefixes } from "./repo.ts";

scenario("SCN-REPO-094", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a Turborepo base commit with module "demo" whose "src/run.ts" has 3 lines, and module "other"',
    async () => {
      await turboRoot(sut);
      await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", prefixes(["DEMO", "modules/demo/features/"]));
      await demoModule(sut, "demo", 3);
      await demoModule(sut, "other", 1);
      base = await sut.git.commit("base");
    },
  );

  await given('a change that adds lines 4 to 6 to "src/run.ts"', async () => {
    await addLines(sut, 6, [4, 5, 6]);
  });

  type Run = Awaited<ReturnType<typeof sut.cli>>;
  let first: Run;
  let second: Run;
  let third: Run;
  const args = ["mutation-plan", "--keys"];
  await when(
    'the developer runs "osf mutation-plan --keys" against the base commit, again after a change to "modules/other/README.md", and again after a change to "modules/demo/README.md"',
    async () => {
      first = await sut.cli(args, { env: { OSF_BASE: base } });
      await sut.files.put("$INPUT/modules/other/README.md", "# other\n");
      second = await sut.cli(args, { env: { OSF_BASE: base } });
      await sut.files.put("$INPUT/modules/demo/README.md", "# demo\n");
      third = await sut.cli(args, { env: { OSF_BASE: base } });
    },
  );

  await then("each run exits with code 0", async () => {
    expect(first.exitCode, first.stderr).toBe(0);
    expect(second.exitCode, second.stderr).toBe(0);
    expect(third.exitCode, third.stderr).toBe(0);
  });

  await then(
    'the key of shard "1/1" of "modules/demo" is the same in the first two runs and different in the third run',
    async () => {
      const [one, two, three] = [first, second, third].map((run) => keyOf(run.stdout, "modules/demo", "key"));
      expect(one).toMatch(/^modules-demo-1-of-1-[0-9a-f]{32}$/);
      expect(two).toBe(one);
      expect(three).not.toBe(one);
    },
  );
});
