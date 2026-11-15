import { FetchError, factorySource } from "@opensoftware/factory-source";
import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { privateForge } from "./source.ts";

scenario("SCN-FSOURCE-011", async ({ sut, fakes, given, when, then }) => {
  let forge: FakeHttp;
  await given('a forge over HTTP whose repository "/acme/factory.git" asks for credentials', async () => {
    forge = await privateForge(fakes);
  });

  let failure: unknown;
  let host = "";
  await when(
    'a program fetches the source "git+http://ada:url-password-0002@<host>/acme/factory.git#main" with a cache folder',
    async () => {
      host = new URL(forge.url).host;
      failure = await factorySource(`git+http://ada:url-password-0002@${host}/acme/factory.git#main`, {
        cache: sut.files.path("$OUTPUT/cache"),
      })
        .fetch()
        .catch((error: unknown) => error);
    },
  );

  await then('the fetch fails with a FetchError "cannot fetch main of http://<host>/acme/factory.git: "', async () => {
    expect(forge.headers()).not.toHaveLength(0);
    expect(failure).toBeInstanceOf(FetchError);
    expect((failure as FetchError).message).toMatch(
      new RegExp(`^cannot fetch main of http://${host}/acme/factory.git: \\S`),
    );
  });

  await then('the message does not contain "ada" or "url-password-0002"', async () => {
    expect(forge.headers()).not.toHaveLength(0);
    expect((failure as FetchError).message).not.toMatch(/ada|url-password-0002/);
  });
});
