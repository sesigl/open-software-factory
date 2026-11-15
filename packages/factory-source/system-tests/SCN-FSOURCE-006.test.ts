import { factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committed, fileUrl } from "./source.ts";

scenario("SCN-FSOURCE-006", async ({ sut, given, when, then }) => {
  let commit = "";
  await given('a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL', async () => {
    commit = await committed(sut);
  });

  await given('the cache folder holds "<commit>.partial/stale.txt", as a fetch that stopped leaves it', async () => {
    await sut.files.put(`$OUTPUT/cache/${commit}.partial/stale.txt`, "half written\n");
  });

  await when('a program fetches the source "git+<url>#main" with that cache folder', async () => {
    await factorySource(`git+${fileUrl(sut)}#main`, { cache: sut.files.path("$OUTPUT/cache") }).fetch();
  });

  await then('the folder "<cache>/<commit>" holds "factory.yaml" and no "stale.txt"', async () => {
    expect(await sut.files.list(`$OUTPUT/cache/${commit}`)).toEqual(["factory.yaml"]);
  });

  await then('the cache folder holds no "<commit>.partial"', async () => {
    const files = await sut.files.list("$OUTPUT/cache");
    expect(files.filter((file) => file.startsWith(`${commit}.partial`))).toEqual([]);
  });
});
