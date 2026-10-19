import { scenario } from "@opensoftware/testkit";
import { DEMO_FEATURE, demoModule, feature, scenarioText } from "./repo.ts";

scenario("SCN-REPO-007", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the implemented scenario "SCN-DEMO-001"', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
    await sut.files.put(".github/CODEOWNERS", "**/features/ @maintainer\n");
    base = await sut.git.commit("base");
  });

  await given('a change to the text of its "Then" step', async () => {
    await sut.files.put(DEMO_FEATURE, feature(scenarioText("SCN-DEMO-001", "implemented", "the command exits")));
  });

  await given("no approval from a code owner", async () => {
    await sut.files.put("reviews.json", "[]\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check SPECGUARD" against the base commit', async () => {
    run = await sut.cli(["check", "SPECGUARD"], { env: { OSF_BASE: base, OSF_APPROVALS: "reviews.json" } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "SPECGUARD modules/demo/features/a.feature:5 SCN-DEMO-001 changed its steps"',
    async () => {
      expect(run.stdout).toContain("SPECGUARD modules/demo/features/a.feature:5 SCN-DEMO-001 changed its steps");
    },
  );

  await then('the output contains "@maintainer"', async () => {
    expect(run.stdout).toContain("@maintainer");
  });
});
