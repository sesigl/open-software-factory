import { scenario } from "@opensoftware/testkit";
import { coverageFile, DEMO_PACKAGE, prefixes } from "./repo.ts";

scenario("SCN-REPO-033", async ({ sut, given, when, then }) => {
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

  await given('a coverage report in which the system tests ran only "used"', async () => {
    const file = coverageFile("modules/demo/src/run.ts", source, ["used"]);
    await sut.files.put("$INPUT/reports/coverage/coverage-1-1.json", file);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check REACH" against the base commit', async () => {
    run = await sut.cli(["check", "REACH"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "REACH ok"', async () => {
    expect(run.stdout).toContain("REACH ok");
  });
});
