import { scenario } from "@opensoftware/testkit";
import { committedReview, entryAt, lockOf, NEWER, putEntries } from "./remote.ts";

scenario("SCN-FSPEC-121", async ({ sut, given, when, then }) => {
  let first = "";
  await given(
    'the skill "review" is committed in "shared/review" of a Git repository at a "file://" URL and tagged "v1"',
    async () => {
      first = await committedReview(sut);
      await sut.git.tag("v1");
    },
  );

  await given(
    'a factory.yaml whose agent "triage" has the skill "git+<url>#v1:shared/review", which "factory plan" pinned',
    async () => {
      await putEntries(sut, [entryAt(sut, "v1")]);
      const plan = await sut.cli(["plan"]);
      expect(plan.exitCode, plan.stdout + plan.stderr).toBe(0);
    },
  );

  let second = "";
  await given('a newer commit of "shared/review/SKILL.md" is tagged "v2"', async () => {
    second = await committedReview(sut, NEWER);
    await sut.git.tag("v2");
  });

  let again: Awaited<ReturnType<typeof sut.cli>>;
  let kept = "";
  let moved: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the factory engineer runs "factory plan" again, and then once more with the entry "git+<url>#v2:shared/review"',
    async () => {
      again = await sut.cli(["plan"]);
      kept = (await lockOf(sut)).skills?.review?.commit ?? "";
      await putEntries(sut, [entryAt(sut, "v2")]);
      moved = await sut.cli(["plan"]);
    },
  );

  await then(
    'the first run names no change of factory.lock, and factory.lock still pins the commit of "v1"',
    async () => {
      expect(again.exitCode, again.stdout + again.stderr).toBe(0);
      expect(again.stdout).not.toContain("factory.lock");
      expect(kept).toBe(first);
    },
  );

  await then(
    'the second run\'s output contains "~ factory.lock.skills.review.commit: \\"<commit of v1>\\" -> \\"<commit of v2>\\""',
    async () => {
      expect(moved.exitCode, moved.stdout + moved.stderr).toBe(0);
      expect(second).not.toBe(first);
      expect(moved.stdout).toContain(`~ factory.lock.skills.review.commit: "${first}" -> "${second}"\n`);
    },
  );

  await then('factory.lock pins the commit of "v2"', async () => {
    expect((await lockOf(sut)).skills?.review).toEqual(
      expect.objectContaining({ source: entryAt(sut, "v2"), commit: second }),
    );
  });
});
