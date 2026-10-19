import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST, demoModule, junit } from "./repo.ts";

scenario("SCN-REPO-013", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  await given('a JUnit report in which the test of "SCN-DEMO-001" passed after 1 retry', async () => {
    const retried = '<properties><property name="retries" value="1"></property></properties>';
    await sut.files.put("reports/junit/demo.xml", junit([{ file: DEMO_TEST, id: "SCN-DEMO-001", body: retried }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check FLAKE"', async () => {
    run = await sut.cli(["check", "FLAKE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "FLAKE modules/demo/features/a.feature:5 SCN-DEMO-001 passed only after 1 retry"',
    async () => {
      expect(run.stdout).toContain("FLAKE modules/demo/features/a.feature:5 SCN-DEMO-001 passed only after 1 retry");
    },
  );
});
