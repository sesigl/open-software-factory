import { type PinnedFolder, pinnedFolder } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committedSkill, folderOf, SKILL } from "./source.ts";

scenario("SCN-FSOURCE-013", async ({ sut, given, when, then }) => {
  const reference = folderOf(sut, "main", "skills/review");
  const cache = sut.files.path("$OUTPUT/cache");
  let pinned: PinnedFolder;
  await given(
    'the folder "skills/review" is committed on the branch "main" of a Git repository at a "file://" URL, and a program pinned "git+<url>#main:skills/review"',
    async () => {
      await committedSkill(sut);
      pinned = await pinnedFolder(reference, { cache });
    },
  );

  await given('"main" has a newer commit that changes "skills/review/SKILL.md"', async () => {
    await committedSkill(sut, `${SKILL}Then read it a third time.\n`);
  });

  let fetched: PinnedFolder[] = [];
  await when(
    "the program fetches the folder with its pin, and again with its pin after the repository was removed",
    async () => {
      // A cache of its own, so that the first fetch fetches the pinned commit and not the newer one of "main".
      const options = { cache: sut.files.path("$OUTPUT/pinned"), pin: { commit: pinned.commit, hash: pinned.hash } };
      const first = await pinnedFolder(reference, options);
      await sut.files.remove("$INPUT/.git");
      fetched = [first, await pinnedFolder(reference, options)];
    },
  );

  await then('both fetches give the pinned commit and the first text of "SKILL.md"', async () => {
    const folder = pinned.folder.replace(cache, sut.files.path("$OUTPUT/pinned"));
    expect(fetched).toEqual([
      { ...pinned, folder },
      { ...pinned, folder },
    ]);
    const below = folder.slice(sut.files.path("$OUTPUT").length + 1);
    expect(await sut.files.read(`$OUTPUT/${below}/SKILL.md`)).toBe(SKILL);
  });
});
