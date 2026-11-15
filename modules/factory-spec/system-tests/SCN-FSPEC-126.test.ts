import { scenario } from "@opensoftware/testkit";
import { committedReview, entryAt, NEWER, putEntries, REVIEW } from "./remote.ts";

scenario("SCN-FSPEC-126", async ({ sut, given, when, then }) => {
  await given(
    'the skill "review" is committed in "shared/review" on the branch "main" of a Git repository at a "file://" URL',
    async () => {
      await committedReview(sut);
    },
  );

  await given(
    'a factory.yaml whose agent "triage" has the skill "git+<url>#main:shared/review", which "factory plan" pinned',
    async () => {
      await putEntries(sut, [entryAt(sut, "main")]);
      const plan = await sut.cli(["plan"]);
      expect(plan.exitCode, plan.stdout + plan.stderr).toBe(0);
    },
  );

  await given('"main" has a newer commit of "shared/review/SKILL.md"', async () => {
    await committedReview(sut, NEWER);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the factory engineer runs "factory render"', async () => {
    run = await sut.cli(["render"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('".claude/skills/review/SKILL.md" in the output folder is the text of the pinned commit', async () => {
    expect(await sut.files.read("$OUTPUT/.claude/skills/review/SKILL.md")).toBe(REVIEW);
  });
});
