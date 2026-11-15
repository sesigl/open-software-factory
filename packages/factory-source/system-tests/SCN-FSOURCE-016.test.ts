import { FetchError, pinnedFolder } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committedSkill, fileUrl, folderOf } from "./source.ts";

scenario("SCN-FSOURCE-016", async ({ sut, given, when, then }) => {
  await given(
    'the folder "skills/review" is committed on the branch "main" of a Git repository at a "file://" URL',
    async () => {
      await committedSkill(sut);
    },
  );

  let commit = "";
  await given(
    'the commit also holds the links "skills/out" to "/etc", "linked" to "skills" and "skills/review/notes.md" to "/etc/hostname"',
    async () => {
      await sut.files.link("$INPUT/skills/out", "/etc");
      await sut.files.link("$INPUT/linked", "skills");
      await sut.files.link("$INPUT/skills/review/notes.md", "/etc/hostname");
      commit = await sut.git.commit("links that lead out of the repository");
    },
  );

  let failures: unknown[] = [];
  await when(
    'a program fetches "git+<url>#main:skills/out", "git+<url>#main:linked/review" and "git+<url>#main:skills/review"',
    async () => {
      const cache = sut.files.path("$OUTPUT/cache");
      const folders = ["skills/out", "linked/review", "skills/review"];
      failures = await Promise.all(
        folders.map((folder) =>
          pinnedFolder(folderOf(sut, "main", folder), { cache }).catch((error: unknown) => error),
        ),
      );
    },
  );

  await then(
    'the fetches fail with the FetchErrors "the commit <commit> of <url> has the symbolic link" "skills/out at skills/out", "linked at linked/review" and "skills/review/notes.md at skills/review"',
    async () => {
      for (const failure of failures) expect(failure).toBeInstanceOf(FetchError);
      const start = `the commit ${commit} of ${fileUrl(sut)} has the symbolic link`;
      expect(failures.map((failure) => (failure as FetchError).message)).toEqual([
        `${start} skills/out at skills/out`,
        `${start} linked at linked/review`,
        `${start} skills/review/notes.md at skills/review`,
      ]);
    },
  );
});
