import { type FactoryFolder, factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committed, FACTORY, fileUrl } from "./source.ts";

scenario("SCN-FSOURCE-001", async ({ sut, given, when, then }) => {
  let commit = "";
  await given('a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL', async () => {
    commit = await committed(sut);
  });

  let got: FactoryFolder;
  await when('a program fetches the source "git+<url>#main" with a cache folder', async () => {
    got = await factorySource(`git+${fileUrl(sut)}#main`, { cache: sut.files.path("$OUTPUT/cache") }).fetch();
  });

  await then(
    'it gets the commit of "main", the folder "<cache>/<commit>" and its "factory.yaml" with its text',
    async () => {
      expect(commit).toMatch(/^[0-9a-f]{40}$/);
      const folder = sut.files.path(`$OUTPUT/cache/${commit}`);
      expect(got).toEqual({ commit, folder, file: `${folder}/factory.yaml` });
      expect(await sut.files.read(`$OUTPUT/cache/${commit}/factory.yaml`)).toBe(FACTORY);
    },
  );
});
