import { scenario } from "@opensoftware/testkit";
import { nestedCheckouts, putAll } from "./repo.ts";

const GUIDE = "# Guide\n\nRead [the missing page](missing.md) first.\n";

scenario("SCN-REPO-160", async ({ sut, given, when, then }) => {
  await given('a repository with the doc "docs/guide.md" that links "missing.md"', async () => {
    await sut.files.put("$INPUT/docs/guide.md", GUIDE);
  });

  await given(
    'the same doc in the worktree ".claude/worktrees/other" (a ".git" file) and the clone "vendor/clone" (a ".git" folder)',
    async () => {
      await putAll(sut, nestedCheckouts({ "docs/guide.md": GUIDE }));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  /** The findings of the run: one line per file and line. */
  const findings = (): string[] => run.stdout.split("\n").filter((line) => /^DOCS-LINKS \S+:\d+ /.test(line));
  const onlyTheGuide = [expect.stringMatching(/^DOCS-LINKS docs\/guide\.md:3 /)];

  await when('the developer runs "osf check DOCS-LINKS"', async () => {
    run = await sut.cli(["check", "DOCS-LINKS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output names "docs/guide.md" and nothing in the worktree or the clone', async () => {
    expect(findings(), run.stdout + run.stderr).toEqual(onlyTheGuide);
  });

  await when('the developer runs "osf check DOCS-LINKS" in the folder after removing its ".git"', async () => {
    await sut.files.remove("$INPUT/.git");
    run = await sut.cli(["check", "DOCS-LINKS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output names "docs/guide.md" and nothing in the worktree or the clone', async () => {
    expect(findings(), run.stdout + run.stderr).toEqual(onlyTheGuide);
  });
});
