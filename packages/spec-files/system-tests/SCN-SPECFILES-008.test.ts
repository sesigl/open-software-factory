import { readJUnitFolder, type TestCase } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

const report = (name: string) =>
  `<testsuites><testsuite name="demo"><testcase name="${name}"/></testsuite></testsuites>`;

scenario("SCN-SPECFILES-008", async ({ sut, given, when, then }) => {
  await given(
    'the folder "$INPUT/junit" with "b.xml" holding the test case "second", "a.xml" holding "first" and "notes.txt"',
    async () => {
      await sut.files.put("$INPUT/junit/b.xml", report("second"));
      await sut.files.put("$INPUT/junit/a.xml", report("first"));
      await sut.files.put("$INPUT/junit/notes.txt", report("not a report"));
    },
  );

  let tests: TestCase[] | undefined;
  await when("the module reads the folder", async () => {
    tests = readJUnitFolder(sut.files.path("$INPUT/junit"));
  });

  await then('it gets the test cases "first" and "second" in this order', async () => {
    expect(tests?.map((test) => test.name)).toEqual(["first", "second"]);
  });
});
