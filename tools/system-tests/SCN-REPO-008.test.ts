import { scenario } from "@osf/testkit";

scenario("SCN-REPO-008", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/src/**"', async () => {
    await sut.files.put("docs/how-to/demo.md", "---\ncovers: [modules/demo/src/**]\n---\n\n# Use demo\n");
    await sut.files.put("modules/demo/src/run.ts", "export const run = () => 0;\n");
    base = await sut.git.commit("base");
  });

  await given('a change to "modules/demo/src/run.ts"', async () => {
    await sut.files.put("modules/demo/src/run.ts", "export const run = () => 1;\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf docs-affected" against the base commit', async () => {
    run = await sut.cli(["docs-affected"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "DOCS-AFFECTED docs/how-to/demo.md:1"', async () => {
    expect(run.stdout).toContain("DOCS-AFFECTED docs/how-to/demo.md:1");
  });
});
