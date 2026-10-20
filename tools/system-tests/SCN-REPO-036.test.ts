import { scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-036", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"', async () => {
    await sut.files.put("$INPUT/docs/how-to/demo.md", "---\ncovers: [modules/demo/**]\n---\n\n# Use demo\n");
    await sut.files.put("$INPUT/modules/demo/package.json", '{\n  "name": "demo",\n  "version": "0.1.0"\n}\n');
    base = await sut.git.commit("base");
  });

  await given(
    'a change that adds "modules/demo/CHANGELOG.md" and sets "version" in "modules/demo/package.json" to "0.2.0"',
    async () => {
      await sut.files.put("$INPUT/modules/demo/CHANGELOG.md", "# Changelog\n\n## 0.2.0\n");
      await sut.files.put("$INPUT/modules/demo/package.json", '{\n  "name": "demo",\n  "version": "0.2.0"\n}\n');
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf docs-affected" against the base commit', async () => {
    run = await sut.cli(["docs-affected"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode).toBe(0);
  });
});
