import { packageVersion } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-014", async ({ sut, given, when, then }) => {
  await given('the file "$INPUT/package.json" with the version "1.4.2"', async () => {
    await sut.files.put("$INPUT/package.json", JSON.stringify({ name: "demo", version: "1.4.2" }));
  });

  let version: string;
  await when('the module reads the package version of "$INPUT/package.json"', async () => {
    version = packageVersion(sut.files.path("$INPUT/package.json"));
  });

  await then('it gets "1.4.2"', async () => {
    expect(version).toBe("1.4.2");
  });
});
