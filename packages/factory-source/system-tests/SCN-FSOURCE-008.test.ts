import { FetchError, factorySource } from "@opensoftware/factory-source";
import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { INFO_REFS, privateForge, TOKEN, texts } from "./source.ts";

scenario("SCN-FSOURCE-008", async ({ sut, fakes, given, when, then }) => {
  let forge: FakeHttp;
  await given('a forge over HTTP whose repository "/acme/factory.git" asks for credentials', async () => {
    forge = await privateForge(fakes);
  });

  let failure: unknown;
  await when(
    'a program fetches the source "git+<url>/acme/factory.git#main" with a cache folder and the token "factory-token-0001"',
    async () => {
      failure = await factorySource(`git+${forge.url}/acme/factory.git#main`, {
        cache: sut.files.path("$OUTPUT/cache"),
        token: TOKEN,
      })
        .fetch()
        .catch((error: unknown) => error);
    },
  );

  await then(
    'the forge received "Authorization: Basic" with the base64 of "x-access-token:factory-token-0001"',
    async () => {
      const basic = `Basic ${Buffer.from("x-access-token:factory-token-0001").toString("base64")}`;
      expect(forge.headers().map(({ path, headers }) => [path, headers.authorization])).toEqual([[INFO_REFS, basic]]);
    },
  );

  await then("the fetch fails with a FetchError that names the URL and not the token", async () => {
    expect(failure).toBeInstanceOf(FetchError);
    const { message } = failure as FetchError;
    expect(message).toMatch(new RegExp(`^cannot fetch main of ${forge.url}/acme/factory.git: \\S`));
    expect(message).not.toContain(TOKEN);
  });

  await then("no file below the cache folder holds the token", async () => {
    const basic = Buffer.from(`x-access-token:${TOKEN}`).toString("base64");
    const all = await texts(sut, "cache");
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((text) => text.includes(TOKEN) || text.includes(basic))).toEqual([]);
  });
});
