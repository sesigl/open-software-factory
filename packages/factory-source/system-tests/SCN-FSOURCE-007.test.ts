import { type FactoryFolder, factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committed, FACTORY, fileUrl } from "./source.ts";

scenario("SCN-FSOURCE-007", async ({ sut, given, when, then }) => {
  let commit = "";
  await given('a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL', async () => {
    commit = await committed(sut);
  });

  let got: PromiseSettledResult<FactoryFolder>[];
  await when('a program starts two fetches of the source "git+<url>#main" with one cache folder at once', async () => {
    const source = factorySource(`git+${fileUrl(sut)}#main`, { cache: sut.files.path("$OUTPUT/cache") });
    got = await Promise.allSettled([source.fetch(), source.fetch()]);
  });

  await then('both give the commit of "main" and the folder "<cache>/<commit>" with its "factory.yaml"', async () => {
    const folder = sut.files.path(`$OUTPUT/cache/${commit}`);
    const value = { commit, folder, file: `${folder}/factory.yaml` };
    expect(got).toEqual([
      { status: "fulfilled", value },
      { status: "fulfilled", value },
    ]);
    expect(await sut.files.read(`$OUTPUT/cache/${commit}/factory.yaml`)).toBe(FACTORY);
  });
});
