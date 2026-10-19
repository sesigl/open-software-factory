import { scenario } from "@osf/testkit";

scenario("SCN-REPO-017", async ({ sut, given, when, then }) => {
  await given('a repository with the doc "docs/guide.md" that links "missing.md"', async () => {
    await sut.files.put("docs/guide.md", "# Guide\n\nRead [the missing page](missing.md) first.\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check DOCS-LINKS"', async () => {
    run = await sut.cli(["check", "DOCS-LINKS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "DOCS-LINKS docs/guide.md:3"', async () => {
    expect(run.stdout).toContain("DOCS-LINKS docs/guide.md:3");
  });
});
