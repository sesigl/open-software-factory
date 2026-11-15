import { FetchError, factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committed, fileUrl } from "./source.ts";

scenario("SCN-FSOURCE-003", async ({ sut, given, when, then }) => {
  await given('a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL', async () => {
    await committed(sut);
  });

  let failure: unknown;
  await when('a program fetches the source "git+<url>#no-such-branch" with a cache folder', async () => {
    failure = await factorySource(`git+${fileUrl(sut)}#no-such-branch`, { cache: sut.files.path("$OUTPUT/cache") })
      .fetch()
      .catch((error: unknown) => error);
  });

  await then(
    'the fetch fails with a FetchError "cannot fetch no-such-branch of file://<path>: " and Git\'s message "couldn\'t find remote ref no-such-branch"',
    async () => {
      expect(failure).toBeInstanceOf(FetchError);
      const { name, message } = failure as FetchError;
      expect(name).toBe("FetchError");
      expect(message).toMatch(
        new RegExp(`^cannot fetch no-such-branch of ${fileUrl(sut)}: \\S.*couldn't find remote ref no-such-branch$`),
      );
    },
  );
});
