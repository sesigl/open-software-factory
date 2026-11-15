import { type PinnedFolder, pinnedFolder } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committedSkill, folderOf, SKILL } from "./source.ts";

const CHECKLIST = "- the plan names its tests\n";
/** The hash of SKILL and CHECKLIST as dirhash.Hash1 of golang.org/x/mod 0.20.0 computes it. */
const HASH = "h1:GF3L2eJrB9ZeU8kQQpkC/U0faN1fMnBU03+KneHC8os=";

scenario("SCN-FSOURCE-012", async ({ sut, given, when, then }) => {
  let commit = "";
  await given(
    'the folder "skills/review" with "SKILL.md" and "notes/checklist.md" is committed on the branch "main" of a Git repository at a "file://" URL',
    async () => {
      commit = await committedSkill(sut, SKILL, { "notes/checklist.md": CHECKLIST });
    },
  );

  let got: PinnedFolder;
  await when('a program fetches the folder "git+<url>#main:skills/review" with a cache folder and no pin', async () => {
    got = await pinnedFolder(folderOf(sut, "main", "skills/review"), { cache: sut.files.path("$OUTPUT/cache") });
  });

  await then(
    'it gets the commit of "main" and the folder "skills/review" of that commit below the cache folder, with both files',
    async () => {
      expect(commit).toMatch(/^[0-9a-f]{40}$/);
      expect(got.commit).toBe(commit);
      expect(got.folder).toMatch(
        new RegExp(`^${sut.files.path("$OUTPUT/cache")}/[0-9a-f]{16}/${commit}/skills/review$`),
      );
      const below = got.folder.slice(sut.files.path("$OUTPUT").length + 1);
      expect((await sut.files.list(`$OUTPUT/${below}`)).sort()).toEqual(["SKILL.md", "notes/checklist.md"]);
      expect(await sut.files.read(`$OUTPUT/${below}/SKILL.md`)).toBe(SKILL);
    },
  );

  await then(
    'the hash "h1:" with the base64 of the SHA-256 of one line "<SHA-256 of the file>  <path>" per file, sorted by path',
    async () => {
      expect(got.hash).toBe(HASH);
    },
  );
});
