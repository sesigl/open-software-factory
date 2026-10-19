import { scenario } from "@opensoftware/testkit";
import { DEMO_PREFIXES, feature, scenarioText } from "./repo.ts";

scenario("SCN-REPO-002", async ({ sut, given, when, then }) => {
  await given('a repository with two scenarios with the ID "SCN-DEMO-001"', async () => {
    await sut.files.put("docs/reference/scenario-prefixes.md", DEMO_PREFIXES);
    await sut.files.put("modules/demo/features/a.feature", feature(scenarioText("SCN-DEMO-001", "planned")));
    await sut.files.put("modules/demo/features/b.feature", feature(scenarioText("SCN-DEMO-001", "planned")));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check SPEC"', async () => {
    run = await sut.cli(["check", "SPEC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "SPEC modules/demo/features/b.feature:5 duplicate ID SCN-DEMO-001"', async () => {
    expect(run.stdout).toContain("SPEC modules/demo/features/b.feature:5 duplicate ID SCN-DEMO-001");
  });
});
