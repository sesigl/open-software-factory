import { FetchError, factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { fileUrl } from "./source.ts";

scenario("SCN-FSOURCE-010", async ({ sut, given, when, then }) => {
  await given('a Git repository at a "file://" URL without a commit', async () => {
    // $INPUT is a Git repository from the start, and nothing is committed in it.
  });

  let failure: unknown;
  await when('a program fetches the source "git+<url>" with a cache folder', async () => {
    failure = await factorySource(`git+${fileUrl(sut)}`, { cache: sut.files.path("$OUTPUT/cache") })
      .fetch()
      .catch((error: unknown) => error);
  });

  await then(
    'the fetch fails with a FetchError "cannot fetch HEAD of file://<path>: " and Git\'s message "couldn\'t find remote ref HEAD"',
    async () => {
      expect(failure).toBeInstanceOf(FetchError);
      expect((failure as FetchError).message).toMatch(
        new RegExp(`^cannot fetch HEAD of ${fileUrl(sut)}: \\S.*couldn't find remote ref HEAD$`),
      );
    },
  );
});
