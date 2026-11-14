import { scenario } from "@opensoftware/testkit";
import { demoModule, feature, nestedCheckouts, putAll, scenarioText } from "./repo.ts";

scenario("SCN-REPO-161", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    await putAll(sut, demoModule());
  });

  await given(
    'the scenario "SCN-DEMO-007" in the worktree ".claude/worktrees/other" (a ".git" file) and the clone "vendor/clone" (a ".git" folder)',
    async () => {
      await putAll(
        sut,
        nestedCheckouts({ "modules/demo/features/b.feature": feature(scenarioText("SCN-DEMO-007", "planned")) }),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf next-id DEMO"', async () => {
    run = await sut.cli(["next-id", "DEMO"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output is "SCN-DEMO-002"', async () => {
    expect(run.stdout).toBe("SCN-DEMO-002\n");
  });
});
