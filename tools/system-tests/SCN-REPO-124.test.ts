import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./repo.ts";

/** The demo module in a workspace, with its system tests run by Vitest directly. */
const UNTIMED_PACKAGE = `${JSON.stringify(
  { name: "@opensoftware/demo", version: "0.1.0", type: "module", scripts: { "test:system": "vitest run" } },
  null,
  2,
)}\n`;

scenario("SCN-REPO-124", async ({ sut, given, when, then }) => {
  await given('a repository whose module "demo" has system tests and runs them with "vitest run"', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(`$INPUT/${path}`, content);
    await sut.files.put("$INPUT/pnpm-workspace.yaml", "packages:\n  - modules/*\n");
    await sut.files.put("$INPUT/modules/demo/package.json", UNTIMED_PACKAGE);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BUDGET"', async () => {
    run = await sut.cli(["check", "BUDGET"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "BUDGET modules/demo/package.json" and "testkit timed"', async () => {
    expect(run.stdout).toContain("BUDGET modules/demo/package.json");
    expect(run.stdout).toContain("testkit timed");
  });
});
