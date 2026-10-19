import { scenario } from "@opensoftware/testkit";
import { DEMO_README, demoModule } from "./repo.ts";

scenario("SCN-REPO-016", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(`$INPUT/${path}`, content);
  });

  await given("the module README lists no scenarios under its generated marker", async () => {
    await sut.files.put("$INPUT/modules/demo/README.md", DEMO_README);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check DOCS-GEN"', async () => {
    run = await sut.cli(["check", "DOCS-GEN"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "DOCS-GEN modules/demo/README.md"', async () => {
    expect(run.stdout).toContain("DOCS-GEN modules/demo/README.md");
  });
});
