import { scenario } from "@opensoftware/testkit";
import { DEMO_PREFIXES, feature, scenarioText } from "./repo.ts";

scenario("SCN-REPO-003", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and no system test', async () => {
    await sut.files.put("$INPUT/docs/reference/scenario-prefixes.md", DEMO_PREFIXES);
    await sut.files.put("$INPUT/modules/demo/features/a.feature", feature(scenarioText("SCN-DEMO-001", "implemented")));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check TRACE"', async () => {
    run = await sut.cli(["check", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "TRACE modules/demo/features/a.feature:5 SCN-DEMO-001 is implemented but has no system test"',
    async () => {
      expect(run.stdout).toContain(
        "TRACE modules/demo/features/a.feature:5 SCN-DEMO-001 is implemented but has no system test",
      );
    },
  );
});
