import { scenario } from "@opensoftware/testkit";
import { sandboxes, TEMPLATE } from "./sandbox.ts";

scenario("SCN-SANDBOX-012", async ({ sut, given, when, then }) => {
  const box = sandboxes(sut);
  try {
    let id = "";
    await given("a sandbox created from a spec with the test template", async () => {
      id = await box.create({ template: TEMPLATE });
    });

    await given('the file "$INPUT/notes.md" with the text "draft"', async () => {
      await sut.files.put("$INPUT/notes.md", "draft");
    });

    let run: Awaited<ReturnType<typeof sut.cli>>;
    await when('the client copies "notes.md" to the sandbox\'s "notes.md" and runs "cat notes.md" in it', async () => {
      const copied = await box.cli(["copy", "notes.md", `${id}:notes.md`]);
      expect(copied.exitCode, copied.stderr).toBe(0);
      run = await box.cli(["exec", id, "--", "cat", "notes.md"]);
    });

    await then('the command prints "draft"', async () => {
      expect(run.stdout, run.stderr).toBe("draft");
    });
  } finally {
    await box.destroyAll();
  }
});
