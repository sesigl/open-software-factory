import { type FactoryFolder, factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-FSOURCE-004", async ({ sut, given, when, then }) => {
  await given('the file "factory/hello.yaml" that is not committed', async () => {
    await sut.files.put("$INPUT/factory/hello.yaml", "name: hello\n");
  });

  let got: FactoryFolder;
  await when('a program fetches the source "<path of factory/hello.yaml>" with a cache folder', async () => {
    got = await factorySource(sut.files.path("$INPUT/factory/hello.yaml"), {
      cache: sut.files.path("$OUTPUT/cache"),
    }).fetch();
  });

  await then('it gets the folder "factory", the file "factory/hello.yaml" and no commit', async () => {
    expect(got).toEqual({
      folder: sut.files.path("$INPUT/factory"),
      file: sut.files.path("$INPUT/factory/hello.yaml"),
    });
  });

  await then("the cache folder holds nothing", async () => {
    expect(await sut.files.list("$OUTPUT")).toEqual([]);
  });
});
