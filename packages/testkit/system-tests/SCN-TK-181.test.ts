import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-181", async ({ sut, given, when, then }) => {
  await given(
    'a module whose system test puts "$INPUT/notes.md" with "one", links "$INPUT/docs/alias.md" to "../notes.md", puts "two" into "$INPUT/notes.md" and expects to read "two" from "$INPUT/docs/alias.md"',
    async () => {
      const module = demoModule({
        steps: [
          'Given the file "notes.md" and a link to it',
          "When the file changes",
          "Then the link reads the new text",
        ],
        test: [
          "await given('the file \"notes.md\" and a link to it', async () => {",
          '  await sut.files.put("$INPUT/notes.md", "one");',
          '  await sut.files.link("$INPUT/docs/alias.md", "../notes.md");',
          "});",
          "await when('the file changes', async () => {",
          '  await sut.files.put("$INPUT/notes.md", "two");',
          "});",
          "await then('the link reads the new text', async () => {",
          '  expect(await sut.files.read("$INPUT/docs/alias.md")).toBe("two");',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});
