import { scenario } from "@opensoftware/testkit";
import { DEMO_PACKAGE, prefixes } from "./repo.ts";

scenario("SCN-REPO-034", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs', async () => {
    await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", prefixes(["DEMO", "modules/demo/features/"]));
    await sut.files.put("$INPUT/modules/demo/package.json", DEMO_PACKAGE);
    await sut.files.put("$INPUT/modules/demo/src/run.ts", "export function used() {\n  return 1;\n}\nused();\n");
    base = await sut.git.commit("base");
  });

  let source = "";
  await given('a change to the body of "used"', async () => {
    source = "export function used() {\n  return 2;\n}\nused();\n";
    await sut.files.put("$INPUT/modules/demo/src/run.ts", source);
  });

  await given("no coverage report", async () => {
    expect(await sut.files.list("$INPUT")).not.toContain("reports/coverage/coverage-1-1.json");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check REACH" against the base commit', async () => {
    run = await sut.cli(["check", "REACH"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "REACH modules/demo/package.json:1 no coverage in reports/coverage/ for this module: run its system tests first"',
    async () => {
      expect(run.stdout).toContain(
        "REACH modules/demo/package.json:1 no coverage in reports/coverage/ for this module: run its system tests first",
      );
    },
  );
});
