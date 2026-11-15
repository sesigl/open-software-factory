import { scenario } from "@opensoftware/testkit";
import { coverageFile, DEMO_PACKAGE, prefixes } from "./repo.ts";

const RUN = "export function used() {\n  return 1;\n}\nused();\n";

scenario("SCN-REPO-174", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with "modules/demo/src/run.ts" whose function "used" a system test runs', async () => {
    await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", prefixes(["DEMO", "modules/demo/features/"]));
    await sut.files.put("$INPUT/modules/demo/package.json", DEMO_PACKAGE);
    await sut.files.put("$INPUT/modules/demo/src/run.ts", RUN);
    base = await sut.git.commit("base");
  });

  await given('a change that adds "modules/demo/src/clock.tsx" with a function that returns markup', async () => {
    await sut.files.put(
      "$INPUT/modules/demo/src/clock.tsx",
      "export function Clock() {\n  return <output>morning</output>;\n}\n",
    );
  });

  await given('a coverage report in which the system tests ran only "used"', async () => {
    await sut.files.put(
      "$INPUT/reports/coverage/coverage-1-1.json",
      coverageFile("modules/demo/src/run.ts", RUN, ["used"]),
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check REACH" against the base commit', async () => {
    run = await sut.cli(["check", "REACH"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "REACH modules/demo/src/clock.tsx:1 no system test loads this file"', async () => {
    expect(run.stdout).toContain("REACH modules/demo/src/clock.tsx:1 no system test loads this file");
  });
});
