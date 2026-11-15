import { FetchError, pinnedFolder } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committedSkill, fileUrl, folderOf } from "./source.ts";

const WRONG = "h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

scenario("SCN-FSOURCE-014", async ({ sut, given, when, then }) => {
  let commit = "";
  await given(
    'the folder "skills/review" is committed on the branch "main" of a Git repository at a "file://" URL',
    async () => {
      commit = await committedSkill(sut);
    },
  );

  let failure: unknown;
  await when(
    'a program fetches "git+<url>#main:skills/review" with a pin of the commit of "main" and the hash "h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="',
    async () => {
      const options = { cache: sut.files.path("$OUTPUT/cache"), pin: { commit, hash: WRONG } };
      failure = await pinnedFolder(folderOf(sut, "main", "skills/review"), options).catch((error: unknown) => error);
    },
  );

  await then(
    'the fetch fails with a FetchError "the folder skills/review of <url> at <commit> has the hash <hash>, not the hash h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= of its pin"',
    async () => {
      expect(failure).toBeInstanceOf(FetchError);
      expect((failure as FetchError).message).toMatch(
        new RegExp(
          `^the folder skills/review of ${fileUrl(sut)} at ${commit} has the hash h1:[A-Za-z0-9+/]{43}=, not the hash ${WRONG} of its pin$`,
        ),
      );
    },
  );
});
