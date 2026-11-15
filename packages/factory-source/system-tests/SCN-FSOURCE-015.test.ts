import { FetchError, pinnedFolder } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committedSkill, fileUrl, folderOf } from "./source.ts";

scenario("SCN-FSOURCE-015", async ({ sut, given, when, then }) => {
  let commit = "";
  await given(
    'the folder "skills/review" is committed on the branch "main" of a Git repository at a "file://" URL',
    async () => {
      commit = await committedSkill(sut);
    },
  );

  let failures: unknown[] = [];
  await when(
    'a program fetches "git+<url>#main", "git+<url>#main:../review", "git+<url>#main:/etc" and "git+<url>#main:skills/missing"',
    async () => {
      const references = [
        `git+${fileUrl(sut)}#main`,
        folderOf(sut, "main", "../review"),
        folderOf(sut, "main", "/etc"),
        folderOf(sut, "main", "skills/missing"),
      ];
      const cache = sut.files.path("$OUTPUT/cache");
      failures = await Promise.all(
        references.map((reference) => pinnedFolder(reference, { cache }).catch((error: unknown) => error)),
      );
    },
  );

  await then(
    'the fetches fail with the FetchErrors "is no git+<url>#<ref>:<path>", "names a folder outside its repository" twice and "the commit <commit> of <url> has no folder skills/missing"',
    async () => {
      for (const failure of failures) expect(failure).toBeInstanceOf(FetchError);
      expect(failures.map((failure) => (failure as FetchError).message)).toEqual([
        `"git+${fileUrl(sut)}#main" is no git+<url>#<ref>:<path>`,
        `"${folderOf(sut, "main", "../review")}" names a folder outside its repository`,
        `"${folderOf(sut, "main", "/etc")}" names a folder outside its repository`,
        `the commit ${commit} of ${fileUrl(sut)} has no folder skills/missing`,
      ]);
    },
  );
});
