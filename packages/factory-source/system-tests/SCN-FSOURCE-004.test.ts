import { type FactoryFolder, factorySource } from "@opensoftware/factory-source";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-FSOURCE-004", async ({ sut, given, when, then }) => {
  await given('the file "git+factory/hello.yaml" that is not committed', async () => {
    await sut.files.put("$INPUT/git+factory/hello.yaml", "name: hello\n");
  });

  let got: FactoryFolder;
  await when('a program fetches the source "<path of git+factory/hello.yaml>" with a cache folder', async () => {
    got = await factorySource(sut.files.path("$INPUT/git+factory/hello.yaml"), {
      cache: sut.files.path("$OUTPUT/cache"),
    }).fetch();
  });

  await then('it gets the folder "git+factory", the file "git+factory/hello.yaml" and no commit', async () => {
    expect(got).toEqual({
      folder: sut.files.path("$INPUT/git+factory"),
      file: sut.files.path("$INPUT/git+factory/hello.yaml"),
    });
  });

  await then("the cache folder holds nothing", async () => {
    expect(await sut.files.list("$OUTPUT")).toEqual([]);
  });
});
