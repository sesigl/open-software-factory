import { scenario } from "@opensoftware/testkit";
import { addLines, demoModule, keyOf, turboRoot } from "./mutation.ts";
import { prefixes } from "./repo.ts";

scenario("SCN-REPO-095", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a Turborepo base commit with library "packages/lib" and module "demo" that depends on it, whose "src/run.ts" has 3 lines',
    async () => {
      await turboRoot(sut);
      await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", prefixes(["DEMO", "modules/demo/features/"]));
      const lib = { name: "@opensoftware/lib", version: "0.1.0", type: "module", scripts: { build: "tsc" } };
      await sut.files.put("$INPUT/packages/lib/package.json", `${JSON.stringify(lib, null, 2)}\n`);
      await sut.files.put("$INPUT/packages/lib/src/index.ts", "export const one = 1;\n");
      await demoModule(sut, "demo", 3);
      const manifest = JSON.parse(await sut.files.read("$INPUT/modules/demo/package.json"));
      manifest.dependencies = { "@opensoftware/lib": "workspace:*" };
      await sut.files.put("$INPUT/modules/demo/package.json", `${JSON.stringify(manifest, null, 2)}\n`);
      await sut.files.put("$INPUT/modules/demo/system-tests/SCN-DEMO-001.test.ts", "// SCN-DEMO-001\n");
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
    'the developer runs "osf mutation-plan --keys" against the base commit, again after a change that adds line 7 to "src/run.ts" and changes "system-tests/SCN-DEMO-001.test.ts", and again after a change to "packages/lib/src/index.ts"',
    async () => {
      first = await sut.cli(args, { env: { OSF_BASE: base } });
      await addLines(sut, 7, [4, 5, 6, 7]);
      await sut.files.put("$INPUT/modules/demo/system-tests/SCN-DEMO-001.test.ts", "// SCN-DEMO-001, changed\n");
      second = await sut.cli(args, { env: { OSF_BASE: base } });
      await sut.files.put("$INPUT/packages/lib/src/index.ts", "export const one = 2;\n");
      third = await sut.cli(args, { env: { OSF_BASE: base } });
    },
  );

  await then("each run exits with code 0", async () => {
    expect(first.exitCode, first.stderr).toBe(0);
    expect(second.exitCode, second.stderr).toBe(0);
    expect(third.exitCode, third.stderr).toBe(0);
  });

  await then(
    'the guard of "modules/demo" is the same in the first two runs and different in the third run',
    async () => {
      const [one, two, three] = [first, second, third].map((run) => keyOf(run.stdout, "modules/demo", "guard"));
      expect(one).toMatch(/^[0-9a-f]{32}$/);
      expect(two).toBe(one);
      expect(three).not.toBe(one);
    },
  );
});
