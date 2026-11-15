import { FetchError, factorySource } from "@opensoftware/factory-source";
import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { INFO_REFS, privateForge } from "./source.ts";

scenario("SCN-FSOURCE-009", async ({ sut, fakes, given, when, then }) => {
  let forge: FakeHttp;
  await given('a forge over HTTP whose repository "/acme/factory.git" asks for credentials', async () => {
    forge = await privateForge(fakes);
  });

  let failure: unknown;
  await when(
    'a program fetches the source "git+<url>/acme/factory.git#main" with a cache folder and no token',
    async () => {
      failure = await factorySource(`git+${forge.url}/acme/factory.git#main`, {
        cache: sut.files.path("$OUTPUT/cache"),
      })
        .fetch()
        .catch((error: unknown) => error);
    },
  );

  await then("the forge received one request without credentials", async () => {
    expect(forge.headers().map(({ path, headers }) => [path, headers.authorization])).toEqual([[INFO_REFS, undefined]]);
  });

  await then(
    'the fetch fails at once with a FetchError "cannot fetch main of <url>/acme/factory.git: " and Git\'s "terminal prompts disabled"',
    async () => {
      expect(failure).toBeInstanceOf(FetchError);
      expect((failure as FetchError).message).toMatch(
        new RegExp(`^cannot fetch main of ${forge.url}/acme/factory.git: \\S.*terminal prompts disabled`),
      );
    },
  );
});
