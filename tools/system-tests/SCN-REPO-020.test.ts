import { scenario } from "@osf/testkit";
import { DEMO_TEST, demoModule, junit } from "./repo.ts";

scenario("SCN-REPO-020", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  await given('a JUnit report in which the test of "SCN-DEMO-001" passed', async () => {
    await sut.files.put("reports/junit/demo.xml", junit([{ file: DEMO_TEST, id: "SCN-DEMO-001" }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check --all" without OSF_BASE', async () => {
    run = await sut.cli(["check", "--all"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "SPECGUARD skipped: OSF_BASE is not set"', async () => {
    expect(run.stdout).toContain("SPECGUARD skipped: OSF_BASE is not set");
  });

  await then('the output contains "DOCS-AFFECTED skipped: OSF_BASE is not set"', async () => {
    expect(run.stdout).toContain("DOCS-AFFECTED skipped: OSF_BASE is not set");
  });
});
