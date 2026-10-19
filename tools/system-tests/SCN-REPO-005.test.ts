import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST, demoModule, junit } from "./repo.ts";

scenario("SCN-REPO-005", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  await given('a JUnit report in which the test of "SCN-DEMO-001" was skipped', async () => {
    await sut.files.put("reports/junit/demo.xml", junit([{ file: DEMO_TEST, id: "SCN-DEMO-001", body: "<skipped/>" }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check PASS"', async () => {
    run = await sut.cli(["check", "PASS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "PASS modules/demo/features/a.feature:5 SCN-DEMO-001 was skipped"', async () => {
    expect(run.stdout).toContain("PASS modules/demo/features/a.feature:5 SCN-DEMO-001 was skipped");
  });
});
