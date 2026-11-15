import { type FactoryFolder, factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";
import { committed, FACTORY, fileUrl } from "./source.ts";

scenario("SCN-FSOURCE-005", async ({ sut, given, when, then }) => {
  await given('a "factory.yaml" is committed on the branch "main" of a Git repository at a "file://" URL', async () => {
    await committed(sut);
  });

  const source = factorySource(`git+${fileUrl(sut)}#main`, { cache: sut.files.path("$OUTPUT/cache") });
  let first: FactoryFolder;
  await given('a program fetched the source "git+<url>#main" with a cache folder', async () => {
    first = await source.fetch();
  });

  let second: FactoryFolder;
  let commit = "";
  await when(
    '"factory.yaml" changes in a new commit on "main" and the program fetches the same source again',
    async () => {
      commit = await committed(sut, "name: hello\ndescription: the second commit\n");
      second = await source.fetch();
    },
  );

  await then("it gets the new commit and its folder with the new text", async () => {
    expect(second.commit).toBe(commit);
    expect(second.commit).not.toBe(first.commit);
    expect(second.folder).toBe(sut.files.path(`$OUTPUT/cache/${commit}`));
    expect(await sut.files.read(`$OUTPUT/cache/${commit}/factory.yaml`)).toBe(
      "name: hello\ndescription: the second commit\n",
    );
  });

  await then("the folder of the first commit still holds the first text", async () => {
    expect(await sut.files.read(`$OUTPUT/cache/${first.commit}/factory.yaml`)).toBe(FACTORY);
  });
});
