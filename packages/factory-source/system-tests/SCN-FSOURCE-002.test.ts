import { type FactoryFolder, factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committed, fileUrl } from "./source.ts";

scenario("SCN-FSOURCE-002", async ({ sut, given, when, then }) => {
  let latest = "";
  await given(
    'a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL, tagged "v1"',
    async () => {
      await committed(sut);
      await sut.git.tag("v1");
    },
  );

  await given('"main" has a newer commit after "v1"', async () => {
    latest = await committed(sut, "name: newer\n");
  });

  let got: FactoryFolder;
  await when('a program fetches the source "git+<url>" with a cache folder', async () => {
    got = await factorySource(`git+${fileUrl(sut)}`, { cache: sut.files.path("$OUTPUT/cache") }).fetch();
  });

  await then('it gets the newer commit of "main", the remote\'s HEAD', async () => {
    expect(got.commit).toBe(latest);
    expect(await sut.files.read(`$OUTPUT/cache/${latest}/factory.yaml`)).toBe("name: newer\n");
  });
});
