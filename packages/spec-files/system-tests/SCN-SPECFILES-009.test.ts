import { readJUnitFolder, type TestCase } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-009", async ({ sut, given, when, then }) => {
  await given('the folder "$INPUT/junit" with only "notes.txt"', async () => {
    await sut.files.put("$INPUT/junit/notes.txt", "notes");
  });

  let results: (TestCase[] | undefined)[];
  await when('the module reads the folder and the missing folder "$INPUT/none"', async () => {
    results = [readJUnitFolder(sut.files.path("$INPUT/junit")), readJUnitFolder(sut.files.path("$INPUT/none"))];
  });

  await then("it gets undefined for both", async () => {
    expect(results).toEqual([undefined, undefined]);
  });
});
