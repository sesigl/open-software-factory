import { type CliResult, scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SKUBE-011", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given("a sandbox created from a spec with the test template", async () => {
      id = await box.create({ template: TEMPLATE });
    });

    await given('the file "$INPUT/notes.md" with the text "draft"', async () => {
      await sut.files.put("$INPUT/notes.md", "draft");
    });

    let run: CliResult;
    await when('the client copies "notes.md" to the sandbox\'s "notes.md"', async () => {
      run = await box.cli(["copy", "notes.md", `${id}:notes.md`]);
    });

    await then('copy exits with code 0 and prints "copied notes.md to <ID>:notes.md"', async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(run.stdout).toBe(`copied notes.md to ${id}:notes.md\n`);
    });
  } finally {
    await box.destroyAll();
  }
});
