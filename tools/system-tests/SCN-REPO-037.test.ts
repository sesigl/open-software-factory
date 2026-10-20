import { scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-037", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"', async () => {
    await sut.files.put("$INPUT/docs/how-to/demo.md", "---\ncovers: [modules/demo/**]\n---\n\n# Use demo\n");
    await sut.files.put("$INPUT/modules/demo/package.json", '{\n  "name": "demo",\n  "version": "0.1.0"\n}\n');
    base = await sut.git.commit("base");
  });

  await given(
    'a change that sets "version" to "0.2.0" and adds the dependency "yaml" in "modules/demo/package.json"',
    async () => {
      await sut.files.put(
        "$INPUT/modules/demo/package.json",
        '{\n  "name": "demo",\n  "version": "0.2.0",\n  "dependencies": { "yaml": "2.8.1" }\n}\n',
      );
    },
  );

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
